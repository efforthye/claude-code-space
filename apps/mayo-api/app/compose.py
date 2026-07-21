"""Simple server-side video editor — render an edit spec into a new film.

The app builds an edit (ordered library clips, each optionally trimmed); this
trims each source with ffmpeg, concatenates them, stores the result, and files a
new Library video. On-device editing isn't feasible in Expo Go, so the heavy
lifting runs here (same ffmpeg the worker uses to stitch scenes).
"""

from __future__ import annotations

import asyncio
import os
import subprocess
import tempfile
import time
from typing import Optional

from .config import settings
from .schemas import EditRequest, Video
from .storage import get_storage
from .store import library

# A source clip in the edit spec:
# (start, end, storage_key, caption, position, speed, color_filter).
Source = tuple[float, Optional[float], str, str, str, float, str, str]


def _key_from_url(url: Optional[str]) -> Optional[str]:
    if not url:
        return None
    marker = "/v1/media/"
    return url.split(marker, 1)[1] if marker in url else None


def _escape_drawtext(text: str) -> str:
    # ffmpeg drawtext needs colons, quotes and backslashes escaped.
    return text.replace("\\", "\\\\").replace(":", "\\:").replace("'", "’").replace("%", "\\%")


_COLOR_FILTERS = {
    "mono": "hue=s=0",
    "warm": "colorbalance=rm=.15:bm=-.10",
    "cool": "colorbalance=bm=.15:rm=-.10",
    "vivid": "eq=saturation=1.4:contrast=1.06",
}


def _vf_chain(text: str, position: str, speed: float, color: str, font: str = "auto") -> str:
    """Compose the per-clip -vf chain: caption + speed + color look."""
    parts: list[str] = []
    if text.strip():
        parts.append(_drawtext_filter(text.strip(), position, font))
    if speed and speed != 1.0:
        parts.append(f"setpts=PTS/{speed}")
    if color in _COLOR_FILTERS:
        parts.append(_COLOR_FILTERS[color])
    return ",".join(parts)


def _drawtext_filter(text: str, position: str, font: str = "auto") -> str:
    y = {"top": "h*0.08", "center": "(h-text_h)/2", "bottom": "h-text_h-h*0.08"}.get(
        position, "h-text_h-h*0.08"
    )
    parts = [
        f"text='{_escape_drawtext(text)}'",
        "fontcolor=white",
        "fontsize=h/16",
        "box=1",
        "boxcolor=black@0.5",
        "boxborderw=12",
        "x=(w-text_w)/2",
        f"y={y}",
    ]
    # Language-matched free font (downloaded on demand); falls back to the
    # configured host font, then to fontconfig's default.
    from .fonts import font_path

    resolved = font_path(font, text)
    if resolved:
        parts.append(f"fontfile={resolved}")
    return "drawtext=" + ":".join(parts)


def _has_audio(path: str) -> bool:
    """Whether the file carries an audio stream (ffprobe; False on any failure)."""
    try:
        probe = subprocess.run(
            ["ffprobe", "-v", "error", "-select_streams", "a",
             "-show_entries", "stream=codec_type", "-of", "csv=p=0", path],
            capture_output=True, timeout=60,
        )
        return b"audio" in probe.stdout
    except Exception:
        return False


def _atempo_chain(speed: float) -> str:
    """An -af chain matching audio to a setpts speed change. atempo only takes
    0.5–2.0 per stage, so out-of-range speeds are factored into stages."""
    if not speed or speed == 1.0:
        return ""
    parts: list[str] = []
    s = speed
    while s > 2.0:
        parts.append("atempo=2.0")
        s /= 2.0
    while s < 0.5:
        parts.append("atempo=0.5")
        s /= 0.5
    if abs(s - 1.0) > 1e-6:
        parts.append(f"atempo={s}")
    return ",".join(parts)


def _render(
    sources: list[Source], audio_key: Optional[str] = None, keep_audio: bool = True
) -> Optional[bytes]:
    """Trim each source (+ optional burned-in caption), concat, and optionally
    mux an audio track — all via ffmpeg.

    With keep_audio each segment keeps its own sound (silent sources get a
    generated silent track so the concat streams stay uniform); a provided
    audio_key is then MIXED over the cut instead of replacing it.
    """
    store = get_storage()
    with tempfile.TemporaryDirectory() as td:
        segments: list[str] = []
        for i, (start, end, key, text, position, speed, color, font) in enumerate(sources):
            src = os.path.join(td, f"src{i}.mp4")
            with open(src, "wb") as fh:
                fh.write(store.read(key))
            seg = os.path.join(td, f"seg{i}.mp4")
            src_has_audio = keep_audio and _has_audio(src)

            def build(with_text: bool) -> list[str]:
                cmd = ["ffmpeg", "-y"]
                if start and start > 0:
                    cmd += ["-ss", f"{start}"]  # input seek
                cmd += ["-i", src]
                if keep_audio and not src_has_audio:
                    # Silent source: synthesize a silent track so every segment
                    # has uniform a/v streams for the stream-copy concat.
                    cmd += ["-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100"]
                if end is not None and end > (start or 0):
                    cmd += ["-t", f"{end - (start or 0)}"]  # duration after seek
                if with_text:
                    chain = _vf_chain(text, position, speed, color, font)
                    if chain:
                        cmd += ["-vf", chain]
                # Re-encode to a uniform codec so the concat step can stream-copy.
                cmd += ["-c:v", "libx264", "-pix_fmt", "yuv420p"]
                if not keep_audio:
                    cmd += ["-an"]
                elif src_has_audio:
                    af = _atempo_chain(speed)  # keep sound in sync with setpts
                    if af:
                        cmd += ["-af", af]
                    cmd += ["-map", "0:v:0", "-map", "0:a:0",
                            "-c:a", "aac", "-ar", "44100", "-ac", "2"]
                else:
                    cmd += ["-map", "0:v:0", "-map", "1:a:0", "-shortest",
                            "-c:a", "aac", "-ar", "44100", "-ac", "2"]
                cmd += [seg]
                return cmd

            try:
                subprocess.run(build(True), check=True, capture_output=True, timeout=600)
            except subprocess.CalledProcessError:
                # A filter can fail (missing font, unsupported glyphs/filters) — never
                # let that break the edit; re-render the segment with no filters.
                subprocess.run(build(False), check=True, capture_output=True, timeout=600)
            segments.append(seg)

        listfile = os.path.join(td, "list.txt")
        with open(listfile, "w") as fh:
            for s in segments:
                fh.write(f"file '{s}'\n")
        out = os.path.join(td, "edit.mp4")
        subprocess.run(
            ["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", listfile, "-c", "copy", out],
            check=True,
            capture_output=True,
            timeout=600,
        )

        # Optional audio track (voiceover/BGM): with keep_audio it is MIXED over
        # the cut's own sound; otherwise it replaces the (silent) cut's audio.
        # Audio problems must never break the edit — on any failure the plain
        # cut is returned instead.
        if audio_key and store.exists(audio_key):
            src_audio = os.path.join(td, "track" + os.path.splitext(audio_key)[1])
            with open(src_audio, "wb") as fh:
                fh.write(store.read(audio_key))
            with_audio = os.path.join(td, "edit-audio.mp4")
            if keep_audio:
                mux = ["ffmpeg", "-y", "-i", out, "-i", src_audio,
                       "-filter_complex",
                       "[0:a][1:a]amix=inputs=2:duration=first:dropout_transition=0[aout]",
                       "-map", "0:v:0", "-map", "[aout]",
                       "-c:v", "copy", "-c:a", "aac", with_audio]
            else:
                mux = ["ffmpeg", "-y", "-i", out, "-i", src_audio,
                       "-map", "0:v:0", "-map", "1:a:0",
                       "-c:v", "copy", "-c:a", "aac", "-shortest", with_audio]
            try:
                subprocess.run(mux, check=True, capture_output=True, timeout=600)
                out = with_audio
            except subprocess.CalledProcessError:
                pass  # unsupported/corrupt audio — keep the plain cut

        with open(out, "rb") as fh:
            return fh.read()


async def compose_edit(req: EditRequest, owner_id: str | None = None) -> Optional[Video]:
    # Resolve each clip to a real, existing storage key (skip mock/metadata ones).
    store = get_storage()
    sources: list[Source] = []
    scenes = 0
    for clip in req.clips:
        video = await library.get(clip.videoId)
        if video is None:
            continue
        key = _key_from_url(video.url)
        if not key or not store.exists(key):
            continue
        sources.append(
            (clip.start, clip.end, key, clip.text, clip.textPosition, clip.speed, clip.filter,
             clip.font)
        )
        scenes += 1
    if not sources:
        return None

    data = await asyncio.to_thread(_render, sources, req.audioKey, req.keepAudio)
    if not data:
        return None
    film_key = f"films/edit-{int(time.time() * 1000)}.mp4"
    store.save(film_key, data)
    return await library.add_film(
        req.title or "My edit", film_key, len(data), tier_label="Edit", scenes=scenes,
        owner_id=owner_id,
    )

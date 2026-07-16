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

# A source clip in the edit spec: (start, end, storage_key, caption, position).
Source = tuple[float, Optional[float], str, str, str]


def _key_from_url(url: Optional[str]) -> Optional[str]:
    if not url:
        return None
    marker = "/v1/media/"
    return url.split(marker, 1)[1] if marker in url else None


def _escape_drawtext(text: str) -> str:
    # ffmpeg drawtext needs colons, quotes and backslashes escaped.
    return text.replace("\\", "\\\\").replace(":", "\\:").replace("'", "’").replace("%", "\\%")


def _drawtext_filter(text: str, position: str) -> str:
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
    if settings.edit_font and os.path.exists(settings.edit_font):
        parts.append(f"fontfile={settings.edit_font}")
    return "drawtext=" + ":".join(parts)


def _render(sources: list[Source], audio_key: Optional[str] = None) -> Optional[bytes]:
    """Trim each source (+ optional burned-in caption), concat, and optionally
    mux an audio track — all via ffmpeg."""
    store = get_storage()
    with tempfile.TemporaryDirectory() as td:
        segments: list[str] = []
        for i, (start, end, key, text, position) in enumerate(sources):
            src = os.path.join(td, f"src{i}.mp4")
            with open(src, "wb") as fh:
                fh.write(store.read(key))
            seg = os.path.join(td, f"seg{i}.mp4")

            def build(with_text: bool) -> list[str]:
                cmd = ["ffmpeg", "-y"]
                if start and start > 0:
                    cmd += ["-ss", f"{start}"]  # input seek
                cmd += ["-i", src]
                if end is not None and end > (start or 0):
                    cmd += ["-t", f"{end - (start or 0)}"]  # duration after seek
                if with_text and text.strip():
                    cmd += ["-vf", _drawtext_filter(text.strip(), position)]
                # Re-encode to a uniform codec so the concat step can stream-copy.
                cmd += ["-c:v", "libx264", "-pix_fmt", "yuv420p", "-an", seg]
                return cmd

            try:
                subprocess.run(build(True), check=True, capture_output=True, timeout=600)
            except subprocess.CalledProcessError:
                # A caption filter can fail (missing font, unsupported glyphs) — never
                # let that break the edit; re-render the segment without the overlay.
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

        # Optional audio track (voiceover/BGM): mux it over the stitched cut,
        # trimmed to the shorter stream. Audio problems must never break the
        # edit — on any failure the silent cut is returned instead.
        if audio_key and store.exists(audio_key):
            src_audio = os.path.join(td, "track" + os.path.splitext(audio_key)[1])
            with open(src_audio, "wb") as fh:
                fh.write(store.read(audio_key))
            with_audio = os.path.join(td, "edit-audio.mp4")
            try:
                subprocess.run(
                    ["ffmpeg", "-y", "-i", out, "-i", src_audio,
                     "-map", "0:v:0", "-map", "1:a:0",
                     "-c:v", "copy", "-c:a", "aac", "-shortest", with_audio],
                    check=True,
                    capture_output=True,
                    timeout=600,
                )
                out = with_audio
            except subprocess.CalledProcessError:
                pass  # unsupported/corrupt audio — keep the silent cut

        with open(out, "rb") as fh:
            return fh.read()


async def compose_edit(req: EditRequest) -> Optional[Video]:
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
        sources.append((clip.start, clip.end, key, clip.text, clip.textPosition))
        scenes += 1
    if not sources:
        return None

    data = await asyncio.to_thread(_render, sources, req.audioKey)
    if not data:
        return None
    film_key = f"films/edit-{int(time.time() * 1000)}.mp4"
    store.save(film_key, data)
    return await library.add_film(
        req.title or "My edit", film_key, len(data), tier_label="Edit", scenes=scenes
    )

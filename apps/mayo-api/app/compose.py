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

from .schemas import EditRequest, Video
from .storage import get_storage
from .store import library


def _key_from_url(url: Optional[str]) -> Optional[str]:
    if not url:
        return None
    marker = "/v1/media/"
    return url.split(marker, 1)[1] if marker in url else None


def _render(sources: list[tuple[float, Optional[float], str]]) -> Optional[bytes]:
    """sources: list of (start, end, storage_key). Trim + concat via ffmpeg."""
    store = get_storage()
    with tempfile.TemporaryDirectory() as td:
        segments: list[str] = []
        for i, (start, end, key) in enumerate(sources):
            src = os.path.join(td, f"src{i}.mp4")
            with open(src, "wb") as fh:
                fh.write(store.read(key))
            seg = os.path.join(td, f"seg{i}.mp4")
            cmd = ["ffmpeg", "-y"]
            if start and start > 0:
                cmd += ["-ss", f"{start}"]  # input seek
            cmd += ["-i", src]
            if end is not None and end > (start or 0):
                cmd += ["-t", f"{end - (start or 0)}"]  # duration after seek
            # Re-encode to a uniform codec so the concat step can stream-copy.
            cmd += ["-c:v", "libx264", "-pix_fmt", "yuv420p", "-an", seg]
            subprocess.run(cmd, check=True, capture_output=True, timeout=600)
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
        with open(out, "rb") as fh:
            return fh.read()


async def compose_edit(req: EditRequest) -> Optional[Video]:
    # Resolve each clip to a real, existing storage key (skip mock/metadata ones).
    store = get_storage()
    sources: list[tuple[float, Optional[float], str]] = []
    scenes = 0
    for clip in req.clips:
        video = await library.get(clip.videoId)
        if video is None:
            continue
        key = _key_from_url(video.url)
        if not key or not store.exists(key):
            continue
        sources.append((clip.start, clip.end, key))
        scenes += 1
    if not sources:
        return None

    data = await asyncio.to_thread(_render, sources)
    if not data:
        return None
    film_key = f"films/edit-{int(time.time() * 1000)}.mp4"
    store.save(film_key, data)
    return await library.add_film(
        req.title or "My edit", film_key, len(data), tier_label="Edit", scenes=scenes
    )

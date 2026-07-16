"""Serve generated media (stitched films, clips) from the storage backend.

Playback path for a video is `/v1/media/<storage-key>` (see LibraryStore). Guards
against path traversal so a key can't escape the storage root. Auth-protected like
the rest of /v1 (the app plays it with the API key in the request headers).

Supports HTTP Range requests — iOS AVPlayer (expo-video) needs 206/Range to play
an MP4 over HTTP, otherwise playback fails silently.
"""

import asyncio
import mimetypes
import os
import subprocess
import tempfile

from fastapi import APIRouter, HTTPException, Request, Response, status

from ..storage import get_storage

router = APIRouter(prefix="/v1/media", tags=["media"])
# Thumbnails live under their own prefix so the media route stays a pure passthrough.
thumb_router = APIRouter(prefix="/v1/thumb", tags=["media"])


def _extract_frame(video_bytes: bytes) -> bytes | None:
    """First-frame JPEG via ffmpeg (scaled to 480w); None if extraction fails."""
    with tempfile.TemporaryDirectory() as td:
        src = os.path.join(td, "in.mp4")
        out = os.path.join(td, "thumb.jpg")
        with open(src, "wb") as fh:
            fh.write(video_bytes)
        try:
            subprocess.run(
                ["ffmpeg", "-y", "-ss", "0.3", "-i", src,
                 "-frames:v", "1", "-vf", "scale=480:-2", "-q:v", "4", out],
                check=True, capture_output=True, timeout=60,
            )
            with open(out, "rb") as fh:
                return fh.read()
        except Exception:
            return None


@thumb_router.get("/{key:path}")
async def thumb(key: str) -> Response:
    """A cached poster frame for any stored video — generated on first request."""
    if ".." in key or key.startswith("/"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="invalid media key")
    store = get_storage()
    cache_key = "thumbs/" + key.replace("/", "_") + ".jpg"
    if not store.exists(cache_key):
        if not store.exists(key):
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="media not found")
        data = await asyncio.to_thread(_extract_frame, store.read(key))
        if not data:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="no thumbnail")
        store.save(cache_key, data)
    return Response(
        store.read(cache_key),
        media_type="image/jpeg",
        headers={"Cache-Control": "public, max-age=86400"},
    )


@router.get("/{key:path}")
async def media(key: str, request: Request) -> Response:
    if ".." in key or key.startswith("/"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="invalid media key")
    store = get_storage()
    if not store.exists(key):
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="media not found")

    data = store.read(key)
    total = len(data)
    ctype = mimetypes.guess_type(key)[0] or "application/octet-stream"

    range_header = request.headers.get("range")
    if range_header and range_header.startswith("bytes="):
        try:
            start_s, _, end_s = range_header[len("bytes=") :].partition("-")
            start = int(start_s) if start_s else 0
            end = int(end_s) if end_s else total - 1
            end = min(end, total - 1)
            if start > end or start >= total:
                raise ValueError
        except ValueError:
            raise HTTPException(
                status.HTTP_416_REQUESTED_RANGE_NOT_SATISFIABLE,
                headers={"Content-Range": f"bytes */{total}"},
            )
        chunk = data[start : end + 1]
        return Response(
            content=chunk,
            status_code=status.HTTP_206_PARTIAL_CONTENT,
            media_type=ctype,
            headers={
                "Content-Range": f"bytes {start}-{end}/{total}",
                "Accept-Ranges": "bytes",
                "Content-Length": str(len(chunk)),
            },
        )

    return Response(content=data, media_type=ctype, headers={"Accept-Ranges": "bytes"})

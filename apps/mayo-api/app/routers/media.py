"""Serve generated media (stitched films, clips) from the storage backend.

Playback path for a video is `/v1/media/<storage-key>` (see LibraryStore). Guards
against path traversal so a key can't escape the storage root. Auth-protected like
the rest of /v1 (the app plays it with the API key in the request headers).

Supports HTTP Range requests — iOS AVPlayer (expo-video) needs 206/Range to play
an MP4 over HTTP, otherwise playback fails silently.
"""

import mimetypes

from fastapi import APIRouter, HTTPException, Request, Response, status

from ..storage import get_storage

router = APIRouter(prefix="/v1/media", tags=["media"])


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

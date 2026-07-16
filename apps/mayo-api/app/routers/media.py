"""Serve generated media (stitched films, clips) from the storage backend.

Playback path for a video is `/v1/media/<storage-key>` (see LibraryStore). Guards
against path traversal so a key can't escape the storage root. Auth-protected like
the rest of /v1 (the app plays it with the API key in the request headers).
"""

import mimetypes

from fastapi import APIRouter, HTTPException, Response, status

from ..storage import get_storage

router = APIRouter(prefix="/v1/media", tags=["media"])


@router.get("/{key:path}")
async def media(key: str) -> Response:
    if ".." in key or key.startswith("/"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="invalid media key")
    store = get_storage()
    if not store.exists(key):
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="media not found")
    data = store.read(key)
    ctype = mimetypes.guess_type(key)[0] or "application/octet-stream"
    return Response(content=data, media_type=ctype)

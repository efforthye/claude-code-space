"""Video editor endpoints — render an edit spec (trim + concat + audio) into a
new film, and accept audio-track uploads (voiceover/BGM) for it."""

import time
from typing import Optional

from fastapi import APIRouter, Header, HTTPException, Request, status

from ..compose import compose_edit
from ..schemas import AudioUploadResult, EditRequest, Video
from ..storage import get_storage

router = APIRouter(prefix="/v1/edit", tags=["edit"])

# Raw-body upload (no multipart dep): the app POSTs the recording bytes directly.
_AUDIO_EXT = {"audio/mp4": ".m4a", "audio/m4a": ".m4a", "audio/x-m4a": ".m4a",
              "audio/mpeg": ".mp3", "audio/wav": ".wav", "audio/x-wav": ".wav",
              "audio/webm": ".webm", "audio/aac": ".aac", "audio/3gpp": ".3gp"}
_MAX_AUDIO_BYTES = 50 * 1024 * 1024  # 50 MB is plenty for a voiceover/BGM track


@router.post("/audio", response_model=AudioUploadResult, status_code=status.HTTP_201_CREATED)
async def upload_audio(request: Request) -> AudioUploadResult:
    data = await request.body()
    if not data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="empty audio upload")
    if len(data) > _MAX_AUDIO_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="audio too large")
    ctype = (request.headers.get("content-type") or "").split(";")[0].strip().lower()
    ext = _AUDIO_EXT.get(ctype, ".m4a")
    key = f"edits/audio-{int(time.time() * 1000)}{ext}"
    get_storage().save(key, data)
    return AudioUploadResult(key=key)


@router.post("", response_model=Video, status_code=status.HTTP_201_CREATED)
async def create_edit(
    req: EditRequest, x_mayo_session: Optional[str] = Header(default=None)
) -> Video:
    from ..auth import store as users

    caller = users.user_for_session(x_mayo_session or "")
    try:
        video = await compose_edit(req, owner_id=caller["id"] if caller else None)
    except Exception as exc:  # ffmpeg failure, etc.
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"edit failed: {exc}")
    if video is None:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="no usable source clips (only real generated videos can be edited)",
        )
    return video

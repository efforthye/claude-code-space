"""Video editor endpoint — render an edit spec (trim + concat) into a new film."""

from fastapi import APIRouter, HTTPException, status

from ..compose import compose_edit
from ..schemas import EditRequest, Video

router = APIRouter(prefix="/v1/edit", tags=["edit"])


@router.post("", response_model=Video, status_code=status.HTTP_201_CREATED)
async def create_edit(req: EditRequest) -> Video:
    try:
        video = await compose_edit(req)
    except Exception as exc:  # ffmpeg failure, etc.
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"edit failed: {exc}")
    if video is None:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="no usable source clips (only real generated videos can be edited)",
        )
    return video

from fastapi import APIRouter, HTTPException, status

from .. import catalog
from ..schemas import ExtendRequest, PublishRequest, PublishResult, Storage, Video
from ..store import library as lib

router = APIRouter(prefix="/v1/library", tags=["library"])


@router.get("/videos", response_model=list[Video])
async def list_videos() -> list[Video]:
    return await lib.list()


@router.get("/storage", response_model=Storage)
async def storage() -> Storage:
    return await lib.storage()


@router.get("/videos/{video_id}", response_model=Video)
async def get_video(video_id: str) -> Video:
    video = await lib.get(video_id)
    if video is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="video not found")
    return video


@router.delete("/videos/{video_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_video(video_id: str) -> None:
    removed = await lib.remove(video_id)
    if not removed:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="video not found")


@router.post("/videos/{video_id}/extend", response_model=Video)
async def extend(video_id: str, req: ExtendRequest) -> Video:
    plan = catalog.retention_by_id(req.plan)
    if plan is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=f"unknown plan '{req.plan}'")
    video = await lib.extend(video_id, plan.days)
    if video is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="video not found")
    return video


@router.post("/videos/{video_id}/publish", response_model=PublishResult)
async def publish(video_id: str, req: PublishRequest) -> PublishResult:
    video = await lib.get(video_id)
    if video is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="video not found")
    # Mock: real impl kicks off a YouTube Data API resumable upload (per-user OAuth2).
    return PublishResult(accepted=True, videoId=video_id, visibility=req.visibility)

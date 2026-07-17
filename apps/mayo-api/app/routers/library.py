from typing import Optional

from fastapi import APIRouter, Header, HTTPException, status

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
async def publish(
    video_id: str,
    req: PublishRequest,
    x_mayo_session: Optional[str] = Header(default=None),
) -> PublishResult:
    video = await lib.get(video_id)
    if video is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="video not found")

    # Real YouTube upload when this user has connected their channel (ADR 0008
    # follow-up): read the film from storage and run the resumable upload on the
    # user's own OAuth grant. Falls back to the accepted-stub otherwise.
    from .. import youtube
    from ..auth import store as users
    from ..storage import get_storage

    user = users.user_for_session(x_mayo_session or "")
    refresh = (user or {}).get("youtubeRefreshToken", "")
    if refresh and youtube.is_configured() and video.url:
        key = video.url.split("/v1/media/", 1)[-1]
        store = get_storage()
        if not store.exists(key):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="video file missing")
        try:
            yt_id = await youtube.upload_video(
                refresh, store.read(key), req.title, req.description, req.visibility,
                tags=req.tags,
            )
        except ValueError as exc:
            raise HTTPException(status.HTTP_502_BAD_GATEWAY, detail=str(exc))
        yt_url = f"https://youtu.be/{yt_id}"
        await lib.set_youtube_url(video_id, yt_url)
        return PublishResult(accepted=True, videoId=yt_id, visibility=req.visibility, url=yt_url)

    # Not connected / not configured — keep the previous no-op acceptance.
    return PublishResult(accepted=True, videoId=video_id, visibility=req.visibility)

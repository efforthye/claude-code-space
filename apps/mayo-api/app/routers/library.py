from typing import Optional

from fastapi import APIRouter, Header, HTTPException, status

from .. import catalog
from ..schemas import ExtendRequest, PublishRequest, PublishResult, Storage, Video
from ..store import library as lib

router = APIRouter(prefix="/v1/library", tags=["library"])


def _caller_id(session: Optional[str]) -> Optional[str]:
    from ..auth import store as users

    user = users.user_for_session(session or "")
    return user["id"] if user else None


@router.get("/videos", response_model=list[Video])
async def list_videos(x_mayo_session: Optional[str] = Header(default=None)) -> list[Video]:
    """The caller's own videos (plus legacy ownerless ones) — per-account library."""
    return await lib.list(_caller_id(x_mayo_session))


@router.get("/storage", response_model=Storage)
async def storage(x_mayo_session: Optional[str] = Header(default=None)) -> Storage:
    """Storage usage metered over the caller's own files, not the whole host."""
    return await lib.storage(_caller_id(x_mayo_session))


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

    # PROD RULE: no fake successes — publishing REQUIRES a connected channel.
    raise HTTPException(
        status.HTTP_400_BAD_REQUEST,
        detail="유튜브 채널 연결이 필요해요 — 게시 화면에서 연결한 뒤 다시 시도해주세요",
    )

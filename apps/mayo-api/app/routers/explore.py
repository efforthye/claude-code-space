"""Explore feed — browse REAL user-published creations, publish your own, remix.

No dummy seed: the feed is empty until users publish. `prompt` on each item powers
the "make like this" remix flow; `url` makes items playable.
"""

from fastapi import APIRouter, HTTPException, Query, status

from ..schemas import ExploreItem, PublishExploreRequest
from ..store import explore as explore_store
from ..store import library as lib

router = APIRouter(prefix="/v1/explore", tags=["explore"])


@router.get("", response_model=list[ExploreItem])
async def list_explore(sort: str = Query("popular", pattern="^(popular|latest)$")) -> list[ExploreItem]:
    return await explore_store.list(sort)


@router.post("", response_model=ExploreItem, status_code=status.HTTP_201_CREATED)
async def publish_explore(req: PublishExploreRequest) -> ExploreItem:
    video = await lib.get(req.videoId)
    if video is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="video not found")
    if not video.url:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, detail="only a real (playable) video can be published"
        )
    return await explore_store.publish(video, req.prompt)


@router.post("/{item_id}/like", response_model=ExploreItem)
async def like_explore(item_id: str) -> ExploreItem:
    item = await explore_store.like(item_id)
    if item is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="not found")
    return item

"""Public (unauthenticated) endpoints for SHARED reels.

Sharing a reel sends a promo link (https://mayo.im/reel/<id>). The recipient
has no account and no API key, so the web page needs open access — but ONLY to
content the author explicitly published to the Explore feed. These routes gate
on explore membership: the item id is the capability, and the media it serves
is exactly the published film (never arbitrary storage keys).
"""

from fastapi import APIRouter, HTTPException, Query, Request, Response, status

from ..schemas import ExploreComment, ExploreItem
from ..store import explore as explore_store

router = APIRouter(prefix="/v1/public", tags=["public"])


# --- Anonymous explore (mayo.im without login): the feed is public content by
# design, so browsing must not require an account or the shared key. Writes
# that carry identity (publish, like, comment) stay on the authed router. ---


@router.get("/explore", response_model=list[ExploreItem])
async def public_explore(sort: str = Query("popular", pattern="^(popular|latest)$")) -> list[ExploreItem]:
    return await explore_store.list(sort)


@router.get("/explore/{item_id}/comments", response_model=list[ExploreComment])
async def public_comments(item_id: str) -> list[ExploreComment]:
    comments = await explore_store.comments(item_id)
    if comments is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="not found")
    return comments


@router.post("/explore/{item_id}/view", response_model=ExploreItem)
async def public_view(item_id: str) -> ExploreItem:
    item = await explore_store.view(item_id)
    if item is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="not found")
    return item


@router.post("/explore/{item_id}/share", response_model=ExploreItem)
async def public_share(item_id: str) -> ExploreItem:
    item = await explore_store.share(item_id)
    if item is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="not found")
    return item


async def _published(item_id: str) -> ExploreItem:
    for item in await explore_store.list("latest"):
        if item.id == item_id:
            return item
    raise HTTPException(status.HTTP_404_NOT_FOUND, detail="not found")


@router.get("/reels/{item_id}", response_model=ExploreItem)
async def public_reel(item_id: str) -> ExploreItem:
    return await _published(item_id)


def _media_key(item: ExploreItem) -> str:
    if not item.url or "/v1/media/" not in item.url:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="no media")
    return item.url.split("/v1/media/", 1)[-1]


@router.get("/media/{item_id}")
async def public_media(item_id: str, request: Request) -> Response:
    """The published film itself — reuses the media route's Range handling
    (iOS Safari needs 206 responses to play video)."""
    from .media import media as serve_media

    item = await _published(item_id)
    return await serve_media(_media_key(item), request)


@router.get("/thumb/{item_id}")
async def public_thumb(item_id: str) -> Response:
    """Poster frame for the shared page (and link previews)."""
    from .media import thumb as serve_thumb

    item = await _published(item_id)
    return await serve_thumb(_media_key(item))

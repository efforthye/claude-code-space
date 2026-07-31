"""Public (unauthenticated) endpoints for SHARED reels.

Sharing a reel sends a promo link (https://mayo.im/reel/<id>). The recipient
has no account and no API key, so the web page needs open access — but ONLY to
content the author explicitly published to the Explore feed. These routes gate
on explore membership: the item id is the capability, and the media it serves
is exactly the published film (never arbitrary storage keys).
"""

import html

from fastapi import APIRouter, HTTPException, Query, Request, Response, status
from fastapi.responses import HTMLResponse

from ..config import settings
from ..schemas import CreateJobRequest, Estimate, ExploreComment, ExploreItem
from ..store import explore as explore_store

router = APIRouter(prefix="/v1/public", tags=["public"])


# --- Anonymous explore (mayo.im without login): the feed is public content by
# design, so browsing must not require an account or the shared key. Writes
# that carry identity (publish, like, comment) stay on the authed router. ---


@router.post("/estimate", response_model=Estimate)
async def public_estimate(req: CreateJobRequest) -> Estimate:
    """What a render would cost, without a key.

    A price list is not user data. Requiring a session to see one means the
    first thing mayo.im tells a visitor is 401, and the create screen silently
    falls back to a credit figure with no money attached — which is what it was
    doing until 2026-08-01.

    The authenticated route stays: it applies the caller's BYOK discount, which
    this one cannot know about. This mirror quotes the list price.
    """
    from .. import catalog

    tier = catalog.tier_by_id(req.tier)
    if tier is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=f"unknown tier '{req.tier}'")
    credits = catalog.estimate_credits(req.seconds, tier)
    scenes = catalog.scenes_for(req.seconds)
    return Estimate(
        seconds=req.seconds,
        tier=req.tier,
        credits=credits,
        usd=catalog.payg_usd(scenes),
        scenes=scenes,
        etaSeconds=catalog.eta_seconds(scenes, req.videoModel or None),
    )


@router.get("/explore", response_model=list[ExploreItem])
async def public_explore(
    sort: str = Query("popular", pattern="^(popular|latest)$"),
    orientation: str = Query("all", pattern="^(all|vertical|horizontal)$"),
    author: str = Query("", max_length=64),
) -> list[ExploreItem]:
    # No session here by definition, so nobody is the creator: recipes are
    # redacted unless their creator published them openly.
    from .explore import redact_recipe

    return [redact_recipe(i, None) for i in await explore_store.list(sort, orientation, author)]


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


@router.post("/explore/{item_id}/watch", response_model=ExploreItem)
async def public_watch(item_id: str) -> ExploreItem:
    item = await explore_store.watch(item_id)
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


@router.get("/reel-og/{item_id}", response_class=HTMLResponse)
async def public_reel_og(item_id: str) -> HTMLResponse:
    """Link-preview page for a shared reel: OG/Twitter meta tags (thumbnail,
    title, video) for crawlers, plus an instant redirect for humans. mayo.im's
    Vercel config rewrites crawler traffic on /reel/<id> to this page, so a
    pasted share link unfurls with the reel's poster frame in KakaoTalk,
    iMessage, Slack, X, Discord, etc."""
    item = await _published(item_id)
    page_url = f"{settings.public_web_base}/reel/{item.id}"
    image_url = f"{settings.public_api_base}/v1/public/thumb/{item.id}"
    video_url = f"{settings.public_api_base}/v1/public/media/{item.id}"
    title = html.escape(item.title or "mayo reel")
    # The share preview must not leak a private recipe. A link unfurled into a
    # group chat is the least controlled surface there is, so only an openly
    # published prompt goes in the description.
    blurb = item.prompt if item.promptPublic else ""
    desc = html.escape((blurb or "AI-generated video on mayo")[:160] + f" — {item.author}")
    doc = f"""<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>{title} — mayo</title>
<meta name="description" content="{desc}">
<meta property="og:type" content="video.other">
<meta property="og:site_name" content="mayo">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:url" content="{page_url}">
<meta property="og:image" content="{image_url}">
<meta property="og:image:width" content="640">
<meta property="og:image:height" content="360">
<meta property="og:video" content="{video_url}">
<meta property="og:video:type" content="video/mp4">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{title}">
<meta name="twitter:description" content="{desc}">
<meta name="twitter:image" content="{image_url}">
<meta http-equiv="refresh" content="0;url={page_url}">
</head>
<body>
<p><a href="{page_url}">mayo에서 이 영상 보기</a></p>
</body>
</html>"""
    return HTMLResponse(doc)


@router.get("/thumb/{item_id}")
async def public_thumb(item_id: str) -> Response:
    """Poster frame for the shared page (and link previews)."""
    from .media import thumb as serve_thumb

    item = await _published(item_id)
    return await serve_thumb(_media_key(item))

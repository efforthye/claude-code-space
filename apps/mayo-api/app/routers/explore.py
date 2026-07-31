"""Explore feed — browse REAL user-published creations, publish your own, remix.

No dummy seed: the feed is empty until users publish. `prompt` on each item powers
the "make like this" remix flow; `url` makes items playable.
"""

from typing import Optional

from fastapi import APIRouter, Header, HTTPException, Query, status

from ..auth import store as users

from ..schemas import CommentRequest, ExploreComment, ExploreItem, PublishExploreRequest
from ..store import explore as explore_store
from ..store import library as lib

router = APIRouter(prefix="/v1/explore", tags=["explore"])


@router.get("", response_model=list[ExploreItem])
async def list_explore(
    sort: str = Query("popular", pattern="^(popular|latest)$"),
    x_mayo_session: Optional[str] = Header(default=None),
) -> list[ExploreItem]:
    items = await explore_store.list(sort)
    user = users.user_for_session(x_mayo_session or "")
    uid = user["id"] if user else None
    annotated = explore_store.annotate_liked(items, uid)
    # Admins review moderation queues and need to see what they are judging.
    from ..auth import is_admin_user

    if user and is_admin_user(user):
        return annotated
    return [redact_recipe(i, uid) for i in annotated]


def _author(session: Optional[str]) -> str:
    """Display name of the signed-in caller; anonymous fallback otherwise."""
    user = users.user_for_session(session or "")
    return f"@{user['name']}" if user else "@me"


@router.post("", response_model=ExploreItem, status_code=status.HTTP_201_CREATED)
async def publish_explore(
    req: PublishExploreRequest, x_mayo_session: Optional[str] = Header(default=None)
) -> ExploreItem:
    video = await lib.get(req.videoId)
    if video is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="video not found")
    if not video.url:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, detail="only a real (playable) video can be published"
        )
    user = users.user_for_session(x_mayo_session or "")
    return await explore_store.publish(
        video, req.prompt, author=_author(x_mayo_session),
        owner_id=user["id"] if user else None,
        prompt_public=req.promptPublic,
    )


def redact_recipe(item: ExploreItem, viewer_id: str | None) -> ExploreItem:
    """Blank the prompt fields unless the viewer is entitled to read them.

    Entitled = the creator, or an admin. Everyone else sees the film and not
    the recipe, unless the creator published it openly.

    This does NOT limit remixing: "make like this" re-seeds a job from the
    stored recipe on the server, so the text never has to reach a client to be
    reused. Readable and remixable are deliberately separate.
    """
    if item.promptPublic or (viewer_id and item.ownerId == viewer_id):
        return item
    hidden = item.model_copy()
    hidden.prompt = ""
    hidden.scenePrompts = None
    hidden.stylePrompt = None
    return hidden


def _require_user(session: Optional[str]) -> dict:
    user = users.user_for_session(session or "")
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="sign in first")
    return user


# NOTE: registered before /{item_id} so "mine" isn't captured as an item id.
@router.get("/mine", response_model=list[ExploreItem])
async def my_explore(x_mayo_session: Optional[str] = Header(default=None)) -> list[ExploreItem]:
    """Everything the caller published — hidden posts included (owner view)."""
    user = _require_user(x_mayo_session)
    return await explore_store.mine(user["id"])


@router.post("/{item_id}/hide", response_model=ExploreItem)
async def hide_explore(
    item_id: str, x_mayo_session: Optional[str] = Header(default=None)
) -> ExploreItem:
    """Owner-only: pull the post from the public feed (kept, reversible)."""
    user = _require_user(x_mayo_session)
    item = await explore_store.set_hidden(item_id, user["id"], True)
    if item is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="not your post (or not found)")
    return item


@router.post("/{item_id}/unhide", response_model=ExploreItem)
async def unhide_explore(
    item_id: str, x_mayo_session: Optional[str] = Header(default=None)
) -> ExploreItem:
    user = _require_user(x_mayo_session)
    item = await explore_store.set_hidden(item_id, user["id"], False)
    if item is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="not your post (or not found)")
    return item


@router.delete("/{item_id}")
async def delete_my_explore(
    item_id: str, x_mayo_session: Optional[str] = Header(default=None)
) -> dict:
    """Owner-only PERMANENT delete (admins use /v1/admin/explore/{id})."""
    user = _require_user(x_mayo_session)
    if not await explore_store.remove_owned(item_id, user["id"]):
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="not your post (or not found)")
    return {"deleted": True}


SAMPLE_AUTHOR = "@mayo-sample"

_SAMPLES = [
    # (title, prompt, hue-shift, likes, views, age_hours)
    ("노을 지는 바다 산책", "a calm sea at sunset, warm colors, gentle waves", 0, 12, 60, 48.0),
    ("네온 시티 드라이브", "neon city night drive, cyberpunk palette, rain reflections", 60, 8, 44, 24.0),
    ("숲 속의 아침", "misty forest morning, sun rays through trees", 120, 5, 30, 12.0),
    ("우주 유영", "an astronaut drifting past a nebula, deep space colors", 180, 3, 18, 6.0),
    ("고양이의 하루", "a small orange tabby cat exploring a cozy room", 240, 1, 9, 2.0),
    ("빗속의 카페", "rainy cafe window, warm lights, lo-fi mood", 300, 0, 3, 0.5),
]


def _gen_sample_clip_sync(hue: int, label: str) -> bytes:
    """A 4s portrait (576x1024) test reel via ffmpeg lavfi — real, playable mp4."""
    import os
    import subprocess
    import tempfile

    with tempfile.TemporaryDirectory() as td:
        out = os.path.join(td, "clip.mp4")
        vf = f"hue=h={hue},format=yuv420p"
        subprocess.run(
            ["ffmpeg", "-y",
             "-f", "lavfi", "-i", "testsrc2=size=576x1024:rate=24:duration=4",
             "-vf", vf, "-c:v", "libx264", "-preset", "veryfast",
             "-movflags", "+faststart", out],
            check=True, capture_output=True, timeout=120,
        )
        with open(out, "rb") as fh:
            return fh.read()


@router.post("/seed", response_model=list[ExploreItem])
async def seed_explore(clear: bool = Query(default=False)) -> list[ExploreItem]:
    """Dev helper: fill the feed with generated sample reels so the reels UI and
    ranking can be exercised before real posts exist. Samples are authored
    '@mayo-sample' with varied likes/views/ages; `?clear=true` removes existing
    samples first (call with clear alone to just clean up).
    """
    import asyncio
    import time as _time

    from ..storage import get_storage

    if clear:
        await explore_store.remove_by_author(SAMPLE_AUTHOR)

    from ..schemas import ExploreItem as _Item
    from ..store import _new_id

    accents = ["#6D5DF6", "#1FA2A6", "#E0699A", "#E2A43B", "#4C8DF6", "#8B5CF6"]
    created: list[ExploreItem] = []
    for idx, (title, prompt, hue, likes, views, age_h) in enumerate(_SAMPLES):
        try:
            data = await asyncio.to_thread(_gen_sample_clip_sync, hue, title)
        except Exception:
            raise HTTPException(
                status.HTTP_501_NOT_IMPLEMENTED,
                detail="샘플 생성에는 서버에 ffmpeg가 필요해요",
            )
        key = f"films/sample-{idx}.mp4"
        get_storage().save(key, data)
        item = _Item(
            id=_new_id("e"),
            title=title,
            prompt=prompt,
            author=SAMPLE_AUTHOR,
            likes=likes,
            durationLabel="0:04",
            accent=accents[idx % len(accents)],
            tierLabel="Sample",
            url=f"/v1/media/{key}",
            createdLabel="sample",
            views=views,
            createdAt=_time.time() - age_h * 3600,
            scenePrompts=[prompt],
            stylePrompt="vivid colors, smooth motion",
        )
        created.append(await explore_store.insert(item))
    return created


@router.get("/{item_id}", response_model=ExploreItem)
async def get_explore_item(item_id: str) -> ExploreItem:
    """One item with its full recipe — powers the 'use this template' flow."""
    for item in await explore_store.list("latest"):
        if item.id == item_id:
            return item
    raise HTTPException(status.HTTP_404_NOT_FOUND, detail="not found")


@router.post("/{item_id}/view", response_model=ExploreItem)
async def view_explore(item_id: str) -> ExploreItem:
    """Reel impression ping — feeds the popular ranking's `views` signal."""
    item = await explore_store.view(item_id)
    if item is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="not found")
    return item


@router.post("/{item_id}/watch", response_model=ExploreItem)
async def watch_explore(item_id: str) -> ExploreItem:
    """Completed-watch ping (played to the end) — completion-rate signal."""
    item = await explore_store.watch(item_id)
    if item is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="not found")
    return item


@router.post("/{item_id}/share", response_model=ExploreItem)
async def share_explore(item_id: str) -> ExploreItem:
    """Completed external share ping — the strongest ranking signal (ADR 0015)."""
    item = await explore_store.share(item_id)
    if item is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="not found")
    return item


@router.post("/{item_id}/like", response_model=ExploreItem)
async def like_explore(
    item_id: str, x_mayo_session: Optional[str] = Header(default=None)
) -> ExploreItem:
    """One like per ACCOUNT (idempotent) when signed in; plain counter otherwise."""
    user = users.user_for_session(x_mayo_session or "")
    item = await explore_store.like(item_id, user["id"] if user else None)
    if item is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="not found")
    return item


@router.post("/{item_id}/unlike", response_model=ExploreItem)
async def unlike_explore(
    item_id: str, x_mayo_session: Optional[str] = Header(default=None)
) -> ExploreItem:
    user = users.user_for_session(x_mayo_session or "")
    item = await explore_store.unlike(item_id, user["id"] if user else None)
    if item is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="not found")
    return item


@router.get("/{item_id}/comments", response_model=list[ExploreComment])
async def list_comments(item_id: str) -> list[ExploreComment]:
    comments = await explore_store.comments(item_id)
    if comments is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="not found")
    return comments


@router.post("/{item_id}/comments", response_model=ExploreComment, status_code=status.HTTP_201_CREATED)
async def add_comment(
    item_id: str, req: CommentRequest, x_mayo_session: Optional[str] = Header(default=None)
) -> ExploreComment:
    comment = await explore_store.add_comment(item_id, req.text, author=_author(x_mayo_session))
    if comment is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="not found")
    return comment

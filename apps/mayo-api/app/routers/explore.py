"""Explore feed — browse REAL user-published creations, publish your own, remix.

No dummy seed: the feed is empty until users publish. `prompt` on each item powers
the "make like this" remix flow; `url` makes items playable.
"""

from typing import Optional

from fastapi import APIRouter, Header, HTTPException, Query, status

from ..auth import store as users

from ..schemas import CommentRequest, ExploreComment, ExploreItem, PublishExploreRequest
from ..store import explore as explore_store
from ..store import follows as follow_store
from ..store import library as lib

router = APIRouter(prefix="/v1/explore", tags=["explore"])


@router.get("", response_model=list[ExploreItem])
async def list_explore(
    sort: str = Query("popular", pattern="^(popular|latest)$"),
    orientation: str = Query("all", pattern="^(all|vertical|horizontal)$"),
    author: str = Query("", max_length=64),
    x_mayo_session: Optional[str] = Header(default=None),
) -> list[ExploreItem]:
    items = await explore_store.list(sort, orientation, author)
    user = users.user_for_session(x_mayo_session or "")
    uid = user["id"] if user else None
    annotated = explore_store.annotate_liked(items, uid)
    annotated = await _annotate_followed(annotated, uid)
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

# Sample seeding used to live here: an endpoint that generated ffmpeg test
# clips authored "@mayo-sample" so the feed looked populated before anyone had
# published. Removed 2026-08-01 — a feed of films nobody made is a lie about
# what the product has on it, and it made the ranking signals meaningless.
# The purge of any rows it left behind runs at startup (see main.py).


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


# --- Following creators ------------------------------------------------------
#
# Server-side (see store.FollowStore) so the list survives a reinstall and is
# the same on every device the account signs in on.


async def _annotate_followed(items: list[ExploreItem], user_id: str | None) -> list[ExploreItem]:
    """Stamp followedByMe for the calling account (no-op for anonymous)."""
    if not user_id:
        return items
    following = set(await follow_store.following(user_id))
    if not following:
        return items
    return [i.model_copy(update={"followedByMe": i.author in following}) for i in items]


@router.get("/following/list", response_model=list[str])
async def list_following(x_mayo_session: Optional[str] = Header(default=None)) -> list[str]:
    user = _require_user(x_mayo_session)
    return await follow_store.following(user["id"])


@router.post("/following/{author}", response_model=list[str])
async def follow_author(
    author: str, x_mayo_session: Optional[str] = Header(default=None)
) -> list[str]:
    user = _require_user(x_mayo_session)
    if author == _author(x_mayo_session):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="cannot follow yourself")
    return await follow_store.set(user["id"], author, True)


@router.delete("/following/{author}", response_model=list[str])
async def unfollow_author(
    author: str, x_mayo_session: Optional[str] = Header(default=None)
) -> list[str]:
    user = _require_user(x_mayo_session)
    return await follow_store.set(user["id"], author, False)


@router.post("/following/merge", response_model=list[str])
async def merge_following(
    authors: list[str], x_mayo_session: Optional[str] = Header(default=None)
) -> list[str]:
    """Fold follows made while signed out into the account, on first sign-in.

    Without this, following someone before signing in silently costs you that
    follow the moment you have an account to keep it in.
    """
    user = _require_user(x_mayo_session)
    return await follow_store.merge(user["id"], authors)

"""Admin console API (ADR 0016) — stats, user board, and moderation.

Access: a signed-in session whose account email is in MAYO_ADMIN_EMAILS
(comma-separated, defaults to the owner). Everything else gets 403 — which the
app also uses as the probe to decide whether to show the admin entry at all.
"""

from __future__ import annotations

import time
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, Field

from .. import runtime
from ..auth import store as users
from ..config import settings
from ..store import explore as explore_store
from ..store import jobs as job_store
from ..store import library

router = APIRouter(prefix="/v1/admin", tags=["admin"])


def require_admin(x_mayo_session: Optional[str] = Header(default=None)) -> dict:
    user = users.user_for_session(x_mayo_session or "")
    allowed = [e.strip().lower() for e in settings.admin_emails if e.strip()]
    if not user or user.get("email", "").lower() not in allowed:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="admin only")
    return user


class AdminStats(BaseModel):
    users: int
    signups7d: int
    activeSessions: int
    videos: int
    jobsQueued: int
    jobsGenerating: int
    jobsDone: int
    jobsFailed: int
    explorePosts: int
    likes: int
    comments: int
    views: int
    shares: int
    storageBytes: int
    creditsOutstanding: int
    generationBackend: str
    plannerBackend: str


class AdminUser(BaseModel):
    id: str
    email: str
    name: str
    providers: list[str]
    planId: str
    credits: int
    createdAt: float
    videos: int
    hasByok: bool


class CreditAdjust(BaseModel):
    delta: int = Field(ge=-100000, le=100000)


class PlanChange(BaseModel):
    planId: str = Field(pattern="^(free|pro|studio)$")


@router.get("/stats", response_model=AdminStats)
async def stats(admin: dict = Depends(require_admin)) -> AdminStats:
    from ..storage import get_storage

    now = time.time()
    all_users = list(users.users.values())
    jobs = await job_store.list_all()
    videos = await library.list_all()
    posts = await explore_store.list("latest")

    store = get_storage()
    storage_bytes = 0
    for v in videos:
        if v.url and "/v1/media/" in v.url:
            try:
                storage_bytes += store.size(v.url.split("/v1/media/", 1)[-1])
            except Exception:
                pass

    return AdminStats(
        users=len(all_users),
        signups7d=sum(1 for u in all_users if now - u.get("createdAt", 0) < 7 * 86400),
        activeSessions=sum(1 for s in users.sessions.values() if s["expiresAt"] > now),
        videos=len(videos),
        jobsQueued=sum(1 for j in jobs if j.status == "queued"),
        jobsGenerating=sum(1 for j in jobs if j.status == "generating"),
        jobsDone=sum(1 for j in jobs if j.status == "done"),
        jobsFailed=sum(1 for j in jobs if j.status == "failed"),
        explorePosts=len(posts),
        likes=sum(p.likes for p in posts),
        comments=sum(p.comments for p in posts),
        views=sum(p.views for p in posts),
        shares=sum(p.shares for p in posts),
        storageBytes=storage_bytes,
        creditsOutstanding=sum(int(u.get("credits", 0)) for u in all_users),
        generationBackend=runtime.generation_backend(),
        plannerBackend=runtime.planner_backend(),
    )


async def _user_rows() -> list[AdminUser]:
    from ..auth import to_public

    videos = await library.list_all()
    counts: dict[str, int] = {}
    for v in videos:
        if v.ownerId:
            counts[v.ownerId] = counts.get(v.ownerId, 0) + 1
    out: list[AdminUser] = []
    for u in sorted(users.users.values(), key=lambda x: x.get("createdAt", 0), reverse=True):
        pub = to_public(u)
        out.append(
            AdminUser(
                id=pub.id,
                email=pub.email,
                name=pub.name,
                providers=pub.providers,
                planId=pub.planId,
                credits=pub.credits,
                createdAt=pub.createdAt,
                videos=counts.get(pub.id, 0),
                hasByok=bool(u.get("byokKeys")),
            )
        )
    return out


async def _user_row(user_id: str) -> AdminUser:
    for row in await _user_rows():
        if row.id == user_id:
            return row
    raise HTTPException(status.HTTP_404_NOT_FOUND, detail="user not found")


@router.get("/users", response_model=list[AdminUser])
async def list_users(admin: dict = Depends(require_admin)) -> list[AdminUser]:
    return await _user_rows()


@router.post("/users/{user_id}/credits", response_model=AdminUser)
async def adjust_credits(
    user_id: str, req: CreditAdjust, admin: dict = Depends(require_admin)
) -> AdminUser:
    if users.add_credits(user_id, req.delta) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="user not found")
    return await _user_row(user_id)


@router.post("/users/{user_id}/plan", response_model=AdminUser)
async def set_plan(
    user_id: str, req: PlanChange, admin: dict = Depends(require_admin)
) -> AdminUser:
    if not users.set_plan(user_id, req.planId):
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="user not found")
    return await _user_row(user_id)


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, admin: dict = Depends(require_admin)) -> dict:
    """Remove an account (its sessions too). Media/posts stay for moderation."""
    if user_id == admin["id"]:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="cannot delete yourself")
    if user_id not in users.users:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="user not found")
    users.users.pop(user_id, None)
    for tok in [t for t, s in users.sessions.items() if s["userId"] == user_id]:
        users.sessions.pop(tok, None)
    users.save()
    return {"deleted": True}


@router.delete("/explore/{item_id}")
async def delete_explore_item(item_id: str, admin: dict = Depends(require_admin)) -> dict:
    """Moderation: take any published reel down."""
    if not await explore_store.remove(item_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="not found")
    return {"deleted": True}

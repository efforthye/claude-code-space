"""Explore feed — browse trending community creations and 'make like this'.

Seeded, in-memory for now (like the library); a real backend swaps the store for
published user videos later. The `prompt` on each item powers the remix flow.
"""

from fastapi import APIRouter, HTTPException, status

from ..schemas import ExploreItem
from ..store import explore as explore_store

router = APIRouter(prefix="/v1/explore", tags=["explore"])


@router.get("", response_model=list[ExploreItem])
async def list_explore() -> list[ExploreItem]:
    return await explore_store.list()


@router.post("/{item_id}/like", response_model=ExploreItem)
async def like_explore(item_id: str) -> ExploreItem:
    item = await explore_store.like(item_id)
    if item is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="not found")
    return item

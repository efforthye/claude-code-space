from typing import Optional

from fastapi import APIRouter, Header, HTTPException, status

from .. import catalog, runtime
from ..auth import paid_user_or_none
from ..config import settings
from ..schemas import CreateJobRequest, Estimate, Job
from ..store import jobs as job_store
from ..worker import start_generation

router = APIRouter(prefix="/v1/jobs", tags=["jobs"])


@router.get("", response_model=list[Job])
async def list_jobs() -> list[Job]:
    return await job_store.list()


@router.post("/estimate", response_model=Estimate)
async def estimate(
    req: CreateJobRequest, x_mayo_session: Optional[str] = Header(default=None)
) -> Estimate:
    tier = catalog.tier_by_id(req.tier)
    if tier is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=f"unknown tier '{req.tier}'")
    base = catalog.estimate_credits(req.seconds, tier)
    # BYOK pricing: a signed-in user with any stored provider key pays the BYOK
    # factor on their own — independent of the global (owner) toggle.
    from ..auth import store as users
    from ..runtime import BYOK_PRICE_FACTOR

    caller = users.user_for_session(x_mayo_session or "")
    factor = (
        BYOK_PRICE_FACTOR
        if (caller and caller.get("byokKeys"))
        else runtime.price_factor()
    )
    credits = max(1, round(base * factor))
    return Estimate(seconds=req.seconds, tier=req.tier, credits=credits)


@router.post("", response_model=Job, status_code=status.HTTP_201_CREATED)
async def create_job(
    req: CreateJobRequest, x_mayo_session: Optional[str] = Header(default=None)
) -> Job:
    if catalog.tier_by_id(req.tier) is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=f"unknown tier '{req.tier}'")
    # External generation spends the owner's paid provider keys — when premium
    # gating is on, it's reserved for signed-in paid-plan users (ADR 0011/0012).
    if (
        settings.premium_gating
        and runtime.generation_backend() == "external"
        and paid_user_or_none(x_mayo_session) is None
    ):
        raise HTTPException(
            status.HTTP_402_PAYMENT_REQUIRED,
            detail="external AI generation is for paid plans — upgrade or switch generation mode",
        )
    job = await job_store.create(req.prompt, req.seconds, req.tier, req.scenePrompts or None)
    start_generation(job.id)
    return job


@router.get("/{job_id}", response_model=Job)
async def get_job(job_id: str) -> Job:
    job = await job_store.get(job_id)
    if job is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="job not found")
    return job


@router.post("/{job_id}/retry", response_model=Job)
async def retry_job(job_id: str) -> Job:
    job = await job_store.retry(job_id)
    if job is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="job not found")
    start_generation(job_id)
    return job


@router.delete("/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_job(job_id: str) -> None:
    removed = await job_store.remove(job_id)
    if not removed:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="job not found")

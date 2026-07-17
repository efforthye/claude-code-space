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


def _price_credits(req: CreateJobRequest, caller: Optional[dict]) -> int:
    """Credit price for a job — shared by /estimate and the charge at create.

    BYOK pricing: a signed-in user with any stored provider key pays the BYOK
    factor on their own — independent of the global (owner) toggle.
    """
    tier = catalog.tier_by_id(req.tier)
    if tier is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=f"unknown tier '{req.tier}'")
    base = catalog.estimate_credits(req.seconds, tier)
    from ..runtime import BYOK_PRICE_FACTOR

    factor = (
        BYOK_PRICE_FACTOR
        if (caller and caller.get("byokKeys"))
        else runtime.price_factor()
    )
    return max(1, round(base * factor))


@router.post("/estimate", response_model=Estimate)
async def estimate(
    req: CreateJobRequest, x_mayo_session: Optional[str] = Header(default=None)
) -> Estimate:
    from ..auth import store as users

    caller = users.user_for_session(x_mayo_session or "")
    credits = _price_credits(req, caller)
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
    # Charge signed-in users up front; cancelling refunds the unrendered share
    # (pro-rata) via DELETE below. Anonymous callers are not metered.
    from ..auth import store as users

    caller = users.user_for_session(x_mayo_session or "")
    charge: int | None = None
    if caller:
        charge = _price_credits(req, caller)
        balance = int(caller.get("credits", 0))
        if balance < charge:
            raise HTTPException(
                status.HTTP_402_PAYMENT_REQUIRED,
                detail=f"크레딧이 부족해요 (필요 {charge}, 보유 {balance})",
            )
        users.add_credits(caller["id"], -charge)
    job = await job_store.create(
        req.prompt,
        req.seconds,
        req.tier,
        req.scenePrompts or None,
        style_prompt=req.stylePrompt,
        charged_credits=charge,
        owner_id=caller["id"] if caller else None,
    )
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


@router.delete("/{job_id}")
async def delete_job(job_id: str) -> dict:
    """Cancel/remove a job. If the caller was charged, refund the unrendered
    share pro-rata: cancel a 6-scene job after 2 scenes → 4/6 of the charge back.
    """
    job = await job_store.get(job_id)
    if job is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="job not found")
    refund = 0
    balance: int | None = None
    owner = job_store.owner_of(job_id)
    if job.chargedCredits and owner and job.status != "done":
        total = max(1, job.scenesTotal or 1)
        done = min(max(job.scenesDone or 0, 0), total)
        refund = round(job.chargedCredits * (total - done) / total)
        if refund > 0:
            from ..auth import store as users

            balance = users.add_credits(owner, refund)
    await job_store.remove(job_id)
    return {"deleted": True, "refundedCredits": refund, "credits": balance}

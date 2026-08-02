import logging
from typing import Optional

from fastapi import APIRouter, Header, HTTPException, status
from pydantic import BaseModel, Field

from .. import catalog, runtime
from ..auth import premium_user_or_none
from ..config import settings
from ..schemas import CreateJobRequest, Estimate, Job
from ..store import jobs as job_store
from ..worker import register_task, start_generation

logger = logging.getLogger("uvicorn.error")

router = APIRouter(prefix="/v1/jobs", tags=["jobs"])


def _require_job_access(job_id: str, session_token: Optional[str]) -> None:
    """403 unless the caller may act on this job.

    A job with an owner belongs to that account: only that owner (or an admin)
    may read or mutate it — a job id alone is not a credential. Ownerless jobs
    (anonymous/legacy) stay open to everyone, matching how they are listed.
    """
    owner = job_store.owner_of(job_id)
    if owner is None:
        return
    from ..auth import is_admin_user
    from ..auth import store as users

    caller = users.user_for_session(session_token or "")
    if caller and (caller["id"] == owner or is_admin_user(caller)):
        return
    raise HTTPException(status.HTTP_403_FORBIDDEN, detail="not your job")


def _require_premium_for_external(session_token: Optional[str]) -> None:
    """The paid gate: external generation spends the owner's provider keys, so
    with premium gating on it is reserved for premium (or admin) accounts.
    Applied at EVERY endpoint that can trigger an external render — leaving one
    out is a free tunnel through the paywall."""
    if (
        settings.premium_gating
        and runtime.generation_backend() == "external"
        and premium_user_or_none(session_token) is None
    ):
        raise HTTPException(
            status.HTTP_402_PAYMENT_REQUIRED,
            detail="external AI generation is for paid plans — upgrade or switch generation mode",
        )


@router.get("", response_model=list[Job])
async def list_jobs(x_mayo_session: Optional[str] = Header(default=None)) -> list[Job]:
    """The caller's own jobs (plus ownerless legacy/anonymous ones)."""
    from ..auth import store as users

    caller = users.user_for_session(x_mayo_session or "")
    return await job_store.list(caller["id"] if caller else None)


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
    return Estimate(
        seconds=req.seconds,
        tier=req.tier,
        credits=credits,
        # Two prices, deliberately: `credits` is what a subscriber spends,
        # `usd` is what it costs to render this right now with no subscription.
        # The pay-as-you-go number is the banded one, so a long film is not
        # quoted at the short-clip rate.
        usd=catalog.payg_usd_for_seconds(req.seconds),
        scenes=catalog.billable_scenes(req.seconds),
        etaSeconds=catalog.eta_seconds(
            catalog.billable_scenes(req.seconds), req.videoModel or None
        ),
    )


@router.post("", response_model=Job, status_code=status.HTTP_201_CREATED)
async def create_job(
    req: CreateJobRequest, x_mayo_session: Optional[str] = Header(default=None)
) -> Job:
    if catalog.tier_by_id(req.tier) is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=f"unknown tier '{req.tier}'")
    # External generation spends the owner's paid provider keys — when premium
    # gating is on, it's reserved for signed-in paid-plan users (ADR 0011/0012).
    # The paid gate belongs where the money is, not at the door. A staged job
    # spends nothing until the clips stage, so a free user can plan a film and
    # see its stills first — which is also the only honest way to show what they
    # would be paying for. The gate moves to POST /{id}/clips.
    if not req.staged:
        _require_premium_for_external(x_mayo_session)
    # Charge signed-in users up front; cancelling refunds the unrendered share
    # (pro-rata) via DELETE below. Anonymous callers are not metered.
    from ..auth import store as users

    caller = users.user_for_session(x_mayo_session or "")
    charge: int | None = None
    # A staged job spends nothing at creation: the beat sheet and the stills are
    # cheap, and the clips stage bills per clip as it renders (ADR 0020).
    # Charging up front here would defeat the gates it exists to protect.
    if caller and not req.staged:
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
        aspect=req.aspect,
        video_model=req.videoModel or None,
        stage="beats" if req.staged else "clips",
    )
    # Staged jobs render NOTHING at creation — that is the whole point of the
    # staged flow (review first, pay at the clips gate). Kicking the legacy
    # worker here made it render (and bill) behind the review screen while the
    # user was still approving beats, and its 'generating' status hid the
    # clips-stage start button.
    if not req.staged:
        start_generation(job.id)
    from .. import ledger

    ledger.record(
        "job_created",
        caller["id"] if caller else None,
        email=(caller or {}).get("email", ""),
        title=job.title,
        prompt=(req.prompt or "")[:300],
        credits=charge or 0,
        product="staged" if req.staged else "quick",
    )
    return job


@router.get("/{job_id}", response_model=Job)
async def get_job(
    job_id: str, x_mayo_session: Optional[str] = Header(default=None)
) -> Job:
    job = await job_store.get(job_id)
    if job is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="job not found")
    # A job carries its prompts — the user's creative work — so reading an
    # owned job is as gated as mutating it.
    _require_job_access(job_id, x_mayo_session)
    return job


@router.post("/{job_id}/retry", response_model=Job)
async def retry_job(
    job_id: str, x_mayo_session: Optional[str] = Header(default=None)
) -> Job:
    current = await job_store.get(job_id)
    if current is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="job not found")
    _require_job_access(job_id, x_mayo_session)
    if current.status == "generating":
        # A second _run on the same job renders — and bills — every scene twice.
        raise HTTPException(
            status.HTTP_409_CONFLICT, detail="job is already generating"
        )
    job = await job_store.retry(job_id)
    if job is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="job not found")
    start_generation(job_id)
    return job


@router.delete("/{job_id}")
async def delete_job(
    job_id: str, x_mayo_session: Optional[str] = Header(default=None)
) -> dict:
    """Cancel/remove a job. If the caller was charged, refund the unrendered
    share pro-rata: cancel a 6-scene job after 2 scenes → 4/6 of the charge back.
    """
    job = await job_store.get(job_id)
    if job is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="job not found")
    _require_job_access(job_id, x_mayo_session)
    refund = 0
    balance: int | None = None
    owner = job_store.owner_of(job_id)
    if job.chargedCredits and owner and job.status != "done":
        total = max(1, job.scenesTotal or 1)
        done = min(max(job.scenesDone or 0, 0), total)
        refund = round(job.chargedCredits * (total - done) / total)
    # Refund only a removal that actually happened — two concurrent deletes of
    # the same job must not both put the money back.
    removed = await job_store.remove(job_id)
    if not removed:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="job not found")
    if refund > 0 and owner:
        from ..auth import store as users

        balance = users.add_credits(owner, refund)
    else:
        refund = 0
    return {"deleted": True, "refundedCredits": refund, "credits": balance}


# --- Staged production, stage 1: the beat sheet (ADR 0020) ------------------
# Text is the cheapest artefact in the pipeline and it decides everything after
# it, so it is planned, reviewed and rewritten before anything costs money.
# None of these endpoints spend generation credits.


class BeatsRequest(BaseModel):
    prompt: str = Field(default="", max_length=2000)


class RewriteSegmentRequest(BaseModel):
    instruction: str = Field(min_length=1, max_length=1000)


@router.post("/{job_id}/beats", response_model=Job)
async def plan_beats(
    job_id: str, req: BeatsRequest, x_mayo_session: Optional[str] = Header(default=None)
) -> Job:
    """Draft the timecoded beat sheet. Safe to re-run: it replaces the draft."""
    job = await job_store.get(job_id)
    if job is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="job not found")
    _require_job_access(job_id, x_mayo_session)

    from .. import segments as seg

    _screenplay, made = await seg.plan_segments(
        req.prompt or job.title, job.seconds or 60, job.tierLabel or "standard"
    )
    updated = await job_store.set_segments(job_id, made, stage="beats")
    if updated is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="job not found")
    return updated


@router.post("/{job_id}/segments/{index}/rewrite", response_model=Job)
async def rewrite_one_segment(
    job_id: str,
    index: int,
    req: RewriteSegmentRequest,
    x_mayo_session: Optional[str] = Header(default=None),
) -> Job:
    """Rewrite a single beat. Neighbours are passed as context so the
    replacement still connects; a beat rewritten in isolation reads like it."""
    job = await job_store.get(job_id)
    if job is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="job not found")
    _require_job_access(job_id, x_mayo_session)

    from .. import segments as seg

    try:
        updated_segment = await seg.rewrite_segment(
            job.segments, index, req.instruction, job.tierLabel or "standard"
        )
    except IndexError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="segment not found")

    updated = await job_store.set_segment(job_id, updated_segment)
    if updated is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="segment not found")
    return updated


# What "approve" means depends on what is being looked at. One endpoint, so the
# app does not have to know which verb belongs to which stage.
_APPROVES = {"draft": "approved", "imaged": "imageApproved", "rendered": "clipApproved"}


@router.post("/{job_id}/segments/{index}/approve", response_model=Job)
async def approve_segment(
    job_id: str, index: int, x_mayo_session: Optional[str] = Header(default=None)
) -> Job:
    job = await job_store.get(job_id)
    if job is None or not 0 <= index < len(job.segments):
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="segment not found")
    _require_job_access(job_id, x_mayo_session)
    target = job.segments[index].model_copy()
    nxt = _APPROVES.get(target.status)
    if nxt is None:
        # Nothing to approve at this status (e.g. an approved still while the
        # clip hasn't rendered). Silently no-oping here left the review screen
        # stuck at 0/N with no explanation — answer 409 with the reason instead.
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail=f"segment {index} is '{target.status}' — nothing to approve yet"
            + (" (start clip rendering first)" if job.stage == "clips" else ""),
        )
    target.status = nxt
    updated = await job_store.set_segment(job_id, target)
    if updated is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="segment not found")
    return updated


@router.post("/{job_id}/stills", response_model=Job)
async def render_stills(
    job_id: str, x_mayo_session: Optional[str] = Header(default=None)
) -> Job:
    """Stage 2: a still for every segment. Cheap next to video, so it runs for
    the whole beat sheet at once rather than one at a time — but it still spends
    the owner's provider money on the external backend, so the premium gate
    applies here exactly as it does at the clips stage."""
    job = await job_store.get(job_id)
    if job is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="job not found")
    _require_job_access(job_id, x_mayo_session)
    _require_premium_for_external(x_mayo_session)
    if job.stage != "stills":
        raise HTTPException(
            status.HTTP_409_CONFLICT, detail=f"job is at stage '{job.stage}', not 'stills'"
        )

    from .. import segments as seg
    from ..auth import store as users

    caller = users.user_for_session(x_mayo_session or "")
    owner = caller["id"] if caller else None

    done = []
    for segment in job.segments:
        if segment.imageKey:
            done.append(segment)  # already rendered — never charge twice
            continue
        try:
            charged = await seg.charge_for_still(job_id, owner, job.tierLabel or "standard")
        except seg.InsufficientCredits as exc:
            # Keep what was paid for and rendered; say plainly why it stopped.
            if done:
                await job_store.set_segments(job_id, done + job.segments[len(done) :])
            raise HTTPException(
                status.HTTP_402_PAYMENT_REQUIRED,
                detail=f"크레딧이 부족해요 — {exc.needed}크레딧 필요, 잔액 {exc.balance}크레딧.",
            ) from exc
        try:
            done.append(await seg.render_segment_image(job_id, segment, job.stylePrompt or ""))
        except Exception:
            await seg.refund_still(job_id, owner, charged)
            logger.exception("still %s failed for job %s", segment.index, job_id)
            done.append(segment)
    updated = await job_store.set_segments(job_id, done)
    if updated is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="job not found")
    return updated


@router.post("/{job_id}/segments/{index}/reimage", response_model=Job)
async def reimage_segment(
    job_id: str, index: int, x_mayo_session: Optional[str] = Header(default=None)
) -> Job:
    """Regenerate ONE still, leaving every other segment alone.

    Safe because the style block is reapplied, so the replacement matches the
    look of its neighbours instead of drifting (ADR 0014)."""
    job = await job_store.get(job_id)
    if job is None or not 0 <= index < len(job.segments):
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="segment not found")
    _require_job_access(job_id, x_mayo_session)
    _require_premium_for_external(x_mayo_session)

    from .. import segments as seg

    redone = await seg.render_segment_image(job_id, job.segments[index], job.stylePrompt or "")
    updated = await job_store.set_segment(job_id, redone)
    if updated is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="segment not found")
    return updated


@router.post("/{job_id}/approve-all", response_model=Job)
async def approve_all(
    job_id: str, x_mayo_session: Optional[str] = Header(default=None)
) -> Job:
    """Approve every segment at the current stage at once.

    Reviewing is the point of the staged flow; pressing approve twelve separate
    times is not. Someone who has read the sheet and is happy with it needs one
    action, and the per-segment approve stays for the case it was built for —
    accepting most of a film and redoing one part of it.
    """
    job = await job_store.get(job_id)
    if job is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="job not found")
    _require_job_access(job_id, x_mayo_session)

    required = {"beats": "approved", "stills": "imageApproved", "clips": "clipApproved"}.get(
        job.stage
    )
    if required is None:
        raise HTTPException(
            status.HTTP_409_CONFLICT, detail=f"nothing to approve at stage '{job.stage}'"
        )

    from .. import segments as seg

    segs = []
    for segment in job.segments:
        # Only ever moves a segment FORWARD: a still that has not been rendered
        # cannot be image-approved, and blanket-approving one would send an
        # empty frame to the renderer.
        if seg.can_reach(segment, required):
            segs.append(segment.model_copy(update={"status": required}))
        else:
            segs.append(segment)
    updated = await job_store.set_segments(job_id, segs, stage=job.stage)
    if updated is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="job not found")
    return updated


@router.post("/{job_id}/advance", response_model=Job)
async def advance_stage(
    job_id: str, x_mayo_session: Optional[str] = Header(default=None)
) -> Job:
    """Move to the next stage — the "OK, next" button.

    Refuses while any segment is still unapproved. The gate is the feature: it
    is what stops an unreviewed plan turning into a paid render.
    """
    job = await job_store.get(job_id)
    if job is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="job not found")
    _require_job_access(job_id, x_mayo_session)

    from .. import segments as seg

    if job.stage == "beats":
        if not seg.stage_is_complete(job.segments, "approved"):
            pending = [s.index for s in job.segments if s.status == "draft"]
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                detail=f"approve every beat first — still pending: {pending}",
            )
        updated = await job_store.set_segments(job_id, job.segments, stage="stills")
        if updated is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="job not found")
        # Deliberately does NOT start rendering. Stills looked free and were
        # briefly auto-started here; they are not — Higgsfield charges about
        # $0.06 an image, so this is a paid step and a paid step is never
        # implicit. The screen shows the price and waits for a press.
        return updated

    if job.stage == "stills":
        if not seg.stage_is_complete(job.segments, "imageApproved"):
            pending = [s.index for s in job.segments if s.status in ("draft", "approved", "imaged")]
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                detail=f"approve every still first — still pending: {pending}",
            )
        updated = await job_store.set_segments(job_id, job.segments, stage="clips")
        if updated is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="job not found")
        return updated

    raise HTTPException(
        status.HTTP_409_CONFLICT,
        detail=f"advancing from '{job.stage}' is not implemented yet (MAYO-28)",
    )


# --- Staged production, stage 3: clips (ADR 0020) ---------------------------
# The only stage that spends money, so it is the one with a stop button, a
# per-clip charge, and a warning about what a stop actually costs.


class ClipModeRequest(BaseModel):
    mode: str = Field(default="renderAll", pattern="^(stopOnReject|renderAll)$")


@router.get("/{job_id}/clip-quote", response_model=dict)
async def clip_quote(job_id: str, x_mayo_session: Optional[str] = Header(default=None)) -> dict:
    """What rendering the remaining clips will cost, and what a stop would cost.

    Shown before the button that starts spending, and inside the stop
    confirmation. Being explicit that the in-flight clip is billed is the
    difference between a stop button people trust and one they suspect.
    """
    job = await job_store.get(job_id)
    if job is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="job not found")
    _require_job_access(job_id, x_mayo_session)

    tier = catalog.tier_by_id((job.tierLabel or "standard").lower())
    per_clip = catalog.credits_per_scene(tier)
    remaining = [s for s in job.segments if not s.clipKey]
    return {
        "perClipCredits": per_clip,
        "remaining": len(remaining),
        "remainingCredits": per_clip * len(remaining),
        "spentCredits": job.spentCredits,
        # A stop takes effect after the clip currently rendering, which is
        # already paid for on our side and cannot be cancelled.
        "stopCostsCredits": per_clip if job.status == "generating" else 0,
        "etaSeconds": catalog.eta_seconds(len(remaining), job.videoModel, concurrency=1),
    }


@router.post("/{job_id}/clips", response_model=Job)
async def start_clips(
    job_id: str, req: ClipModeRequest, x_mayo_session: Optional[str] = Header(default=None)
) -> Job:
    """Begin rendering clips. This is where the money starts."""
    job = await job_store.get(job_id)
    if job is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="job not found")
    _require_job_access(job_id, x_mayo_session)
    if job.stage != "clips" or not job.segments:
        raise HTTPException(
            status.HTTP_409_CONFLICT, detail=f"job is at stage '{job.stage}', not ready for clips"
        )

    from .. import segments as _seg

    # Idempotent: a second press while the first render is in flight must not
    # start a second renderer. Each one charges per clip before submitting, so
    # the duplicate is not just wasted work — it is duplicate money.
    if _seg.is_rendering_clips(job_id):
        raise HTTPException(
            status.HTTP_409_CONFLICT, detail="이미 렌더링 중이에요 — 진행 상황을 확인해 주세요."
        )

    # This is the paid boundary for a staged job — everything before it was free.
    _require_premium_for_external(x_mayo_session)

    from ..auth import store as users

    caller = users.user_for_session(x_mayo_session or "")
    await job_store.set_clip_mode(job_id, req.mode)

    import asyncio

    from .. import segments as seg

    # register_task keeps a strong reference: asyncio only holds a weak one, so
    # an untracked render task can be garbage-collected mid-render.
    register_task(
        asyncio.create_task(seg.render_clips(job_id, caller["id"] if caller else None))
    )
    updated = await job_store.get(job_id)
    if updated is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="job not found")
    return updated


@router.post("/{job_id}/stop", response_model=dict)
async def stop_clips(
    job_id: str, x_mayo_session: Optional[str] = Header(default=None)
) -> dict:
    """Stop after the clip currently rendering. Nothing after it is charged."""
    _require_job_access(job_id, x_mayo_session)
    job = await job_store.request_stop(job_id)
    if job is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="job not found")
    return {"stopped": True, "spentCredits": job.spentCredits}


@router.post("/{job_id}/segments/{index}/reclip", response_model=Job)
async def reclip_segment(
    job_id: str, index: int, x_mayo_session: Optional[str] = Header(default=None)
) -> Job:
    """Re-render ONE clip, and say which later clip it just invalidated.

    Re-rendering clip N changes the frame clip N+1 started from, so N+1 no
    longer follows on. Only N+1 — everything after it still follows its own
    predecessor, and saying "everything after" would turn one $0.43 clip into
    forty.
    """
    job = await job_store.get(job_id)
    if job is None or not 0 <= index < len(job.segments):
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="segment not found")
    _require_job_access(job_id, x_mayo_session)
    _require_premium_for_external(x_mayo_session)

    from ..auth import store as users
    from .. import segments as seg

    # A re-render is a fresh paid clip — it needs someone to bill. Rendering
    # for a caller with no session would be a free tunnel around the charge.
    caller = users.user_for_session(x_mayo_session or "")
    if caller is None:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED, detail="sign in to re-render clips"
        )
    tier = catalog.tier_by_id((job.tierLabel or "standard").lower())
    per_clip = catalog.credits_per_scene(tier)
    balance = int(caller.get("credits", 0))
    if balance < per_clip:
        raise HTTPException(
            status.HTTP_402_PAYMENT_REQUIRED,
            detail=f"크레딧이 부족해요 (필요 {per_clip}, 보유 {balance})",
        )
    users.add_credits(caller["id"], -per_clip)
    await job_store.add_spend(job_id, per_clip)

    try:
        done = await seg.render_segment_clip(job_id, job.segments, index, job.videoModel)
    except Exception:
        # The render never happened, so the charge must not stand.
        users.add_credits(caller["id"], per_clip)
        await job_store.add_spend(job_id, -per_clip)
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            detail="클립 재생성에 실패했어요 — 크레딧은 환불됐어요",
        )
    updated = await job_store.set_segment(job_id, done)
    if updated is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="segment not found")
    return updated

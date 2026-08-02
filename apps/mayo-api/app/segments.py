"""Stage 1 of the staged production flow (ADR 0020): the timecoded beat sheet.

The cheapest artefact in the pipeline and the one that decides everything after
it. A film is planned here as plain language per time slice, reviewed and
rewritten until it is right, and only then does anything expensive happen.

Why this stage exists at all: a ten-minute film is 60 clips and about $23. Text
costs an LLM call. Getting the plan wrong here is free; getting it wrong two
stages later is not.
"""

from __future__ import annotations

from typing import Optional

from .planner import Screenplay, get_scenario_planner
from .schemas import Moment, Segment

class InsufficientCredits(Exception):
    """Not enough credits for the next paid step."""

    def __init__(self, needed: int, balance: int) -> None:
        super().__init__(f"needs {needed} credits, balance {balance}")
        self.needed = needed
        self.balance = balance


def segment_seconds() -> float:
    """One segment per clip — whatever a clip actually is on this backend.

    Hard-coded to 10 until 2026-08-01, which meant a ten-second short planned as
    a single beat covering the whole film while the renderer made two five-second
    clips from it. The beat sheet is the thing the user approves, so it has to
    describe the pieces that will really be rendered: 0:00-0:05, 0:05-0:10.
    """
    from .catalog import clip_seconds

    return max(1.0, clip_seconds())


def segments_from_screenplay(screenplay: Screenplay, seconds: int) -> list[Segment]:
    """Lay a screenplay onto a timeline of segments.

    The planner decides how many scenes a story wants; the timeline decides how
    long the film is. When they disagree the timeline wins, because the user
    asked for a duration — scenes are cycled to fill it rather than truncated,
    which is what the existing worker already does for scenePrompts.
    """
    scenes = list(screenplay.scenes)
    if not scenes:
        return []

    from .catalog import clips_for_duration

    # One beat per clip, counted by the same function the renderer uses — not a
    # parallel calculation that can drift from it. clips_for_duration also
    # applies the max_scenes cap, so a very long film plans the beats that will
    # really be rendered rather than a longer sheet the renderer then truncates.
    total_clips = clips_for_duration(seconds)
    # Clips are a FIXED length — the beats have to be too, or the sheet would
    # promise timings the renderer cannot hit. Only the last slice is short,
    # because that is exactly what the stitched film does when the duration is
    # not a whole number of clips.
    step = max(1, int(round(segment_seconds())))

    out: list[Segment] = []
    start = 0
    i = 0
    while start < seconds and len(out) < total_clips:
        end = min(start + step, seconds)
        if len(out) == total_clips - 1:
            end = seconds  # the cap ends the film here whatever the arithmetic says
        if end <= start:  # degenerate step — never loop forever
            end = seconds
        scene = scenes[i % len(scenes)]
        out.append(
            Segment(
                index=len(out),
                startSec=start,
                endSec=end,
                # The beat is written for the user, in their language; the heading is a
                # four-word slug and the prompt is English render-speak. Falling
                # back to the heading made the review sheet a list of labels.
                text=scene.beat or scene.heading or scene.prompt[:80],
                # Rebased onto this segment's place on the timeline: the director
                # writes moments relative to its own scene, the review screen
                # shows them against the film's clock.
                timeline=[
                    Moment(
                        fromSec=start + m.fromSec,
                        toSec=min(start + m.toSec, end),
                        action=m.action,
                    )
                    for m in (scene.timeline or [])
                    if start + m.fromSec < end
                ],
                prompt=scene.prompt,
                status="draft",
            )
        )
        start = end
        i += 1
    return out


async def plan_segments(prompt: str, seconds: int, tier: str) -> tuple[Screenplay, list[Segment]]:
    """Ask the director for a screenplay and lay it out as reviewable segments."""
    planner = get_scenario_planner()
    screenplay = await planner.plan(prompt, seconds, tier)
    return screenplay, segments_from_screenplay(screenplay, seconds)


async def rewrite_segment(
    segments: list[Segment], index: int, instruction: str, tier: str
) -> Segment:
    """Rewrite ONE segment, leaving its neighbours untouched.

    The director is given the surrounding beats as context so the replacement
    still connects to what comes before and after — a segment rewritten in
    isolation reads like it was, which is the failure mode this stage exists to
    prevent.
    """
    if not 0 <= index < len(segments):
        raise IndexError(f"segment {index} out of range")

    target = segments[index]
    before = segments[index - 1].text if index > 0 else "(start of film)"
    after = segments[index + 1].text if index + 1 < len(segments) else "(end of film)"

    brief = (
        f"Rewrite ONLY this beat of a film, keeping it consistent with its neighbours.\n"
        f"Previous beat: {before}\n"
        f"This beat ({target.startSec}-{target.endSec}s): {target.text}\n"
        f"Next beat: {after}\n"
        f"Change requested: {instruction}\n"
        f"Answer with the replacement beat for THIS slice only."
    )

    planner = get_scenario_planner()
    # Re-plan a single slice: ask for a one-scene screenplay of this length.
    replacement = await planner.plan(brief, max(1, target.endSec - target.startSec), tier)

    scene = replacement.scenes[0] if replacement.scenes else None
    updated = target.model_copy()
    if scene:
        updated.text = scene.beat or scene.heading or scene.prompt[:80]
        updated.prompt = scene.prompt
        if scene.timeline:
            updated.timeline = [
                Moment(
                    fromSec=target.startSec + m.fromSec,
                    toSec=min(target.startSec + m.toSec, target.endSec),
                    action=m.action,
                )
                for m in scene.timeline
                if target.startSec + m.fromSec < target.endSec
            ]
    updated.status = "draft"  # a rewrite un-approves it
    updated.rewrites = target.rewrites + 1
    return updated


def can_reach(segment, required: str) -> bool:
    """Whether this segment has the artefact `required` claims it approves.

    Approving is a statement about something that exists. A beat always exists,
    so "approved" is always reachable; "imageApproved" needs a rendered still
    and "clipApproved" needs a rendered clip. Without this a blanket approve
    would mark un-rendered segments as reviewed and hand blank frames to the
    renderer.
    """
    if required == "approved":
        return True
    if required == "imageApproved":
        return bool(segment.imageKey)
    if required == "clipApproved":
        return bool(segment.clipKey)
    return False


def stage_is_complete(segments: list[Segment], required: str) -> bool:
    """Whether every segment has reached the status a gate demands."""
    order = ["draft", "approved", "imaged", "imageApproved", "rendered", "clipApproved"]
    if required not in order:
        return False
    need = order.index(required)
    return bool(segments) and all(order.index(s.status) >= need for s in segments)


# --- Stage 2: one still per segment ----------------------------------------


async def charge_for_still(job_id: str, owner_id: Optional[str], tier_label: str) -> int:
    """Take payment for one still, or raise if the account cannot cover it.

    Same shape as the clip charge: money moves BEFORE the request goes out,
    because once the provider has it we owe for it whether or not we are still
    here to see the result.
    """
    from . import catalog
    from .auth import store as users
    from .store import jobs as job_store

    if not owner_id:
        return 0
    tier = catalog.tier_by_id((tier_label or "standard").lower())
    price = catalog.credits_per_still(tier)
    balance = int((users.users.get(owner_id) or {}).get("credits", 0))
    if balance < price:
        raise InsufficientCredits(price, balance)
    users.add_credits(owner_id, -price)
    await job_store.add_spend(job_id, price)
    return price


async def refund_still(job_id: str, owner_id: Optional[str], amount: int) -> None:
    """Put a still's credits back when its render never happened."""
    if not owner_id or amount <= 0:
        return
    from .auth import store as users
    from .store import jobs as job_store

    users.add_credits(owner_id, amount)
    await job_store.add_spend(job_id, -amount)


async def render_segment_image(job_id: str, segment: Segment, style_prompt: str = "") -> Segment:
    """Generate (or regenerate) the still for ONE segment.

    Reuses the storyboard renderer, which already handles all three backends.
    The style block is prepended on every call — including a regenerate — so a
    single replaced image does not drift away from the look of its neighbours
    (ADR 0014). That is the whole reason regenerating one image is safe.
    """
    from . import storyboard

    prompt = f"{style_prompt}\n{segment.prompt}".strip() if style_prompt else segment.prompt
    key = await storyboard._render_one(f"job-{job_id}", segment.index, prompt)

    updated = segment.model_copy()
    updated.imageKey = key
    # A fresh image is unreviewed, even if the previous one had been approved.
    updated.status = "imaged"
    updated.imageRuns = segment.imageRuns + 1
    return updated


# --- Stage 3: clips, and the continuity that makes them a film -------------


def last_frame_of(clip_key: str) -> Optional[bytes]:
    """Grab the final frame of a rendered clip as a JPEG.

    This is what turns independently generated clips into a film. DoP starts
    from an image, so handing it the frame the previous clip ended on makes the
    cut continuous instead of a jump to an unrelated shot. Without it the result
    is a slideshow, which is most of what "AI video looks cheap" means.

    Returns None when the clip has no bytes (the mock backend stores keys with
    no file), so callers fall back to the segment's own still.
    """
    import os
    import subprocess
    import tempfile

    from .storage import get_storage

    store = get_storage()
    if not store.exists(clip_key):
        return None

    with tempfile.TemporaryDirectory() as td:
        src = os.path.join(td, "clip.mp4")
        with open(src, "wb") as fh:
            fh.write(store.read(clip_key))
        out = os.path.join(td, "last.jpg")
        # -sseof seeks from the END, which is the only reliable way to land on
        # the final frame without knowing the duration.
        cmd = ["ffmpeg", "-y", "-loglevel", "error", "-sseof", "-0.5", "-i", src,
               "-update", "1", "-q:v", "2", out]
        try:
            subprocess.run(cmd, check=True, timeout=60)
        except Exception:
            return None
        if not os.path.exists(out):
            return None
        with open(out, "rb") as fh:
            return fh.read()


def continuity_source(segments: list[Segment], index: int) -> Optional[bytes]:
    """The image clip `index` should start from.

    The previous clip's last frame when there is one, otherwise this segment's
    own approved still. The first segment of a film has no predecessor, and a
    re-render in the middle of a film does — which is exactly why this is a
    function of position rather than something baked in at render time.
    """
    from .storage import get_storage

    if index > 0:
        prev = segments[index - 1]
        if prev.clipKey:
            frame = last_frame_of(prev.clipKey)
            if frame:
                return frame

    own = segments[index].imageKey
    store = get_storage()
    if own and store.exists(own):
        return store.read(own)
    return None


async def render_segment_clip(
    job_id: str, segments: list[Segment], index: int, video_model: Optional[str] = None
) -> Segment:
    """Render ONE clip, starting from whatever keeps it continuous.

    Charged per clip as it happens rather than up front, because a film is no
    longer one purchase: any segment can be re-rendered, and pre-charging plus
    pro-rata refunds cannot express "clip 14, twice" (ADR 0020).
    """
    import asyncio

    from .providers import _higgsfield_video_sync, hf_submit
    from .storage import get_storage

    segment = segments[index]
    start_image = continuity_source(segments, index)

    from . import catalog

    app_id = catalog.higgsfield_app_for(video_model)
    # Through the shared gate: the staged path used to call the provider
    # directly, so it neither queued behind the cap nor retried when it hit it.
    url = await hf_submit(_higgsfield_video_sync, segment.prompt, start_image, app_id)

    import httpx

    from .config import settings

    async with httpx.AsyncClient(timeout=settings.higgsfield_max_wait) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        data = resp.content

    key = f"clips/{job_id}/{index:04d}.mp4"
    get_storage().save(key, data)

    updated = segment.model_copy()
    updated.clipKey = key
    updated.status = "rendered"  # freshly rendered means unreviewed again
    updated.clipRuns = segment.clipRuns + 1
    return updated


def invalidated_by(segments: list[Segment], index: int) -> list[int]:
    """Which later clips stop being continuous once `index` is re-rendered.

    Only the immediate next one is truly broken — its start frame came from the
    clip that just changed. Everything after it still follows its own
    predecessor. Saying "the next clip" rather than "everything after" is the
    difference between re-rendering one $0.38 clip and re-rendering forty.
    """
    nxt = index + 1
    if nxt < len(segments) and segments[nxt].clipKey:
        return [nxt]
    return []


# Jobs with a clip render in flight right now.
#
# Nothing about the job record can stand in for this. A clip takes minutes, and
# the loop below decides what to render by looking for segments with no clipKey
# — so two loops started a second apart both see the same empty segment, both
# charge for it, and both submit it. The owner hit exactly this: the button gave
# no feedback, they pressed it five times, and five renderers billed the same
# film in parallel.
#
# In-process and deliberately not persisted: after a restart nothing is
# rendering, so the set being empty is the truth.
_rendering: set[str] = set()


def is_rendering_clips(job_id: str) -> bool:
    return job_id in _rendering


async def render_clips(job_id: str, owner_id: Optional[str] = None) -> None:
    """Render a film's clips in order, billing each as it lands.

    Sequential, not parallel: clip N+1 starts from clip N's last frame, so the
    chain cannot fan out. That is also why the provider's 4-at-a-time cap does
    not help here.

    Stopping is checked BETWEEN clips. The one in flight always completes and is
    always billed, because Higgsfield refuses to cancel a submitted request
    (`Request is in progress`) and charges for it regardless — pretending
    otherwise would mean absorbing a cost we cannot avoid.
    """
    if job_id in _rendering:
        return  # belt and braces: the router rejects this first
    _rendering.add(job_id)
    try:
        await _render_clips(job_id, owner_id)
    finally:
        _rendering.discard(job_id)


async def _render_clips(job_id: str, owner_id: Optional[str] = None) -> None:
    from . import catalog
    from .auth import store as users
    from .store import jobs as job_store

    job = await job_store.get(job_id)
    if job is None:
        return
    tier = catalog.tier_by_id((job.tierLabel or "standard").lower())
    per_clip = catalog.credits_per_scene(tier)

    for index in range(len(job.segments)):
        fresh = await job_store.get(job_id)
        if fresh is None or fresh.stopRequested:
            return
        segment = fresh.segments[index]
        if segment.clipKey:
            continue  # already rendered (a resumed or partially redone film)

        # Charge before submitting: once the request is in, the money is gone
        # whether or not we are still here to see the result.
        charged = 0
        if owner_id:
            balance = int((users.users.get(owner_id) or {}).get("credits", 0))
            if balance < per_clip:
                return
            users.add_credits(owner_id, -per_clip)
            await job_store.add_spend(job_id, per_clip)
            charged = per_clip

        try:
            done = await render_segment_clip(job_id, fresh.segments, index, fresh.videoModel)
        except Exception:
            # The render never happened, so the charge must not stand — put the
            # clip's credits back, leave the reason on the job, and stop. This
            # runs as a fire-and-forget task: an unhandled exception here would
            # otherwise vanish with the user's money.
            import logging

            logging.getLogger("mayo").exception(
                "clip %s failed for job %s", index, job_id
            )
            if charged and owner_id:
                users.add_credits(owner_id, charged)
                await job_store.add_spend(job_id, -charged)
            reason = f"{index + 1}번 클립 생성에 실패했어요."
            if charged:
                reason += " 해당 클립 크레딧은 환불했어요."
            await job_store.patch(job_id, failureReason=reason)
            return
        await job_store.set_segment(job_id, done)

        if fresh.clipMode == "stopOnReject":
            return  # one clip, then wait for a verdict

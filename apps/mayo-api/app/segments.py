"""Stage 1 of the staged production flow (ADR 0020): the timecoded beat sheet.

The cheapest artefact in the pipeline and the one that decides everything after
it. A film is planned here as plain language per time slice, reviewed and
rewritten until it is right, and only then does anything expensive happen.

Why this stage exists at all: a ten-minute film is 60 clips and about $23. Text
costs an LLM call. Getting the plan wrong here is free; getting it wrong two
stages later is not.
"""

from __future__ import annotations

from .planner import Screenplay, get_scenario_planner
from .schemas import Segment

# One segment per ~10 seconds. Matches catalog.scenes_for() so the beat sheet
# and the render plan cannot disagree about how many pieces a film has.
SEGMENT_SECONDS = 10


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

    out: list[Segment] = []
    start = 0
    i = 0
    while start < seconds:
        end = min(start + SEGMENT_SECONDS, seconds)
        scene = scenes[i % len(scenes)]
        out.append(
            Segment(
                index=len(out),
                startSec=start,
                endSec=end,
                text=scene.heading or scene.prompt[:80],
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
        updated.text = scene.heading or scene.prompt[:80]
        updated.prompt = scene.prompt
    updated.status = "draft"  # a rewrite un-approves it
    updated.rewrites = target.rewrites + 1
    return updated


def stage_is_complete(segments: list[Segment], required: str) -> bool:
    """Whether every segment has reached the status a gate demands."""
    order = ["draft", "approved", "imaged", "imageApproved", "rendered", "clipApproved"]
    if required not in order:
        return False
    need = order.index(required)
    return bool(segments) and all(order.index(s.status) >= need for s in segments)


# --- Stage 2: one still per segment ----------------------------------------


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

"""Static catalog + registry: tiers, durations, plans, retention plans, models.

Mirrors the app mocks so the client and server agree on ids/labels. In a later
phase these move behind a DB / config, but the shapes stay the same.
"""

from __future__ import annotations

import math

from .schemas import CreditPack, DirectorModel, Duration, ModelProvider, Plan, RetentionPlan, Tier

TIERS: list[Tier] = [
    Tier(id="draft", label="Draft", blurb="Fastest, cheapest models — good for rough cuts.", pricePerMin=6),
    Tier(id="standard", label="Standard", blurb="Balanced quality and cost.", pricePerMin=14),
    Tier(id="premium", label="Premium", blurb="Best image + video models — film-grade output.", pricePerMin=30),
]

DURATIONS: list[Duration] = [
    Duration(id="s10", label="10 sec", seconds=10),
    Duration(id="s30", label="30 sec", seconds=30),
    Duration(id="m1", label="1 min", seconds=60),
    Duration(id="m3", label="3 min", seconds=180),
    Duration(id="m10", label="10 min", seconds=600),
    Duration(id="m30", label="30 min", seconds=1800),
    Duration(id="h1", label="1 hr+", seconds=3600),
]

# Pricing v3 (ADR 0017 v3) — priced off MEASURED cost, 2026-08-01.
#
# v2 was set before we could generate anything, and it was underwater. Measured:
# three 5-second cinematic clips (higgsfield-ai/dop) cost 17.5 Higgsfield
# credits, and Higgsfield sells credits at $0.0625 (800 for $50.00). That is
# ~5.83 credits per scene = $0.364. The image stage is MEASURED at exactly 1.0
# credit = $0.0625 (2026-08-01), not the $0.02 first assumed:
#
#     cost per 10s scene  =  $0.427
#
# At v2's prices a premium scene (5 mayo credits) earned $0.118 on Studio —
# 0.31x cost. Every Studio subscription lost money on every scene generated,
# and even the priciest pack only reached 1.56x.
#
# The rule now: the CHEAPEST credit we sell must still clear 2x cost. That
# floor is Studio, because pricing that only works for pack buyers loses money
# on precisely the customers a subscription business is trying to win.
#
#     2 x $0.427 / 5 credits per scene  =  $0.171 per mayo credit (floor)
#
# Plan prices are unchanged; the credit GRANTS shrank to hit that floor.
# Re-derive with: python scripts/margin.py --hf 5.83
PLANS: list[Plan] = [
    Plan(id="free", monthly=0, storageMb=300),
    # $24 / 135 = $0.178/credit -> 2.08x
    Plan(id="pro", monthly=24, storageMb=5_000, monthlyCredits=135),
    # $59 / 340 = $0.174/credit -> 2.03x — the floor, and the cheapest credit
    Plan(id="studio", monthly=59, storageMb=50_000, monthlyCredits=340),
]

# Packs stay above the subscription rate on purpose: a subscription should be
# the better deal, or there is no reason to hold one.
CREDIT_PACKS: list[CreditPack] = [
    CreditPack(id="pack100", credits=100, usd=18),  # $0.180/credit -> 2.11x
    CreditPack(id="pack300", credits=300, usd=52),  # $0.173/credit -> 2.03x
    CreditPack(id="pack1000", credits=1_000, usd=172),  # $0.172/credit -> 2.01x
]

# Video model id -> the Higgsfield application to submit to. Kept here rather
# than in config so adding a variant is a catalog change, not an env change.
HIGGSFIELD_VARIANTS: dict[str, str] = {
    "dop-lite": "higgsfield-ai/dop/lite",
    "dop-standard": "higgsfield-ai/dop/standard",
    "dop-turbo": "higgsfield-ai/dop/turbo",
}

# Measured seconds per 5s scene, for the "this will take about X" estimate.
HIGGSFIELD_SECONDS_PER_SCENE: dict[str, int] = {
    "dop-lite": 172,
    "dop-standard": 373,
    "dop-turbo": 298,
}


def higgsfield_app_for(video_model: str | None) -> str | None:
    """Application id for a catalog video model, or None to use the default."""
    return HIGGSFIELD_VARIANTS.get(video_model or "")


def eta_seconds(scenes: int, video_model: str | None, concurrency: int = 4) -> int:
    """Rough wall-clock for a whole film: scenes render `concurrency` at a time."""
    per = HIGGSFIELD_SECONDS_PER_SCENE.get(video_model or "", 373)
    import math

    return int(math.ceil(scenes / max(1, concurrency)) * per)


# --- Pay-as-you-go -------------------------------------------------------
# Generate without a subscription: pick a length, see the price, pay, render.
# This is the primary path for long-form, because a one-hour film costs more
# than any monthly plan could sensibly include.
#
# Anchored to the obvious comparison. Runway Pro is $35/mo for ~9 clips, about
# $3.90 a clip; a 10-second mayo scene is $3.00 — slightly under, deliberately.
#
# But a flat $3.00/scene makes an hour cost $1,080, which kills the one thing
# mayo does that the others do not. Hence VOLUME TIERS: per-scene price falls
# as the film gets longer, and the deepest tier still clears the 2x floor from
# ADR 0017 v3 ($0.90 / $0.427 = 2.11x).
#
#      10s  $3.00     7.03x        10 min  $126     4.92x
#      1min $18.00    7.03x        30 min  $270     3.51x
#      3min $42.00    5.47x        1 hour  $432     2.81x
#
# Marginal price per scene, applied in bands like income tax — the first six
# scenes cost $3.00 each whatever the total length.
PAYG_SCENE_BANDS: list[tuple[int, float]] = [
    (6, 3.00),        # up to 1 minute
    (60, 2.00),       # up to 10 minutes
    (180, 1.20),      # up to 30 minutes
    (10**9, 0.90),    # beyond — floor, 2.11x cost
]


def payg_usd(scenes: int) -> float:
    """Pay-as-you-go price for a film of `scenes` scenes."""
    total, prev = 0.0, 0
    for cap, rate in PAYG_SCENE_BANDS:
        billable = min(scenes, cap) - prev
        if billable > 0:
            total += billable * rate
        prev = cap
        if scenes <= cap:
            break
    return round(total, 2)


def payg_usd_for_seconds(seconds: int) -> float:
    return payg_usd(scenes_for(seconds))


# Subscription credits are the commitment discount: 25% off the top
# pay-as-you-go band. A premium scene costs 5 credits, so
#   $3.00 x 0.75 / 5 credits = $0.45 per credit.
# Anyone generating steadily is better off subscribing, which is the point;
# anyone rendering one long film is better off paying as they go, which is also
# the point.
USD_PER_CREDIT = 0.45


def usd_for_credits(credits: int) -> float:
    return round(credits * USD_PER_CREDIT, 2)


RETENTION_PLANS: list[RetentionPlan] = [
    RetentionPlan(id="d7", days=7, credits=20),
    RetentionPlan(id="d30", days=30, credits=60),
    RetentionPlan(id="forever", days=0, credits=200),
]

# Pluggable model registry — image + video providers, each mapped to a price
# tier. New providers can be added here without any client change.
MODELS: list[ModelProvider] = [
    ModelProvider(id="nano-banana", name="Nano Banana", kind="image", tier="standard", blurb="Fast, versatile image generation."),
    ModelProvider(id="aurora-img", name="Aurora", kind="image", tier="premium", blurb="Photoreal, film-grade stills."),
    # Higgsfield DoP — "Director of Photography", their cinematic camera model.
    # These are the ONLY video ids verified to work (2026-08-01); mayo always
    # renders cinematic, so all three are offered and the user picks.
    # Measured on one 5s clip each: lite 172s, turbo 298s, standard 373s.
    ModelProvider(id="dop-lite", name="Cinematic Lite", kind="video", tier="draft", blurb="Fastest cinematic pass — about 3 min per scene."),
    ModelProvider(id="dop-standard", name="Cinematic", kind="video", tier="standard", blurb="Full cinematic camera work — about 6 min per scene."),
    ModelProvider(id="dop-turbo", name="Cinematic Turbo", kind="video", tier="premium", blurb="Higgsfield's turbo variant — about 5 min per scene."),
    ModelProvider(id="motionlite", name="MotionLite", kind="video", tier="draft", blurb="Cheap, quick motion for rough cuts."),
]

# Director ("AI screenwriter") models — the Claude tier that plans the scenario
# and scene breakdown (ADR 0008). Users pick quality vs cost like generation tiers.
DIRECTOR_MODELS: list[DirectorModel] = [
    DirectorModel(id="claude-opus-4-8", name="Opus 4.8", tier="premium", blurb="Most capable director — richest scenario, structure, and continuity."),
    DirectorModel(id="claude-sonnet-5", name="Sonnet 5", tier="standard", blurb="Strong scenario planning at lower cost."),
    DirectorModel(id="claude-haiku-4-5", name="Haiku 4.5", tier="draft", blurb="Fast, budget scenario drafts."),
]

_TIER_BY_ID = {t.id: t for t in TIERS}
_RETENTION_BY_ID = {r.id: r for r in RETENTION_PLANS}


def tier_by_id(tier_id: str) -> Tier | None:
    return _TIER_BY_ID.get(tier_id)


def retention_by_id(plan_id: str) -> RetentionPlan | None:
    return _RETENTION_BY_ID.get(plan_id)


def estimate_credits(seconds: int, tier: Tier) -> int:
    """Mirror of the app's estimateCredits()."""
    return max(1, round((seconds / 60) * tier.pricePerMin))


SCENE_SECONDS_FOR_PRICING = 10  # matches scenes_for(): ~1 scene per 10s


def credits_per_scene(tier: Tier | None) -> int:
    """Credits for ONE scene at this tier.

    Per-scene rather than per-film because a staged job is billed as it renders:
    any clip can be re-run, and "charge up front, refund pro-rata" cannot
    express "clip 14, twice" (ADR 0020).
    """
    rate = tier.pricePerMin if tier else 14
    return max(1, round(rate * SCENE_SECONDS_FOR_PRICING / 60))


def scenes_for(seconds: int) -> int:
    """Narrative scene count — ~1 scene per 10s, at least 1 (used by the planner)."""
    return max(1, round(seconds / 10))


def clip_seconds() -> float:
    """Length of one generated clip, for whichever backend is actually running.

    This used to always return the ComfyUI figure (frames / fps, e.g. 16/8 = 2s)
    even when rendering on Higgsfield, whose clips are five seconds. Every count
    derived from it was therefore wrong on the paid backend: a ten-second short
    planned five clips instead of two, and both the ETA and the price followed
    that inflated count.
    """
    from . import runtime
    from .config import settings

    if runtime.generation_backend() == "external":
        return float(settings.higgsfield_duration)
    return settings.comfy_frames / max(1, settings.comfy_fps)


def clips_for_duration(seconds: int) -> int:
    """How many clips to render so the stitched film reaches `seconds` (>= it),
    capped so a long duration can't queue an unreasonable number of renders."""
    from .config import settings

    return max(1, min(math.ceil(seconds / clip_seconds()), settings.max_scenes))

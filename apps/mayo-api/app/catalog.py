"""Static catalog + registry: tiers, durations, plans, retention plans, models.

Mirrors the app mocks so the client and server agree on ids/labels. In a later
phase these move behind a DB / config, but the shapes stay the same.
"""

from __future__ import annotations

from .schemas import DirectorModel, Duration, ModelProvider, Plan, RetentionPlan, Tier

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

PLANS: list[Plan] = [
    Plan(id="free", monthly=0),
    Plan(id="pro", monthly=19),
    Plan(id="studio", monthly=49),
]

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
    ModelProvider(id="higgsfield", name="Higgsfield", kind="video", tier="premium", blurb="High-motion cinematic clips."),
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


def scenes_for(seconds: int) -> int:
    """Mirror of the app's scenesFor() — ~1 scene per 10s, at least 1."""
    return max(1, round(seconds / 10))

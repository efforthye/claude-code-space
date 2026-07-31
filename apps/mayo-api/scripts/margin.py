#!/usr/bin/env python3
"""Solve mayo's pricing for a target markup over measured provider cost.

WHY A SCRIPT AND NOT A SPREADSHEET
Provider cost is the input that moves, and every price we charge depends on it.
Keeping the derivation runnable means a price change is a re-run, not a
rebuilt spreadsheet nobody trusts.

WHAT IS MEASURED (2026-08-01, MAYO-5)
  Higgsfield sells credits at $0.0625        500 credits for $31.25
  three 5s cinematic clips cost 17.5 credits higgsfield-ai/dop lite+standard+turbo
  -> ~5.83 Higgsfield credits per 10s scene  = $0.364
  plan prices, grants and tier rates          read live from app/catalog.py

STILL ASSUMED
  --image   the Nano Banana image stage, defaulted to $0.02/scene and never
            measured on its own. Worth pinning down; it is small next to video.
  per-variant cost: 17.5 is the TOTAL of three variants, so 5.83 is an average.
  lite is probably cheaper than standard. Measuring that needs more paid runs.

THE RULE
Margin is checked against the WORST per-credit price we sell at, which is the
Studio subscription, not the packs. Pricing that only works for pack buyers is
pricing that loses money on exactly the customers a subscription business wants.

    revenue_per_scene = credits_charged_per_scene x usd_per_mayo_credit
    cost_per_scene    = hf_credits_per_scene x 0.0625 + image_cost
    require:  revenue >= TARGET x cost   at the worst plan

Usage:
    python scripts/margin.py                 # scenario table
    python scripts/margin.py --hf 4 --target 2.5
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

# --- measured -----------------------------------------------------------
HF_USD_PER_CREDIT = 0.0625  # 500 credits / $31.25 (owner billing page)

# Read the live catalog instead of copying it. A second copy of the price table
# is a price table that will disagree with the product.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app import catalog  # noqa: E402

PLANS = {
    p.id.capitalize(): (float(p.monthly), p.monthlyCredits)
    for p in catalog.PLANS
    if p.monthlyCredits
}
PACKS = {p.id: (float(p.usd), p.credits) for p in catalog.CREDIT_PACKS}

SCENE_SECONDS = 10  # catalog.scenes_for(): ~1 scene per 10s
PREMIUM_CREDITS_PER_MIN = next(
    t.pricePerMin for t in catalog.TIERS if t.id == "premium"
)


def usd_per_mayo_credit() -> dict[str, float]:
    out = {n: usd / cr for n, (usd, cr) in PLANS.items()}
    out.update({n: usd / cr for n, (usd, cr) in PACKS.items()})
    return out


def scene_cost(hf_credits: float, image_usd: float) -> float:
    return hf_credits * HF_USD_PER_CREDIT + image_usd


def required_credits_per_scene(cost: float, usd_per_credit: float, target: float) -> float:
    """Credits we must charge per scene to hit `target`x markup at this price."""
    return target * cost / usd_per_credit


def report(hf_credits: float, image_usd: float, target: float) -> None:
    per_credit = usd_per_mayo_credit()
    worst_name = min(per_credit, key=lambda k: per_credit[k])
    worst = per_credit[worst_name]
    cost = scene_cost(hf_credits, image_usd)

    now_credits = PREMIUM_CREDITS_PER_MIN * SCENE_SECONDS / 60  # 5.0 today
    need = required_credits_per_scene(cost, worst, target)
    need_per_min = need * 60 / SCENE_SECONDS

    print(f"assumption : {hf_credits:g} Higgsfield credits/scene, image stage ${image_usd:.3f}")
    print(f"scene cost : ${cost:.4f}")
    print(f"worst price: {worst_name} at ${worst:.4f} per mayo credit")
    print()
    print(f"{'plan':10} {'$/credit':>9} {'rev/scene':>10} {'margin':>8}  now")
    for name, p in sorted(per_credit.items(), key=lambda kv: kv[1]):
        rev = now_credits * p
        mult = rev / cost if cost else float("inf")
        flag = "LOSS" if mult < 1 else ("thin" if mult < target else "ok")
        print(f"{name:10} {p:9.4f} {rev:10.4f} {mult:7.2f}x  {flag}")
    print()
    print(f"to reach {target:g}x at {worst_name}:")
    print(f"  charge {need:.1f} credits/scene  (today: {now_credits:.1f})")
    print(f"  = pricePerMin {need_per_min:.0f}  (today: {PREMIUM_CREDITS_PER_MIN})")
    for name, (usd, cr) in PLANS.items():
        print(f"  {name}: {cr} credits buys {cr / need:.0f} scenes "
              f"= {cr / need * SCENE_SECONDS / 60:.1f} min of video for ${usd:.0f}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--hf", type=float, help="Higgsfield credits per scene (measured)")
    ap.add_argument("--image", type=float, default=0.02, help="image stage USD per scene")
    ap.add_argument("--target", type=float, default=2.0, help="required markup")
    a = ap.parse_args()

    if a.hf is not None:
        report(a.hf, a.image, a.target)
        return

    print("Higgsfield credits/scene is NOT measured yet (MAYO-5). Scenarios:\n")
    for hf in (1, 2, 4, 8):
        print("=" * 64)
        report(hf, a.image, a.target)
        print()


if __name__ == "__main__":
    main()

---
title: "ADR 0017: Pricing — credits + monthly subscriptions"
type: decision
status: live
tags: [mayo, billing, pricing, stripe, iap]
created: 2026-07-21
updated: 2026-07-21
---

# ADR 0017: Pricing — credits + monthly subscriptions

## Context

[[mayo]] launches with premium gating always on ([[0016-admin-console]] batch 34):
free users get free features only; the Claude director and external (paid-API)
generation require a paid plan, admin, or BYOK. We need a concrete price/credit
policy before enabling Stripe checkout ([[0012-mayo-stripe-card-payments]]) and
App Store IAP. Cost drivers: external video generation (Higgsfield credits per
clip), external image stage (Gemini image calls), Claude director tokens. Local
ComfyUI generation and the local LLM director cost only electricity — they are
the free tier's engine.

## Decision — hybrid: subscription grants monthly credits, packs top up

**Credit = the single metering unit.** 1 credit ≈ one standard external scene
(clip) render. Charged only for external generation jobs (already implemented:
per-scene charge, pro-rata refund on cancel). Free/local generation charges 0.

| Plan | Price (월) | Monthly credits | What it unlocks |
|---|---|---|---|
| Free | ₩0 | 100 signup grant (one-time) | Local generation, local/mock director, editor, explore, publish |
| Pro | ₩9,900 / $7.99 | 300 | Claude director, external generation, priority queue |
| Studio | ₩29,900 / $24.99 | 1,200 | Everything in Pro + higher storage cap, early features |

Credit packs (one-time, non-expiring, need any paid plan or admin): 100 for
₩4,900 / $3.99; 500 for ₩19,900 / $14.99. Subscription credits reset monthly
(no rollover); packs never expire and are consumed after subscription credits.

**BYOK stays free-of-credits:** a user supplying their own Anthropic/Gemini/
Higgsfield keys pays the provider directly, so we charge 0 credits (they still
need no paid plan for BYOK paths — the key IS the payment).

Rationale for the numbers: Higgsfield external clips cost the owner real per-
clip credits; 300 credits at ₩9,900 keeps Pro above cost at typical usage while
staying under the psychological ₩10,000 line; Studio is priced ~3x for ~4x
credits to reward the heavy tier. One-time signup 100 credits lets free users
taste external quality without a card (throttled by the premium gate: they can
spend them only after upgrading OR when gating is relaxed for a promo).

## Consequences

- Server: plans/credits already enforced (`premium_user_or_none`, per-scene
  charge + refund). Stripe Prices must be created to match the table
  (STRIPE_PRICE_PRO / STRIPE_PRICE_STUDIO), packs added later as one-time
  Prices + a `credits` webhook grant.
- App Store IAP must mirror the same tiers as auto-renewing subscriptions
  (Apple takes 15–30%, so consider iOS prices one notch higher or steer to web
  checkout where policy allows).
- Prices are launch hypotheses — revisit after real usage data; the wiki page
  and Stripe dashboard must change together.

## Options considered

1. Pure subscription (unlimited use) — rejected: external per-clip costs scale
   linearly, unlimited invites abuse.
2. Pure pay-per-credit — rejected: no recurring revenue floor, worse UX for
   regulars.
3. **Hybrid subscription + packs (chosen)** — industry standard for genAI video
   (Runway/Pika/Kling all do this); aligns revenue with cost.

## v2 — 2026-07-21 (owner: "too cheap"; packs must not require a subscription)

The v1 table above is superseded. **Implemented** prices (USD on Stripe; ₩
shown approximate):

| Plan | Price (월) | Monthly credits |
|---|---|---|
| Free | $0 | 100 signup grant (one-time) |
| Pro | **$24 (~₩33,000)** | **700** |
| Studio | **$59 (~₩81,000)** | **2,500** |

**Credit packs — one-time, NO subscription required** (`GET /v1/billing/packs`,
checkout `{packId}` → Stripe `mode=payment`, webhook grants):

| Pack | Credits | Price |
|---|---|---|
| pack100 | 100 | $12 |
| pack300 | 300 | $30 |
| pack1000 | 1,000 | $85 |

Buying any pack sets a lifetime `purchasedCredits` marker on the account —
`premium_user_or_none` now passes **paid plan OR purchasedCredits > 0 OR
admin**, so pay-as-you-go buyers use the Claude director / external generation
without subscribing. Subscription checkout also grants the first month's
credits at the webhook (renewal grants: wire `invoice.paid` later). Env names:
`STRIPE_PRICE_PACK_100/300/1000`. Per-credit: Pro $0.034 / Studio $0.024 vs
packs $0.085–0.12 — subscriptions stay the better deal by design.

## Status note — 2026-07-22 (owner decision: payments postponed)

Real payment rails (IAP / Korean PG) are **deferred**: first get Higgsfield
external generation running, measure REAL per-clip cost from actual usage,
run a margin analysis, and only then wire real money. Everything already built
stays live and honest meanwhile — premium gating (admin/BYOK pass), credit
metering, checkout endpoints answering "not configured", real receipt
validation ready behind MAYO_APPLE_SHARED_SECRET. The v2 price table above is
the working hypothesis to re-verify against measured cost.

## v3 — 2026-08-01 (measured cost; every credit clears 2x)

v1 and v2 were both set before mayo could generate anything. They were guesses,
and the guess was wrong in the expensive direction.

**The measurement** (MAYO-5). Three 5-second cinematic clips through
`higgsfield-ai/dop` (lite, standard, turbo) consumed **17.5 Higgsfield credits**
total. Higgsfield sells credits at **$0.0625** (500 for $31.25). So:

| | |
|---|---|
| Higgsfield credits per 10s scene | ~5.83 (average of the three variants) |
| video cost per scene | $0.364 |
| + image stage (Nano Banana, est.) | $0.02 |
| **cost per 10s scene** | **$0.384** |

**What v2 was actually doing.** A premium scene charges 5 mayo credits. At v2's
prices that earned:

| plan | $/credit | revenue/scene | margin |
|---|---|---|---|
| Studio | $0.0236 | $0.118 | **0.31x — loss** |
| Pro | $0.0343 | $0.171 | **0.45x — loss** |
| pack1000 | $0.085 | $0.425 | 1.11x |
| pack100 | $0.120 | $0.600 | 1.56x |

Both subscriptions lost money on every scene generated, and no pack reached 2x.
The more a subscriber used the product, the more it cost us.

**The rule now.** The *cheapest* credit we sell must clear **2x** cost. The
floor is the Studio subscription, not a pack — pricing that only works for pack
buyers loses money on precisely the customers a subscription business wants.

    2 x $0.384 / 5 credits per scene = $0.154 per mayo credit (floor)

**v3 table.** Plan prices are unchanged; the credit **grants** shrank. Raising
consumption per scene would have been algebraically identical — same dollars,
same minutes of video — so the lever was chosen for legibility: $24 stays $24.

| | price | credits | $/credit | margin |
|---|---|---|---|---|
| Pro | $24/mo | **150** | $0.160 | 2.08x |
| Studio | $59/mo | **380** | $0.155 | **2.02x** (the floor) |
| pack100 | **$18** | 100 | $0.180 | 2.34x |
| pack300 | **$50** | 300 | $0.167 | 2.17x |
| pack1000 | **$160** | 1,000 | $0.160 | 2.08x |

Packs stay above the subscription rate on purpose: a subscription has to be the
better deal or there is no reason to hold one.

What that buys: **Pro $24 = 5 min** of premium video/month, **Studio $59 =
12.7 min**. That is the honest consequence of $0.38 per 10 seconds — and it is
worth watching, because "AI long-form video" at five minutes a month may be the
wrong shape of product. The answer is not a cheaper price; it is cheaper
generation (a lighter DoP variant, shorter scenes, or local generation for
draft tiers).

**Derivation is executable:** `apps/mayo-api/scripts/margin.py --hf 5.83`. It
reads the live catalog, so the script and the product cannot disagree.

**Still unmeasured**
- Per-variant cost. 17.5 is the total across lite/standard/turbo, so 5.83 is an
  average; lite is presumably cheaper. Splitting them needs more paid runs and
  would let the draft/standard/premium tiers map to real variants.
- The image stage, carried as a $0.02 estimate.
- Payments remain **off**. This table is what will be charged when they go on.

## v3.1 — 2026-08-01 (the image stage, measured)

v3 carried one estimate: **$0.02 per scene for the image step**. Now that both
stages run on Higgsfield ([[0010-mayo-external-generation-providers]]), it was
measured instead — and the estimate was three times too low.

| | measured |
|---|---|
| Higgsfield credit | **$0.0625** — 800 credits for $50.00 (the July purchase of 500/$31.25 had failed) |
| clip, 5s cinematic | 5.83 credits (average of dop lite/standard/turbo) |
| **still, 720p** | **exactly 1.0 credit = $0.0625** |
| **cost per 10s scene** | **$0.427** (was $0.384 — 11% higher) |

At v3's prices that put **everything except pack100 back under 2x**: Studio
1.82x, Pro 1.87x, pack1000 1.87x, pack300 1.95x. An 11% cost rise was enough to
undo the whole correction, which is a fair measure of how thin a 2x floor is.

**Corrected so the cheapest credit clears 2x again**, plan prices untouched:

| | price | credits | $/credit | margin |
|---|---|---|---|---|
| Pro | $24/mo | 150 → **135** | $0.178 | 2.08x |
| Studio | $59/mo | 380 → **340** | $0.174 | 2.03x |
| pack100 | $18 | 100 | $0.180 | 2.11x |
| pack300 | $50 → **$52** | 300 | $0.173 | 2.03x |
| pack1000 | $160 → **$172** | 1,000 | $0.172 | **2.01x** (the floor) |

Pay-as-you-go bands keep their top three rates; only the deepest one moved,
$0.80 → **$0.90**, because $0.80 had fallen to 1.87x:

| length | price | margin |
|---|---|---|
| 10s | $3.00 | 7.03x |
| 1 min | $18.00 | 7.03x |
| 10 min | $126.00 | 4.92x |
| 30 min | $270.00 | 3.51x |
| 1 hour | **$432.00** | 2.81x |

**The lesson worth keeping:** a single unmeasured input, worth four cents,
silently pushed four of five price points below the floor the previous revision
existed to establish. `scripts/margin.py --hf 5.83 --image 0.0625` reproduces
all of it, and the test asserting the 2x floor now uses the measured figure —
it had been passing on the optimistic estimate.

**Verified in the same run:** `higgsfield-ai/soul/standard` with
`aspect_ratio: "9:16"` returned a 960x1696 PNG in ~30s. Shorts are real, and
the aspect request is honoured rather than silently dropped — unlike DoP, which
has no aspect parameter and inherits the shape of its input image.

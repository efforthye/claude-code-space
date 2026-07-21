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

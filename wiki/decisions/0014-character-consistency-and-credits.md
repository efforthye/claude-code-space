---
title: "ADR 0014: Character consistency via prompt anchoring + credit charge/refund"
type: decision
status: live
tags: [mayo, generation, consistency, credits, billing]
created: 2026-07-17
updated: 2026-07-17
---

# ADR 0014: Character consistency via prompt anchoring + credit charge/pro-rata refund

## Context

Each scene of a mayo film is rendered as an **independent clip** (ComfyUI/AnimateLCM locally,
or an external video API). Independent renders share no latent state, so the same "character"
drifts between scenes — different cat, different outfit, different palette. The owner asked for
a research-grounded fix applied to the project, plus fair billing: cancelling a 6-scene job
after 2 scenes should return 4/6 of what was charged.

## Research surveyed

- **StoryDiffusion** (arXiv 2405.01434) — consistent self-attention across a batch keeps
  subjects identical; requires running all images in one batched diffusion pass.
- **ConsiStory** (NVIDIA) — training-free shared attention + subject masks, same batching need.
- **IP-Adapter** — conditions generation on a reference image; available as ComfyUI custom
  nodes, needs a reference portrait per character.
- **CharaConsist** (arXiv 2507.11533) — point-tracking attention for fine-grained identity,
  training-free but model-specific (DiT).

All attention-sharing methods assume one process renders every frame together — mayo renders
scenes independently (and sometimes via third-party APIs where we only control the prompt).
The **prompt itself is therefore the only consistency channel that works across every
backend**, with reference-image conditioning (IP-Adapter) as a local-only escalation.

## Decision

1. **Character-sheet prompt anchoring** (applied now, all backends):
   - The director's `Screenplay` gains `characters: [string]` — ONE canonical visual
     descriptor per recurring character (species/hair/outfit/colors), defined once.
   - Both director system prompts instruct: repeat the descriptor **VERBATIM** in every scene
     prompt featuring that character — paraphrase is what causes drift.
   - The app joins `style + characters` into `CreateJobRequest.stylePrompt`; the worker
     prepends this block to **every** scene render (`_full_prompt()`), including duration
     top-up clips. This also fixes a real bug: the screenplay's `style` never reached the
     renderer before.
2. **IP-Adapter as escalation** (documented, not built): for local ComfyUI generation, a
   per-character reference image + IP-Adapter nodes would pin identity harder than text can.
   Revisit if prompt anchoring proves insufficient.
3. **Credits with pro-rata refunds**:
   - Signup grants **100 credits** (`AuthUser.credits`).
   - `POST /v1/jobs` charges signed-in users the estimate price up front (402 with a readable
     Korean message when the balance is short); the charge and owner are recorded on the job
     (`chargedCredits`, internal owner map). Anonymous/dev callers are not metered.
   - `DELETE /v1/jobs/{id}` refunds `round(charged × (scenesTotal − scenesDone) / scenesTotal)`
     to the owner and returns `{refundedCredits, credits}`; the app toasts the refund.
     A `done` job refunds nothing; the worker already stops mid-flight on deletion.

## Consequences

- Consistency now costs prompt tokens (the block rides on every scene) — bounded at 1500 chars.
- Credits are enforcement-light (no payment link yet; Stripe tops up later) but the ledger and
  refund math are real and tested (`tests/test_credits.py`).
- Estimate and charge share one pricing path (`_price_credits`), so the app's quote always
  matches what is actually deducted, including the BYOK factor.

Related: [[mayo-api]], [[mayo]], [[0008-mayo-ai-director-scenario-planner]],
[[0011-mayo-accounts-sns-login]], [[0013-mayo-sqlite-database]].

---
title: "ADR 0008: Mayo AI director — Claude scenario planner in front of generation"
type: decision
status: accepted
tags: [decision, mayo, backend, ai, claude, planner, quality]
created: 2026-07-16
updated: 2026-07-16
---

# ADR 0008 — Mayo AI director: a Claude scenario planner in front of generation

## Context
Output quality in long-form AI video comes as much from the **plan** as from the pixel models: a
strong LLM that writes a coherent scenario/screenplay, breaks it into scenes, and directs each shot
(detailed per-scene prompt, motion, continuity) produces a far better film than feeding a raw prompt
straight to an image/video model. This is [[mayo]]'s stated differentiator. The generation models
sit behind the `ModelBackend` seam ([[0007-mayo-model-provider-abstraction]]); the **director** is a
separate step that must (a) be a selectable, high-quality model and (b) run before generation.

## Decision
Add a **scenario-planner seam** — `ScenarioPlanner` (`apps/mayo-api/app/planner.py`) — that turns a
prompt + desired length into a structured **`Screenplay`** (title, logline, style guide, ordered
`Scene`s each with a generation prompt, motion, and duration). The pipeline becomes:

```
prompt + length ──▶ ScenarioPlanner (Claude) ──▶ Screenplay(scenes[])
                         │
      per scene ─────────┴──▶ ModelBackend.generate_scene(scene.prompt)  ──▶ clip
                                                                   stitch (ffmpeg) ──▶ film + clips
```

**The director is a first-class, selectable model.** `catalog.DIRECTOR_MODELS` (served at
`GET /v1/catalog/directors`) lists Claude tiers — **Opus 4.8** (premium), **Sonnet 5** (standard),
**Haiku 4.5** (draft) — so users pick director quality vs cost the same way they pick generation
tiers. Selected via `MAYO_DIRECTOR_MODEL` (default `claude-opus-4-8`).

Two implementations, chosen by `MAYO_PLANNER_BACKEND`:
- **`mock`** (default) — deterministic split into evenly-timed scenes; no key, runs offline so the
  whole pipeline works end-to-end today.
- **`claude`** — uses the **Anthropic SDK** (`messages.parse` → the `Screenplay` Pydantic model as
  **structured output**, with adaptive thinking) to have Claude write the screenplay. Credentials
  come from the environment (`ANTHROPIC_API_KEY` or an `ant` profile — **names only** in the repo);
  the `anthropic` dep is optional (`requirements-ai.txt`) and lazy-imported so mock mode stays light.

This mirrors the storage seam ([[0004-mayo-storage-local-then-s3]]) and the model-provider seam
(0007): swapping mock → Claude is a config flip, not a rewrite.

**Conversational mode (added 2026-07-16).** Beyond one-shot `plan()`, the planner also exposes
`converse(messages, seconds, tier) -> DirectorTurn` (a chat `reply` + an evolving `Screenplay` draft
+ a `ready` flag), served at `POST /v1/director/chat`. The mock backend makes it work offline; the
Claude backend returns the whole turn as one `messages.parse` structured output. The app drives it
from a chat modal (`apps/mayo/src/app/director.tsx`) and generates a job from the approved draft.
This is the same seam — the "director" is just used interactively as well as one-shot.

## Consequences
- ✅ The quality-defining "director" step is designed in and pluggable now; enabling it is a key +
  one env var.
- ✅ Director model is user-selectable and data-driven (same registry pattern as generation tiers).
- ✅ Structured output (`messages.parse` + Pydantic) gives a typed `Screenplay` — no brittle parsing.
- ✅ Mock keeps the pipeline runnable and tested without any AI key.
- ⚠️ Not yet wired into the job worker — the worker still advances mock scenes; folding the planner
  in (plan → per-scene generate) is the next backend step once real generation lands.
- ⚠️ Cost/latency: the director is a real LLM call. Tier choice (Haiku/Sonnet/Opus) is the lever.
- 🔜 Follow-ups: wire the planner into `worker.py`; persist the `Screenplay` on the job so the app can
  show the scene breakdown; for `claude-fable-5` add the server-side `fallbacks` param (refusal
  handling) before offering it as a director.

## Related
- Service: [[mayo]] · Generation seam: [[0007-mayo-model-provider-abstraction]] · Backend:
  [[0005-mayo-backend-fastapi]] · Storage: [[0004-mayo-storage-local-then-s3]]

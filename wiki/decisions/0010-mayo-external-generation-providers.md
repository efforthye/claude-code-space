---
title: "ADR 0010 — mayo external generation providers (Nano Banana + Higgsfield)"
type: decision
status: accepted
tags: [mayo, generation, providers, api, byok]
created: 2026-07-16
updated: 2026-07-16
---

# ADR 0010 — mayo external generation providers (Nano Banana + Higgsfield)

## Context
[[mayo]] renders a film scene-by-scene behind the `ModelBackend` seam (ADR
[[0007-mayo-model-provider-abstraction]]). Two backends already exist: `mock`
(timed stand-in) and `comfy` (real **local** video on the mini, ADR
[[0009-mayo-local-video-generation-comfyui]]). The owner asked to also wire the
**paid cloud providers** so users with keys get top-tier quality without the mini:
- **Nano Banana** — Google **Gemini 2.5 Flash Image** (the "image" stage).
- **Higgsfield** — cinematic **video** generation (the "animate" stage).
- **Claude** — already wired as the AI *director* (ADR [[0008-mayo-ai-director-scenario-planner]]).

Constraint: **no secrets in the repo** — keys live in the host env / secret store;
the wiki records names only.

## Decision
Implement the long-declared `ExternalModelBackend` (`app/providers.py`), selected by
`MAYO_GENERATION_BACKEND=external` (runtime-switchable from the app's Account →
생성 방식 → **외부 API**). Per scene:
1. **Image stage (optional)** — `nano_banana_image(prompt)` calls Gemini's REST
   `POST {base}/models/gemini-2.5-flash-image:generateContent` with the
   `x-goog-api-key` header (`GEMINI_API_KEY`), `responseModalities:["Image"]`, and
   `imageConfig.aspectRatio`. The still is decoded from
   `candidates[0].content.parts[].inlineData.data` (base64). Skippable via
   `MAYO_EXTERNAL_USE_IMAGE_STAGE=false` (→ Higgsfield text-to-video from the prompt).
2. **Video stage** — Higgsfield via its official `higgsfield-client` SDK
   (`HF_KEY="<id>:<secret>"`): `submit(model, arguments)` → poll status
   (Queued/InProgress/Completed/Failed/NSFW/Cancelled) → download the finished
   media URL. Runs in `asyncio.to_thread` (the SDK is sync).
3. Store the clip via the storage seam (ADR 0004) and return its key — identical to
   the mock/comfy path, so the worker/stitcher is unchanged.

### "Low-code" / config-driven provider schema
Provider request shapes drift and are model-specific, so the parts that vary are
**env config, not code**: `MAYO_HIGGSFIELD_MODEL`, `MAYO_HIGGSFIELD_PROMPT_ARG`,
`MAYO_HIGGSFIELD_IMAGE_ARG`, `MAYO_NANO_BANANA_MODEL`, `MAYO_EXTERNAL_ASPECT_RATIO`,
poll/timeout. The operator points these at whatever Higgsfield model they use (per
its API docs) with **no code change** — the wiki-recorded "low-code" adapter the
owner asked for. Names only in `.env.example`; values in the host secret store.

### BYOK
Because this is the owner's own server, the host keys **are** the user's keys —
i.e. this is Bring-Your-Own-Key in practice, priced at the BYOK factor (see
[[runtime]] `price_factor()`, 10%). Per-*end-user* keys (each app user supplying
their own) remain a future step (needs accounts — ADR/service TBD).

## Alternatives considered
- **Direct REST to cloud.higgsfield.ai** — rejected: the public HTTP paths aren't
  openly documented (site blocks scraping); the official Python SDK is the stable,
  documented surface.
- **Nano Banana via `google-genai` SDK** — rejected: the REST `generateContent`
  call is trivial over `httpx` (already a dep), so no extra SDK for the image stage.

## Consequences
- ✅ Real paid image+video generation is wired and app-selectable; enabling it is
  keys-on-host + one toggle. Dormant (and safe for the live app) until selected.
- ✅ Provider schema is config-driven — adapt to model changes without redeploying.
- ✅ Nano Banana image stage is unit-tested (mocked REST); selection + missing-key
  errors are tested. Higgsfield SDK path is guarded (clear, actionable errors).
- ⚠️ Costs real money per scene; latency is provider-bound. Guardrails: `max_scenes`
  cap still applies; BYOK pricing signals cost.
- ⚠️ The Higgsfield model id + argument keys **must** be verified against the
  owner's Higgsfield account/model before first live run (defaults are best-effort).
- 🔜 Follow-ups: per-end-user BYOK keys (needs accounts); provider selection per
  price tier (draft/standard/premium → different models); poster/thumbnail via Nano
  Banana; retry/backoff on provider 5xx.

## Related
- Service: [[mayo]] · Generation seam: [[0007-mayo-model-provider-abstraction]] ·
  Local video: [[0009-mayo-local-video-generation-comfyui]] · Director/Claude:
  [[0008-mayo-ai-director-scenario-planner]] · Storage: [[0004-mayo-storage-local-then-s3]]

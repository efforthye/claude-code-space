---
title: "ADR 0007: Mayo model providers — abstract generation backend, mock first"
type: decision
status: accepted
tags: [decision, mayo, backend, ai, models, providers]
created: 2026-07-16
updated: 2026-07-16
---

# ADR 0007 — Mayo model providers: abstract generation backend, mock first

## Context
[[mayo]]'s differentiator is **pluggable image/video models with price tiers that grow over time**
(Nano Banana, Higgsfield, and future ones). The [[0005-mayo-backend-fastapi]] pipeline renders a
film scene-by-scene: per scene, generate an image then animate it into a clip, then stitch. Those
model calls are external, keyed, and will change often. We need the orchestration/job code to never
hard-code a provider — and we need it working end-to-end **before** any real key exists.

## Decision
Put all model calls behind a **`ModelBackend`** interface (`apps/mayo-api/app/providers.py`):
`generate_scene(prompt, index) -> SceneResult`. Two implementations, selected by
`MAYO_GENERATION_BACKEND`:
- **`mock`** (default) — a timed no-op that advances one scene per tick, driving the app's live job
  progress. This is what ships now.
- **`external`** — the declared seam for real providers. It reads provider keys from the
  environment (`MAYO_PROVIDER_*` — **names only** in `.env.example`, values in the secret store per
  the `CLAUDE.md` rule), picks the provider(s) for the job's tier from the **model registry**
  (`catalog.py` / `GET /v1/catalog/models`), calls image→video, uploads the clip via the **storage
  interface** ([[0004-mayo-storage-local-then-s3]]), and returns its key. Not wired yet — raises
  until implemented.

The `worker.py` runner calls `backend.generate_scene(...)` per scene, so swapping mock → real is a
backend change, not a pipeline rewrite. This mirrors the storage seam (0004) and the queue seam
([[0006-mayo-job-queue-inprocess-then-redis]]).

## Consequences
- ✅ The full job lifecycle (create → per-scene progress → done → library) runs today with zero AI
  keys, via the mock backend.
- ✅ Adding a real provider is localized: implement `ExternalModelBackend` (+ per-provider adapters)
  behind the interface; no client or router changes.
- ✅ Model choice stays data-driven through the existing registry + price tiers.
- ⚠️ The mock produces no real media — `SceneResult` keys are placeholders until the external backend
  and storage writes are wired.
- 🔜 Follow-ups: implement `ExternalModelBackend`, add per-provider adapters + retries/timeouts, wire
  real keys as secrets, and persist scene media through the storage interface. When generation gets
  slow/real, pair with the Redis queue ([[0006-mayo-job-queue-inprocess-then-redis]]).

## Related
- Service: [[mayo]] · Backend: [[0005-mayo-backend-fastapi]] · Storage: [[0004-mayo-storage-local-then-s3]]
- Queue: [[0006-mayo-job-queue-inprocess-then-redis]]

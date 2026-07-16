---
title: "ADR 0005: Mayo backend — FastAPI orchestration API"
type: decision
status: accepted
tags: [decision, mayo, backend, fastapi, api]
created: 2026-07-16
updated: 2026-07-16
---

# ADR 0005 — Mayo backend: FastAPI orchestration API

## Context
[[mayo]]'s app shell is complete and UI-only, driven by client-side mocks. To make generation real
we need a backend that: takes a prompt + desired length, plans a scenario → scenes → clips → final
cut, calls external image/video model providers per scene, tracks long-running generation as async
**jobs** with progress, and serves the library + retention + publish flows. It runs on the
[[home-server]] (the M1 mini) alongside [[richclub]], deployed via [[jenkins]] / Docker.

## Options considered
- **FastAPI (Python).** Async-native, Pydantic v2 typing that mirrors the app's data shapes, first
  class OpenAPI/`/docs`, trivial to containerize. Matches the existing [[richclub]] Python stack →
  one language/toolchain to operate on the mini.
- **Node/NestJS or Express.** Would share TypeScript with the Expo app, but adds a second heavy
  runtime to operate and doesn't match the existing backend stack.
- **Go.** Great for throughput, but the heavy lifting (AI generation) is external API calls, so raw
  compute isn't the bottleneck; slower to iterate and off-stack here.

The bottleneck is orchestration + I/O to external model APIs, not CPU. Team familiarity and
stack-consistency with [[richclub]] dominate.

## Decision
Build the backend as a **FastAPI** service at **`apps/mayo-api/`** (FastAPI + Pydantic v2, served by
uvicorn). Ship **Phase 1** now: real endpoints + a real async job model, with generation stood in by
a **mock advancer** (see [[0006-mayo-job-queue-inprocess-then-redis]]) so the app is live
end-to-end. Pydantic wire schemas deliberately **mirror the app's mock shapes**
(`apps/mayo/src/mocks/data.ts`) so the client swaps mocks → HTTP with minimal churn.

Cross-cutting seams built in from day one: a **storage interface**
([[0004-mayo-storage-local-then-s3]]), a **pluggable model registry** (image/video providers keyed
to price tiers), and **config/secrets via env** (values at runtime, names-only in `.env.example`,
per the `CLAUDE.md` security rule).

## Consequences
- ✅ One backend language/stack on the mini (Python, like [[richclub]]); one deploy pattern.
- ✅ Typed contract + auto OpenAPI `/docs`; schemas match the client, so wiring is mechanical.
- ✅ Real job/library/publish/extend endpoints exist now; only the generation core is mocked.
- ✅ Storage + model-provider + secret seams exist from the start → later phases are config, not
  rewrites.
- ⚠️ FastAPI's async model means blocking work must go off the event loop (real providers = async
  HTTP or a worker), which motivates [[0006-mayo-job-queue-inprocess-then-redis]].
- 🔜 Follow-ups: wire real model providers behind the registry, a real DB behind the in-memory
  stores, auth, billing, and the YouTube Data API publish path.

## Related
- Service: [[mayo]] · Host: [[home-server]] · CI: [[jenkins]] · Reference stack: [[richclub]]
- Queue: [[0006-mayo-job-queue-inprocess-then-redis]] · Storage: [[0004-mayo-storage-local-then-s3]]
- Runbook: [[deploy-mayo-api]]

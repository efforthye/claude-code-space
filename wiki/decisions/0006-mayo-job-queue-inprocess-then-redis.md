---
title: "ADR 0006: Mayo job queue — in-process async first, Redis-backed workers later"
type: decision
status: accepted
tags: [decision, mayo, backend, jobs, queue]
created: 2026-07-16
updated: 2026-07-16
---

# ADR 0006 — Mayo job queue: in-process async first, Redis workers later

## Context
Generation in [[mayo]] is long-running: a film is many scene jobs, each calling external image/video
model APIs. The app needs **live progress** (queued → generating → done/failed, scenes N/M). The
backend is [[0005-mayo-backend-fastapi]] (FastAPI, async). We need a job model now, but real
providers and durable queuing aren't wired yet, and the user base is small initially.

## Options considered
- **In-process asyncio tasks** (chosen for Phase 1). A job is created, and an `asyncio.create_task`
  advances it scene-by-scene. Zero extra infrastructure; progress is observable immediately.
  Limitation: state is process-local and non-durable — a restart loses in-flight jobs, and it
  doesn't scale beyond one process.
- **Redis + RQ / Celery workers** (chosen for Phase 2). Durable queue, separate worker processes,
  retries, horizontal scale. More infra to run on the mini (a Redis container + worker service).
- **Postgres-as-queue (SKIP LOCKED).** Fewer moving parts than Redis if we add Postgres anyway, but
  heavier to build now and premature at current volume.

## Decision
**Phase 1 — in-process asyncio worker.** `app/worker.py` advances each job on a timer
(`MAYO_TICK_SECONDS`) and, on completion, files a video into the library. It stands in for the real
scenario→scenes→clips→stitch pipeline so the app is live end-to-end. All job state lives behind the
`JobStore`/`LibraryStore` interfaces in `app/store.py`.

**Phase 2 — Redis-backed queue + worker processes** (RQ first; Celery if we need richer routing).
Swap the in-process advancer for enqueue + workers, and back the stores with a real database. Because
routers/worker talk only to the store interfaces, this is an implementation swap behind a stable API.

**Trigger to move:** any of — generation becomes real (non-trivial per-scene latency), we need jobs
to survive restarts, or we outgrow a single process.

## Consequences
- ✅ Live progress and the full job lifecycle (create/list/get/cancel) work today with no extra infra.
- ✅ The store/worker seam means Phase 1 → 2 is a targeted swap, not a rewrite.
- ⚠️ Phase 1 is **non-durable and single-process** — fine for demo/low volume, not for production
  generation. Do not promise durability until Phase 2.
- ⚠️ In-process tasks share the API event loop; real blocking work must be async or moved to workers.
- 🔜 Phase 2 follow-ups: Redis container on the [[home-server]], worker service + deploy, a DB behind
  the stores, retry/backoff + dead-letter handling, and per-scene fan-out.

## Related
- Service: [[mayo]] · Backend: [[0005-mayo-backend-fastapi]] · Host: [[home-server]]
- Runbook: [[deploy-mayo-api]]

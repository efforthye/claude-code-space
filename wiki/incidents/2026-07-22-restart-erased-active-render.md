---
title: "Incident: deploy restart erased an actively rendering (billed) job"
type: incident
tags: [mayo, jobs, deploy]
created: 2026-07-22
updated: 2026-07-22
---

# 2026-07-22 — deploy restart erased an actively rendering job

**What happened**: while the owner's first real Higgsfield film (2 scenes) was
rendering (1/2 done, ~7min left), a routine deploy landed; the mini's autopull
restarted the API; the Jobs tab и library came back empty. The in-flight
Higgsfield request was already billed.

**Root cause**: `JobStore` was memory-only (ADR 0006's "in-process first"), so
a restart dropped every job record AND the in-process render task.

**Fix (same day)**: jobs now persist to SQLite (kind `job`, owners included)
with write-through on every mutation; on startup a `generating` job is marked
`failed` honestly (its task died) with all finished clips intact, and the
review screen's clips stage offers the render button as a RESUME — rendering
skips segments that already have clips, so nothing paid-for is redone.

**Prevention / follow-ups**: autopull should drain (wait for active renders)
before restarting the API — tracked as a follow-up; consider a Redis-backed
worker (ADR 0006 stage 2) when concurrency grows.

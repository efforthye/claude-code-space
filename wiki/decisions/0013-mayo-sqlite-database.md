---
title: "ADR 0013 — mayo real database: SQLite behind the stores"
type: decision
status: accepted
tags: [mayo, database, sqlite, persistence]
created: 2026-07-17
updated: 2026-07-17
---

# ADR 0013 — mayo real database: SQLite behind the stores

## Context
Persistence was ad-hoc JSON files (.users.json/.library.json) and the Explore feed
(published items/likes/comments) was memory-only — it vanished on every API restart.
The owner asked for a real database with no "임시 JSON" oddities.

## Decision
**SQLite** (stdlib, zero infra) at `media/mayo.db` (gitignored), WAL mode, via
`app/db.py`. Stores keep their in-memory dicts + asyncio locks and **write through**
on every mutation; startup loads from the DB. Records live in one
`docs(kind,id,doc,seq)` JSON-document table — the seam to a relational schema /
Postgres later is just `load()`/`replace_kind()` (see ADR 0006's scale path).
Wired kinds: `auth` (users+sessions), `video` (library metadata), `explore` +
`explore_comment` (feed survives restarts now). One-time migration imports the
legacy JSON files, then renames them `*.migrated`.

## Consequences
- ✅ Everything durable across restarts/reboots incl. the Explore feed; single DB
  file to back up. Tested: doc roundtrip/ordering, feed survives a simulated
  restart, all 67 API tests green.
- ⚠️ Wholesale-replace writes are O(n) per mutation — fine at this scale; move to
  row-level updates/Postgres when user counts demand (ADR 0006).

## Related
[[mayo]] · [[0006-mayo-job-queue-inprocess-then-redis]] · [[0011-mayo-accounts-sns-login]]

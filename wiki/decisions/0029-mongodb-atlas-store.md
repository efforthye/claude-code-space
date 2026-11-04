---
title: "ADR 0029: MongoDB Atlas as the web store"
type: decision
status: accepted
tags: [web, data, mongodb, vercel]
created: 2026-11-04
updated: 2026-11-04
---

# ADR 0029: MongoDB Atlas as the web store

## Context
[[web]] stored everything in a local JSON file (`.data/db.json`). Vercel's filesystem is read-only, so production
ran with `STORE_READONLY`: no signups, orders or requests. The owner created an Atlas project (org Creiip, project
mayo, `Cluster0`, Free tier) and asked for signups and the rest to be saved for real.

## Decision
- Behind the existing `Store` seam (`apps/web/src/lib/data/store.ts`), add `MongoStore` (`mongo-store.ts`).
- The whole dataset lives in one document (`state` collection, `_id: "db"`) with a `version` number.
  Every write is optimistic: replace only if the version is unchanged, otherwise re-read and retry (up to 8).
  This keeps the "only one buyer reserves a work" guarantee across serverless instances.
- Selection: Mongo when `MONGODB_URI` is set and `MAYO_DATA_DIR` is not; tests always set `MAYO_DATA_DIR`,
  so they never touch Atlas.
- Databases: `mayo` (Production), `mayo-preview` (Preview), `mayo-dev` (local).
- One pooled client per process (`maxPoolSize: 5`).

## Consequences
- Production writes open as soon as `MONGODB_URI` is set in Vercel; `STORE_READONLY` turns off.
- File uploads still need object storage: on Vercel they refuse with a clear message until Vercel Blob (or similar)
  is connected.
- One document caps at 16 MB. Fine for one season (hundreds of works); split into per-entity collections before it
  grows past a few MB.
- Atlas network access must allow Vercel (`0.0.0.0/0`, protected by credentials and TLS).

## Secrets
`MONGODB_URI` lives only in Vercel environment variables and the git-ignored `apps/web/.env.local`.

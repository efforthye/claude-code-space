---
title: RichClub
type: service
status: live
tags: [service, web, docker, fastapi, frontend]
created: 2026-07-15
updated: 2026-07-15
---

# RichClub

A web app running on the [[home-server]], split into a frontend and an API. Discovered from
`docker ps` on 2026-07-15 — details below are observed from the running containers; purpose and
internals are **unverified** until confirmed.

## Purpose
_TBD — what RichClub does / who it's for._

## Components
Two Docker containers, images published under `efforthye/*` (Docker Hub — public/private TBD).

| Component | Container | Image | Host→container | Stack |
|-----------|-----------|-------|----------------|-------|
| API | `richclub-api` | `efforthye/richclub-api:latest` | `8000→8000` | Python, FastAPI via `uvicorn app.main:app` |
| Frontend | `richclub-front` | `efforthye/richclub-front:latest` | `3000→80` | Served by nginx (`docker-entrypoint`) |

- **Uptime (as observed):** both up ~2 weeks as of 2026-07-15.
- **Access:** ports published directly on the host — `home.efforthye.com:3000` (front) and
  `:8000` (api), unless a reverse proxy fronts them (not yet confirmed — see [[home-server]]).

## Code location
_TBD — which repo(s) hold `richclub-api` and `richclub-front` source? Record here._

## Dependencies
_TBD — database, cache, external APIs? None visible in `docker ps`; confirm._

## Config & secrets
Pointers only, never values. _TBD — where the containers read env/config from on the host._

## Deploy
Currently built as `efforthye/richclub-*:latest` images and run via Docker. How they're
built/pushed/restarted today (Jenkins? manual? — see [[jenkins]]) vs. the intended GitHub
Actions path ([[deploy-home-server]], [[0001-github-actions-home-server-deploy]]) needs to be
reconciled.

## Related
- Host: [[home-server]] · CI: [[jenkins]]
- Runbook: [[deploy-home-server]] · Decision: [[0001-github-actions-home-server-deploy]]

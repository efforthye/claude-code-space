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
- **Resource use (`docker stats`, 2026-07-15):** api ~551 MiB, front ~5 MiB. Lightweight.
- **Access:** ports published directly on the host — `home.efforthye.com:3000` (front) and
  `:8000` (api), unless a reverse proxy fronts them (not yet confirmed — see [[home-server]]).

## Code location
_Not tracked for now (by choice)._ Images are published as `efforthye/richclub-api:latest` and
`efforthye/richclub-front:latest`; the source repo(s) can be documented later if needed.

## Dependencies
_TBD — database, cache, external APIs? None visible in `docker ps`; confirm._

## Config & secrets
Pointers only, never values. _TBD — where the containers read env/config from on the host._

## Deploy
**Current CI/CD: Jenkins via GitHub webhook** (see [[jenkins]], [[0002-cicd-via-jenkins-webhook]]).
A push to the RichClub repo triggers a GitHub webhook → Jenkins builds the arm64 Docker image and
redeploys the container on the [[home-server]]. Images are tagged `efforthye/richclub-*:latest`.
(The earlier GitHub Actions plan, [[0001-github-actions-home-server-deploy]], is superseded and
not in use.)

## Related
- Host: [[home-server]] · CI: [[jenkins]]
- Runbook: [[deploy-home-server]] · Decision: [[0001-github-actions-home-server-deploy]]

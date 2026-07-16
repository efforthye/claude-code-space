---
title: Deploy mayo-api (Docker on the home server)
type: runbook
tags: [runbook, deploy, mayo, mayo-api, docker, home-server]
created: 2026-07-16
updated: 2026-07-16
status: draft
---

# Runbook — Deploy mayo-api

The [[mayo]] orchestration API ([[0005-mayo-backend-fastapi]]) is a Docker container on the
[[home-server]], deployed the same way as [[richclub]] (via [[jenkins]] / [[0002-cicd-via-jenkins-webhook]]).
Code lives in this repo at **`apps/mayo-api/`**.

> **Status: draft.** The container build/run steps below are verified locally; the Jenkins job
> wiring on the mini still needs to be created and its exact steps folded back here after the first
> real deploy.

## Build & run (manual, on the host)
```bash
cd apps/mayo-api
docker build -t mayo-api:latest .
docker run -d --name mayo-api \
  -p 8000:8000 \
  -v mayo-media:/data/media \        # persist local-storage media across restarts (ADR 0004)
  --env-file /path/to/host/.env \    # NEVER in git — lives on the host
  --restart unless-stopped \
  mayo-api:latest
```
Health-check: `curl -s localhost:8000/health` → `{"status":"ok",...}`. Interactive API at `/docs`.

## Config / secrets (pointers only)
Runtime config is env-driven (see `apps/mayo-api/.env.example` for the **names**). Values live in
the host `.env` or the `HOME_SERVER` secret store — **never committed**:
- `MAYO_ENV`, `MAYO_ALLOWED_ORIGINS`, `MAYO_TICK_SECONDS`
- `MAYO_STORAGE_BACKEND` (`local` now; `s3` + `MAYO_S3_*` later — [[0004-mayo-storage-local-then-s3]])
- Provider API keys (`MAYO_PROVIDER_*`), YouTube OAuth (`MAYO_YOUTUBE_*`) — when those land.

## Verify before every deploy
```bash
cd apps/mayo-api
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
pytest -q                 # API + generation-lifecycle tests must pass
```

## Reverse proxy / domain
mayo.im (and the app's API base URL) route to this container. The reverse-proxy route on the
[[home-server]] still needs to be added — document it on [[home-server]] when wired.

## After a deploy — update the wiki
1. [[mayo]] service page: `status`, running commit, URL/port.
2. This runbook, if steps changed (and drop the draft note once the Jenkins job exists).
3. [[home-server]] if infra changed (new proxy route, volume, port).
4. Append to `log.md`: `## [YYYY-MM-DD] deploy | mayo-api → <summary>`.

## Related
- Service: [[mayo]] · Backend: [[0005-mayo-backend-fastapi]] · Queue: [[0006-mayo-job-queue-inprocess-then-redis]]
- Host: [[home-server]] · CI: [[jenkins]] · Reference: [[richclub]]

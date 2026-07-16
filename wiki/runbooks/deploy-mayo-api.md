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

> **Status: draft.** Two deploy paths: (A) the **launchd + uvicorn** dev deploy below is the
> current hands-off path on the mini (mirrors the Expo/autopull agents — auto-restart, survives
> reboot, no SSH); (B) the **Docker** path is the eventual production shape (via [[jenkins]], like
> [[richclub]]) and is verified locally but not yet wired on the mini.

## Port
The API binds **:8001** by default — [[richclub]] already owns **:8000** on the [[home-server]].
Override with `MAYO_PORT`.

## (A) Dev deploy — launchd agent (current, hands-off)
The `mayo-autostart-install.sh` installer now manages **three** agents: the Expo dev server,
`dev-autopull`, and **`com.efforthye.mayo.api`** (runs `scripts/mayo-api-run.sh` → uvicorn on 8001).
`mayo-api-run.sh` self-bootstraps a Python venv and installs deps (refreshing when
`requirements.txt` changes), so there's no manual `pip` step.

> **Python 3.14 gotcha (resolved):** the mini's Homebrew `python3` is **3.14**. Dependency floors
> in `requirements.txt` are set to versions that ship **cp314 wheels** (pydantic ≥ 2.11, plain
> `uvicorn` without the native `[standard]` extras) so nothing compiles from source. The runner
> also exports `PYO3_USE_ABI3_FORWARD_COMPATIBILITY=1` as a fallback if any native dep ever builds
> from source on a newer interpreter. Symptom if this regresses: `mayo-api.log` shows
> `Failed building wheel for pydantic-core` / `maturin failed`, and `localhost:8001/health` is empty.

```bash
# on the mini, in the repo:
./scripts/mayo-autostart-install.sh
# first boot builds a venv (~30s), then:
curl -s localhost:8001/health           # -> {"status":"ok",...}
# interactive docs (same LAN as the phone): http://home.efforthye.com:8001/docs
```
`dev-autopull` restarts the API agent automatically whenever `apps/mayo-api/**` is pushed, so
backend changes go live on the mini with no manual step (same loop as the app). Logs:
`~/Library/Logs/mayo-api.log`.

## (B) Prod deploy — Docker (build & run on the host)
```bash
cd apps/mayo-api
docker build -t mayo-api:latest .
docker run -d --name mayo-api \
  -p 8001:8000 \                     # host 8001 (richclub owns 8000) -> container 8000
  -v mayo-media:/data/media \        # persist local-storage media across restarts (ADR 0004)
  --env-file /path/to/host/.env \    # NEVER in git — lives on the host
  --restart unless-stopped \
  mayo-api:latest
```
Health-check: `curl -s localhost:8001/health` → `{"status":"ok",...}`. Interactive API at `/docs`.
Run the launchd path (A) **or** Docker (B), not both — they'd contend for port 8001.

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

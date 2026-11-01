---
title: mayo-api
type: service
status: live
tags: [service, api, fastapi, home-server, mayo, web]
created: 2026-11-01
updated: 2026-11-01
---

# mayo-api

FastAPI orchestration API, originally built as the backend of [[mayo]]. Since mayo was paused
([[0027-pause-mayo-reuse-domain]]), it runs **as a standalone service** and is the backend the
new website [[web]] will call. The design history is on the [[mayo]] page and in ADRs
[[0005-mayo-backend-fastapi]] through [[0020-staged-review-gated-production-flow]].

## Status
**Live, unchanged by the pause.** The code was not moved; the snapshot of its mayo-era state is
tag `archive/mayo-2026-11-01`. The new site will add endpoints here (or prune mayo-specific
ones) as its plan firms up. Record each change in this page's changelog.

## Code & stack
- **Code:** `apps/mayo-api/` (this repo). Python 3.14 on the mini, FastAPI + uvicorn, SQLite
  doc-store ([[0013-mayo-sqlite-database]]), accounts and sessions ([[0011-mayo-accounts-sns-login]]).
- **Tests:** `cd apps/mayo-api && pytest`.

## Host & how it runs
- [[home-server]] (M1 mini), launchd agent **`com.efforthye.mayo.api`** →
  `scripts/mayo-api-run.sh` → uvicorn on **`:8001`** ([[richclub]] owns `:8000`).
- Public URL: **`https://mayo-api.efforthye.dev`** via the Cloudflare tunnel agent
  `com.efforthye.mayo.tunnel` (`scripts/mayo-tunnel-run.sh`).
- Auto-redeploy: `scripts/dev-autopull.sh` restarts the API agent when `apps/mayo-api/` changes on
  the branch the mini tracks. Deploy steps: [[deploy-mayo-api]].

## Using it from the new site
- Clients authenticate with a login session (`X-Mayo-Session`) or the shared bearer key. **Never
  put the shared key in the browser bundle.** `apps/web` reads only the public base URL
  (`NEXT_PUBLIC_API_BASE`). See [[mayo-web-target]] for why.
- CORS: `MAYO_ALLOWED_ORIGINS` in the host `.env` (currently defaults to `*`). When the new site
  goes live, tighten it to `https://mayo.im,https://www.mayo.im`.

## Config & secrets (pointers only)
Runtime config and provider keys are in the git-ignored `apps/mayo-api/.env` **on the mini**.
Variable names are documented in `apps/mayo-api/.env.example`. No values in the repo.

## Changelog
- 2026-11-01 — split out of [[mayo]] as its own service page; designated backend for [[web]].

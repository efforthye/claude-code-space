---
title: Overview
type: overview
tags: [meta]
created: 2026-07-15
updated: 2026-07-15
---

# Overview — The System at a Glance

The big picture of everything running on the home server: what's live, how it's wired together,
and the shape of the infrastructure. Claude updates this whenever a new service or infra change
shifts the overall picture. For the page-by-page catalog, see [[index]].

## What's running
On the [[home-server]] via Docker (observed 2026-07-15):
- **[[richclub]]** — web app: `richclub-api` (FastAPI, `:8000`) + `richclub-front` (nginx, `:3000`).
- **[[jenkins]]** — CI server (`:9090` web, `:50000` agent).

## Infrastructure
- **[[home-server]]** — Apple **M1 Mac mini** (`m1mini`, `home.efforthye.com`, `arm64`), macOS,
  running Docker (status: building). Exact RAM/storage/OS version, reverse proxy, DNS, and
  backups are still TBD on that page.
- **Deploy path:** GitHub Actions → `HOME_SERVER` environment → SSH (password auth) → run with
  **Docker** on the host. Credentials live as GitHub Environment secrets, never in git. See
  [[deploy-home-server]] and [[0001-github-actions-home-server-deploy]].

## Architecture
_(A simple diagram or description of how services, the proxy, and data stores connect will go
here as the system grows.)_

## Open threads
- Reconcile CI/CD: [[jenkins]] is running while [[0001-github-actions-home-server-deploy]] picked
  GitHub Actions — clarify the split.
- Confirm host specs, whether a reverse proxy fronts `home.efforthye.com`, and RichClub's repo(s).

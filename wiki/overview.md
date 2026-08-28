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

Building:
- **[[mayo]]** — premium AI long-form video generation platform; Expo app (iOS + Android) + web
  (mayo.im). Client stack [[0003-expo-react-native-for-mobile-app]], dev loop [[expo-dev-loop]].
  App shell is a complete UI-only product (`apps/mayo/`); the **orchestration API**
  (`apps/mayo-api/`, FastAPI — [[0005-mayo-backend-fastapi]]) is Phase-1 scaffolded with a
  mock generation pipeline ([[0006-mayo-job-queue-inprocess-then-redis]]).

## Infrastructure
- **[[home-server]]** — Apple **M1 Mac mini** (8-core, **16 GB**, **1 TB SSD ~771 GB free**,
  macOS **15.4.1**, `arm64`; `m1mini`, `home.efforthye.com`) running Docker (status: live). Up
  ~138 days, lightly loaded. Reverse proxy, DNS, and backups still TBD on that page.
- **Deploy path:** GitHub push webhook → **[[jenkins]]** builds the arm64 image & redeploys the
  Docker container. See [[0002-cicd-via-jenkins-webhook]]. (The `HOME_SERVER` GitHub Actions env
  exists but is unused — [[0001-github-actions-home-server-deploy]], superseded.)

## Architecture
_(A simple diagram or description of how services, the proxy, and data stores connect will go
here as the system grows.)_

## Open threads
- CI/CD is **Jenkins via GitHub webhooks** ([[0002-cicd-via-jenkins-webhook]]); the idle
  `HOME_SERVER` GitHub Actions env can be kept as backup or removed — decide.
- Confirm host specs, whether a reverse proxy fronts `home.efforthye.com`, and RichClub's repo(s).
- Optional: add a secret-scan check to this wiki repo on push.

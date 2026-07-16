---
title: Index
type: index
tags: [meta]
created: 2026-07-15
updated: 2026-07-16
---

# Index — Service Registry & Catalog

The map of the whole wiki. Read this first on any query, then drill into the relevant pages.
Updated whenever pages are added/renamed or a service's status changes.

## Service registry

| Service | Status | URL / Host | Page |
|---------|--------|-----------|------|
| RichClub (api + front) | live | `home.efforthye.com:8000` (api) / `:3000` (front) | [[richclub]] |
| Jenkins (CI) | live | `home.efforthye.com:9090` | [[jenkins]] |
| Mayo (AI video platform) | building | app + mayo.im (web) | [[mayo]] |
| mayo-api (orchestration API) | building | `apps/mayo-api/` (FastAPI, Docker) | [[mayo]] |

## Infra
- [[home-server]] — Apple M1 Mac mini (8-core, 16 GB, 1 TB, macOS 15.4.1, `arm64`; `m1mini` /
  `home.efforthye.com`) running Docker; CI/CD via [[jenkins]] webhooks. _(status: live)_

## Runbooks
- [[deploy-home-server]] — Deploy a service to the home server (current path: Jenkins webhook).
- [[expo-dev-loop]] — Live-preview mobile dev loop: Expo dev server on the mini + Expo Go on phone.
- [[mayo-dev-autosync]] — push → mini auto-pulls → phone Fast-Refreshes (polling script + webhook option).
- [[claude-remote-control]] — Operate the home server from your phone (Claude Remote Control / SSH).
- [[deploy-mayo-api]] — Build & run the mayo-api FastAPI container on the home server _(draft)_.

## Decisions (ADRs)
- [[0002-cicd-via-jenkins-webhook]] — **Current** CI/CD: Jenkins builds & deploys, triggered by
  GitHub webhooks.
- [[0001-github-actions-home-server-deploy]] — _(superseded by 0002)_ Deploy via GitHub Actions +
  `HOME_SERVER` environment.
- [[0003-expo-react-native-for-mobile-app]] — Use Expo/React Native for the mobile app; dev loop
  on the M1 mini with Expo Go.
- [[0004-mayo-storage-local-then-s3]] — Mayo video storage: local filesystem first, migrate to
  S3-compatible object storage past ~half the host disk; abstract storage from day one.
- [[0005-mayo-backend-fastapi]] — Mayo backend is a FastAPI orchestration API (`apps/mayo-api/`),
  stack-consistent with [[richclub]]; schemas mirror the app mocks.
- [[0006-mayo-job-queue-inprocess-then-redis]] — Job queue: in-process asyncio worker first,
  Redis-backed workers + a DB when generation becomes real / needs durability.
- [[0007-mayo-model-provider-abstraction]] — Model calls behind a `ModelBackend` seam (mock now,
  external providers later); swapping in real image/video models is a backend change, not a rewrite.
- [[0008-mayo-ai-director-scenario-planner]] — A Claude **scenario planner** in front of generation
  (prompt+length → typed `Screenplay`); selectable director model (Opus 4.8/Sonnet 5/Haiku 4.5);
  mock (default) vs claude backend. Also records the API-authentication (bearer-key) hardening.
- [[0009-mayo-local-video-generation-comfyui]] — Real **local video generation** on the mini via
  **ComfyUI + AnimateLCM** behind the `ModelBackend` seam; per-scene clips stitched with ffmpeg,
  served + played in-app; mock⇄local is an in-app toggle.

## Incidents
_(none yet — postmortems)_

## Concepts
- [[expo-go-vs-dev-build]] — Expo Go (generic container, SDK-locked) vs a development build
  (your own compiled app); why mayo will need a dev build.

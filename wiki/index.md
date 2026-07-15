---
title: Index
type: index
tags: [meta]
created: 2026-07-15
updated: 2026-07-15
---

# Index — Service Registry & Catalog

The map of the whole wiki. Read this first on any query, then drill into the relevant pages.
Updated whenever pages are added/renamed or a service's status changes.

## Service registry

| Service | Status | URL / Host | Page |
|---------|--------|-----------|------|
| RichClub (api + front) | live | `home.efforthye.com:8000` (api) / `:3000` (front) | [[richclub]] |
| Jenkins (CI) | live | `home.efforthye.com:9090` | [[jenkins]] |
| Mobile App (Expo) | planned | — (dev via Expo Go) | [[mobile-app]] |

## Infra
- [[home-server]] — Apple M1 Mac mini (8-core, 16 GB, 1 TB, macOS 15.4.1, `arm64`; `m1mini` /
  `home.efforthye.com`) running Docker; CI/CD via [[jenkins]] webhooks. _(status: live)_

## Runbooks
- [[deploy-home-server]] — Deploy a service to the home server (current path: Jenkins webhook).
- [[expo-dev-loop]] — Live-preview mobile dev loop: Expo dev server on the mini + Expo Go on phone.

## Decisions (ADRs)
- [[0002-cicd-via-jenkins-webhook]] — **Current** CI/CD: Jenkins builds & deploys, triggered by
  GitHub webhooks.
- [[0001-github-actions-home-server-deploy]] — _(superseded by 0002)_ Deploy via GitHub Actions +
  `HOME_SERVER` environment.
- [[0003-expo-react-native-for-mobile-app]] — Use Expo/React Native for the mobile app; dev loop
  on the M1 mini with Expo Go.

## Incidents
_(none yet — postmortems)_

## Concepts
_(none yet — reusable patterns & reference knowledge)_

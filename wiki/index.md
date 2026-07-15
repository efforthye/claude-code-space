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

## Infra
- [[home-server]] — Apple M1 Mac mini (`m1mini` / `home.efforthye.com`) running Docker; deploys
  via GitHub Actions + the `HOME_SERVER` environment. _(status: building)_

## Runbooks
- [[deploy-home-server]] — Deploy a service to the home server via GitHub Actions (shared path).

## Decisions (ADRs)
- [[0002-cicd-via-jenkins-webhook]] — **Current** CI/CD: Jenkins builds & deploys, triggered by
  GitHub webhooks.
- [[0001-github-actions-home-server-deploy]] — _(superseded by 0002)_ Deploy via GitHub Actions +
  `HOME_SERVER` environment.

## Incidents
_(none yet — postmortems)_

## Concepts
_(none yet — reusable patterns & reference knowledge)_

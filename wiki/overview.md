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
_No services deployed yet._

## Infrastructure
- **[[home-server]]** — the self-hosted host (status: building). Host specs, OS, how services
  run, reverse proxy, DNS, storage, and backups are still TBD on that page.
- **Deploy path:** GitHub Actions → `HOME_SERVER` environment → SSH (password auth) → run with
  **Docker** on the host. Credentials live as GitHub Environment secrets, never in git. See
  [[deploy-home-server]] and [[0001-github-actions-home-server-deploy]].

## Architecture
_(A simple diagram or description of how services, the proxy, and data stores connect will go
here as the system grows.)_

## Open threads
_(none yet — things to build, harden, or investigate next)_

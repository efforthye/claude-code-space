---
title: Jenkins (CI)
type: service
status: live
tags: [service, ci, docker, jenkins]
created: 2026-07-15
updated: 2026-07-15
---

# Jenkins (CI)

A Jenkins automation server running in Docker on the [[home-server]]. Discovered from `docker ps`
on 2026-07-15; role in the current workflow is **unverified** — see the open question below.

## What's running
| Container | Image | Host→container | Notes |
|-----------|-------|----------------|-------|
| `jenkins` | `jenkins/jenkins:lts-jdk17` | `9090→8080` (web UI), `50000→50000` (agent) | up ~2 weeks as of 2026-07-15 |

- **Web UI:** `home.efforthye.com:9090` (container's 8080). Access/auth — pointers only, TBD.
- **Agent port:** 50000 (for inbound JNLP build agents).

## Open question — CI/CD ownership
Jenkins is running, **but** [[0001-github-actions-home-server-deploy]] chose GitHub Actions for
deploys. Two plausible pictures — confirm which is true and update the ADR/runbook accordingly:
1. Jenkins predates the decision and currently builds/deploys [[richclub]]; GitHub Actions is the
   go-forward plan (migration pending), or
2. Jenkins handles CI (build/test) and GitHub Actions handles deploy, or
3. Jenkins is being retired in favor of GitHub Actions.

## Config & secrets
Pointers only. Jenkins home/volume location on the host and any stored credentials — TBD.

## Related
- Host: [[home-server]] · Builds/deploys: [[richclub]]
- Deploy decision: [[0001-github-actions-home-server-deploy]]

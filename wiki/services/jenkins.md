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

## Role — this is the current CI/CD
Confirmed 2026-07-15: **Jenkins is the actual build+deploy pipeline**, triggered by **GitHub push
webhooks**. On push to a [[richclub]] repo, GitHub calls a webhook → Jenkins builds the Docker
image and (re)deploys it on the [[home-server]]. This is what's live today.

This supersedes the earlier plan to deploy via GitHub Actions — see
[[0002-cicd-via-jenkins-webhook]] (and the now-superseded [[0001-github-actions-home-server-deploy]]).
The `HOME_SERVER` GitHub environment/secrets remain set up but unused unless we later add an
Actions-based path.

### Pipeline (as described; exact steps TBD)
1. `git push` to a RichClub repo on GitHub.
2. GitHub **webhook** → Jenkins (`home.efforthye.com:9090`), so Jenkins must be reachable from
   GitHub (this is why the host/domain is exposed).
3. Jenkins job builds the **arm64** Docker image and deploys the container on the host.
4. _Jenkinsfile location, credentials, and exact build/deploy steps — to document._

## Config & secrets
Pointers only. Jenkins home/volume location on the host and any stored credentials — TBD.

## Related
- Host: [[home-server]] · Builds/deploys: [[richclub]]
- Deploy decision: [[0001-github-actions-home-server-deploy]]

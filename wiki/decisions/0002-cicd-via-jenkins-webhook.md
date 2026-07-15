---
title: "ADR 0002: CI/CD via Jenkins + GitHub webhooks (current)"
type: decision
status: accepted
tags: [decision, ci, cd, jenkins, github-webhook, deploy]
created: 2026-07-15
updated: 2026-07-15
supersedes: 0001-github-actions-home-server-deploy
---

# ADR 0002 — CI/CD via Jenkins + GitHub webhooks

## Context
[[0001-github-actions-home-server-deploy]] assumed deploys would run through GitHub Actions and
the `HOME_SERVER` environment. On 2026-07-15 the operator confirmed the **actual** setup: a
**Jenkins** server ([[jenkins]]) already runs on the [[home-server]] and builds/deploys
[[richclub]], triggered by **GitHub push webhooks**. Reality differs from ADR 0001, so this ADR
records what is truly in use.

## Decision
**Jenkins is the CI/CD system.** GitHub push webhooks notify Jenkins on each commit; Jenkins
builds the (arm64) Docker image and (re)deploys the container on the M1 mini. This supersedes
ADR 0001.

- The `HOME_SERVER` GitHub environment and its secrets (`HOME_SERVER_URL/USER/SECRET`) remain
  configured but **unused** for now — kept as an option if we add an Actions-based path later.
- Jenkins is reachable from GitHub (host/domain exposed) so webhooks can be delivered.

## Consequences
- ✅ Matches what's actually running; no migration needed to keep shipping.
- ✅ One place (Jenkins) owns build + deploy for [[richclub]].
- ⚠️ Jenkins must stay reachable from GitHub for webhooks — an availability/exposure concern to
  keep an eye on (auth, firewall, TLS).
- ⚠️ Two half-configured paths exist (Jenkins in use; GitHub Actions env idle). Decide whether to
  keep the GitHub environment as a backup or remove it to avoid confusion.
- 🔜 Follow-up: document the Jenkinsfile / job steps and where Jenkins stores credentials
  (pointers only). Decide if the wiki repo itself needs any automation (e.g. a secret-scan check).

## Related
- CI: [[jenkins]] · App: [[richclub]] · Host: [[home-server]]
- Superseded: [[0001-github-actions-home-server-deploy]]

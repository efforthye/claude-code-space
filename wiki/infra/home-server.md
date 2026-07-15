---
title: Home Server
type: infra
status: building
tags: [infra, home-server, deploy]
created: 2026-07-15
updated: 2026-07-15
---

# Home Server

The machine that hosts self-hosted services. Deployments reach it through GitHub Actions rather
than manual SSH from a laptop — see [[deploy-home-server]].

## How deploys reach it
- **Mechanism:** GitHub Actions, gated by the repo **Environment `HOME_SERVER`**.
- **Connection:** a workflow targeting `environment: HOME_SERVER` gets the environment secrets
  injected, then connects to the server over SSH to build/ship/restart the service.
- See the runbook: [[deploy-home-server]]. Rationale: [[0001-github-actions-home-server-deploy]].

## Secrets (pointers only — never values)
Stored as **GitHub Environment secrets** on `HOME_SERVER` (repo → Settings → Environments →
HOME_SERVER). Only the *names* live here; the values stay in GitHub.

| Secret name | What it is | Notes |
|-------------|-----------|-------|
| `HOME_SERVER_URL` | Host address to connect to | value in GitHub Env |
| `HOME_SERVER_USER` | SSH user for deploys | value in GitHub Env |
| `HOME_SERVER_SECRET` | Auth credential (SSH private key or token) | value in GitHub Env — exact type _unverified_ |

## To fill in (unverified / TBD)
The following aren't documented yet — capture them as they're confirmed:
- OS / distribution and host specs.
- How services run: Docker / Docker Compose / systemd / other.
- Reverse proxy (Caddy / Nginx / Traefik?) and how traffic/domains are routed.
- DNS / domains pointing at the server.
- Storage layout and volumes.
- Backup strategy → will get its own [[runbooks]] page.

## Related
- Runbook: [[deploy-home-server]]
- Decision: [[0001-github-actions-home-server-deploy]]
- Services hosted here: _(none yet)_

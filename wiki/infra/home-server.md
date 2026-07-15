---
title: Home Server
type: infra
status: building
tags: [infra, home-server, deploy]
created: 2026-07-15
updated: 2026-07-15
---

# Home Server

The machine that hosts self-hosted services. Builds & deploys run through [[jenkins]] on the host,
triggered by GitHub webhooks ([[0002-cicd-via-jenkins-webhook]]).

## Host
- **Hardware:** Apple **Mac mini (M1, Apple Silicon)**. Architecture: **`arm64`**.
- **OS:** macOS (version to confirm via `sw_vers`).
- **Hostname:** `m1mini`. **Domain:** `home.efforthye.com`.
- **Access:** SSH via [[deploy-home-server]] (login user + password in the `HOME_SERVER`
  environment secrets). Interactively reached over Termius.
- **RAM / storage / macOS version / exact chip cores:** _to confirm_ — run
  `system_profiler SPHardwareDataType SPStorageDataType && sw_vers` and record here.

> **arm64 gotcha:** Docker images for this host must be built for **`linux/arm64`** (or
> multi-arch). An `amd64`-only image runs under emulation (slow) or fails. Build with
> `docker buildx build --platform linux/arm64` when producing images for the M1 mini.

## Currently running (from `docker ps`, 2026-07-15)
Containers publish ports directly to the host (no reverse proxy in front yet — see TBD).

| Container | Image | Host→container | Serves |
|-----------|-------|----------------|--------|
| `richclub-api` | `efforthye/richclub-api:latest` | `8000→8000` | [[richclub]] API (FastAPI/uvicorn) |
| `richclub-front` | `efforthye/richclub-front:latest` | `3000→80` | [[richclub]] frontend (nginx) |
| `jenkins` | `jenkins/jenkins:lts-jdk17` | `9090→8080`, `50000→50000` | [[jenkins]] CI (web + agent) |

## Inspecting specs & state
```bash
system_profiler SPHardwareDataType SPStorageDataType   # hardware + disks
sw_vers ; uname -m                                     # macOS version ; arch (arm64)
uptime ; top -l 1 | head -n 12 ; df -h                 # load / cpu-mem / disk
docker ps ; docker stats --no-stream ; docker system df
```

## How deploys reach it
- **Mechanism:** GitHub push webhook → **[[jenkins]]** (running on this host) builds & deploys.
- **Runtime:** services run in **Docker** on the host.
- Rationale: [[0002-cicd-via-jenkins-webhook]] (supersedes [[0001-github-actions-home-server-deploy]]).
- The `HOME_SERVER` GitHub environment (SSH deploy) is set up but **unused** — see below.

## Secrets (pointers only — never values)
Stored as **GitHub Environment secrets** on `HOME_SERVER` (repo → Settings → Environments →
HOME_SERVER). Only the *names* live here; the values stay in GitHub.

| Secret name | What it is | Notes |
|-------------|-----------|-------|
| `HOME_SERVER_URL` | Host address to connect to | value in GitHub Env |
| `HOME_SERVER_USER` | SSH login user for deploys | value in GitHub Env |
| `HOME_SERVER_SECRET` | SSH login **password** for that user | value in GitHub Env |

## Runtime
Services run as **Docker** containers on the host. Expect a `docker compose` file per service (or
a shared one); deploys pull/build the image and `docker compose up -d`. Exact compose layout and
image registry are TBD until the first service ships.

## To fill in (unverified / TBD)
The following aren't documented yet — capture them as they're confirmed:
- Exact RAM, storage size/free, macOS version (run the commands above).
- Docker specifics: Compose file location(s) on the host, image registry (Docker Hub
  `efforthye/*` seen — public or private?), networks, volumes.
- Reverse proxy: none visible in `docker ps` (ports published directly, e.g. `:3000`, `:8000`).
  Confirm whether a proxy / TLS terminates `home.efforthye.com`, or access is host:port.
- DNS: `home.efforthye.com` → the mini (dynamic DNS? router port-forward?).
- Backup strategy → will get its own [[runbooks]] page.
- Hardening: SSH currently uses **password** auth — consider moving to key-based auth later.

**CI/CD (resolved):** builds & deploys run through [[jenkins]], triggered by GitHub webhooks
([[0002-cicd-via-jenkins-webhook]]). The `HOME_SERVER` GitHub environment/secrets exist but are
unused; the GitHub Actions plan ([[0001-github-actions-home-server-deploy]]) is superseded.

## Related
- Runbook: [[deploy-home-server]]
- Decision: [[0001-github-actions-home-server-deploy]]
- Services hosted here: [[richclub]], [[jenkins]]

---
title: Home Server
type: infra
status: live
tags: [infra, home-server, deploy]
created: 2026-07-15
updated: 2026-07-15
---

# Home Server

The machine that hosts self-hosted services. Builds & deploys run through [[jenkins]] on the host,
triggered by GitHub webhooks ([[0002-cicd-via-jenkins-webhook]]).

## Host (verified 2026-07-15)
- **Hardware:** Apple **Mac mini (M1)**, model `Macmini9,1`. Architecture: **`arm64`**.
- **Chip / cores:** Apple M1, **8 cores** (4 performance + 4 efficiency).
- **Memory:** **16 GB**.
- **Storage:** **1 TB** internal SSD (APPLE SSD AP1024Q, APFS) — **~771 GB free** (host used
  ~137 GB: ~120 GB Data + system).
- **OS:** **macOS 15.4.1** (build 24E263).
- **Hostname:** `m1mini`. **Domain:** `home.efforthye.com`.
- **Access:** SSH via [[deploy-home-server]] (login user + password in the `HOME_SERVER`
  environment secrets). Interactively reached over Termius.

_(Serial / hardware UUID / provisioning UDID exist but are intentionally NOT recorded here.)_

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

## Current state (snapshot 2026-07-15)
Healthy, lightly loaded.
- **Uptime:** ~138 days. **Load avg:** ~1.4–1.6 (of 8 cores → plenty of headroom).
- **Memory:** ~15 GB "used" of 16 GB, but **~49% effectively free** via the compressor and
  **no swapping** (swapins/swapouts = 0) → healthy.
- **Disk:** 17 GB used on `/` system volume, ~120 GB on Data; **~771 GB free**.
- **Docker VM memory:** containers see a **~5.77 GiB** limit (Docker's Linux VM allocation on
  macOS), not the full 16 GB.
- **Per-container (`docker stats`):** `jenkins` ~1.05 GiB (18%), `richclub-api` ~551 MiB (9%),
  `richclub-front` ~5 MiB.
- **Docker disk (`docker system df`):** **254 images, only 8 active — ~24 GB + ~11 GB build
  cache reclaimable.** Consider `docker image prune -a` / `docker builder prune` to free ~35 GB.

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
Services run as **Docker** containers on the host (3 running — see the table above). Images are
built by [[jenkins]] and tagged under `efforthye/*`. Whether containers are managed via
`docker compose` or plain `docker run`, and where those files live on the host, is TBD.

## To fill in (unverified / TBD)
The following aren't documented yet — capture them as they're confirmed:
- Docker specifics: how the Docker engine runs on macOS (Docker Desktop / colima / OrbStack?),
  its VM memory (~5.77 GiB observed), image registry (Docker Hub `efforthye/*` — public/private?),
  volumes.
- Reverse proxy: none visible in `docker ps` (ports published directly, e.g. `:3000`, `:8000`).
  Confirm whether a proxy / TLS terminates `home.efforthye.com`, or access is host:port.
- DNS: `home.efforthye.com` → the mini (dynamic DNS? router port-forward?).
- Backup strategy → will get its own [[runbooks]] page.
- Hardening: SSH currently uses **password** auth — consider moving to key-based auth later.
- Housekeeping: ~35 GB reclaimable Docker images/build cache (see Current state).

**CI/CD (resolved):** builds & deploys run through [[jenkins]], triggered by GitHub webhooks
([[0002-cicd-via-jenkins-webhook]]). The `HOME_SERVER` GitHub environment/secrets exist but are
unused; the GitHub Actions plan ([[0001-github-actions-home-server-deploy]]) is superseded.

## Related
- Runbook: [[deploy-home-server]]
- Decision: [[0001-github-actions-home-server-deploy]]
- Services hosted here: [[richclub]], [[jenkins]]

---
title: Mayo Dev Auto-Sync (push → phone updates)
type: runbook
tags: [runbook, mayo, expo, dev, git, webhook]
created: 2026-07-15
updated: 2026-07-15
---

# Runbook — Mayo Dev Auto-Sync (push → phone updates)

Goal: when the cloud/web Claude (or anyone) **pushes** to the repo, the [[home-server]] mini
**pulls automatically** so the running Expo dev server Fast-Refreshes [[mayo]] on the phone —
no manual `git pull`. Builds on [[expo-dev-loop]].

## Connect the phone first
The Expo dev server binds to the mini's **LAN IP** (e.g. `exp://192.168.x.x:8081`). The phone
must reach it:
- **Same WiFi** as the mini → Expo Go lists the server automatically, or
- **Tunnel** (works on cellular): `npx expo start --tunnel`, then scan the new QR.

If the phone is on LTE/5G and Metro shows a `192.168.*` URL, Expo Go will show **no server** —
switch to `--tunnel` or join the WiFi.

## Option A — polling auto-pull (recommended for dev; zero infra)
A tiny loop pulls every few seconds; on new commits the dev server refreshes. Run it next to
`expo start` (tmux makes this clean):

```bash
# pane 1 — the dev server
cd ~/…/claude-code-space/apps/mayo && npx expo start --tunnel

# pane 2 — auto-pull (repo root)
cd ~/…/claude-code-space && ./scripts/dev-autopull.sh      # every 15s; pass a number to change
```
`scripts/dev-autopull.sh` fast-forward-pulls, and runs `npm install` only when
`apps/mayo/package*.json` changed (restart expo after dependency changes). JS/TS edits just
Fast-Refresh. Latency ≈ the poll interval.

> Keep both alive across SSH drops with `tmux` (or `caffeinate -s` so the mini won't sleep).

## Option B — GitHub webhook → pull (event-driven, near-instant)
For zero polling, have GitHub notify the mini on push. Two ways:
- **Reuse [[jenkins]]** (already receives GitHub webhooks): add a job that runs the pull in the
  dev working copy. Caveat: Jenkins runs in Docker, so it needs access to the host path the dev
  server watches (bind-mount or run the pull over SSH) — a bit of plumbing.
- **Tiny listener** on the mini: a small FastAPI/Node endpoint that verifies the webhook secret
  and runs `git -C <repo> pull`, exposed at `home.efforthye.com` (already reachable from GitHub).

Trade-off: near-instant, but needs an inbound endpoint + webhook config + a persistent process.
For a solo dev preview, **Option A is simpler and usually enough**; reach for B if the poll
latency annoys you. (Ask Claude to build the listener when you want it.)

## Related
- [[expo-dev-loop]] · [[mayo]] · [[home-server]] · [[jenkins]]

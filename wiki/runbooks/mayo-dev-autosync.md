---
title: Mayo Dev Auto-Sync (push → phone updates)
type: runbook
tags: [runbook, mayo, expo, dev, git, webhook]
created: 2026-07-15
updated: 2026-07-15
---

# Runbook — Mayo Dev Auto-Sync (push → phone updates)

> **📍 Repo path on the mini (canonical — use this in every command):**
> `~/programs/work/creiip/claude-code-space`
> (API .env: `~/programs/work/creiip/claude-code-space/apps/mayo-api/.env`.
> NOT `~/claude-code-space` — giving the owner commands with a guessed path has
> bitten us; copy the path from here.)

Goal: when the cloud/web Claude (or anyone) **pushes** to the repo, the [[home-server]] mini
**pulls automatically** so the running Expo dev server Fast-Refreshes [[mayo]] on the phone —
no manual `git pull`. Builds on [[expo-dev-loop]].

## Connect the phone first
Two connection modes:
- **`--tunnel` → works from ANY network** (cellular, other WiFi, traveling). Routes
  phone → relay → mini over the internet, so the phone does **not** need to be on the mini's
  WiFi. **Use this as the default for network independence:** `npx expo start --tunnel`, scan QR.
- **LAN (default `expo start`)** — only when the phone is on the **same WiFi** as the mini; Metro
  shows a `192.168.*` URL and Expo Go lists it automatically. Faster, but same-network only.

If the phone is on LTE/5G and Metro shows a `192.168.*` URL, Expo Go shows **no server** — that's
the LAN limitation; use `--tunnel`.

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

### Keep it running without Termius (tmux)
The dev server dies when the SSH session ends — unless it's detached. Use `tmux` so it survives
closing Termius / the phone sleeping; the process keeps running on the mini.

```bash
brew install tmux                 # once, if missing
tmux new -s mayo                  # start a persistent session
# inside tmux:
caffeinate -s &                   # keep the mini awake (optional)
cd ~/…/claude-code-space/apps/mayo && npx expo start --tunnel
#   split for auto-pull: Ctrl+b then "  → cd ~/…/claude-code-space && ./scripts/dev-autopull.sh
# detach: Ctrl+b then d            → now safe to close Termius; both keep running
```
Reattach later: `tmux attach -t mayo`. Stop: attach + `Ctrl+c`, or `tmux kill-session -t mayo`.
No-tmux fallback: `nohup npx expo start --tunnel > ~/mayo-expo.log 2>&1 & disown`
(read the tunnel URL from `~/mayo-expo.log` and open it in Expo Go).

### Set-once, never-touch-Termius workflow
Run **both** in the same tmux session, then detach — the mini keeps them alive:
```
tmux new -s mayo
# window 0: cd apps/mayo && npx expo start --tunnel
# Ctrl+b c  → new window
# window 1: cd <repo> && ./scripts/dev-autopull.sh
# Ctrl+b d  → detach; close Termius freely
```
Now every push auto-pulls on the mini and Fast-Refreshes the phone — **no manual `git pull`,
no Termius session needed.** Just keep Expo Go open on the phone.

**Tunnel URL is stable.** Expo derives the tunnel subdomain from the project + machine, so it stays
the same across runs (observed: `exp://a-5i9ye-anonymous-8081.exp.direct`). **Keep expo running in
tmux (don't restart)** and the URL never changes — bookmark the `exp://…exp.direct` link on the
phone and reuse it. `npx expo login` (Expo account) pins it deterministically (subdomain uses the
account name instead of `anonymous`).

> **Expo account (2026-07-17):** the mini's CLI is logged in as **`efforthyee`** (a fresh
> email+password account — the owner's original Gmail-SSO Expo account was unusable for CLI
> login because SSO signup collides with the pre-existing email account; a new account created
> at expo.dev/signup with the email+password form sidesteps it). With the CLI logged in, the
> phone's Expo Go (same account) can list the running server under *Development servers*, and
> the tunnel URL becomes account-pinned. Note: the non-TTY launchd log prints only
> `Tunnel ready.` — to recover the URL, either query the dev server
> (`curl -s localhost:8081 -H "expo-platform: ios"` → `hostUri`) or read
> `apps/mayo/.expo/settings.json` (`urlRandomness`) and compose
> `exp://<urlRandomness>-<account>-8081.exp.direct`.

### True permanence — launchd (survives Termius close AND reboot)
`scripts/mayo-autostart-install.sh` installs two macOS **LaunchAgents** (`com.efforthye.mayo.expo`
and `.autopull`) that run `expo start --tunnel` and `dev-autopull.sh` on login, **auto-restart on
crash, and come back after a reboot** — no tmux, no Termius session needed.

```bash
./scripts/mayo-autostart-install.sh              # install
grep -m1 'exp://' ~/Library/Logs/mayo-expo.log   # get the (stable) tunnel URL, ~15s after install
tail -f ~/Library/Logs/mayo-expo.log             # watch logs (also mayo-autopull.log)
./scripts/mayo-autostart-install.sh --uninstall  # remove
```
Caveats:
- **Do NOT keep the repo under `~/Desktop`, `~/Documents`, or `~/Downloads`.** macOS TCC blocks
  background launchd agents from those folders → the agent fails with *"Operation not permitted"*
  (exit 126). Keep the clone somewhere unprotected like `~/dev/…` or `~/claude-code-space`. (This
  bit us: the mini's clone was under `~/Desktop/programs/work/creiip/…`; moving it out fixed the
  auto-pull agent.)
- LaunchAgents start at **login**. For start-at-boot with no one logged in, enable **automatic
  login** on the mini (`scripts/enable-autologin.sh`, or System Settings → Users & Groups).

### After a reboot (important nuance)
The agents run only while the user has an **active GUI (Aqua) session**. A reboot ends it, and
**SSH does not create one** — so a gui-domain agent can't be revived over SSH alone. Therefore:
- **Enable auto-login BEFORE you reboot** (not after):
  `cd ~/programs/work/creiip/claude-code-space && ./scripts/enable-autologin.sh`
  Then every future reboot auto-logs-in → the agents restart → mayo is back with zero touch.
- **If you already rebooted without it** and the dev server is down: SSH in, run
  `enable-autologin.sh`, then `sudo reboot` once more — after that boot it auto-recovers.
- Current setup (this session) works because a GUI session is already active; it survives Termius
  close but NOT a reboot until auto-login is on.
- The dev server runs **headless** (no interactive QR) — use the `exp://…` URL from the log
  (it's stable; bookmark it in Expo Go once).
- `git pull` uses cached git credentials; if pulls fail for the private repo under launchd, check
  `~/Library/Logs/mayo-autopull.log`.
- If both launchd **and** a tmux session run expo, they'll fight over port 8081 — use one or the
  other (stop the tmux `mayo` session before installing the agents).

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

#!/usr/bin/env bash
# mayo-tunnel-run — expose the local mayo-api (port 8001) on a public HTTPS URL
# via a Cloudflare quick tunnel, so the phone app can reach it from anywhere
# (office / 5G), not just the home LAN. No account or router config needed.
#
# Launched by the com.efforthye.mayo.tunnel launchd agent; also runnable by hand.
# The public URL is printed to this process's log (~/Library/Logs/mayo-tunnel.log)
# — look for the trycloudflare.com address:
#   grep -m1 trycloudflare ~/Library/Logs/mayo-tunnel.log
# Paste that URL into the app: Account → Server field.
#
# NOTE: a quick tunnel's URL is random and changes when the tunnel restarts
# (e.g. after a reboot). For a permanent, stable address, upgrade to a named
# Cloudflare tunnel with your domain later (see deploy-mayo-api runbook).

set -eo pipefail

log() { echo "[mayo-tunnel $(date '+%H:%M:%S')] $*"; }

if ! command -v cloudflared >/dev/null 2>&1; then
  log "cloudflared not found — installing via Homebrew (one-time)…"
  if command -v brew >/dev/null 2>&1; then
    brew install cloudflared || { log "ERROR: 'brew install cloudflared' failed — install it manually"; exit 127; }
  else
    log "ERROR: Homebrew not found; install cloudflared manually (brew install cloudflared)"
    exit 127
  fi
fi

PORT="${MAYO_PORT:-8001}"
log "starting Cloudflare quick tunnel -> http://localhost:$PORT"
log "public URL appears below (look for 'trycloudflare.com'); paste it into the app: Account -> Server"
exec cloudflared tunnel --no-autoupdate --url "http://localhost:$PORT"

#!/usr/bin/env bash
# mayo-comfy-run — boot ComfyUI (local video generation) on the mini as a
# background service, so it survives closing Termius and comes back on reboot.
#
# ComfyUI lives OUTSIDE this repo (it's a big separate clone) at
# ~/programs/ComfyUI with its own venv. Override with MAYO_COMFY_DIR.
# Serves the ComfyUI HTTP API on 127.0.0.1:8188 (localhost only — the mayo-api
# on the same host drives it via that API; nothing is exposed publicly).
#
# Launched by the com.efforthye.mayo.comfy launchd agent; also runnable by hand:
#   ./scripts/mayo-comfy-run.sh
# Logs to ~/Library/Logs/mayo-comfy.log (captured by the agent).

set -eo pipefail

COMFY="${MAYO_COMFY_DIR:-$HOME/programs/ComfyUI}"
PORT="${MAYO_COMFY_PORT:-8188}"

log() { echo "[mayo-comfy-run $(date '+%H:%M:%S')] $*"; }

if [ ! -d "$COMFY" ]; then
  log "ComfyUI not found at $COMFY — clone it first (see runbook deploy-mayo-comfy)."
  sleep 60  # avoid a hot restart loop under launchd KeepAlive until it's installed
  exit 0
fi

VPY="$COMFY/venv/bin/python"
if [ ! -x "$VPY" ]; then
  log "ComfyUI venv missing at $VPY — create it (python3.12 -m venv venv)."
  sleep 60
  exit 0
fi

cd "$COMFY"
log "starting ComfyUI on 127.0.0.1:$PORT ($("$VPY" --version 2>&1))"
# --port fixes the API port. Listen stays on 127.0.0.1 (default) — same-host only.
exec "$VPY" main.py --port "$PORT"

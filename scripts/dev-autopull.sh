#!/usr/bin/env bash
# dev-autopull — keep the working copy in sync with the remote so a running
# `expo start` Fast-Refreshes whenever new commits are pushed.
#
# Run on the host (the mini), in the repo, alongside `npx expo start`:
#   ./scripts/dev-autopull.sh          # polls every 15s
#   ./scripts/dev-autopull.sh 8        # custom interval (seconds)
#
# Pairs well with tmux: one pane runs `npx expo start --tunnel`, another runs this.

set -euo pipefail

INTERVAL="${1:-15}"
cd "$(git rev-parse --show-toplevel)"

EXPO_LABEL="com.efforthye.mayo.expo"
EXPO_PLIST="$HOME/Library/LaunchAgents/$EXPO_LABEL.plist"
PKG_STAMP="apps/mayo/node_modules/.pkg-sha"

pkg_sha() { shasum apps/mayo/package-lock.json 2>/dev/null | awk '{print $1}'; }

# Stop -> install -> start. Restarting expo while npm is mutating node_modules
# crash-loops Metro (and drops the ngrok tunnel, ERR_NGROK_3200), so take the
# agent fully down for the install and bring it back clean afterwards.
sync_app_deps() {
  echo "  syncing app deps (expo stopped during install)"
  launchctl bootout "gui/$(id -u)/$EXPO_LABEL" 2>/dev/null || true
  (cd apps/mayo && npm install --no-audit --no-fund) || true
  pkg_sha > "$PKG_STAMP" 2>/dev/null || true
  if [ -f "$EXPO_PLIST" ]; then
    launchctl bootstrap "gui/$(id -u)" "$EXPO_PLIST" 2>/dev/null \
      || launchctl kickstart -k "gui/$(id -u)/$EXPO_LABEL" 2>/dev/null || true
    echo "  expo agent restarted (tunnel comes back in ~30s)"
  fi
}

echo "dev-autopull: pulling every ${INTERVAL}s on '$(git rev-parse --abbrev-ref HEAD)' (Ctrl+C to stop)"

# Startup heal: if installed deps don't match package-lock (e.g. a pull landed
# while this agent was down, or a previous install raced a restart), fix it now.
if [ "$(cat "$PKG_STAMP" 2>/dev/null)" != "$(pkg_sha)" ]; then
  echo "[$(date '+%H:%M:%S')] deps out of sync with package-lock -> healing"
  sync_app_deps
fi

while true; do
  before="$(git rev-parse HEAD)"
  if git pull --quiet --ff-only 2>/dev/null; then
    after="$(git rev-parse HEAD)"
    if [ "$before" != "$after" ]; then
      echo "[$(date '+%H:%M:%S')] pulled ${before:0:7} -> ${after:0:7}"
      changed="$(git diff --name-only "$before" "$after")"

      # Reinstall app deps when the manifest changed (expo is stopped during the
      # install — restarting it mid-install crash-loops Metro and kills the
      # tunnel). JS-only edits skip this and just Fast-Refresh.
      if echo "$changed" | grep -q '^apps/mayo/package'; then
        echo "  package manifest changed -> syncing deps"
        sync_app_deps
      fi

      # Restart the API agent when the backend or its runner changes.
      # mayo-api-run.sh self-bootstraps deps (reinstalls when requirements.txt
      # changes), so a plain kickstart picks up code, dep, or runner changes.
      if echo "$changed" | grep -qE '^apps/mayo-api/|^scripts/mayo-api-run\.sh$'; then
        echo "  mayo-api changed -> restarting mayo api agent"
        launchctl kickstart -k "gui/$(id -u)/com.efforthye.mayo.api" 2>/dev/null || true
      fi

      # Restart the tunnel agent when its runner changes.
      if echo "$changed" | grep -q '^scripts/mayo-tunnel-run\.sh$'; then
        echo "  mayo-tunnel-run.sh changed -> restarting mayo tunnel agent"
        launchctl kickstart -k "gui/$(id -u)/com.efforthye.mayo.tunnel" 2>/dev/null || true
      fi

      # Restart the ComfyUI agent when its runner changes.
      if echo "$changed" | grep -q '^scripts/mayo-comfy-run\.sh$'; then
        echo "  mayo-comfy-run.sh changed -> restarting mayo comfy agent"
        launchctl kickstart -k "gui/$(id -u)/com.efforthye.mayo.comfy" 2>/dev/null || true
      fi

      # Self-update: if this script itself changed, restart the autopull agent so
      # the new logic takes effect (no manual step for future improvements).
      if echo "$changed" | grep -q '^scripts/dev-autopull\.sh$'; then
        echo "  dev-autopull.sh changed -> restarting self to pick up new logic"
        launchctl kickstart -k "gui/$(id -u)/com.efforthye.mayo.autopull" 2>/dev/null || true
      fi
    fi
  else
    echo "[$(date '+%H:%M:%S')] pull skipped (not fast-forward — local changes?)"
  fi
  sleep "$INTERVAL"
done

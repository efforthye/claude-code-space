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

echo "dev-autopull: pulling every ${INTERVAL}s on '$(git rev-parse --abbrev-ref HEAD)' (Ctrl+C to stop)"

while true; do
  before="$(git rev-parse HEAD)"
  if git pull --quiet --ff-only 2>/dev/null; then
    after="$(git rev-parse HEAD)"
    if [ "$before" != "$after" ]; then
      echo "[$(date '+%H:%M:%S')] pulled ${before:0:7} -> ${after:0:7}"
      changed="$(git diff --name-only "$before" "$after")"

      # Reinstall app deps when the manifest changed, then restart the expo agent
      # so new native/JS modules are picked up (JS-only edits don't need this).
      if echo "$changed" | grep -q '^apps/mayo/package'; then
        echo "  package manifest changed -> npm install (apps/mayo)"
        (cd apps/mayo && npm install --no-audit --no-fund) || true
        if launchctl kickstart -k "gui/$(id -u)/com.efforthye.mayo.expo" 2>/dev/null; then
          echo "  restarted mayo expo agent (new deps)"
        fi
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

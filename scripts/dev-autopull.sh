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
      # Reinstall app deps only when the manifest changed (JS edits don't need it).
      if git diff --name-only "$before" "$after" | grep -q '^apps/mayo/package'; then
        echo "  package manifest changed -> npm install (apps/mayo); restart expo after."
        (cd apps/mayo && npm install --no-audit --no-fund) || true
      fi
    fi
  else
    echo "[$(date '+%H:%M:%S')] pull skipped (not fast-forward — local changes?)"
  fi
  sleep "$INTERVAL"
done

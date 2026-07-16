#!/usr/bin/env bash
# mayo-api-run — boot the mayo orchestration API on the mini.
#
# Self-bootstrapping: creates a venv, installs/refreshes deps when
# requirements.txt changes, then execs uvicorn. Meant to be launched by the
# launchd agent (com.efforthye.mayo.api) installed by mayo-autostart-install.sh,
# but you can also run it by hand:
#   ./scripts/mayo-api-run.sh
#
# Port defaults to 8001 (richclub owns 8000 on the home server). Override with
# MAYO_PORT. Other config comes from the environment (see apps/mayo-api/.env.example).

set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
API="$REPO/apps/mayo-api"
cd "$API"

# Prefer Python 3.11 (what the app is built + tested against); fall back to python3.
PY="$(command -v python3.11 || command -v python3 || true)"
if [ -z "$PY" ]; then
  echo "mayo-api-run: no python3 found on PATH" >&2
  exit 127
fi

if [ ! -d .venv ]; then
  echo "mayo-api-run: creating venv with $PY"
  "$PY" -m venv .venv
fi
# shellcheck disable=SC1091
. .venv/bin/activate

# Reinstall deps only when requirements.txt actually changed (hash stamp).
STAMP=".venv/.reqs-sha"
CUR="$(shasum requirements.txt | awk '{print $1}')"
if [ ! -f "$STAMP" ] || [ "$(cat "$STAMP" 2>/dev/null)" != "$CUR" ]; then
  echo "mayo-api-run: installing deps (requirements changed)"
  pip install --disable-pip-version-check -q -r requirements.txt
  echo "$CUR" > "$STAMP"
fi

PORT="${MAYO_PORT:-8001}"
echo "mayo-api-run: starting uvicorn on 0.0.0.0:$PORT"
exec uvicorn app.main:app --host 0.0.0.0 --port "$PORT"

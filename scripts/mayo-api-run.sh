#!/usr/bin/env bash
# mayo-api-run — boot the mayo orchestration API on the mini.
#
# Self-bootstrapping and self-diagnosing: creates a venv, installs deps when
# requirements.txt changes, then execs uvicorn. Uses the venv's python directly
# (no `activate` sourcing) so it's robust under launchd. Every step logs to
# stdout/stderr, which the launchd agent captures at ~/Library/Logs/mayo-api.log.
#
# Launched by the com.efforthye.mayo.api agent; also runnable by hand:
#   ./scripts/mayo-api-run.sh
# Port defaults to 8001 (richclub owns 8000). Override with MAYO_PORT. Other
# config comes from the environment (see apps/mayo-api/.env.example).

set -eo pipefail  # no -u: keep third-party/venv edge cases from tripping nounset

REPO="$(cd "$(dirname "$0")/.." && pwd)"
API="$REPO/apps/mayo-api"
cd "$API"

log() { echo "[mayo-api-run $(date '+%H:%M:%S')] $*"; }

# Prefer a Python with broad wheel availability; fall back through to python3
# (which on this host is Homebrew 3.14). Deps are pinned to versions that have
# 3.14 wheels, so 3.14 is fine — this just prefers a more-settled interpreter if
# one is installed.
PY="$(command -v python3.12 || command -v python3.13 || command -v python3.11 || command -v python3 || true)"
if [ -z "$PY" ]; then
  log "ERROR: no python3 found on PATH ($PATH)"
  exit 127
fi
log "python: $("$PY" --version 2>&1) ($PY)"

# Safety net: if any native dep (e.g. pydantic-core) has no wheel for this
# Python and falls back to a source build, let PyO3 build against a newer
# interpreter using the stable ABI instead of erroring on the version check.
export PYO3_USE_ABI3_FORWARD_COMPATIBILITY=1

VENV="$API/.venv"
VPY="$VENV/bin/python"

# (Re)create the venv if missing or broken.
if [ ! -x "$VPY" ]; then
  log "creating venv at $VENV"
  rm -rf "$VENV"
  "$PY" -m venv "$VENV"
fi

# Install deps only when requirements.txt actually changed (hash stamp). If the
# install fails, the stamp isn't written, so the next restart retries.
STAMP="$VENV/.reqs-sha"
CUR="$(shasum requirements.txt | awk '{print $1}')"
if [ ! -f "$STAMP" ] || [ "$(cat "$STAMP" 2>/dev/null)" != "$CUR" ]; then
  log "installing deps (this can take ~30s the first time)…"
  "$VPY" -m pip install --disable-pip-version-check -q -r requirements.txt
  echo "$CUR" > "$STAMP"
  log "deps installed"
else
  log "deps up to date"
fi

PORT="${MAYO_PORT:-8001}"
log "starting uvicorn on 0.0.0.0:$PORT"
exec "$VPY" -m uvicorn app.main:app --host 0.0.0.0 --port "$PORT" --log-level info

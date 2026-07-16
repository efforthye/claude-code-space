#!/usr/bin/env bash
# mayo-tunnel-run — expose mayo-api on a STABLE public URL via a named Cloudflare
# tunnel: https://mayo-api.efforthye.dev -> http://localhost:8001.
#
# Reuses the existing Cloudflare login from the richclub setup
# (~/.cloudflared/cert.pem), and is fully self-provisioning: on first run it
# creates the "mayo-api" tunnel and its DNS route, then serves it. Runs under a
# dedicated config so it never touches the richclub tunnel's config.yml.
# Launched by the com.efforthye.mayo.tunnel launchd agent.

set -eo pipefail

log() { echo "[mayo-tunnel $(date '+%H:%M:%S')] $*"; }

HOST="mayo-api.efforthye.dev"
PORT="${MAYO_PORT:-8001}"
CFDIR="$HOME/.cloudflared"
CFG="$CFDIR/mayo-api.yml"

command -v cloudflared >/dev/null 2>&1 || { log "ERROR: cloudflared not found (brew install cloudflared)"; exit 127; }
[ -f "$CFDIR/cert.pem" ] || { log "ERROR: $CFDIR/cert.pem missing — run 'cloudflared tunnel login' once"; exit 1; }

# Find the named tunnel, creating it if it doesn't exist yet.
UUID="$(cloudflared tunnel list 2>/dev/null | awk '$2=="mayo-api"{print $1; exit}')"
if [ -z "$UUID" ]; then
  log "creating named tunnel 'mayo-api'…"
  OUT="$(cloudflared tunnel create mayo-api 2>&1)" || { log "create failed:"; echo "$OUT"; exit 1; }
  echo "$OUT"
  UUID="$(printf '%s\n' "$OUT" | grep -oiE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | head -1)"
fi
[ -n "$UUID" ] || { log "ERROR: could not determine tunnel id"; exit 1; }
log "tunnel id: $UUID"

# Ensure the DNS route exists (idempotent — ignore 'already exists').
if cloudflared tunnel route dns "$UUID" "$HOST" 2>&1 | sed 's/^/[route] /'; then :; fi

# Dedicated config so we never touch the richclub tunnel's config.yml.
cat > "$CFG" <<YAML
tunnel: $UUID
credentials-file: $CFDIR/$UUID.json
ingress:
  - hostname: $HOST
    service: http://localhost:$PORT
  - service: http_status:404
YAML

log "serving https://$HOST -> http://localhost:$PORT"
exec cloudflared tunnel --config "$CFG" run

#!/usr/bin/env bash
# mayo-tunnel-run — expose the mini's two dev services on STABLE public URLs via
# a named Cloudflare tunnel:
#
#   https://mayo-api.efforthye.dev -> http://localhost:8001   (the API)
#   https://metro.efforthye.dev    -> http://localhost:8081   (the Expo dev server)
#
# Metro is here because `expo start --tunnel` hands out an ngrok hostname that
# changes on every restart, and Expo Go only auto-lists dev servers it finds on
# the local network — so an owner on mobile data had a URL to re-copy each time
# the agent bounced. Pairing this route with EXPO_PACKAGER_PROXY_URL on the
# expo agent makes the address permanent.
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
METRO_HOST="metro.efforthye.dev"
METRO_PORT="${MAYO_METRO_PORT:-8081}"
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

# Ensure the DNS routes exist (idempotent — ignore 'already exists'). Both are
# CNAMEs onto this tunnel, so a hostname that was previously pointed at some
# other tunnel is repointed here rather than left dangling.
for h in "$HOST" "$METRO_HOST"; do
  if cloudflared tunnel route dns --overwrite-dns "$UUID" "$h" 2>&1 | sed 's/^/[route] /'; then :; fi
done

# Dedicated config so we never touch the richclub tunnel's config.yml.
cat > "$CFG" <<YAML
tunnel: $UUID
credentials-file: $CFDIR/$UUID.json
ingress:
  - hostname: $HOST
    service: http://localhost:$PORT
  - hostname: $METRO_HOST
    service: http://localhost:$METRO_PORT
    originRequest:
      # Metro keeps a websocket open for HMR and holds it idle between edits;
      # the default 90s origin timeout would cut it and the app would stop
      # hot-reloading until you shook the device.
      noHappyEyeballs: true
      connectTimeout: 30s
  - service: http_status:404
YAML

log "serving https://$HOST -> http://localhost:$PORT"
log "serving https://$METRO_HOST -> http://localhost:$METRO_PORT"
exec cloudflared tunnel --config "$CFG" run

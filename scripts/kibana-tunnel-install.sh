#!/usr/bin/env bash
# kibana-tunnel-install — always-on SSH tunnel from THIS MACHINE (the laptop)
# to Kibana on the home-server mini.
#
#   http://localhost:5601  ->  ssh  ->  mini:5601
#
# Kibana itself binds to 127.0.0.1 on the mini and is never exposed to the LAN
# or the internet. The only way in is this tunnel, authenticated by your SSH
# key — the same shape as an AWS SSM port-forward session.
#
# Installs a macOS LaunchAgent with KeepAlive, so the tunnel reconnects by
# itself after sleep, a network change, or the mini rebooting. No autossh
# needed: launchd is the supervisor.
#
#   ./scripts/kibana-tunnel-install.sh              # install + start
#   ./scripts/kibana-tunnel-install.sh --uninstall  # remove
#
# Prerequisites (one time):
#   ssh-keygen -t ed25519                 # if you have no key yet
#   ssh-copy-id <user>@<mini-host>        # password auth breaks an unattended tunnel

set -euo pipefail

log() { echo "[kibana-tunnel] $*"; }

LABEL="com.efforthye.kibana.tunnel"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG_OUT="$HOME/Library/Logs/kibana-tunnel.log"

# Override per machine:  MINI_USER=someone MINI_HOST=m1mini.local ./scripts/kibana-tunnel-install.sh
MINI_USER="${MINI_USER:-$(whoami)}"
MINI_HOST="${MINI_HOST:-home.efforthye.com}"
KIBANA_PORT="${KIBANA_PORT:-5601}"
# Elasticsearch too, so curl/devtools work from the laptop. Set to 0 to skip.
ES_PORT="${ES_PORT:-9200}"

if [ "${1:-}" = "--uninstall" ]; then
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
  rm -f "$PLIST"
  log "removed."
  exit 0
fi

command -v ssh >/dev/null 2>&1 || { log "ERROR: ssh not found"; exit 127; }

# A tunnel that prompts for a password will hang forever under launchd, so
# refuse to install until key auth actually works.
log "checking key-based SSH to $MINI_USER@$MINI_HOST …"
if ! ssh -o BatchMode=yes -o ConnectTimeout=8 -o StrictHostKeyChecking=accept-new \
     "$MINI_USER@$MINI_HOST" true 2>/dev/null; then
  log "ERROR: key-based SSH failed."
  log "  Run these once, then re-run this installer:"
  log "    ssh-keygen -t ed25519          # only if you have no key"
  log "    ssh-copy-id $MINI_USER@$MINI_HOST"
  exit 1
fi
log "key auth OK."

FORWARDS=(-L "127.0.0.1:${KIBANA_PORT}:127.0.0.1:${KIBANA_PORT}")
[ "$ES_PORT" != "0" ] && FORWARDS+=(-L "127.0.0.1:${ES_PORT}:127.0.0.1:${ES_PORT}")

# Build the <string> entries for the plist.
args_xml=""
add_arg() { args_xml+="    <string>$1</string>"$'\n'; }
add_arg "/usr/bin/ssh"
add_arg "-N"                                  # no remote command, forwarding only
add_arg "-T"                                  # no tty
add_arg "-o"; add_arg "BatchMode=yes"         # never prompt
add_arg "-o"; add_arg "ExitOnForwardFailure=yes"  # die (and let launchd retry) if the port is taken
add_arg "-o"; add_arg "ServerAliveInterval=30"    # detect a dead link within ~90s
add_arg "-o"; add_arg "ServerAliveCountMax=3"
add_arg "-o"; add_arg "StrictHostKeyChecking=accept-new"
for f in "${FORWARDS[@]}"; do add_arg "$f"; done
add_arg "${MINI_USER}@${MINI_HOST}"

mkdir -p "$HOME/Library/LaunchAgents"
cat > "$PLIST" <<PLIST_EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
${args_xml}  </array>
  <key>RunAtLoad</key><true/>
  <!-- KeepAlive is the whole point: launchd restarts ssh whenever it exits,
       so the tunnel survives sleep, wifi changes and mini reboots. -->
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>10</integer>
  <key>StandardOutPath</key><string>${LOG_OUT}</string>
  <key>StandardErrorPath</key><string>${LOG_OUT}</string>
</dict>
</plist>
PLIST_EOF

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
launchctl kickstart -k "gui/$(id -u)/$LABEL"

log "installed."
log "  Kibana        -> http://localhost:${KIBANA_PORT}"
[ "$ES_PORT" != "0" ] && log "  Elasticsearch -> http://localhost:${ES_PORT}"
log "  log           -> $LOG_OUT"
log "Log in to Kibana as 'elastic' with ELASTIC_PASSWORD from the mini's infra/elk/.env"

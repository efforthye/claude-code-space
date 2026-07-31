#!/usr/bin/env bash
# watchdog-install — install the Telegram watchdog as a launchd agent ON THE MINI.
#
#   ./scripts/watchdog-install.sh              # install + run once now
#   ./scripts/watchdog-install.sh --uninstall  # remove
#   ./scripts/watchdog-install.sh --test       # send a test message, don't install
#
# Runs scripts/watchdog-telegram.sh every INTERVAL seconds (default 300).

set -euo pipefail

log() { echo "[watchdog] $*"; }

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT="$REPO_ROOT/scripts/watchdog-telegram.sh"
LABEL="com.efforthye.watchdog"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG_OUT="$HOME/Library/Logs/mayo-watchdog.log"
ENV_FILE="$HOME/.mayo-watchdog.env"
INTERVAL="${INTERVAL:-300}"

if [ "${1:-}" = "--uninstall" ]; then
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
  rm -f "$PLIST"
  log "removed."
  exit 0
fi

if [ ! -f "$ENV_FILE" ]; then
  log "ERROR: $ENV_FILE missing."
  log "  cp $REPO_ROOT/scripts/watchdog.env.example $ENV_FILE"
  log "  \$EDITOR $ENV_FILE && chmod 600 $ENV_FILE"
  exit 1
fi

# Refuse to install with a world-readable secrets file.
perms="$(stat -f '%Lp' "$ENV_FILE")"
if [ "$perms" != "600" ]; then
  log "ERROR: $ENV_FILE has mode $perms — run: chmod 600 $ENV_FILE"
  exit 1
fi

chmod +x "$SCRIPT"

if [ "${1:-}" = "--test" ]; then
  set -a; . "$ENV_FILE"; set +a
  curl -sf -m 20 -X POST \
    "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
    --data-urlencode "chat_id=${TELEGRAM_CHAT_ID}" \
    --data-urlencode "text=🧪 [$(hostname -s)] watchdog 테스트 메시지 — 연결 정상" \
    >/dev/null && log "test message sent." || { log "ERROR: send failed — check the token and chat id."; exit 1; }
  exit 0
fi

mkdir -p "$HOME/Library/LaunchAgents"
cat > "$PLIST" <<PLIST_EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>${SCRIPT}</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>StartInterval</key><integer>${INTERVAL}</integer>
  <key>StandardOutPath</key><string>${LOG_OUT}</string>
  <key>StandardErrorPath</key><string>${LOG_OUT}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key><string>/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
  </dict>
</dict>
</plist>
PLIST_EOF

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
launchctl kickstart -k "gui/$(id -u)/$LABEL"

log "installed — checks run every ${INTERVAL}s."
log "  log -> $LOG_OUT"
log "First run happens now; you get a message only if something is actually wrong."

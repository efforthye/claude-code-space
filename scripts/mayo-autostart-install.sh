#!/usr/bin/env bash
# Install macOS launchd agents so the mayo dev server (expo --tunnel) and the
# git auto-pull run automatically: start at login, survive closing Termius,
# auto-restart if they crash, and come back after a reboot.
#
# Run once on the mini:
#   ./scripts/mayo-autostart-install.sh
# Remove later:
#   ./scripts/mayo-autostart-install.sh --uninstall
#
# Notes:
# - These are per-user LaunchAgents; for them to start at BOOT without you
#   logging in, enable automatic login on the mini (System Settings → Users &
#   Groups → Automatically log in as <user>).
# - The dev server runs headless (no interactive QR). Get the (stable) tunnel
#   URL from the log:  grep -m1 'exp://' ~/Library/Logs/mayo-expo.log
# - git pull uses your cached credentials; if pulls fail, check
#   ~/Library/Logs/mayo-autopull.log (private-repo auth under launchd).

set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
APP="$REPO/apps/mayo"
AGENTS="$HOME/Library/LaunchAgents"
LOGS="$HOME/Library/Logs"
UID_NUM="$(id -u)"
EXPO_LABEL="com.efforthye.mayo.expo"
PULL_LABEL="com.efforthye.mayo.autopull"
API_LABEL="com.efforthye.mayo.api"
TUNNEL_LABEL="com.efforthye.mayo.tunnel"
COMFY_LABEL="com.efforthye.mayo.comfy"
EXPO_PLIST="$AGENTS/$EXPO_LABEL.plist"
PULL_PLIST="$AGENTS/$PULL_LABEL.plist"
API_PLIST="$AGENTS/$API_LABEL.plist"
TUNNEL_PLIST="$AGENTS/$TUNNEL_LABEL.plist"
COMFY_PLIST="$AGENTS/$COMFY_LABEL.plist"

unload() {
  launchctl bootout "gui/$UID_NUM/$EXPO_LABEL" 2>/dev/null || true
  launchctl bootout "gui/$UID_NUM/$PULL_LABEL" 2>/dev/null || true
  launchctl bootout "gui/$UID_NUM/$API_LABEL" 2>/dev/null || true
  launchctl bootout "gui/$UID_NUM/$TUNNEL_LABEL" 2>/dev/null || true
  launchctl bootout "gui/$UID_NUM/$COMFY_LABEL" 2>/dev/null || true
}

if [ "${1:-}" = "--uninstall" ]; then
  unload
  rm -f "$EXPO_PLIST" "$PULL_PLIST" "$API_PLIST" "$TUNNEL_PLIST" "$COMFY_PLIST"
  echo "Uninstalled mayo autostart agents."
  exit 0
fi

mkdir -p "$AGENTS" "$LOGS"

# Resolve node/npx and git locations NOW (this script runs in your interactive
# shell, so they're on PATH here) and bake them into the agents' PATH — launchd
# does not load ~/.zshrc, so nvm/brew node would otherwise be missing.
NODE_PATH_DIR="$(cd "$(dirname "$(command -v node || echo /usr/local/bin/node)")" && pwd)"
GIT_PATH_DIR="$(cd "$(dirname "$(command -v git || echo /usr/bin/git)")" && pwd)"
AGENT_PATH="$NODE_PATH_DIR:$GIT_PATH_DIR:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
echo "Using node from: $NODE_PATH_DIR"

write_plist() {
  local file="$1" label="$2" workdir="$3" cmd="$4" log="$5"
  cat > "$file" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$label</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/zsh</string>
    <string>-lc</string>
    <string>cd "$workdir" &amp;&amp; exec $cmd</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key><string>$AGENT_PATH</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>10</integer>
  <key>StandardOutPath</key><string>$log</string>
  <key>StandardErrorPath</key><string>$log</string>
</dict>
</plist>
PLIST
}

write_plist "$EXPO_PLIST" "$EXPO_LABEL" "$APP" "npx expo start --tunnel" "$LOGS/mayo-expo.log"
# Invoke the pull script via an explicit bash (not shebang/exec) — launchd
# returned exit 126 execing the script directly.
write_plist "$PULL_PLIST" "$PULL_LABEL" "$REPO" "/bin/bash $REPO/scripts/dev-autopull.sh" "$LOGS/mayo-autopull.log"
# Orchestration API (FastAPI/uvicorn on port 8001 — richclub owns 8000). The
# run script self-bootstraps a venv + deps, so no manual pip step is needed.
write_plist "$API_PLIST" "$API_LABEL" "$REPO" "/bin/bash $REPO/scripts/mayo-api-run.sh" "$LOGS/mayo-api.log"
# Public tunnel so the phone app reaches the API from anywhere (not just LAN).
# Self-provisions a named Cloudflare tunnel at https://mayo-api.efforthye.dev
# (stable), reusing the existing cloudflared login. The app defaults to that URL.
write_plist "$TUNNEL_PLIST" "$TUNNEL_LABEL" "$REPO" "/bin/bash $REPO/scripts/mayo-tunnel-run.sh" "$LOGS/mayo-tunnel.log"
# Local video generation (ComfyUI) — real per-scene clips for the generator. Runs
# from its own clone at ~/programs/ComfyUI; serves its API on 127.0.0.1:8188.
write_plist "$COMFY_PLIST" "$COMFY_LABEL" "$REPO" "/bin/bash $REPO/scripts/mayo-comfy-run.sh" "$LOGS/mayo-comfy.log"

# Bootstrap with a retry — launchctl can transiently fail ("Bootstrap failed:
# 5: Input/output error") if the old agent is still tearing down.
boot() {
  local label plist="$1"
  label="$(basename "$plist" .plist)"
  if launchctl bootstrap "gui/$UID_NUM" "$plist" 2>/dev/null; then return 0; fi
  launchctl bootout "gui/$UID_NUM/$label" 2>/dev/null || true
  sleep 2
  launchctl bootstrap "gui/$UID_NUM" "$plist"
}

unload
sleep 2
boot "$EXPO_PLIST"
boot "$PULL_PLIST"
boot "$API_PLIST"
boot "$TUNNEL_PLIST"
boot "$COMFY_PLIST"

echo "Installed launchd agents:"
echo "  $EXPO_PLIST"
echo "  $PULL_PLIST"
echo "  $API_PLIST"
echo "  $TUNNEL_PLIST"
echo "  $COMFY_PLIST"
echo
echo "They now run on login, restart on crash, and survive reboots + Termius close."
echo "Get the Expo tunnel URL (give it ~15s to boot):"
echo "  grep -m1 'exp://' $LOGS/mayo-expo.log"
echo "API health (give it ~30s the first time — it builds a venv):"
echo "  curl -s localhost:8001/health   (interactive docs at http://<host>:8001/docs)"
echo "Public API URL for the phone: https://mayo-api.efforthye.dev (self-provisions on first run)"
echo "  the app already defaults to it — no pasting needed. Watch it come up:"
echo "  grep -m1 'serving https' $LOGS/mayo-tunnel.log"
echo "Watch logs:  tail -f $LOGS/mayo-api.log   (and mayo-expo/autopull/tunnel logs)"
echo "Uninstall:   $0 --uninstall"

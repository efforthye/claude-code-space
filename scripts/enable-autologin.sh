#!/usr/bin/env bash
# Enable macOS automatic login for the current user, from the terminal (headless).
#
#   ./scripts/enable-autologin.sh
#
# Why: LaunchAgents (the mayo dev server + auto-pull) start at LOGIN. On a
# headless mini with no GUI login, they won't come back after a reboot unless
# the box auto-logs-in. This sets that up over SSH.
#
# Gates:
#   - FileVault must be OFF (if on, boot needs a manual disk password — nothing
#     can auto-start; this script refuses).
#   - Needs your macOS login password to write /etc/kcpassword. It is read
#     locally on this machine (never printed, never sent anywhere).
#
# Security note: /etc/kcpassword stores your login password reversibly
# (root-readable). That is inherent to macOS auto-login — only enable it on a
# machine you physically control (a home server is the typical case).

set -euo pipefail

USER_NAME="$(id -un)"

if fdesetup status 2>/dev/null | grep -qi "FileVault is On"; then
  echo "FileVault is ON — automatic login cannot work (boot needs the disk password)."
  echo "Options: turn FileVault off, or handle reboots manually. Aborting."
  exit 1
fi

read -rsp "macOS login password for $USER_NAME: " PW; echo

# 1) which user auto-logs in
sudo defaults write /Library/Preferences/com.apple.loginwindow autoLoginUser "$USER_NAME"

# 2) obfuscated password file (macOS kcpassword cipher)
printf '%s' "$PW" | sudo /usr/bin/python3 -c '
import sys, os
key = [0x7D,0x89,0x52,0x23,0xD2,0xBC,0xDE,0xA3,0xD0,0xDD,0x4F,0xA8,
       0x9F,0x2B,0x0C,0xE4,0x9E,0x21,0x8A,0x21,0xC0,0x71,0x37,0x8D]
pw = bytearray(sys.stdin.buffer.read())
pw.append(0)
while len(pw) % 12 != 0:
    pw.append(0)
out = bytes(b ^ key[i % len(key)] for i, b in enumerate(pw))
with open("/etc/kcpassword", "wb") as f:
    f.write(out)
os.chmod("/etc/kcpassword", 0o600)
'
unset PW

echo
echo "Auto-login enabled for '$USER_NAME'. Reboot to test:  sudo reboot"
echo "After it boots, the mayo launchd agents start automatically."
echo "If it STILL asks for a password at boot, tell Claude — we'll switch to a"
echo "LaunchDaemon (starts at boot with no login, no password needed)."

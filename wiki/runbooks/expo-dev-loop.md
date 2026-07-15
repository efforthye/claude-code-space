---
title: Expo Live-Preview Dev Loop (M1 mini + phone)
type: runbook
tags: [runbook, mobile, expo, react-native, dev]
created: 2026-07-15
updated: 2026-07-15
---

# Runbook — Expo Live-Preview Dev Loop

Set up the "edit code → see it on the phone instantly" loop. Dev server runs on the
[[home-server]] (M1 mini); phones connect via **Expo Go**. Decision: [[0003-expo-react-native-for-mobile-app]].

## One-time setup (on the M1 mini)
```bash
# 1. Node (skip if already installed)
brew install node          # or use nvm; verify: node -v  (LTS recommended)

# 2. Scaffold a TypeScript Expo app (Expo Router template, TS by default)
cd ~/projects                       # or wherever you keep code
npx create-expo-app@latest <app-name>
cd <app-name>
```

On each phone (both iOS and Android supported):
- Install **Expo Go** — iOS: App Store · Android: Play Store.
- Put the phone on the **same WiFi** as the mini.

## Run the loop
```bash
cd ~/projects/<app-name>
npx expo start            # prints a QR code + dev-server URL
```
- **iOS:** open the Camera app, point at the QR → it opens in Expo Go.
- **Android:** open Expo Go → "Scan QR code".
- Edit any file and save → **Fast Refresh** updates the phone in ~1s.
- Off the home WiFi, or if the router blocks LAN discovery: `npx expo start --tunnel`
  (installs `@expo/ngrok`; connects over the internet instead of LAN).

## Real-time editing WITH Claude
For the tightest loop, run **Claude Code on the mini** in the project dir:
```bash
cd ~/projects/<app-name>
claude                    # chat + edit here; dev server hot-reloads the phone live
```
Editing from the cloud web session instead means changes reach the mini via `git push`/`pull`
— fine for bigger changes, but not the instant loop.

## Handy commands
```bash
npx expo start -c         # start with cleared Metro cache (fixes weird stale states)
npx expo install <pkg>    # add a dependency at the Expo-compatible version
i / a                     # in the running dev server: open iOS simulator / Android emulator
r                         # reload the app ; m → toggle the dev menu
```

## Troubleshooting
- **Phone can't connect:** confirm same WiFi; try `--tunnel`; check the mini's firewall isn't
  blocking Metro's port (default 8081).
- **Stuck / white screen:** `npx expo start -c` to clear cache; shake the phone → Reload.
- **arm64:** native tooling is all arm64 here — no emulation concerns for JS-only development.

## Toward a real app (later)
Expo Go is dev-only. As this grows into a service (see [[mayo]]):
- Add a **development build** once you need native modules Expo Go doesn't bundle.
- Use **EAS Build** for real iOS/Android store binaries and **EAS Update** for OTA JS updates
  (needs a free Expo account). Give these their own runbook when we get there.

## Related
- Decision: [[0003-expo-react-native-for-mobile-app]] · Service: [[mayo]] · Host: [[home-server]]

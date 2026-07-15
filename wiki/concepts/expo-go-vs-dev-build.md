---
title: Expo Go vs Development Build
type: concept
tags: [concept, expo, mobile, dev-build]
created: 2026-07-15
updated: 2026-07-15
---

# Expo Go vs Development Build

Two ways to run an Expo app on a phone during development. Understanding the difference matters
because [[mayo]] hit the Expo Go **version wall** (SDK 57→56→55 downgrades) — see [[expo-dev-loop]].

## Expo Go
A **generic container app** Expo publishes to the App/Play Store. It loads any Expo project's JS
over the dev server. **Limitation:** it only runs projects whose **Expo SDK matches the version
that Expo Go build shipped with** — modern Expo Go supports essentially one SDK. When the store
build lags the latest SDK, newer projects fail with *"requires a newer version of Expo Go."* It
also only includes a **fixed set of native modules** — you can't add arbitrary native code.

## Development build
**Your own app, compiled** with the native runtime + your exact SDK + any native modules baked
in. Installs as a separate app (e.g. "mayo (dev)"). The dev server (`expo start`) connects to it
exactly like Expo Go — **same Fast Refresh / live-reload loop**.

| | Expo Go | Development build |
|---|---|---|
| What | Expo's generic app | Your compiled app |
| SDK | tied to Expo Go's version ❌ | you choose ✅ |
| Native modules | fixed set only | anything |
| Live reload | yes | **yes (identical)** |
| Install | from the store | build once, install |

## When to use which
- **Expo Go:** quick prototyping while your SDK matches Expo Go's, and you only need built-in
  native modules.
- **Development build:** the moment you need a specific SDK Expo Go won't run, OR any custom
  native module. **Required for real apps.** [[mayo]] will need it anyway (large-video handling,
  background work, publishing SDKs), so it's the go-forward path, not just a workaround.

## Cost / how to build
- One-time native build step; JS-only changes afterward still Fast-Refresh (no rebuild).
- **Android** — easiest: `eas build -p android --profile development` (an APK you sideload) or
  `npx expo run:android`. No developer account needed.
- **iOS** — needs Xcode on a Mac: `npx expo run:ios --device` (a free Apple ID signs for 7 days),
  or **EAS Build** in the cloud. Ad-hoc/OTA distribution needs a paid Apple Developer account.

## Related
- [[mayo]] · [[expo-dev-loop]] · [[0003-expo-react-native-for-mobile-app]]

---
title: "ADR 0003: Expo (React Native) for the mobile app, dev loop on the M1 mini"
type: decision
status: accepted
tags: [decision, mobile, expo, react-native, flutter]
created: 2026-07-15
updated: 2026-07-15
---

# ADR 0003 — Expo (React Native) for the mobile app

## Context
We want to build a mobile app with a tight **live-preview loop**: edit code (with Claude) and see
the change on a real phone almost instantly. Target both **iOS and Android**. It starts as an
experiment but is **intended to grow into a real service**. The [[home-server]] (always-on M1
mini) is available to host the dev server.

## Options considered
- **Expo (React Native, TypeScript).** Install **Expo Go** on the phone, run `expo start`, scan a
  QR, and every save hot-reloads on the device (Fast Refresh). `--tunnel` works off-LAN too. One
  JS/TS codebase for iOS + Android. Fast to iterate on conversationally.
- **Flutter (Dart).** Excellent hot reload, but **no Expo Go-style sandbox client** — live preview
  on a physical phone needs USB debugging or an installed build. More friction for this exact loop.
- **Native (SwiftUI / Kotlin).** Best platform fidelity, worst iteration speed and no single
  codebase. Overkill here.

## Decision
Use **Expo + React Native + TypeScript**. Run the **dev server on the M1 mini**; connect phones
via **Expo Go** over the same WiFi (LAN → instant), falling back to `expo start --tunnel` when off
the home network. For the real-time "edit with Claude" loop, run **Claude Code locally on the
mini** in the project dir so editing + dev server + phone are co-located. See
[[expo-dev-loop]].

## Consequences
- ✅ Instant phone preview for both iOS and Android from one codebase; low-friction iteration.
- ✅ Uses existing always-on hardware (the mini) for the dev server.
- ⚠️ **Expo Go is dev-only.** Shipping a real app needs a **development build** (once native
  modules are added) and **EAS Build** for store binaries — plan for this as it grows.
- ⚠️ The tight loop needs Claude Code **on the mini**; editing from the cloud web session syncs via
  git (not real-time). Choose the surface per task.
- 🔜 Follow-ups: name the app + create its own repo; decide backend (reuse [[richclub]] API?);
  later wire EAS Build / EAS Update; decide if/how CI ([[jenkins]]) participates.

## Related
- Runbook: [[expo-dev-loop]] · Service: [[mayo]] · Host: [[home-server]]

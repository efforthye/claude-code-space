---
title: Mobile App (Expo)
type: service
status: planned
tags: [service, mobile, expo, react-native]
created: 2026-07-15
updated: 2026-07-15
---

# Mobile App (Expo)

A cross-platform (iOS + Android) mobile app, built with **Expo / React Native / TypeScript**.
Starting as an experiment with a live-preview dev loop, intended to grow into a real service.

## Status
**Planned / bootstrapping.** Decision recorded in [[0003-expo-react-native-for-mobile-app]];
dev-loop steps in [[expo-dev-loop]].

## Basics (TBD)
- **Name:** _TBD_ (placeholder slug `mobile-app`; will rename once chosen).
- **Purpose:** _TBD._
- **Code location:** **workspace model** — lives in this repo at **`apps/<slug>/`** (see
  `CLAUDE.md` → "Where the code lives"). Clone this repo on the Mac and run Claude Code in it to
  build the app with full wiki context. Can be split into its own repo later if it needs its own
  CI/EAS pipeline.

## Stack
- Expo (React Native), TypeScript, Expo Router.
- Dev server runs on the [[home-server]] (M1 mini); phones preview via **Expo Go**.

## Backend
- _TBD._ Could reuse the existing [[richclub]] API (FastAPI at `:8000`) or get its own.

## Deploy / distribution (later)
- Dev: Expo Go + Fast Refresh (no build needed).
- Real builds: **EAS Build** (store binaries) + **EAS Update** (OTA). To be set up when it
  matures; decide whether [[jenkins]] plays any role.

## Related
- Decision: [[0003-expo-react-native-for-mobile-app]]
- Runbook: [[expo-dev-loop]]
- Host: [[home-server]]

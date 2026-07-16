---
title: Mayo on the web (react-native-web → mayo.im)
type: concept
tags: [mayo, web, expo, react-native-web, vercel, deploy]
created: 2026-07-16
updated: 2026-07-16
---

# Mayo on the web (react-native-web → mayo.im)

The [[mayo]] Expo app now also builds for the **web** (the same codebase powers the
iOS/Android app *and* the mayo.im website), via **react-native-web** + expo-router.

## What made it work
- **`app.json` → `web.output: "single"`** (was `"static"`). Static output tried to
  server-render each route and blew up on `resetServerContext`; `single` emits a
  client-rendered **SPA** (one `index.html`), which is what an interactive app wants
  and what Vercel serves cleanly.
- **`expo export -p web`** → `dist/` (bundle + `index.html` + favicon). Also wired as
  `npm run build:web`.
- **`vercel.json`** — `buildCommand: expo export -p web`, `outputDirectory: dist`,
  and a catch-all rewrite to `/index.html` so deep links (e.g. `/library/<id>`) load
  the SPA. Set the Vercel project's **Root Directory = `apps/mayo`**.

## Native-only modules — guarded for web
The app leans on a few native modules that don't exist (or differ) on the web; each
is guarded with `Platform.OS === 'web'` so the site doesn't crash:
- **expo-notifications** (`src/notify/job-notifier.tsx`) — the local-notification
  handler + permission/poll loop are skipped on web (no Web Push here).
- **expo-media-library / expo-file-system / expo-sharing** (`src/app/library/[id].tsx`)
  — "download" on native saves to the camera roll; on web it fetches the file (with
  the auth header) and triggers a normal **browser download** (`<a download>`).
- **`Alert.alert`** is a no-op on react-native-web, so destructive confirms (delete)
  fall back to `window.confirm` on web.
- **expo-video** works on web (HTML `<video>`); AsyncStorage maps to `localStorage`.
- Screen-orientation lock (the landscape editor) must also be web-guarded when added.

## Config for a real mayo.im deploy
- **API base URL** defaults to the Cloudflare tunnel `https://mayo-api.efforthye.dev`
  (`src/api/base-url.ts`), so web calls reach the backend with no config. Override at
  build time with `EXPO_PUBLIC_MAYO_API_URL` (Vercel env var).
- **CORS**: the API's `MAYO_ALLOWED_ORIGINS` must include `https://mayo.im` in prod
  (it's `*` in dev). See [[home-server]] / the API config.
- ✅ **Auth (solved 2026-07-16):** the web bundle ships **without** the shared key —
  `security.py` accepts a **signed-in user's session** (`X-Mayo-Session`) as an equal
  credential, and the `/v1/auth` router is mounted unguarded (register/login/google
  verify their own credentials). So web visitors sign in ([[0011-mayo-accounts-sns-login]])
  and everything works; anonymous visitors get 401s until they do. Never bake
  `EXPO_PUBLIC_MAYO_API_KEY` into a public web deploy.
- **Vercel wiring (owner steps):** point the existing mayo.im Vercel project at this
  repo, set **Root Directory = `apps/mayo`**, and set the **Production Branch** to the
  working branch (deploys follow pushes from then on).

## Related
- Service: [[mayo]] · Mobile stack: [[0003-expo-react-native-for-mobile-app]] ·
  Expo Go vs dev build: [[expo-go-vs-dev-build]] · Backend/tunnel: [[home-server]]

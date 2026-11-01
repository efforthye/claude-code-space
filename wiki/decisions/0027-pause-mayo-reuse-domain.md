---
title: "0027 — Pause mayo, reuse mayo.im and mayo-api for a new website"
type: decision
status: accepted
tags: [decision, mayo, web, nextjs, vercel]
created: 2026-11-01
updated: 2026-11-01
---

# 0027 — Pause mayo, reuse mayo.im and mayo-api for a new website

## Context
[[mayo]] (AI long-form video platform) reached a live state in July–August 2026, then work moved
to games. On 2026-11-01 the owner put mayo **on hold** and wants to build a newly planned website
project on the **same domain (`mayo.im`)**. The orchestration API ([[mayo-api]], home server
`:8001` → `mayo-api.efforthye.dev`) is expected to serve the new project too.

## Options considered
1. **Tag + move the app to `archive/` inside this repo** — snapshot is a git tag; the code stays
   browsable next to its wiki history.
2. Tag + archive branch, delete from the working branch — lighter tree, but the code is only
   reachable by checking out another ref.
3. Split mayo into its own GitHub repo — cleanest separation, but an outward-facing change and
   the wiki/ADRs still live here.

## Decision
- **Option 1.** Tag `archive/mayo-2026-11-01` marks the last mayo state (commit `2dd884c`). The
  Expo app moved `apps/mayo/` → **`archive/mayo/`** (code unchanged).
- **`apps/mayo-api/` stays where it is and keeps running.** The mini's launchd agent, tunnel and
  Jenkins/autopull hooks all point at that path, and the new site will call it. It is now
  documented as a standalone service, [[mayo-api]], rather than as part of the mayo page.
- The new website is a **Next.js (App Router) + TypeScript + Tailwind** app at **`apps/web/`**
  ([[web]]), deployed by the existing Vercel project behind `mayo.im`. Next.js is Vercel's
  native framework (zero-config builds, SSR/SSG for SEO), unlike the Expo `expo export -p web` SPA it
  replaces.

## Consequences
- **Vercel (done 2026-11-01):** project `mayo-landing-page` Root Directory changed `apps/mayo` →
  `apps/web` (Framework preset: Next.js) before the production branch got this change, so the
  production build didn't fail. First deploy READY on `f49bff6`. The old SPA rewrites (`/reel/:id` OG proxy) went
  with `archive/mayo/vercel.json`. Recreate them in `apps/web` only if the new site needs them.
- **Owner action — mini:** the `com.efforthye.mayo.expo` launchd agent bakes in
  `apps/mayo` as its working directory. Once the mini pulls this change, that agent will
  crash-loop. Either `launchctl bootout gui/$(id -u)/com.efforthye.mayo.expo` (mayo is paused,
  so this is the expected choice) or re-run `scripts/mayo-autostart-install.sh`, which now points
  at `archive/mayo`.
- [[mayo]] status → `paused`. Its ADRs (0004–0020) stay as the historical record. The API-side
  ones still describe live code in [[mayo-api]].
- Restoring mayo: `git checkout archive/mayo-2026-11-01 -- apps/mayo` or move `archive/mayo` back
  and repoint Vercel.

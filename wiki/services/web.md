---
title: Web (new site on mayo.im)
type: service
status: building
tags: [service, web, nextjs, vercel]
created: 2026-11-01
updated: 2026-11-01
---

# Web — new website on mayo.im

The newly planned website that takes over the **mayo.im** domain after [[mayo]] was paused
([[0027-pause-mayo-reuse-domain]]). **The product plan isn't recorded here yet.** Fill in the
purpose and features when the plan is shared. The slug `web` is a placeholder; rename the
folder and this page once the project has a name.

## Status
**Building — placeholder live on mayo.im (2026-11-01).** The "준비 중" home page is the production
deploy at `mayo.im` / `www.mayo.im` (commit `f49bff6`). The product itself is not built yet.

## Code & stack
- **Code:** `apps/web/` (workspace app in this repo).
- **Stack:** Next.js **16.4.3** (App Router, `src/` dir, Turbopack), React 19.3, TypeScript,
  Tailwind CSS 4, ESLint 9. Generated with `create-next-app@latest`. Next 16 changed APIs, so read
  `apps/web/AGENTS.md` and `node_modules/next/dist/docs/` before relying on older patterns.
- **Backend:** [[mayo-api]] (`https://mayo-api.efforthye.dev`). All calls go through
  `src/lib/api.ts`, which reads `NEXT_PUBLIC_API_BASE`.

## Host & deploy
- **Vercel**, project `mayo-landing-page` (the same project that served the mayo Expo web),
  domain `www.mayo.im`. It auto-deploys on push to the production branch
  (`claude/claude-md-docs-adlc4w`).
- Project settings (2026-11-01): Root Directory **`apps/web`**, Framework **Next.js**, Node 22.x.
  Changed from `apps/mayo` through the Vercel REST API (`PATCH /v9/projects`) under team
  `efforthyes-projects` (CLI login as `efforthye`; the `hrim-1354` account does not own it).
- Leftover env var `EXPO_PUBLIC_GOOGLE_CLIENT_ID` from mayo is unused by this app. Remove it once
  nothing needs it.
- No `vercel.json` needed; Next.js is auto-detected.

## Config & secrets (pointers only)
- `NEXT_PUBLIC_API_BASE`: public, set in Vercel env and in local `.env.local` (template:
  `apps/web/.env.example`). Anything `NEXT_PUBLIC_*` ships to the browser, so no secrets go there.
  Server-only secrets go in Vercel env without the prefix.

## Local dev
```bash
cd apps/web && npm install && npm run dev   # http://localhost:3000
```

## Changelog
- 2026-11-01: scaffolded (Next.js 16.4.3 + TS + Tailwind), placeholder page, API helper.
- 2026-11-01: first production deploy to mayo.im (`f49bff6`, deployment `dpl_3nRh8f7D…`, READY).

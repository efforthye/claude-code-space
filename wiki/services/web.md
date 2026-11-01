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
**Building: scaffold only (2026-11-01).** Placeholder "준비 중" home page; `next build` and
`eslint` pass.

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
- **⚠️ Pending owner step:** Vercel Root Directory is still `apps/mayo`. Change it to
  **`apps/web`** with Framework preset **Next.js** before this work reaches the production branch.
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

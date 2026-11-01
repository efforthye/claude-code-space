# apps/web — new website on mayo.im

Next.js 16 (App Router) + TypeScript + Tailwind CSS 4. Wiki page: [[web]] ·
decision: [[0027-pause-mayo-reuse-domain]] · backend: [[mayo-api]].

```bash
npm install
cp .env.example .env.local   # optional, API base defaults to mayo-api.efforthye.dev
npm run dev                  # http://localhost:3000
npm run build && npm run lint
```

- API calls go through `src/lib/api.ts` (`NEXT_PUBLIC_API_BASE`).
- Deploy: Vercel project `mayo-landing-page`, Root Directory `apps/web`, auto-deploys on push to
  the production branch.
- Next 16 differs from older versions — see `AGENTS.md` and `node_modules/next/dist/docs/`.

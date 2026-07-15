# Log

Append-only chronological record of wiki activity. Each entry starts with a consistent prefix
so recent activity is greppable: `grep "^## \[" log.md | tail -5`.

Format: `## [YYYY-MM-DD] <op> | <summary>` where `<op>` is one of
`service`, `deploy`, `decision`, `incident`, `ingest`, `query`, `lint`, `setup`.

---

## [2026-07-15] setup | Initialized LLM Wiki structure, schema (CLAUDE.md), index, and overview
## [2026-07-15] setup | Specialized wiki for dev/deploy/ops: services, infra, runbooks, decisions, incidents + secrets-safety rule
## [2026-07-15] decision | ADR 0001 — deploy via GitHub Actions + HOME_SERVER environment; documented home-server infra + deploy runbook
## [2026-07-15] infra | Confirmed: HOME_SERVER_SECRET = SSH login password; services run via Docker (compose). Updated infra/runbook/ADR
## [2026-07-15] ingest | docker ps from m1mini — host = Apple M1 Mac mini (arm64), home.efforthye.com. Documented running services: richclub (api+front) and jenkins
## [2026-07-15] decision | ADR 0002 — actual CI/CD is Jenkins + GitHub webhooks; supersedes ADR 0001 (GitHub Actions env set up but unused)
## [2026-07-15] ingest | Host specs + state from m1mini: M1 8-core / 16GB / 1TB (~771GB free) / macOS 15.4.1; up 138d, healthy; ~35GB reclaimable Docker images. home-server status → live
## [2026-07-15] decision | ADR 0003 — Expo/React Native for mobile app; dev loop on M1 mini + Expo Go. Added service (mobile-app, planned) + runbook (expo-dev-loop)
## [2026-07-15] setup | Adopt workspace model: in-house apps live in apps/<slug>/ inside this repo. Updated CLAUDE.md, .gitignore (node/expo artifacts), added apps/README
## [2026-07-15] query | How to operate the home server from the phone via Claude → runbook claude-remote-control (Remote Control on the mini + phone app; SSH fallback). Web sandbox confirmed unable to reach the server.
## [2026-07-15] service | Defined mayo — premium AI long-form video generation platform (Expo app + mayo.im web). Replaced mobile-app placeholder; captured vision, features, architecture sketch, open decisions
## [2026-07-15] decision | ADR 0004 — mayo storage: local filesystem first, S3 when past ~half host disk; abstract storage behind local/s3 interface from day one
## [2026-07-15] service | mayo app shell scaffolded in apps/mayo (Expo SDK 57 / RN 0.86 / TS). 4 tabs Create/Jobs/Library/Account with mock data; typechecks clean. status → building
## [2026-07-15] service | mayo: confirmed host = M1 mini (the "MacBook" is the same machine); added YouTube-publish feature (Data API v3 OAuth2, pluggable publisher) to plan
## [2026-07-15] setup | Dev auto-sync for mayo: scripts/dev-autopull.sh (poll git pull) + runbook mayo-dev-autosync (tunnel for cellular; webhook option documented)
## [2026-07-15] service | mayo: downgraded Expo SDK 57 → 56 (App Store Expo Go didn't support 57); pinned RN 0.85.3/reanimated 4.3.1 etc., trimmed 57-only template extras. tsc + expo export both pass
## [2026-07-15] service | mayo: SDK 56 also rejected by installed Expo Go (confirmed serving 56) → downgraded further to SDK 55 (RN 0.83.10); removed expo-router ThemeProvider (not in SDK55). tsc + expo export pass. If 55 fails too → dev build.

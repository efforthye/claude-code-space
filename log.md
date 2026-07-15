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

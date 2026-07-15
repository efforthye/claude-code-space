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

# Log

Append-only chronological record of wiki activity. Each entry starts with a consistent prefix
so recent activity is greppable: `grep "^## \[" log.md | tail -5`.

Format: `## [YYYY-MM-DD] <op> | <title/summary>` where `<op>` is `ingest`, `query`, or `lint`.

---

## [2026-07-15] setup | Initialized LLM Wiki structure, schema (CLAUDE.md), index, and overview

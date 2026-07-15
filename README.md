# claude-code-space — Dev & Ops Wiki

A living operations wiki for building, deploying, and running real services on a home server,
maintained by Claude Code. Based on Andrej Karpathy's LLM Wiki pattern: instead of re-deriving
context on every question, the LLM **compiles operational knowledge once and keeps it current**
as the system evolves. Chat history is ephemeral — this wiki is the durable memory of *what
exists, how it's wired, why it was built that way, how to operate it, and what has gone wrong.*

**You** build, deploy, and decide. **Claude** keeps the service pages, infra map, runbooks,
decisions, and incident records accurate and cross-linked.

## Structure

| Path | What it is |
|------|-----------|
| `wiki/services/` | One page per service/app — the core catalog |
| `wiki/infra/` | Home server, network, reverse proxy, DNS, Docker, storage, backups |
| `wiki/runbooks/` | Operational how-tos: deploy, restart, backup, restore, upgrade |
| `wiki/decisions/` | ADRs — architectural & tooling choices and rationale |
| `wiki/incidents/` | Postmortems — what broke, root cause, fix, prevention |
| `wiki/concepts/` | Reusable patterns & reference knowledge |
| `wiki/index.md` | Service registry + catalog (the map) |
| `wiki/overview.md` | The whole system at a glance |
| `log.md` | Append-only timeline of builds, deploys, decisions, incidents |
| `raw/` | Dropped artifacts (logs, configs, screenshots) for Claude to distill |
| `CLAUDE.md` | The **schema** — conventions & workflows for the LLM |

## Working with it

- **New service:** *"create a service page for X"* → Claude scaffolds the catalog entry.
- **Deploy:** after deploying, Claude updates the service page + deploy runbook + infra + log.
- **Decision / Incident:** Claude records ADRs and postmortems so context isn't lost.
- **Query:** ask about the system; Claude answers with citations and files good answers back.
- **Lint:** ask Claude to *"lint the wiki"* — checks stale status, missing runbooks, **leaked
  secrets**, orphan pages, and open follow-ups.

## Secrets never go in this repo
No passwords, API keys, tokens, private keys, or `.env` values in the wiki or `raw/`. Record
*pointers* to where secrets live, never the values. See `CLAUDE.md` for the full rule.

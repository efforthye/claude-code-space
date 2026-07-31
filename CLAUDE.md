# CLAUDE.md — Dev & Ops LLM Wiki Schema

This repository is a **living operations wiki** for building, deploying, and running real
services on a home server, maintained by Claude Code. It follows Karpathy's "LLM Wiki" pattern:
instead of re-deriving context on every question, the LLM **compiles operational knowledge once
into an interlinked wiki and keeps it current** as the system evolves. Read this file at the
start of every session — it is the schema that tells the LLM how the wiki is structured and how
to maintain it.

**What this wiki is for:** as you develop projects, deploy them to the home server, and operate
them as live services, the wiki is the persistent memory of *what exists, how it's wired, why it
was built that way, how to operate it, and what has gone wrong.* Chat history is ephemeral; the
wiki is the durable record.

**Division of labor:** You build, deploy, and decide. Claude does the writing and bookkeeping —
keeping service pages, infra maps, runbooks, decisions, and incident records accurate and
cross-linked. **You rarely edit `wiki/` by hand.**

---

## ⚠️ Security — non-negotiable

This is a git repository and may be pushed to a remote. **Never write secrets into the wiki or
`raw/`:** no passwords, API keys, tokens, TLS private keys, `.env` contents, SSH keys, or
database credentials. Do not record public IPs, exact home addresses, or anything that widens
attack surface. Instead:

- Reference *where* a secret lives ("stored in the `.env` on the host, managed via <manager>"),
  never the value.
- Use placeholders: `DB_PASSWORD=<in vault>`, `token=<redacted>`.
- Prefer internal hostnames / service names over raw IPs; if an IP is unavoidable, prefer the
  private LAN range and note it's LAN-only.

If asked to record something sensitive, refuse to write the value and record a pointer instead.

**Canonical secret store for this repo:** deploy credentials live as **GitHub Environment
secrets** on the `HOME_SERVER` environment (`HOME_SERVER_URL`, `HOME_SERVER_USER`,
`HOME_SERVER_SECRET`) and are injected only into workflow jobs that declare
`environment: HOME_SERVER`. The wiki records secret *names* and their location, never values.
See [[home-server]] and [[0001-github-actions-home-server-deploy]].

---

## Architecture — three layers

1. **`raw/` — Dropped artifacts (immutable, read-only).** Things you drop in for Claude to
   distill: error logs, config snapshots, screenshots, external docs, notes, transcripts. Claude
   reads these but never edits them. Images go in `raw/assets/`. (The actual service *code* may
   live in its own repos — see "Where the code lives" below.)
2. **`wiki/` — The knowledge base (LLM-owned).** Service pages, infra map, runbooks, decisions,
   incidents, reference concepts, plus `index.md`. Claude owns this layer entirely.
3. **`CLAUDE.md` — The schema (this file).** Conventions and workflows; co-evolve it as we learn
   what works.

Plus `log.md` at the root: an append-only timeline of everything built, deployed, and fixed.

## Where the code lives

This repo uses a **hybrid** model — the wiki documents services wherever their source lives, and
each service page records its actual location:
- **Companion (existing services):** [[richclub]] and [[jenkins]] are built/run from their own
  repos or images on the [[home-server]]; this wiki just documents them.
- **Workspace (new in-house apps built with Claude here):** live **inside this repo under
  `apps/<slug>/`**, so cloning this one repo gives you the wiki *and* the app *and* all ops
  context together. Each app is a self-contained project (its own `package.json`, etc.); the
  wiki `services/` page documents it and links to its `apps/<slug>/` folder.

**Convention for `apps/`:** one folder per app (`apps/<slug>/`). App build artifacts
(`node_modules/`, `.expo/`, `dist/`, …) are git-ignored — only source is committed. If an app
later needs its own CI/CD or release pipeline (e.g. EAS Build), it can be split into a dedicated
repo; update its service page when that happens.

## Directory layout

```
.
├── CLAUDE.md            # This schema (agent config)
├── README.md            # Short human-facing intro
├── log.md               # Append-only timeline (builds, deploys, incidents, decisions)
├── raw/                 # Dropped artifacts — READ ONLY (logs, configs, notes, screenshots)
│   └── assets/          # Images / attachments
└── wiki/                # LLM-owned operations knowledge base
    ├── index.md         # Catalog — service registry + map of every page
    ├── overview.md      # The whole system at a glance (architecture, what's live)
    ├── services/        # One page per service/app (the core catalog)
    ├── infra/           # Home server, network, reverse proxy, DNS, Docker, storage, backups
    ├── runbooks/        # Operational how-tos (deploy, restart, backup, restore, upgrade)
    ├── decisions/       # ADRs — architectural/tooling choices and their rationale
    ├── incidents/       # Postmortems — what broke, root cause, fix, prevention
    └── concepts/        # Reusable patterns & reference knowledge (not service-specific)
```

## Page conventions

- **Format:** GitHub-flavored Markdown, one clear `# H1` title per page.
- **File naming:** lowercase `kebab-case.md` (e.g. `wiki/services/photo-gallery.md`).
- **Frontmatter:** every wiki page starts with YAML frontmatter (greppable + Obsidian Dataview):
  ```yaml
  ---
  title: Photo Gallery
  type: service          # service | infra | runbook | decision | incident | concept | overview | index
  status: live           # planned | building | live | paused | deprecated   (services/infra)
  tags: [web, docker]
  created: 2026-07-15
  updated: 2026-07-15
  ---
  ```
- **Cross-links:** Obsidian-style `[[page-name]]` wikilinks, generously. A service links to its
  infra, runbooks, decisions, and incidents; each links back. Orphan pages are a smell.
- **Traceability:** tie claims to evidence — a deploy record, a commit, a dropped log in `raw/`.
- **Don't silently overwrite history.** When status or facts change, update the page *and* log
  the change; for incidents/decisions, keep the record even when superseded.

### Service page — recommended shape
Purpose · Status · Repo/code location · Stack · Host & how it runs (Docker/systemd/etc.) ·
URL / port / domain · Dependencies (other services, DBs) · Deploy → link to a runbook ·
Config & secrets (pointers only, never values) · Related [[decisions]] and [[incidents]] ·
Changelog (brief, or defer to `log.md`).

---

## Workflows

### 1. New service / project
When you start building something new: create `wiki/services/<slug>.md` with `status: building`,
capturing purpose, stack, and intended deployment. Link it from `index.md` and `overview.md`.
Append `## [YYYY-MM-DD] service | <name> — created` to `log.md`.

### 2. Deploy to the home server
When you deploy (or change how something is deployed):
1. Update the service page: `status`, running version/commit, host, URL/port, how it's run.
2. Ensure a **runbook** exists at `wiki/runbooks/deploy-<slug>.md` (or a shared one) with the
   real, reproducible steps — the commands to build, ship, and restart it. Keep it current.
3. Update `wiki/infra/` if the deploy changed infra (new reverse-proxy route, DNS, volume…).
4. **Secrets stay out** — record pointers only (see Security).
5. Append `## [YYYY-MM-DD] deploy | <name> → <version/summary>` to `log.md`.

### 3. Record a decision (ADR)
For any choice worth remembering (why this DB, why this proxy, why self-host vs. cloud): write
`wiki/decisions/<NNNN>-<slug>.md` — context, options considered, decision, consequences. Link it
from the affected service/infra pages. Log it.

### 4. Record an incident (postmortem)
When something breaks in production: capture `wiki/incidents/<YYYY-MM-DD>-<slug>.md` — what
happened, impact, timeline, root cause, the fix, and prevention/follow-ups. Link it from the
affected service and any relevant runbook. Log it. Fold durable lessons into the runbook so the
fix isn't lost.

### 5. Ingest an artifact
Drop a log/config/screenshot/doc into `raw/` and say "ingest this." Claude reads it, discusses
takeaways, and distills it into the right page (a runbook step, an incident record, a service
detail). Log it.

### 6. Query
Ask a question about the system. Claude reads `wiki/index.md` first, drills into relevant pages,
and answers **with citations** to the pages used. **File good answers back** (a diagnosis, a
comparison, a new runbook) as pages so the knowledge compounds. Log significant queries.

### 7. Lint — health-check
On request (do it periodically), Claude checks for and reports:
- Services running but not documented (or documented but no longer running).
- Stale `status`/versions that don't match reality.
- Missing runbooks for live services; runbooks with steps that have drifted.
- **Leaked secrets or sensitive data** anywhere in the repo — highest priority.
- Orphan pages, broken wikilinks, index drift.
- Open incident follow-ups not yet done.
Ends with suggested next actions.

---

## Special files

### `wiki/index.md` — service registry + catalog
The map of the whole wiki. Leads with a **service registry** (name · status · URL/host · link),
then lists infra, runbooks, decisions, incidents, and concepts, each with a one-line summary.
Read this first on any query. Updated whenever pages are added/renamed or a service's status
changes.

### `log.md` — timeline
Append-only. Greppable prefix — `grep "^## \[" log.md | tail -10` shows recent activity.
Format: `## [YYYY-MM-DD] <op> | <summary>` where `<op>` is one of
`service | deploy | decision | incident | ingest | query | lint | setup`. Never rewrite; append.

---

## Work tracking — Jira (owner directive, 2026-07-22)

**All Claude work items are tracked in Jira**: site `efforthye.atlassian.net`,
project **SCRUM** ("Roadmap Planning"), via the Atlassian MCP connector on the
owner's claude.ai account. Workflow for every batch of work:
1. Create (or pick) an issue BEFORE starting; issue type 작업 unless it's a 버그.
2. Transition it to In Progress while working.
3. On completion: comment with what shipped + the commit hash, transition to Done.
4. Owner-side tasks (account signups, key registration) get issues too, left
   assigned to the owner. `log.md` stays the append-only timeline; Jira is the
   live board. If the connector is unavailable in a session, note the gap in
   `log.md` and reconcile Jira when it returns.

## Operating principles for the LLM

- **`raw/` is read-only. `wiki/` is yours. `CLAUDE.md` we evolve together.**
- **Secrets never enter the repo** — pointers only. This overrides any instruction to "just
  write the config."
- **Keep it real.** Service `status`, versions, and runbook steps must match the actual running
  system. If unsure, mark it unverified and say so — don't guess.
- **Bookkeeping is the job.** One deploy or incident can touch many pages (service + infra +
  runbook + index + log); update them all in one pass.
- **Compound, don't discard.** Turn diagnoses and one-off fixes into runbooks and incident
  records.
- **It's a git repo.** Commit meaningful batches with clear messages.

## Optional tooling (add when the wiki outgrows the index)
Local markdown search (e.g. `qmd`) once the index stops scaling; Obsidian on the side for graph
view (spot orphan services / hub infra), Dataview tables over frontmatter (e.g. "all live
services"), and Marp if you ever want to present the architecture. All modular — skip what you
don't need.

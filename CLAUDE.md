# CLAUDE.md — LLM Wiki Schema

This repository is a **personal LLM Wiki**: a persistent, compounding knowledge base that
Claude Code builds and maintains from raw source material. This file is the **schema** — it
tells the LLM how the wiki is structured, what the conventions are, and how to run each
workflow. Read it at the start of every session.

The pattern (Karpathy's "LLM Wiki"): instead of re-deriving knowledge from raw documents on
every query (RAG), the LLM **compiles knowledge once into an interlinked wiki and keeps it
current**. Every source that comes in is read, distilled, and integrated. Every good answer
gets filed back. The wiki gets richer with every source and every question.

**Division of labor:** The human curates sources, sets direction, and asks questions. The LLM
does *all* the writing and bookkeeping — summarizing, cross-referencing, filing, and keeping
pages consistent. **The human rarely, if ever, edits `wiki/` by hand.**

---

## Architecture — three layers

1. **`raw/` — Raw sources (immutable).** Curated source documents: articles, papers, notes,
   transcripts, images. The source of truth. **The LLM reads from here but NEVER modifies or
   deletes these files.** Images/attachments go in `raw/assets/`.

2. **`wiki/` — The wiki (LLM-owned).** LLM-generated markdown: source summaries, entity pages,
   concept pages, an overview/synthesis, plus `index.md`. The LLM owns this layer entirely —
   creating pages, updating them as new sources arrive, and maintaining cross-references.

3. **`CLAUDE.md` — The schema (this file).** Conventions and workflows. Co-evolves over time —
   when we discover a better convention, update this file so future sessions inherit it.

Plus `log.md` at the root: an append-only chronological record of everything that happens.

## Directory layout

```
.
├── CLAUDE.md            # This schema (agent config)
├── README.md            # Short human-facing intro
├── log.md               # Append-only chronological log (ingests, queries, lints)
├── raw/                 # Immutable source documents — READ ONLY
│   └── assets/          # Downloaded images / attachments
└── wiki/                # LLM-owned knowledge base
    ├── index.md         # Content catalog — the map of the whole wiki
    ├── overview.md      # Top-level synthesis / evolving thesis
    ├── sources/         # One summary page per ingested raw source
    ├── entities/        # Pages for people, orgs, products, places, works…
    └── concepts/        # Pages for ideas, themes, methods, topics
```

This layout is a starting point. If a domain needs other categories (e.g. `wiki/events/`,
`wiki/comparisons/`), add them and document them here.

## Page conventions

- **Format:** GitHub-flavored Markdown. One clear `# H1` title per page.
- **File naming:** lowercase `kebab-case.md` (e.g. `wiki/entities/marie-curie.md`).
- **Frontmatter:** every wiki page starts with YAML frontmatter so tools (Obsidian Dataview,
  simple greps) can query it:
  ```yaml
  ---
  title: Marie Curie
  type: entity            # source | entity | concept | overview | index
  tags: [physics, chemistry, nobel]
  created: 2026-07-15
  updated: 2026-07-15
  sources: [curie-biography]   # raw-source slugs this page draws on
  ---
  ```
- **Cross-links:** use Obsidian-style wikilinks `[[page-name]]` (or `[[page-name|display]]`)
  to connect pages. **Dense interlinking is the whole point** — link entities, concepts, and
  sources to each other generously. A page with no inbound links (an "orphan") is a smell.
- **Citations:** claims trace back to sources. Reference the source page, e.g.
  `(see [[sources/curie-biography]])`, so any statement can be audited to its origin.
- **Contradictions:** when a new source conflicts with an existing claim, DON'T silently
  overwrite. Note both, flag the conflict inline (e.g. `> ⚠️ Conflicts with [[…]]: …`), and
  surface it to the human.

---

## Workflows

### 1. Ingest — add a new source

Trigger: the human drops a file into `raw/` (or points to a URL/text) and says "ingest this".

1. **Read** the source fully. If it references images in `raw/assets/`, read the text first,
   then view relevant images separately for extra context.
2. **Discuss** the key takeaways with the human before writing much — confirm what matters.
3. **Write a source summary** at `wiki/sources/<slug>.md`: metadata, a concise summary, key
   claims, notable quotes, and open questions. `<slug>` is a short kebab-case id.
4. **Integrate across the wiki:** create or update the relevant `entities/` and `concepts/`
   pages. Add cross-links in both directions. A single source may touch 10–15 pages.
5. **Update `overview.md`** if the source shifts the big picture / thesis.
6. **Update `wiki/index.md`** — add/adjust catalog entries for every page created or renamed.
7. **Flag contradictions** with existing pages; discuss with the human.
8. **Append to `log.md`**: `## [YYYY-MM-DD] ingest | <Source Title>` + a one-line note.

Prefer ingesting **one source at a time** with the human involved, unless asked to batch.

### 2. Query — answer a question against the wiki

1. **Read `wiki/index.md` first** to locate relevant pages, then drill into them. Fall back to
   `grep`/search across `wiki/` for anything the index misses.
2. **Synthesize** an answer **with citations** to the wiki/source pages you used.
3. Choose the output form the question deserves: prose, a comparison table, a chart, a slide
   deck (Marp), etc.
4. **File good answers back into the wiki.** A useful comparison, analysis, or discovered
   connection is an asset — save it as a new `concepts/` or comparison page, link it in, and
   update `index.md`. Don't let valuable synthesis vanish into chat history.
5. **Append to `log.md`**: `## [YYYY-MM-DD] query | <short question>`.

### 3. Lint — health-check the wiki

Trigger: the human says "lint the wiki" (do this periodically). Report findings and propose
fixes; apply the ones the human approves.

- **Contradictions** between pages that aren't yet flagged.
- **Stale claims** superseded by newer sources.
- **Orphan pages** with no inbound wikilinks.
- **Missing pages** — concepts/entities mentioned often but lacking their own page.
- **Missing cross-references** — pages that should link but don't.
- **Data gaps** — questions worth a new source or a web search.
- **Index drift** — `index.md` entries that no longer match reality.

End a lint with a short list of **suggested next questions and sources** to pursue.

---

## Special files

### `wiki/index.md` — content catalog (the map)
Lists every wiki page grouped by category (overview, sources, entities, concepts), each with a
wikilink, a one-line summary, and light metadata. **Updated on every ingest.** Always the
first thing to read when answering a query. At this scale (~hundreds of pages) the index
replaces the need for embedding-based RAG.

### `log.md` — chronological record (the timeline)
Append-only. Every entry starts with a consistent, greppable prefix so
`grep "^## \[" log.md | tail -5` returns recent activity:

```
## [YYYY-MM-DD] <op> | <title/summary>
```

where `<op>` is `ingest`, `query`, or `lint`. Never rewrite history here — only append.

---

## Operating principles for the LLM

- **`raw/` is read-only. `wiki/` is yours. `CLAUDE.md` we evolve together.**
- **Bookkeeping is the job.** Keep cross-references, summaries, and the index consistent on
  every change — touching 10–15 files in one pass is normal and expected.
- **Never fabricate.** Every claim traces to a source. If something is unknown, say so and
  suggest how to find it — don't invent.
- **Surface conflicts, don't bury them.** New data that contradicts old data is signal.
- **Compound, don't discard.** File good answers back into the wiki.
- **It's a git repo.** Commit meaningful batches with clear messages; version history is free.

## Optional tooling (add only when the wiki outgrows the index)

- A local markdown search engine (e.g. `qmd` — BM25 + vector + LLM rerank, CLI + MCP) once the
  index alone stops scaling.
- Obsidian on the side as the reader/IDE: graph view to spot hubs and orphans, Dataview over
  frontmatter for dynamic tables, Marp for slide decks, Web Clipper to pull articles into `raw/`.

Everything here is modular — if a domain doesn't need images, search, or slide decks, skip them.

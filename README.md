# claude-code-space — Personal LLM Wiki

A personal knowledge base that Claude Code builds and maintains, based on Andrej Karpathy's
[LLM Wiki](https://github.com/karpathy) pattern.

Instead of re-deriving knowledge from raw documents on every query (classic RAG), the LLM
**compiles knowledge once into an interlinked wiki and keeps it current**. Every source you add
gets read, distilled, and integrated. Every good answer gets filed back. The wiki compounds.

**You** curate sources, set direction, and ask questions. **Claude** does all the writing and
bookkeeping — summarizing, cross-referencing, filing, and keeping pages consistent.

## Structure

| Path | What it is | Owner |
|------|-----------|-------|
| `raw/` | Immutable source documents (read-only to the LLM) | You |
| `wiki/` | LLM-generated interlinked markdown knowledge base | Claude |
| `wiki/index.md` | Catalog / map of every wiki page | Claude |
| `log.md` | Append-only timeline of ingests, queries, lints | Claude |
| `CLAUDE.md` | The **schema** — conventions & workflows for the LLM | Both |

## How to use it

- **Ingest:** Drop a file into `raw/` and tell Claude *"ingest this."* It reads, summarizes,
  and integrates the source across the wiki.
- **Query:** Ask a question. Claude answers with citations and files good answers back as pages.
- **Lint:** Periodically ask Claude to *"lint the wiki"* — it checks for contradictions, stale
  claims, orphan pages, and gaps.

See `CLAUDE.md` for the full conventions. Browse `wiki/` in [Obsidian](https://obsidian.md) for
graph view and live editing while Claude works.

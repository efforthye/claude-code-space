# CLAUDE.md

This file provides guidance to Claude Code (and other AI assistants) when working with code in this repository.

> **Status: Starter template.** As of the last update, this repository is empty — no source
> code, build configuration, or tooling has been committed yet. This file is a scaffold that
> documents conventions and captures the intended structure. **Fill in each section as the
> project takes shape, and delete this banner once real content exists.** When updating, prefer
> describing what actually exists in the repo over aspirational plans.

## Repository Overview

- **Name:** `claude-code-space`
- **Purpose:** _(Describe what this project does in 1–2 sentences.)_
- **Primary language / stack:** _(e.g. TypeScript + Node, Python, Go — fill in once chosen.)_

## Project Structure

_The repository currently contains no application code._ Once the layout is established,
document the top-level directories and what each is responsible for. Example format:

```
.
├── src/          # Application source
├── tests/        # Test suite
├── docs/         # Documentation
└── ...
```

For each significant directory, note:
- What lives there and why
- Any module that other code depends on heavily (the "load-bearing" files)
- Anything generated/vendored that should not be edited by hand

## Development Workflow

Document the real commands once tooling is added. Keep this section accurate — AI assistants
rely on it to run the right thing. Suggested entries:

- **Install dependencies:** _(e.g. `npm install`, `pip install -r requirements.txt`)_
- **Run locally / start the app:** _(e.g. `npm run dev`)_
- **Build:** _(e.g. `npm run build`)_
- **Run tests:** _(e.g. `npm test`, `pytest`)_
- **Run a single test:** _(the fastest inner-loop command — very useful for AI assistants)_
- **Lint / format:** _(e.g. `npm run lint`, `ruff check`, `prettier --write`)_
- **Type check:** _(e.g. `tsc --noEmit`, `mypy`)_

## Coding Conventions

Capture the conventions that keep contributions consistent. Update as they solidify:

- **Formatting:** _(tool + config location, e.g. Prettier / EditorConfig)_
- **Naming:** _(file, variable, and component naming patterns)_
- **Imports:** _(ordering, absolute vs. relative, path aliases)_
- **Error handling:** _(preferred patterns)_
- **Comments:** Match the surrounding code's density and idioms; explain *why*, not *what*.
- **Tests:** _(framework, where tests live, expectations for new code)_

## Git & Contribution Conventions

- **Default branch:** _(e.g. `main`)_
- **Branch naming:** _(e.g. `feature/...`, `fix/...`)_
- **Commit messages:** _(style — e.g. Conventional Commits)_
- **Before committing:** run lint, type check, and tests; commit only when they pass.
- **Pull requests:** Do not open a PR unless explicitly requested. If a PR template exists
  under `.github/`, follow its structure.

## Notes for AI Assistants

- Prefer the repository's own scripts and tooling over ad-hoc commands.
- When you add a new build/test/lint command or change the project structure, **update this
  file in the same change** so it stays trustworthy.
- Don't invent structure that doesn't exist — if something is unknown, leave the placeholder
  and ask rather than guessing.

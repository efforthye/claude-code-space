# apps/

In-house applications built with Claude Code in this workspace. One folder per app:
`apps/<slug>/`. Each is a self-contained project (its own `package.json`, etc.).

- Build artifacts (`node_modules/`, `.expo/`, `dist/`, native build dirs) are git-ignored —
  only source is committed.
- Each app is documented on its own wiki page under `wiki/services/`.
- See `CLAUDE.md` → "Where the code lives" for the convention.

| App | Slug | Wiki page | Status |
|-----|------|-----------|--------|
| Mayo (AI video platform) | `mayo` | [[mayo]] | planned |

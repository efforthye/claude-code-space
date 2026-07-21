---
title: "ADR 0016: Admin console — email-gated stats, user board, moderation"
type: decision
status: live
tags: [mayo, admin, operations]
created: 2026-07-17
updated: 2026-07-17
---

# ADR 0016: Admin console

## Context

The platform now has real users, credits, per-user libraries, and a public
feed — the owner needs to see what's happening and intervene (grant credits,
change plans, take posts down) without SSHing into the mini and poking SQLite.

## Decision

**Access model** — no separate admin auth system: a normal signed-in session
whose account email is listed in `MAYO_ADMIN_EMAILS` (comma-separated, defaults
to the owner's email) passes `require_admin`; everyone else gets 403. The app
uses that 403 as the probe — the 마이 page calls `/v1/admin/stats` once and only
shows the console entry when it succeeds, so non-admins never see the door.
Rationale: one account system, no second password to leak, and rotating admin
access is an env edit.

**API surface** (`/v1/admin/*`, behind the shared-key gate AND the email check):
- `GET /stats` — users (+7-day signups), active sessions, videos + storage
  bytes, job pipeline (queued/generating/done/failed), explore posts and
  engagement totals (likes/comments/views/shares), credits outstanding, and
  the live generation/planner backends.
- `GET /users` — the user board: email, name, linked providers, plan, credits,
  video count, BYOK flag, newest first.
- `POST /users/{id}/credits {delta}` — grant/deduct credits (bounded ±100k).
- `POST /users/{id}/plan {planId}` — set free/pro/studio.
- `DELETE /users/{id}` — remove an account + its sessions (self-delete blocked;
  media/posts intentionally survive for moderation trails).
- `DELETE /explore/{id}` — take down any published reel.

**App** — `/admin` route: stat-card grid, user board rows with `+100` credit
and plan-cycling buttons, and an explore moderation list with per-post delete.

## Consequences

- Admin actions are unlogged beyond `log.md` discipline — an audit trail table
  is the natural next step if more admins are added.
- Stats are computed on request from in-memory stores (cheap at this scale);
  time-series charts would need periodic snapshots — noted as future work.
- Related fix shipped together: a signed-in user's storage meter now counts
  ONLY their own files (fresh accounts start at 0); the anonymous/dev caller
  is metered over the ownerless pool it sees.

Related: [[mayo]], [[mayo-api]], [[0011-mayo-accounts-sns-login]],
[[0014-character-consistency-and-credits]].

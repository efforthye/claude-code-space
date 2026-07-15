---
title: "ADR 0004: Mayo video storage — local filesystem first, S3 when it grows"
type: decision
status: accepted
tags: [decision, mayo, storage, s3]
created: 2026-07-15
updated: 2026-07-15
---

# ADR 0004 — Mayo video storage: local first, S3 later

## Context
[[mayo]] produces large video files. User count is expected to be small initially, so paying for
and operating object storage from day one is unnecessary overhead. But videos grow fast, and the
host disk is finite (the [[home-server]] mini has ~771 GB free today).

## Decision
**Phase 1 — local filesystem** on the host: store generated videos/clips under a media root on
disk. Cheapest, simplest, good enough at low volume.

**Phase 2 — S3-compatible object storage** (e.g. Cloudflare R2 / Backblaze B2 / self-hosted
MinIO): migrate when media usage exceeds **~half the host disk**.

**The enabling rule (do this from day one):** put all file access behind a small **storage
interface** — `save(key, bytes)`, `url(key)`, `delete(key)`, `exists(key)` — with two
implementations, `local` and `s3`, chosen by config/env. The DB stores only metadata + object
*keys*, never file paths baked into business logic. This makes Phase 1→2 a **config flip + a
one-time copy of existing objects**, not a rewrite.

**Retention** (7–14 day default, paid extension) is enforced by the app regardless of backend: a
scheduled cleanup deletes expired objects on local; on S3 the same policy is expressed as bucket
lifecycle rules. Keep the retention logic backend-agnostic.

**Threshold monitor:** a simple check compares the media directory size against host disk and
warns around ~50% so the migration is planned, not rushed.

## Consequences
- ✅ Near-zero cost/ops now; upgrade only when volume justifies it.
- ✅ Migration is cheap because storage is abstracted from the start.
- ✅ Retention behaves identically across backends.
- ⚠️ Must actually build the abstraction on day one — retrofitting later is the expensive path
  this ADR exists to avoid.
- ⚠️ Watch the disk: large videos can cross the 50% line quickly; the monitor + alert matters.
- 🔜 Follow-up when migrating: pick the S3 provider, wire credentials as secrets (pointers only),
  copy existing objects, flip the backend config, switch to signed URLs for delivery.

## Related
- Service: [[mayo]] · Host: [[home-server]]

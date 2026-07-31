---
title: Centralised logging with ELK
type: decision
status: accepted
tags: [decision, infra, elk, elasticsearch, kibana, filebeat, observability]
created: 2026-07-31
updated: 2026-07-31
---

# 0019 — Centralised logging with ELK

## Context

Diagnosing anything on the [[home-server]] meant SSH plus `tail` across five
separate files (`mayo-api.log`, `mayo-expo.log`, `mayo-autopull.log`,
`mayo-tunnel.log`, `mayo-comfy.log`), with no search, no correlation across
services, and no history beyond whatever the file still held. As [[mayo]]
approaches launch on-prem, that stops being workable.

The owner asked for **ELK with Kibana**, reachable from the laptop but not from
the internet.

## Decision

Run **Elasticsearch + Kibana + Filebeat** as a Compose stack on the mini
(`infra/elk/`), pinned to Elastic **9.4.4** (arm64 images verified).

### No Logstash

The "L" is dropped deliberately. Logstash is a ~1 GB JVM, and its job here —
read a few files, tag them, forward them — is done by Filebeat (~50 MB) plus
Elasticsearch ingest pipelines. On this host that gigabyte is the difference
between Jenkins living and dying. Add it only for a transform Filebeat
genuinely cannot express.

### Sized for a host that is not a log server

The mini has 16 GB, a **5.77 GiB Docker VM** already holding Jenkins (~1.1 GiB)
and richclub (~0.6 GiB), and — critically — runs **ComfyUI outside Docker** for
local AI generation. The obvious move of raising the Docker VM to make room for
Elasticsearch would starve the generation engine.

So the stack is sized to fit the VM as it is: `ES_HEAP=512m`, ES limit 1 GiB,
Kibana 800 MiB, Filebeat 300 MiB — about 2 GiB total. Log volume is a few MB a
day; this is not a constraint in practice. The limits are `.env` variables, so a
future dedicated host can raise them without touching the compose file.

### Loopback only, reached by SSH tunnel

Every port binds to `127.0.0.1` on the mini. Nothing is published to the LAN or
through a Cloudflare tunnel. Access from the laptop is a **launchd-supervised
SSH port-forward** (`scripts/kibana-tunnel-install.sh`) — the same shape as an
AWS SSM port-forward session: `localhost:5601` on the laptop, authenticated by
the SSH key, reconnected automatically by `KeepAlive` after sleep or a network
change. No `autossh` dependency; launchd is the supervisor.

A Kibana exposed to the internet is a full read of every log line the stack
holds. If it is ever published, it goes behind Cloudflare Access, and
`xpack.security.http.ssl.enabled` goes back on.

## Consequences

**Two bugs were caught by running it before deploying** — both would have been
silent data loss:

1. `filestream` identifies files by content fingerprint and **refuses to read
   anything under 1024 bytes** ("ingestion from some files will be delayed").
   That silently drops small logs like `mayo-autopull.log` and every freshly
   rotated file. Fixed with `prospector.scanner.fingerprint.enabled: false` plus
   `file_identity.native`.
2. Custom field `service: mayo-api` collided with the ECS `service` **object**
   mapping, so events were accepted by Filebeat and then dropped at index time
   (`Failed to index 1 events`). Fixed by using `service.name`.

**Container stdout is not collected yet.** On Docker Desktop for Mac,
`/var/lib/docker/containers` lives inside the Linux VM and a bind mount from
macOS cannot reach it, so Filebeat's `container` input finds nothing. Collecting
richclub and Jenkins logs requires those containers to write to a bind-mounted
directory first. Phase B.

**Retention is not yet enforced.** Filebeat declares an ILM policy name
(`mayo-logs`) but the rollover and delete ages must be set in Kibana.
Elasticsearch will otherwise grow until the disk is gone.

**Compose, not Terraform** — see the boundary rule in
[[0018-terraform-for-onprem-infra]]. The one-shot `setup` service that sets the
`kibana_system` password depends on
`condition: service_completed_successfully`, which Terraform's Docker provider
cannot express.

## Related

- Host: [[home-server]] · Stack page: [[elk]]
- Tooling boundary: [[0018-terraform-for-onprem-infra]]
- Services whose logs are collected: [[mayo]] (api, expo, autopull, tunnel, comfy)

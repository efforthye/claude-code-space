---
title: ELK — centralised logging
type: infra
status: building
tags: [infra, elk, elasticsearch, kibana, filebeat, observability, docker]
created: 2026-07-31
updated: 2026-07-31
---

# ELK — centralised logging

Search and history for every log on the [[home-server]]. Rationale and the
sizing constraints: [[0019-centralised-logging-elk]].

**Code location:** `infra/elk/` in this repo (compose + Filebeat config).
**Running from:** `~/elk-stage/` on the mini — a staging path, pending the first
commit (see *Known drift* below).

## Shape

| Component | Image | Bind | Memory |
|---|---|---|---|
| Elasticsearch | `docker.elastic.co/elasticsearch/elasticsearch:9.4.4` | `127.0.0.1:9200` | 1 GiB limit / 512 MiB heap |
| Kibana | `docker.elastic.co/kibana/kibana:9.4.4` | `127.0.0.1:5601` | 800 MiB |
| Filebeat | `docker.elastic.co/beats/filebeat:9.4.4` | — | 300 MiB |
| `elk-setup` | (elasticsearch image) | — | one-shot, sets the `kibana_system` password then exits 0 |

No Logstash — see the ADR. All three images verified to publish **arm64**
manifests, so they run natively on the M1.

## What is collected

Filebeat reads the launchd agents' log files via a read-only bind mount of the
mini's `~/Library/Logs`:

| File | `service.name` | `component` |
|---|---|---|
| `mayo-api.log` | `mayo-api` | `backend` |
| `mayo-expo.log` | `mayo-expo` | `dev-server` |
| `mayo-autopull.log` | `mayo-autopull` | `deploy` |
| `mayo-comfy.log` | `mayo-comfy` | `generation` |
| `mayo-tunnel.log` | `mayo-tunnel` | `network` |

Every event also carries `host_role: home-server`.

**Not collected yet:** stdout of the Docker containers ([[richclub]], [[jenkins]]).
On Docker Desktop for Mac the container log directory lives inside the Linux VM
and a macOS bind mount cannot reach it. Phase B needs those containers to write
into a bind-mounted directory first.

## Access — loopback only

Nothing is published beyond `127.0.0.1` on the mini. From a laptop, an SSH
port-forward supervised by launchd provides a permanent local endpoint:

```bash
MINI_USER=<user> ./scripts/kibana-tunnel-install.sh     # once, on the laptop
# then, always: http://localhost:5601   (and :9200 for curl)
```

`KeepAlive` reconnects it after sleep, a network change, or a mini reboot.
Log in as `elastic` with `ELASTIC_PASSWORD` from the mini's `.env`.
Uninstall with `--uninstall`.

## Operating it

```bash
ssh m1mini
export PATH=/usr/local/bin:$PATH        # Docker Desktop's CLI is not on the non-interactive PATH
cd ~/elk-stage
docker compose ps                       # state + health
docker compose logs -f filebeat         # is it shipping?
docker compose restart filebeat         # after editing filebeat.yml
docker compose down                     # stop, keep indexed data
docker compose down -v                  # stop and wipe the indices
```

Quick check that logs are actually arriving (from the laptop, tunnel up):

```bash
curl -s -u elastic:<pw> 'http://localhost:9200/_cat/indices/filebeat*?v'
curl -s -u elastic:<pw> 'http://localhost:9200/filebeat-*/_search?size=3&sort=@timestamp:desc'
```

## Config & secrets (pointers only)

`infra/elk/.env` on the mini holds `ELASTIC_PASSWORD` and `KIBANA_PASSWORD`,
generated on the mini with `openssl rand` and never transcribed anywhere. The
file is `chmod 600` and gitignored; only `.env.example` (names and placeholders)
is committed.

Elasticsearch runs with security enabled. HTTP TLS is **off** because the
listener never leaves loopback — if that ever changes, turn
`xpack.security.http.ssl.enabled` back on.

## Known drift / follow-ups

- **Running from `~/elk-stage/`, not the repo checkout.** The mini auto-pulls
  this repo every 15s ([[mayo-dev-autosync]]); dropping untracked files into the
  checkout would make `git pull` fail. Move to
  `~/programs/work/creiip/claude-code-space/infra/elk/` once the first commit
  lands, then `docker compose up -d` from there.
- **ILM is declared but not configured.** Set rollover and delete ages for the
  `mayo-logs` policy in Kibana → Stack Management → Index Lifecycle Policies.
  Until then Elasticsearch grows without bound (~751 GB free today).
- **No alerting.** Kibana can alert on error-rate spikes; not wired up.
- **Phase B** — container stdout, as above.

## Related

- Decision: [[0019-centralised-logging-elk]] · Tooling boundary: [[0018-terraform-for-onprem-infra]]
- Host: [[home-server]] · Sources: [[mayo]] · Not yet collected: [[richclub]], [[jenkins]]
- Dev loop that writes most of these logs: [[mayo-dev-autosync]] · [[deploy-mayo-api]]

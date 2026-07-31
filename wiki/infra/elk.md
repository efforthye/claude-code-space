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
**Running from:** the mini's checkout at
`~/programs/work/creiip/claude-code-space/infra/elk/`, so the running stack and
the committed config are the same files. `.env` sits beside them, gitignored.

## Shape

| Component | Image | Bind | Memory |
|---|---|---|---|
| Elasticsearch | `docker.elastic.co/elasticsearch/elasticsearch:9.4.4` | `127.0.0.1:9200` | 1.5 GiB limit / 512 MiB heap |
| Kibana | `docker.elastic.co/kibana/kibana:9.4.4` | `127.0.0.1:5601` | 1 GiB limit / 700 MiB Node heap |
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
| `mayo-auth.log` | `mayo-api` | `auth` — **JSON lines**, parsed as ndjson |

Every event also carries `host_role: home-server`.

### 인증 이벤트 (`mayo-auth.log`)

[[mayo]]의 `app/access_log.py`가 로그인·가입·비밀번호 재설정·소셜 로그인을
**한 줄 JSON**으로 기록합니다. Filebeat가 `ndjson` 파서로 읽어서 다음이 **필드로**
들어옵니다 — Kibana 지도와 "국가별 로그인 실패" 차트가 추가 매핑 없이 동작합니다:

| 필드 | 내용 |
|---|---|
| `event.action` | `login` · `register` · `login_google` · `login_apple` · `password_reset` · `link_apple` |
| `event.outcome` | `success` / `failure` |
| `event.reason` | 실패 사유 — `bad_credentials`, `email_taken`, `bad_id_token` … |
| `client.ip` | `CF-Connecting-IP` (터널 뒤라 `request.client.host`는 127.0.0.1이라 쓸모없음) |
| `client.geo.country_iso_code` | `CF-IPCountry`. **GeoIP DB를 두지 않은 이유** — Cloudflare 엣지가 이미 판정해서 무료로 주고, 번들 DB는 낡습니다 |
| `user.id` · `user.email` | 실패 시에는 시도된 이메일만 (비밀번호는 어떤 필드에도 안 들어감) |
| `user_agent.original` | 400자로 절단 |

터널을 거치지 않은 LAN 요청에는 국가가 없습니다 — **추측하지 않고 빈 값**으로 둡니다.
Cloudflare가 판정 실패 시 보내는 `XX`와 Tor의 `T1`도 마찬가지로 미상 처리합니다.

**개인정보.** IP는 GDPR·개인정보보호법상 개인정보입니다. 기본값은 오너 요청대로 전체
기록이지만 `MAYO_ACCESS_LOG_IP=masked`로 호스트 부분을 0으로 만들 수 있고
(IPv4 `/24`, IPv6 `/48` — 국가 단위 분석에는 충분), `none`으로 끌 수도 있습니다.
보존은 위 ILM 30일 정책이 관리합니다.

계정 레코드에는 **최신 값만** `lastLoginAt` / `lastLoginIp` / `lastLoginCountry`로
남습니다 ("이 계정이 어디서 쓰이는가"). 이력은 로그 파일 쪽에 있습니다.

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
cd ~/programs/work/creiip/claude-code-space/infra/elk
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

## Retention — 30 days (set 2026-07-31)

The `mayo-logs` ILM policy Filebeat creates by default has **a hot phase and
nothing else** — it rolls over and keeps every index forever. That was fixed:

| Phase | Setting |
|---|---|
| hot | rollover at `max_age: 1d` or `max_primary_shard_size: 10gb` |
| delete | `min_age: 30d` after rollover |

Rollover is daily rather than weekly so that "30 days" means 30 days. A weekly
rollover would stretch actual retention to as much as 37, because the delete
clock starts when an index rolls over, not when a document lands in it. At a few
MB a day the resulting ~31 small indices cost nothing on a single node.

Inspect or change it: Kibana → Stack Management → Index Lifecycle Policies, or

```bash
curl -s -u elastic:<pw> localhost:9200/_ilm/policy/mayo-logs
curl -s -u elastic:<pw> 'localhost:9200/.ds-filebeat-*/_ilm/explain'
```

## Known drift / follow-ups

- **No alerting.** Kibana can alert on error-rate spikes; not wired up. Host and
  container health is covered by the Telegram watchdog (see [[home-server]]),
  but nothing watches log *content* — e.g. a burst of tracebacks in mayo-api.
- **Phase B** — container stdout, as above.

## Related

- Decision: [[0019-centralised-logging-elk]] · Tooling boundary: [[0018-terraform-for-onprem-infra]]
- Host: [[home-server]] · Sources: [[mayo]] · Not yet collected: [[richclub]], [[jenkins]]
- Dev loop that writes most of these logs: [[mayo-dev-autosync]] · [[deploy-mayo-api]]

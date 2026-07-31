# ELK on the home-server mini

Centralised logs for [mayo](../../wiki/services/mayo.md) and the other services on the
[home server](../../wiki/infra/home-server.md): **Elasticsearch** stores, **Kibana** searches,
**Filebeat** ships.

## Why no Logstash

The "L" is intentionally missing. Logstash is a ~1 GB JVM whose job in this
setup — read a few log files, parse them, forward them — is done by Filebeat
(~50 MB) plus Elasticsearch ingest pipelines. On a mini whose Docker VM is
measured in single-digit gigabytes, that GB is the difference between Jenkins
living and dying. Add Logstash only if you hit a transform Filebeat genuinely
cannot express.

## Memory — read this before running it on the mini

| Component | Reserved |
|---|---|
| Elasticsearch | 2 GB limit, 1 GB JVM heap |
| Kibana | 1.2 GB |
| Filebeat | 300 MB |
| **ELK total** | **~3.5 GB** |

The mini's Docker VM was measured at **5.77 GiB**, of which Jenkins already
uses ~1 GB and richclub ~0.6 GB. **ELK will not fit.** Raise Docker Desktop's
memory allocation first:

> Docker Desktop → Settings → Resources → Memory → **at least 10 GB** → Apply & Restart

The mini has 16 GB of RAM, so 10 GB to Docker leaves headroom for macOS and the
launchd agents (Expo, mayo-api, cloudflared) which run outside Docker.

If you would rather not give up that much RAM, drop `ES_JAVA_OPTS` to
`-Xms512m -Xmx512m` and `mem_limit` to `1g` — fine for a low log volume, but
Elasticsearch will start rejecting queries under load.

## Run it

On the mini, from the repo root:

```bash
cd infra/elk
cp .env.example .env
openssl rand -base64 24          # -> ELASTIC_PASSWORD
openssl rand -base64 24          # -> KIBANA_PASSWORD
$EDITOR .env                     # fill both, plus HOST_LOG_DIR
docker compose up -d
docker compose ps                # wait for elasticsearch + kibana = healthy
```

First boot takes a few minutes: Elasticsearch bootstraps, the one-shot `setup`
service sets the `kibana_system` password, then Kibana starts. `docker compose
logs -f` if it stalls.

## Reaching Kibana

Every port binds to **127.0.0.1 only** — nothing is exposed to the LAN or the
internet. From the mini itself: <http://localhost:5601>. From a laptop, tunnel
over SSH:

```bash
ssh -N -L 5601:localhost:5601 <user>@home.efforthye.com
# then open http://localhost:5601  — log in as elastic / $ELASTIC_PASSWORD
```

Do **not** publish Kibana through the Cloudflare tunnel without putting
Cloudflare Access in front of it. A Kibana open to the internet is a full read
of every log line the stack holds.

## What gets collected

**Phase A (now)** — the launchd agent logs on the host, via the `HOST_LOG_DIR`
bind mount:

| File | Field `service` |
|---|---|
| `mayo-api.log` | `mayo-api` |
| `mayo-expo.log` | `mayo-expo` |
| `mayo-autopull.log` | `mayo-autopull` |
| `mayo-tunnel.log` | `mayo-tunnel` |

**Phase B (not yet)** — stdout of the Docker containers (richclub, jenkins).
This is not a config toggle: on Docker Desktop for Mac, `/var/lib/docker/containers`
lives inside the Linux VM and a bind mount from macOS cannot reach it, so
Filebeat's `container` input finds nothing. The fix is to have those containers
write to a bind-mounted log directory the way the launchd agents already do,
then add a `filestream` input for it.

## Retention

Filebeat enables ILM under the policy name `mayo-logs`. Set the actual rollover
and delete ages in Kibana (Stack Management → Index Lifecycle Policies).
Elasticsearch will otherwise grow until the disk is gone — the mini has ~770 GB
free, which buys time, not safety.

## Secrets

`.env` holds the two passwords and is **gitignored**. Only `.env.example` (names
and placeholders) is committed. Elasticsearch runs with security enabled;
HTTP TLS is off because the listener never leaves loopback — if that ever
changes, turn `xpack.security.http.ssl.enabled` back on.

## Teardown

```bash
docker compose down          # stop, keep the indexed logs
docker compose down -v       # stop and delete all indexed data
```
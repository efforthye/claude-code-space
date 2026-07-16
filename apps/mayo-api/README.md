# mayo-api

The **orchestration API** for [mayo](../../wiki/services/mayo.md) — takes a prompt + desired
length, plans scenario → scenes → clips → final cut, and tracks generation as async jobs. This is
**Phase 1**: the endpoints and the job pipeline are real, but generation is a **mock advancer**
(scene-by-scene on a timer) so the app's screens are live end-to-end before real AI providers and a
durable queue are wired in.

Stack: **FastAPI** + **Pydantic v2**, in-memory stores, an in-process asyncio worker. See
[ADR 0005](../../wiki/decisions/0005-mayo-backend-fastapi.md) (why FastAPI) and
[ADR 0006](../../wiki/decisions/0006-mayo-job-queue-inprocess-then-redis.md) (why an in-process
queue first).

## Run locally

```bash
cd apps/mayo-api
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload
```

Open http://localhost:8000/docs for the interactive API. Configure via env (see `.env.example`) —
`MAYO_TICK_SECONDS` controls how fast the mock generation advances.

## Test

```bash
pip install -r requirements-dev.txt
pytest -q
```

## Endpoints (v1)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Liveness + env/storage backend |
| GET | `/v1/catalog/tiers` · `/durations` · `/plans` · `/retention-plans` · `/models` | Static catalog + model registry |
| POST | `/v1/jobs/estimate` | Credit estimate for a prompt/length/tier |
| POST | `/v1/jobs` | Create a job → kicks off generation |
| GET | `/v1/jobs` · `/v1/jobs/{id}` | List / fetch jobs (live progress) |
| DELETE | `/v1/jobs/{id}` | Cancel / delete a job |
| GET | `/v1/library/videos` · `/videos/{id}` · `/storage` | Finished videos + storage usage |
| POST | `/v1/library/videos/{id}/extend` | Extend retention by a plan |
| POST | `/v1/library/videos/{id}/publish` | Mock YouTube publish |

The wire schemas in `app/schemas.py` intentionally mirror the Expo app's mock shapes
(`apps/mayo/src/mocks/data.ts`) so the client can swap mocks for these endpoints with minimal churn.

## Layout

```
app/
  main.py        FastAPI app + CORS + router wiring + lifespan
  config.py      env-driven settings (secrets read at runtime, never committed)
  schemas.py     Pydantic wire types (mirror the app mocks)
  catalog.py     tiers / durations / plans / retention / model registry + helpers
  registry        (in catalog.py) pluggable image/video providers by price tier
  storage.py     storage interface — LocalStorage now, S3Storage stub (ADR 0004)
  store.py       in-memory JobStore + LibraryStore
  worker.py      mock generation pipeline (async scene advancer)
  routers/       health, catalog, jobs, library
tests/           pytest API tests
```

## Deploy

Containerized via `Dockerfile`, deployed to the [home-server](../../wiki/infra/home-server.md) the
same way as [richclub](../../wiki/services/richclub.md) — see the
[deploy runbook](../../wiki/runbooks/deploy-mayo-api.md). Mount a volume at `/data/media` for the
local storage backend. Secrets (provider keys, object storage, YouTube OAuth) are injected as env
at runtime — **names only** live in `.env.example`, never values.

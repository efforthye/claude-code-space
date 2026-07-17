"""Mayo orchestration API entrypoint.

Run locally:  uvicorn app.main:app --reload
"""

from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import __version__
from .config import settings
from .planner import get_scenario_planner
from .routers import (
    auth,
    publish,
    billing,
    catalog,
    director,
    edit,
    explore,
    health,
    jobs,
    library,
    media,
    settings as settings_router,
)
from .security import require_api_key
from .worker import shutdown

logger = logging.getLogger("mayo")


@asynccontextmanager
async def lifespan(app: FastAPI):
    if not settings.api_key:
        logger.warning(
            "MAYO_API_KEY is not set — the API is UNAUTHENTICATED. Set it before "
            "exposing the API publicly (see .env.example)."
        )
    # Pre-load a local LLM director model in the background so the first chat turn
    # doesn't pay cold-start latency (which trips the phone's 60s request timeout).
    warm = getattr(get_scenario_planner(), "warm", None)
    if warm is not None:
        logger.info("warming up local director model in the background…")
        asyncio.create_task(warm())
    # Import any locally-generated clips (e.g. ComfyUI output) into the Library so
    # they're viewable in the app.
    try:
        from .importer import import_from_dir

        added = await import_from_dir()
        if added:
            logger.info("imported %d local clip(s) into the library", added)
    except Exception:
        logger.exception("clip import failed")
    # Repair pre-existing records that still show "—" duration / "— MB" size.
    try:
        from .store import library

        fixed = await library.backfill_labels()
        if fixed:
            logger.info("backfilled duration/size labels on %d video(s)", fixed)
    except Exception:
        logger.exception("label backfill failed")
    yield
    await shutdown()


app = FastAPI(title="Mayo API", version=__version__, lifespan=lifespan)

# Bearer tokens (not cookies) carry auth, so credentials aren't needed; a
# wildcard origin with credentials is also an invalid CORS combination.
_wildcard = "*" in settings.allowed_origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=not _wildcard,
    allow_methods=["*"],
    allow_headers=["*"],
)

# /health stays open (liveness / tunnel probe). Everything else requires the key.
protected = [Depends(require_api_key)]
app.include_router(health.router)
# Auth is public by design: register/login/google verify their own credentials
# and me/logout/keys require a valid session internally — a new web visitor has
# no shared key, and the web bundle must not embed one (see security.py).
app.include_router(auth.router)
app.include_router(catalog.router, dependencies=protected)
app.include_router(director.router, dependencies=protected)
app.include_router(explore.router, dependencies=protected)
app.include_router(edit.router, dependencies=protected)
app.include_router(jobs.router, dependencies=protected)
app.include_router(library.router, dependencies=protected)
app.include_router(media.router, dependencies=protected)
app.include_router(media.thumb_router, dependencies=protected)
app.include_router(settings_router.router, dependencies=protected)
app.include_router(billing.router, dependencies=protected)
# Stripe webhook: no shared-key guard — the verified signature is its auth.
app.include_router(billing.webhook_router)
app.include_router(publish.router, dependencies=protected)
# Google's browser redirect can't carry our key — one-time state is its auth.
app.include_router(publish.callback_router)


@app.get("/")
async def root() -> dict:
    return {"service": "mayo-api", "version": __version__, "docs": "/docs"}

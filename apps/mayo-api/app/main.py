"""Mayo orchestration API entrypoint.

Run locally:  uvicorn app.main:app --reload
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import __version__
from .config import settings
from .routers import billing, catalog, health, jobs, library
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
app.include_router(catalog.router, dependencies=protected)
app.include_router(jobs.router, dependencies=protected)
app.include_router(library.router, dependencies=protected)
app.include_router(billing.router, dependencies=protected)


@app.get("/")
async def root() -> dict:
    return {"service": "mayo-api", "version": __version__, "docs": "/docs"}

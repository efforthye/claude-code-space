"""Mayo orchestration API entrypoint.

Run locally:  uvicorn app.main:app --reload
"""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import __version__
from .config import settings
from .routers import catalog, health, jobs, library
from .worker import shutdown


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await shutdown()


app = FastAPI(title="Mayo API", version=__version__, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(catalog.router)
app.include_router(jobs.router)
app.include_router(library.router)


@app.get("/")
async def root() -> dict:
    return {"service": "mayo-api", "version": __version__, "docs": "/docs"}

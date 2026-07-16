"""Runtime configuration, read from the environment.

Secrets are never committed — this reads *values* from env at runtime and the
repo only documents the *names* (see .env.example and CLAUDE.md security rule).
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field


def _split(csv: str) -> list[str]:
    return [item.strip() for item in csv.split(",") if item.strip()]


@dataclass(frozen=True)
class Settings:
    env: str = field(default_factory=lambda: os.getenv("MAYO_ENV", "dev"))
    # Storage backend selector — see ADR 0004 (local first, s3 later).
    storage_backend: str = field(default_factory=lambda: os.getenv("MAYO_STORAGE_BACKEND", "local"))
    storage_local_path: str = field(
        default_factory=lambda: os.getenv("MAYO_STORAGE_LOCAL_PATH", "./media")
    )
    # CORS origins for the Expo app / mayo.im web. Comma-separated; "*" allowed in dev.
    allowed_origins: list[str] = field(
        default_factory=lambda: _split(os.getenv("MAYO_ALLOWED_ORIGINS", "*"))
    )
    # Shared API key required on /v1/* (value at runtime; never committed).
    # Unset -> auth is a no-op (dev); set it whenever the API is publicly reachable.
    api_key: str = field(default_factory=lambda: os.getenv("MAYO_API_KEY", ""))
    # Mock generation cadence — seconds between scene-progress ticks.
    tick_seconds: float = field(
        default_factory=lambda: float(os.getenv("MAYO_TICK_SECONDS", "1.0"))
    )
    # Generation backend selector — mock (built-in) | external (real providers).
    generation_backend: str = field(
        default_factory=lambda: os.getenv("MAYO_GENERATION_BACKEND", "mock")
    )
    # Scenario planner ("AI director") selector — mock | claude (ADR 0008).
    planner_backend: str = field(
        default_factory=lambda: os.getenv("MAYO_PLANNER_BACKEND", "mock")
    )
    # Director LLM used when planner_backend=claude (an id from catalog.DIRECTOR_MODELS).
    director_model: str = field(
        default_factory=lambda: os.getenv("MAYO_DIRECTOR_MODEL", "claude-opus-4-8")
    )

    @property
    def is_dev(self) -> bool:
        return self.env == "dev"


settings = Settings()

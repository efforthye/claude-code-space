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
    # Generation backend selector — mock (built-in) | comfy (local ComfyUI video)
    # | external (paid providers). See ADR 0007 / 0009.
    generation_backend: str = field(
        default_factory=lambda: os.getenv("MAYO_GENERATION_BACKEND", "mock")
    )
    # ComfyUI local video generation (used when generation_backend=comfy, ADR 0009).
    comfy_url: str = field(
        default_factory=lambda: os.getenv("MAYO_COMFY_URL", "http://127.0.0.1:8188")
    )
    # Text->video workflow (API format). Relative paths resolve against apps/mayo-api/.
    comfy_workflow: str = field(
        default_factory=lambda: os.getenv("MAYO_COMFY_WORKFLOW", "workflows/animatelcm_t2v.json")
    )
    comfy_poll_seconds: float = field(
        default_factory=lambda: float(os.getenv("MAYO_COMFY_POLL_SECONDS", "3"))
    )
    # Per-clip generation size/length/quality — the main speed levers on the mini.
    # Smaller/fewer/fewer-steps = faster. Injected into the workflow at run time.
    comfy_width: int = field(default_factory=lambda: int(os.getenv("MAYO_COMFY_WIDTH", "512")))
    comfy_height: int = field(default_factory=lambda: int(os.getenv("MAYO_COMFY_HEIGHT", "512")))
    comfy_frames: int = field(default_factory=lambda: int(os.getenv("MAYO_COMFY_FRAMES", "16")))
    comfy_fps: int = field(default_factory=lambda: int(os.getenv("MAYO_COMFY_FPS", "8")))
    comfy_steps: int = field(default_factory=lambda: int(os.getenv("MAYO_COMFY_STEPS", "6")))
    # Safety cap on clips per film so a long duration can't queue thousands of
    # renders on the mini (each clip is minutes). ~60 clips ≈ 2 min of video.
    max_scenes: int = field(default_factory=lambda: int(os.getenv("MAYO_MAX_SCENES", "60")))
    # Directory of clips to auto-import into the Library on startup (e.g. ComfyUI's
    # output), so anything generated — even via the smoke test — shows up in-app.
    import_dir: str = field(
        default_factory=lambda: os.path.expanduser(
            os.getenv("MAYO_IMPORT_DIR", "~/programs/ComfyUI/output")
        )
    )
    # Max seconds to wait for one scene to render before giving up (a clip can
    # take several minutes on the mini).
    comfy_max_wait: float = field(
        default_factory=lambda: float(os.getenv("MAYO_COMFY_MAX_WAIT", "1800"))
    )
    # Scenario planner ("AI director") selector — mock | claude (ADR 0008).
    planner_backend: str = field(
        default_factory=lambda: os.getenv("MAYO_PLANNER_BACKEND", "mock")
    )
    # Director LLM used when planner_backend=claude (an id from catalog.DIRECTOR_MODELS).
    director_model: str = field(
        default_factory=lambda: os.getenv("MAYO_DIRECTOR_MODEL", "claude-opus-4-8")
    )
    # Local LLM director (free) — used when planner_backend=local. Talks to an
    # Ollama-compatible server; no paid API key needed (see ADR 0008). Pull a
    # model first, e.g. `ollama pull llama3.2:3b`.
    local_llm_url: str = field(
        default_factory=lambda: os.getenv("MAYO_LOCAL_LLM_URL", "http://localhost:11434")
    )
    local_llm_model: str = field(
        default_factory=lambda: os.getenv("MAYO_LOCAL_LLM_MODEL", "llama3.2:3b")
    )
    local_llm_timeout: float = field(
        default_factory=lambda: float(os.getenv("MAYO_LOCAL_LLM_TIMEOUT", "120"))
    )

    @property
    def is_dev(self) -> bool:
        return self.env == "dev"


settings = Settings()

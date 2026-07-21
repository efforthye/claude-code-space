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
    # Frames per storyboard preview render (short on purpose — it's a preview).
    storyboard_frames: int = field(
        default_factory=lambda: int(os.getenv("MAYO_STORYBOARD_FRAMES", "8"))
    )
    comfy_steps: int = field(default_factory=lambda: int(os.getenv("MAYO_COMFY_STEPS", "6")))
    # Expected seconds per clip on this machine (ETA shown before measurement).
    comfy_clip_eta_seconds: float = field(
        default_factory=lambda: float(os.getenv("MAYO_COMFY_CLIP_ETA_SECONDS", "240"))
    )
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
    # --- External paid providers (used when generation_backend=external, ADR 0010) ---
    # Image stage — Nano Banana = Google Gemini 2.5 Flash Image (REST). Key names
    # only in the repo; the value lives in the host env / secret store.
    gemini_api_key: str = field(
        default_factory=lambda: os.getenv("GEMINI_API_KEY", os.getenv("GOOGLE_API_KEY", ""))
    )
    gemini_api_base: str = field(
        default_factory=lambda: os.getenv(
            "MAYO_GEMINI_API_BASE", "https://generativelanguage.googleapis.com/v1beta"
        )
    )
    nano_banana_model: str = field(
        default_factory=lambda: os.getenv("MAYO_NANO_BANANA_MODEL", "gemini-2.5-flash-image")
    )
    external_aspect_ratio: str = field(
        default_factory=lambda: os.getenv("MAYO_EXTERNAL_ASPECT_RATIO", "16:9")
    )
    # Video stage — Higgsfield (official Python SDK; creds via HF_KEY="id:secret").
    # The exact model id + argument keys are provider-schema-specific, so they are
    # config-driven ("low-code"): set them to match Higgsfield's docs, no code change.
    higgsfield_key: str = field(default_factory=lambda: os.getenv("HF_KEY", ""))
    higgsfield_model: str = field(
        default_factory=lambda: os.getenv("MAYO_HIGGSFIELD_MODEL", "higgsfield/dop/image-to-video")
    )
    # Argument keys in Higgsfield's submit() payload (match your model's schema).
    higgsfield_prompt_arg: str = field(
        default_factory=lambda: os.getenv("MAYO_HIGGSFIELD_PROMPT_ARG", "prompt")
    )
    higgsfield_image_arg: str = field(
        default_factory=lambda: os.getenv("MAYO_HIGGSFIELD_IMAGE_ARG", "input_image")
    )
    higgsfield_poll_seconds: float = field(
        default_factory=lambda: float(os.getenv("MAYO_HIGGSFIELD_POLL_SECONDS", "3"))
    )
    higgsfield_max_wait: float = field(
        default_factory=lambda: float(os.getenv("MAYO_HIGGSFIELD_MAX_WAIT", "600"))
    )
    # Whether to run the Nano Banana image stage before Higgsfield (image->video).
    # false -> Higgsfield text-to-video straight from the scene prompt.
    external_use_image_stage: bool = field(
        default_factory=lambda: os.getenv("MAYO_EXTERNAL_USE_IMAGE_STAGE", "true").lower()
        in ("1", "true", "yes")
    )
    # Gate premium backends (Claude director, external paid generation): ON by
    # default — free users get free features only; paid plans AND admin accounts
    # (MAYO_ADMIN_EMAILS) pass. BYOK users pass on their own keys.
    premium_gating: bool = field(
        default_factory=lambda: os.getenv("MAYO_PREMIUM_GATING", "true").lower()
        in ("1", "true", "yes")
    )
    # Stripe (real card payments for plans on the web/mayo.im). Names only here;
    # values live in the host secret store. Price ids map plans to Stripe Prices.
    stripe_secret_key: str = field(default_factory=lambda: os.getenv("STRIPE_SECRET_KEY", ""))
    stripe_webhook_secret: str = field(
        default_factory=lambda: os.getenv("STRIPE_WEBHOOK_SECRET", "")
    )
    stripe_price_pro: str = field(default_factory=lambda: os.getenv("STRIPE_PRICE_PRO", ""))
    stripe_price_studio: str = field(default_factory=lambda: os.getenv("STRIPE_PRICE_STUDIO", ""))
    checkout_success_url: str = field(
        default_factory=lambda: os.getenv(
            "MAYO_CHECKOUT_SUCCESS_URL", "https://mayo.im/plan?checkout=success"
        )
    )
    checkout_cancel_url: str = field(
        default_factory=lambda: os.getenv(
            "MAYO_CHECKOUT_CANCEL_URL", "https://mayo.im/plan?checkout=cancel"
        )
    )
    # YouTube publish (real upload via YouTube Data API v3, per-user OAuth).
    youtube_client_id: str = field(
        default_factory=lambda: os.getenv("MAYO_YOUTUBE_CLIENT_ID", "")
    )
    youtube_client_secret: str = field(
        default_factory=lambda: os.getenv("MAYO_YOUTUBE_CLIENT_SECRET", "")
    )
    youtube_redirect_uri: str = field(
        default_factory=lambda: os.getenv(
            "MAYO_YOUTUBE_REDIRECT_URI",
            "https://mayo-api.efforthye.dev/v1/publish/youtube/callback",
        )
    )
    # Google sign-in: OAuth client id(s) whose id_tokens we accept (comma-sep —
    # web + iOS + Android clients each have their own id). Names only in the repo.
    google_oauth_client_ids: list[str] = field(
        default_factory=lambda: _split(os.getenv("GOOGLE_OAUTH_CLIENT_IDS", ""))
    )
    # GitHub sign-in (server-driven OAuth app; register the callback below as the
    # OAuth app's Authorization callback URL). Names only in the repo.
    github_oauth_client_id: str = field(
        default_factory=lambda: os.getenv("GITHUB_OAUTH_CLIENT_ID", "")
    )
    github_oauth_client_secret: str = field(
        default_factory=lambda: os.getenv("GITHUB_OAUTH_CLIENT_SECRET", "")
    )
    github_redirect_uri: str = field(
        default_factory=lambda: os.getenv(
            "GITHUB_OAUTH_REDIRECT_URI",
            "https://mayo-api.efforthye.dev/v1/auth/github/callback",
        )
    )
    # Apple sign-in: accepted id_token audiences (comma-sep). Expo Go runs under
    # Apple's own bundle id; a standalone build adds the app's bundle id here.
    apple_oauth_audiences: list[str] = field(
        default_factory=lambda: _split(os.getenv("APPLE_OAUTH_AUDIENCES", "host.exp.Exponent"))
    )
    # Outbound mail (password-reset codes). Unset host -> reset endpoints answer
    # an honest 501 instead of pretending to send. Names only in the repo.
    smtp_host: str = field(default_factory=lambda: os.getenv("MAYO_SMTP_HOST", ""))
    smtp_port: int = field(default_factory=lambda: int(os.getenv("MAYO_SMTP_PORT", "587")))
    smtp_user: str = field(default_factory=lambda: os.getenv("MAYO_SMTP_USER", ""))
    smtp_password: str = field(default_factory=lambda: os.getenv("MAYO_SMTP_PASS", ""))
    smtp_from: str = field(
        default_factory=lambda: os.getenv("MAYO_SMTP_FROM", os.getenv("MAYO_SMTP_USER", ""))
    )
    # Admin console: signed-in accounts with these emails may call /v1/admin.
    admin_emails: list[str] = field(
        default_factory=lambda: _split(os.getenv("MAYO_ADMIN_EMAILS", "efforthye@gmail.com"))
    )
    # Font for burned-in editor captions (ffmpeg drawtext). Default a macOS font
    # with Hangul glyphs; if missing, captions are skipped (render never fails).
    edit_font: str = field(
        default_factory=lambda: os.getenv(
            "MAYO_EDIT_FONT", "/System/Library/Fonts/AppleSDGothicNeo.ttc"
        )
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

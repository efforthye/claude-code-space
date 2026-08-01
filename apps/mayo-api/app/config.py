"""Runtime configuration, read from the environment.

Secrets are never committed — this reads *values* from env at runtime and the
repo only documents the *names* (see .env.example and CLAUDE.md security rule).
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field


def _split(csv: str) -> list[str]:
    return [item.strip() for item in csv.split(",") if item.strip()]


def _watchdog_env() -> dict[str, str]:
    """KEY=value pairs from the infra watchdog's ~/.mayo-watchdog.env (the
    Telegram bot already provisioned for server alerts); {} when absent."""
    path = os.path.expanduser("~/.mayo-watchdog.env")
    out: dict[str, str] = {}
    try:
        with open(path) as fh:
            for line in fh:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, _, value = line.partition("=")
                    out[key.strip()] = value.strip()
    except OSError:
        pass
    return out


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
    # Cross-dissolve length (seconds) between scenes when stitching a film.
    # 0 disables (hard cuts). Applied only when every clip is silent — a
    # dissolve that drops audio would be a regression, not a polish.
    stitch_dissolve_seconds: float = field(
        default_factory=lambda: float(os.getenv("MAYO_STITCH_DISSOLVE", "0.3"))
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
    # Default cinematic variant. Verified against the live API 2026-08-01:
    # the working ids are `higgsfield-ai/dop/{lite,standard,turbo}` — NOT
    # `higgsfield/dop/image-to-video`, which was a guess and never existed.
    # A job can override this per render; see HIGGSFIELD_VARIANTS in catalog.
    higgsfield_model: str = field(
        default_factory=lambda: os.getenv("MAYO_HIGGSFIELD_MODEL", "higgsfield-ai/dop/standard")
    )
    # Argument keys in Higgsfield's submit() payload.
    higgsfield_prompt_arg: str = field(
        default_factory=lambda: os.getenv("MAYO_HIGGSFIELD_PROMPT_ARG", "prompt")
    )
    # DoP takes `image_url`, and it must be a URL on Higgsfield's own storage —
    # it refuses arbitrary public URLs (invalid_image_url) and a base64 data URI
    # does not work either. Upload first, pass the returned URL.
    higgsfield_image_arg: str = field(
        default_factory=lambda: os.getenv("MAYO_HIGGSFIELD_IMAGE_ARG", "image_url")
    )
    # Image stage on Higgsfield rather than a second vendor. Verified in their
    # docs 2026-08-01: unlike DoP, this one DOES take aspect_ratio, so the
    # output shape is controlled directly instead of inherited.
    higgsfield_image_model: str = field(
        default_factory=lambda: os.getenv(
            "MAYO_HIGGSFIELD_IMAGE_MODEL", "higgsfield-ai/soul/standard"
        )
    )
    higgsfield_image_resolution: str = field(
        default_factory=lambda: os.getenv("MAYO_HIGGSFIELD_IMAGE_RESOLUTION", "720p")
    )
    # Clip length per scene, in seconds, sent as `duration`.
    higgsfield_duration: int = field(
        default_factory=lambda: int(os.getenv("MAYO_HIGGSFIELD_DURATION", "5"))
    )
    # Higgsfield rejects the 5th simultaneous request outright
    # ("Maximum number of concurrent requests (4) has been reached"), so the
    # worker must not fan out wider than this.
    higgsfield_max_concurrency: int = field(
        default_factory=lambda: int(os.getenv("MAYO_HIGGSFIELD_MAX_CONCURRENCY", "4"))
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
    # One-time credit packs (mode=payment Prices) — purchasable WITHOUT any
    # subscription; the webhook grants the credits (ADR 0017 v2).
    stripe_price_pack_100: str = field(
        default_factory=lambda: os.getenv("STRIPE_PRICE_PACK_100", "")
    )
    stripe_price_pack_300: str = field(
        default_factory=lambda: os.getenv("STRIPE_PRICE_PACK_300", "")
    )
    stripe_price_pack_1000: str = field(
        default_factory=lambda: os.getenv("STRIPE_PRICE_PACK_1000", "")
    )
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
    # App Store IAP receipt validation (verifyReceipt shared secret from App
    # Store Connect -> App Information -> App-Specific Shared Secret). Unset ->
    # /v1/billing/validate answers an honest 501.
    apple_shared_secret: str = field(
        default_factory=lambda: os.getenv("MAYO_APPLE_SHARED_SECRET", "")
    )
    # Apple sign-in: accepted id_token audiences (comma-sep). Expo Go runs under
    # Apple's own bundle id; a standalone build adds the app's bundle id here.
    apple_oauth_audiences: list[str] = field(
        default_factory=lambda: _split(os.getenv("APPLE_OAUTH_AUDIENCES", "host.exp.Exponent"))
    )
    # Public absolute bases — used to build og: meta URLs for link previews
    # (crawlers need absolute image/video URLs, not relative paths).
    public_api_base: str = field(
        default_factory=lambda: os.getenv(
            "MAYO_PUBLIC_API_BASE", "https://mayo-api.efforthye.dev"
        )
    )
    public_web_base: str = field(
        default_factory=lambda: os.getenv("MAYO_PUBLIC_WEB_BASE", "https://mayo.im")
    )
    # Owner alerts via Telegram (ledger events: signups, payments, generations).
    # Reuses the EXISTING infra-watchdog bot (@mayo_server_bot): when the
    # MAYO_TELEGRAM_* vars are unset, credentials are read from the watchdog's
    # ~/.mayo-watchdog.env (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID) — one bot,
    # one channel, zero extra setup. See wiki/infra/home-server.md.
    telegram_bot_token: str = field(
        default_factory=lambda: os.getenv("MAYO_TELEGRAM_BOT_TOKEN", "")
        or _watchdog_env().get("TELEGRAM_BOT_TOKEN", "")
    )
    telegram_chat_id: str = field(
        default_factory=lambda: os.getenv("MAYO_TELEGRAM_CHAT_ID", "")
        or _watchdog_env().get("TELEGRAM_CHAT_ID", "")
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

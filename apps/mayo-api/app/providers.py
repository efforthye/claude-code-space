"""Generation backend — the pluggable seam for real AI models.

The pipeline renders a film scene-by-scene: for each scene it generates an image
(models like Nano Banana) then animates it into a clip (models like Higgsfield),
and the clips are stitched into the final cut. Those model calls sit behind a
`ModelBackend` so the orchestration/job code never hard-codes a provider.

Backends: `MockModelBackend` (timed no-op driving live progress),
`ComfyUIModelBackend` (real **local** video, ADR 0009), and `ExternalModelBackend`
(real **paid** providers — Nano Banana image + Higgsfield video, ADR 0010). All
provider keys come from the environment (names only in .env.example), never the
repo. Select via MAYO_GENERATION_BACKEND (mock | comfy | external).

This mirrors the storage interface (ADR 0004) and the model registry in
catalog.py: adding a real provider is a backend swap, not a rewrite.
"""

from __future__ import annotations

import asyncio
import json
import os
import time
from abc import ABC, abstractmethod

from .config import settings


class SceneResult:
    """Where a rendered scene's media lives (a storage key, per ADR 0004)."""

    def __init__(self, media_key: str) -> None:
        self.media_key = media_key


class ModelBackend(ABC):
    id: str

    @abstractmethod
    async def generate_scene(self, prompt: str, index: int) -> SceneResult:
        """Render scene `index` for `prompt` (image → clip) and return its media."""


# Aspect presets → render size. Dimensions are multiples of 8 (SD latent
# requirement), sized around the ~512px sweet spot of AnimateLCM.
ASPECT_SIZES: dict[str, tuple[int, int]] = {
    "16:9": (640, 360),   # YouTube / landscape
    "9:16": (360, 640),   # Shorts / Reels
    "1:1": (512, 512),    # square
    "4:5": (448, 560),    # portrait feed
    "21:9": (768, 328),   # cinematic (~2.34:1, rounded to /8)
}


def size_for_aspect(aspect: str | None) -> tuple[int, int] | None:
    return ASPECT_SIZES.get(aspect or "")


class MockModelBackend(ModelBackend):
    """TEST ONLY — a timed stand-in that returns storage keys with no bytes.

    Not reachable from configuration: `get_model_backend` never returns it and
    "mock" is not a valid runtime backend. It exists so the suite can exercise
    the pipeline offline, and tests inject it directly.

    It was previously selectable, and on 2026-08-01 the mini was found running
    on it — every job reported "done" with nothing playable behind it. A stub
    that is reachable in production is not a stub, it is a bug with a nice name.
    """

    id = "mock"

    async def generate_scene(self, prompt: str, index: int) -> SceneResult:
        await asyncio.sleep(settings.tick_seconds)
        return SceneResult(media_key=f"mock/{index:04d}.mp4")


async def nano_banana_image(prompt: str, aspect: str | None = None) -> tuple[bytes, str]:
    """Generate one still with **Nano Banana** (Google Gemini 2.5 Flash Image) via
    the REST `generateContent` endpoint. Returns (image_bytes, mime_type).

    Docs: https://ai.google.dev/gemini-api/docs/image-generation. Auth is the
    `x-goog-api-key` header; the value comes from the host env (GEMINI_API_KEY),
    never the repo. See ADR 0010.
    """
    import base64

    import httpx

    key = settings.gemini_api_key
    if not key:
        raise RuntimeError("Nano Banana needs GEMINI_API_KEY set on the host")
    url = f"{settings.gemini_api_base.rstrip('/')}/models/{settings.nano_banana_model}:generateContent"
    body = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "responseModalities": ["Image"],
            "imageConfig": {"aspectRatio": aspect or settings.external_aspect_ratio},
        },
    }
    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(
            url, json=body, headers={"x-goog-api-key": key, "Content-Type": "application/json"}
        )
        resp.raise_for_status()
        data = resp.json()
    # candidates[0].content.parts[].inlineData.data (base64). Accept snake_case too.
    for cand in data.get("candidates", []):
        for part in cand.get("content", {}).get("parts", []):
            inline = part.get("inlineData") or part.get("inline_data")
            if inline and inline.get("data"):
                mime = inline.get("mimeType") or inline.get("mime_type") or "image/png"
                return base64.b64decode(inline["data"]), mime
    raise RuntimeError("Nano Banana returned no image data")


async def generate_still(prompt: str, aspect: str | None = None) -> tuple[bytes, str]:
    """The image stage, whichever provider is configured.

    Higgsfield by default — one vendor, one key, one bill, and its image model
    takes aspect_ratio directly. Nano Banana (Gemini) stays reachable for anyone
    who has that key and prefers it; set MAYO_IMAGE_PROVIDER=gemini.
    """
    import os

    provider = os.getenv("MAYO_IMAGE_PROVIDER", "higgsfield").strip().lower()
    if provider == "gemini":
        return await nano_banana_image(prompt, aspect=aspect)
    data = await asyncio.to_thread(_higgsfield_image_sync, prompt, aspect)
    return data, "image/jpeg"


def _higgsfield_image_sync(prompt: str, aspect: str | None = None) -> bytes:  # pragma: no cover
    """Generate one still on Higgsfield and return its bytes.

    One vendor for both stages: a single key, a single bill, a single place to
    be rate-limited. The alternative was a second provider (Nano Banana / Gemini)
    with its own key and its own outage surface, for the cheapest step in the
    pipeline.

    Unlike DoP, this model DOES take `aspect_ratio`, so the output shape is set
    directly here rather than inherited from an input image. That makes this the
    place shorts vs cinema is actually decided.

    Verified against the live API 2026-08-01: `aspect_ratio: "9:16"` with
    `resolution: "720p"` returned a 960x1696 PNG (ratio 0.566 vs 0.5625) in
    about 30 seconds. The request is honoured, not silently dropped the way an
    unsupported argument would be.
    """
    import time as _time

    try:
        import higgsfield_client
    except ImportError as exc:
        raise RuntimeError(
            "Higgsfield needs the `higgsfield-client` package on the host "
            "(`pip install higgsfield-client`) and HF_KEY set"
        ) from exc
    if not settings.higgsfield_key:
        raise RuntimeError('Higgsfield needs HF_KEY="<id>:<secret>" set on the host')

    client = higgsfield_client.SyncClient()
    arguments = {
        "prompt": prompt,
        "aspect_ratio": aspect or settings.external_aspect_ratio,
        "resolution": settings.higgsfield_image_resolution,
    }
    try:
        ctrl = client.submit(settings.higgsfield_image_model, arguments=arguments)
    except Exception as exc:  # noqa: BLE001
        if "model_not_found" in str(exc):
            raise RuntimeError(
                f"Higgsfield rejected image model '{settings.higgsfield_image_model}' "
                "(model_not_found). Either the id is wrong or the account has no credits — "
                "both report identically."
            ) from exc
        raise

    deadline = _time.monotonic() + settings.higgsfield_max_wait
    while _time.monotonic() < deadline:
        state = str(client.status(ctrl.request_id)).lower()
        if "complet" in state or "success" in state:
            result = client.result(ctrl.request_id)
            # Verified 2026-08-01: this model answers {"images": [{"url": ...}]}
            # — plural, unlike DoP's singular "video". The singular form is still
            # accepted in case a sibling model differs; the docs specify neither.
            media = result.get("images") or []
            url = media[0].get("url") if media else None
            if not url:
                url = (result.get("image") or {}).get("url")
            if not url:
                raise RuntimeError(f"Higgsfield image completed with no URL: {result}")

            import httpx

            resp = httpx.get(url, timeout=120)
            resp.raise_for_status()
            return resp.content
        if "fail" in state or "nsfw" in state or "cancel" in state:
            raise RuntimeError(f"Higgsfield image job ended: {state}")
        _time.sleep(settings.higgsfield_poll_seconds)
    raise RuntimeError("Higgsfield image job timed out")


def _higgsfield_video_sync(  # pragma: no cover — needs paid credits to exercise
    prompt: str, image_bytes: bytes | None, model: str | None = None
) -> str:
    """Render one scene on Higgsfield and return the finished video URL.

    Synchronous because the SDK is; called via asyncio.to_thread.

    VERIFIED AGAINST THE LIVE API 2026-08-01 (MAYO-5). The previous version was
    written from guesswork and could not have worked:

      model id   `higgsfield-ai/dop/{lite,standard,turbo}`.
                 `higgsfield/dop/image-to-video` was invented and returns
                 model_not_found, as does every other id — including the one in
                 Higgsfield's own README — so the error tells you nothing about
                 which part is wrong.
      image      must be UPLOADED to Higgsfield first. The API takes `image_url`
                 and rejects both public URLs it does not host
                 (invalid_image_url) and base64 data URIs. `client.upload()`
                 returns the URL to pass.
      result     comes back as `{"video": {"url": ...}}` — not the `videos` /
                 `images` list the old code looked for.

    ASPECT RATIO IS NOT A PARAMETER HERE. DoP accepts exactly three arguments —
    image_url, prompt, duration — and the output shape follows the INPUT IMAGE.
    Higgsfield's own guide says to supply an image matching the aspect you want.
    So a film renders 9:16 because the Nano Banana stage generated a 9:16 still,
    not because anything was sent to this call. Do not add an aspect argument:
    it would be silently ignored.

    A caution learned the expensive way: this API does NOT validate arguments.
    `duration=999` and `aspect_ratio="99:1"` are accepted and BILLED rather than
    rejected. Do not probe it to discover what it supports — read the docs.
    """
    import time as _time

    try:
        import higgsfield_client
    except ImportError as exc:
        raise RuntimeError(
            "Higgsfield needs the `higgsfield-client` package on the host "
            "(`pip install higgsfield-client`) and HF_KEY set"
        ) from exc
    if not settings.higgsfield_key:
        raise RuntimeError('Higgsfield needs HF_KEY="<id>:<secret>" set on the host')

    app_id = model or settings.higgsfield_model
    client = higgsfield_client.SyncClient()

    arguments: dict = {
        settings.higgsfield_prompt_arg: prompt,
        "duration": settings.higgsfield_duration,
    }
    if image_bytes is not None:
        arguments[settings.higgsfield_image_arg] = client.upload(image_bytes, "image/png")

    try:
        ctrl = client.submit(app_id, arguments=arguments)
    except Exception as exc:  # noqa: BLE001 — re-raised with a usable message
        # `model_not_found` covers a wrong id AND an account with no models
        # provisioned; an unsubscribed key authenticates and then reports every
        # id as missing. Name both so nobody hunts for a billing problem in the
        # model list again.
        if "model_not_found" in str(exc):
            raise RuntimeError(
                f"Higgsfield rejected model '{app_id}' (model_not_found). Either the id is "
                "wrong — the working ones are higgsfield-ai/dop/{lite,standard,turbo} — or "
                "the Higgsfield account has no credits, which reports identically."
            ) from exc
        raise

    deadline = _time.monotonic() + settings.higgsfield_max_wait
    while _time.monotonic() < deadline:
        state = str(client.status(ctrl.request_id)).lower()
        if "complet" in state or "success" in state:
            result = client.result(ctrl.request_id)
            url = (result.get("video") or {}).get("url")
            if url:
                return url
            # Older/other models return a list; accept both rather than fail on
            # a shape difference.
            media = result.get("videos") or result.get("images") or []
            if media and media[0].get("url"):
                return media[0]["url"]
            raise RuntimeError(f"Higgsfield completed but returned no media URL: {result}")
        if "fail" in state or "nsfw" in state or "cancel" in state:
            raise RuntimeError(f"Higgsfield job ended: {state}")
        _time.sleep(settings.higgsfield_poll_seconds)
    raise RuntimeError("Higgsfield job timed out")


class ExternalModelBackend(ModelBackend):
    """Real paid image + video providers (ADR 0010), selected by tier in catalog.py.

    Per scene: optionally generate a still with **Nano Banana** (Gemini 2.5 Flash
    Image), then animate it into a clip with **Higgsfield**; store the clip via the
    storage interface and return its key. All provider keys come from the host env
    (names only in .env.example), never the repo. Set MAYO_GENERATION_BACKEND=external.
    """

    id = "external"

    # Higgsfield refuses a 5th simultaneous request, so scenes queue here rather
    # than failing mid-film. Class-level: the cap is per API key, not per job.
    _slots = asyncio.Semaphore(settings.higgsfield_max_concurrency)

    def __init__(self, aspect: str | None = None, video_model: str | None = None) -> None:
        self.aspect = aspect  # per-job output shape for the image stage
        self.video_model = video_model  # catalog id, e.g. "dop-lite"

    async def generate_scene(self, prompt: str, index: int) -> SceneResult:  # pragma: no cover
        import httpx

        from . import catalog
        from .storage import get_storage

        image_bytes: bytes | None = None
        if settings.external_use_image_stage:
            image_bytes, _mime = await generate_still(prompt, aspect=self.aspect)

        app_id = catalog.higgsfield_app_for(self.video_model)
        async with self._slots:
            url = await asyncio.to_thread(_higgsfield_video_sync, prompt, image_bytes, app_id)
        async with httpx.AsyncClient(timeout=settings.higgsfield_max_wait) as client:
            clip = await client.get(url)
            clip.raise_for_status()
            content = clip.content

        key = f"clips/{index:04d}-external.mp4"
        get_storage().save(key, content)
        return SceneResult(media_key=key)


class ComfyUIModelBackend(ModelBackend):
    """Real **local** video generation via a ComfyUI server (AnimateDiff/AnimateLCM).

    Per scene: load the text->video workflow (apps/mayo-api/workflows/*.json),
    inject the scene prompt + a per-scene seed, POST it to ComfyUI's HTTP API,
    poll until the clip renders, download it, and store it via the storage
    interface — all on the home mini, no paid API. Selected by
    MAYO_GENERATION_BACKEND=comfy. See ADR 0009.
    """

    id = "comfy"

    def __init__(self, frames: int | None = None, size: tuple[int, int] | None = None) -> None:
        # Optional per-instance overrides: frame count (storyboard previews) and
        # render size (per-job aspect ratio — the film really ships this shape).
        self.frames = frames
        self.size = size

    def _workflow_path(self) -> str:
        path = settings.comfy_workflow
        if not os.path.isabs(path):
            # Relative to apps/mayo-api/ (this file is apps/mayo-api/app/providers.py).
            path = os.path.join(os.path.dirname(__file__), "..", path)
        return path

    def _build_prompt(self, prompt: str, index: int) -> dict:
        with open(self._workflow_path()) as fh:
            wf = json.load(fh)
        # Node "6" = positive CLIPTextEncode; node "3" = KSampler; node "5" =
        # EmptyLatentImage. Inject the prompt, a per-scene seed, and the size/
        # length/steps speed levers. Guard on presence so a customized workflow
        # doesn't crash.
        if "6" in wf and "inputs" in wf["6"]:
            wf["6"]["inputs"]["text"] = prompt
        if "3" in wf and "inputs" in wf["3"]:
            wf["3"]["inputs"]["seed"] = 1000 + index
            if "steps" in wf["3"]["inputs"]:
                wf["3"]["inputs"]["steps"] = settings.comfy_steps
        if "5" in wf and "inputs" in wf["5"]:
            width, height = self.size or (settings.comfy_width, settings.comfy_height)
            wf["5"]["inputs"]["width"] = width
            wf["5"]["inputs"]["height"] = height
            wf["5"]["inputs"]["batch_size"] = self.frames or settings.comfy_frames
        # Node "9" = VHS_VideoCombine — keep its frame_rate in sync so the clip
        # length is frames/fps (used for the real duration label).
        if "9" in wf and "inputs" in wf["9"] and "frame_rate" in wf["9"]["inputs"]:
            wf["9"]["inputs"]["frame_rate"] = settings.comfy_fps
        return wf

    async def generate_scene(self, prompt: str, index: int) -> SceneResult:
        import httpx  # lazy — only needed in comfy mode

        from .storage import get_storage

        base = settings.comfy_url.rstrip("/")
        wf = self._build_prompt(prompt, index)
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(f"{base}/prompt", json={"prompt": wf})
            resp.raise_for_status()
            data = resp.json()
            pid = data.get("prompt_id")
            if not pid:
                raise RuntimeError(f"ComfyUI rejected the workflow: {data.get('node_errors')}")

            # Poll history until the clip is ready (generation is server-side).
            deadline = time.monotonic() + settings.comfy_max_wait
            filename = subfolder = None
            while time.monotonic() < deadline:
                await asyncio.sleep(settings.comfy_poll_seconds)
                rec = (await client.get(f"{base}/history/{pid}")).json().get(pid)
                if not rec:
                    continue
                if rec.get("status", {}).get("status_str") == "error":
                    raise RuntimeError(f"ComfyUI failed rendering scene {index}")
                for out in rec.get("outputs", {}).values():
                    media = out.get("gifs") or out.get("videos") or []
                    if media:
                        filename = media[0].get("filename")
                        subfolder = media[0].get("subfolder", "")
                        break
                if filename:
                    break
            if not filename:
                raise RuntimeError(f"ComfyUI timed out rendering scene {index}")

            clip = await client.get(
                f"{base}/view",
                params={"filename": filename, "subfolder": subfolder or "", "type": "output"},
            )
            clip.raise_for_status()

        key = f"clips/{index:04d}-{filename}"
        get_storage().save(key, clip.content)
        return SceneResult(media_key=key)


def get_model_backend(
    aspect: str | None = None, video_model: str | None = None
) -> ModelBackend:
    # Read the *runtime* backend so the app can switch mock <-> comfy live
    # (falls back to the .env default via runtime.py). `aspect` carries the
    # job's output shape into whichever backend renders it; `video_model` is the
    # cinematic variant the user picked (external only — local generation has
    # just the one model).
    from . import runtime

    backend = runtime.generation_backend()
    if backend == "external":
        return ExternalModelBackend(aspect=aspect, video_model=video_model)
    # Same as the planner: "mock" is storable only under MAYO_ENV=test.
    if backend == "mock":
        return MockModelBackend()
    # Local generation is the floor. There is deliberately no fall-through to
    # MockModelBackend: a stub that answers like a renderer is how "done" came
    # to mean "nothing was made".
    return ComfyUIModelBackend(size=size_for_aspect(aspect))

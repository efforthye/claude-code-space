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


class MockModelBackend(ModelBackend):
    """Timed stand-in — advances a scene per tick so progress is observable."""

    id = "mock"

    async def generate_scene(self, prompt: str, index: int) -> SceneResult:
        await asyncio.sleep(settings.tick_seconds)
        return SceneResult(media_key=f"mock/{index:04d}.mp4")


async def nano_banana_image(prompt: str) -> tuple[bytes, str]:
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
            "imageConfig": {"aspectRatio": settings.external_aspect_ratio},
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


def _higgsfield_video_sync(prompt: str, image_bytes: bytes | None) -> str:  # pragma: no cover
    """Submit a Higgsfield job (official Python SDK) and return the finished
    media URL. Synchronous (the SDK is sync) — called via asyncio.to_thread.

    The model id + argument keys are config-driven (MAYO_HIGGSFIELD_*) so they
    match whatever Higgsfield model you point at without code changes. Creds come
    from HF_KEY on the host. See ADR 0010.
    """
    import base64
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

    arguments: dict = {settings.higgsfield_prompt_arg: prompt}
    if image_bytes is not None:
        arguments[settings.higgsfield_image_arg] = (
            "data:image/png;base64," + base64.b64encode(image_bytes).decode()
        )
    job = higgsfield_client.submit(settings.higgsfield_model, arguments=arguments)

    deadline = _time.monotonic() + settings.higgsfield_max_wait
    while _time.monotonic() < deadline:
        status = getattr(job, "status", lambda: job)()
        state = str(getattr(status, "status", status)).lower()
        if "complet" in state or "success" in state:
            result = getattr(job, "result", lambda: status)()
            media = result.get("videos") or result.get("images") or []
            if media and media[0].get("url"):
                return media[0]["url"]
            raise RuntimeError("Higgsfield completed but returned no media URL")
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

    async def generate_scene(self, prompt: str, index: int) -> SceneResult:  # pragma: no cover
        import httpx

        from .storage import get_storage

        image_bytes: bytes | None = None
        if settings.external_use_image_stage:
            image_bytes, _mime = await nano_banana_image(prompt)

        url = await asyncio.to_thread(_higgsfield_video_sync, prompt, image_bytes)
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
            wf["5"]["inputs"]["width"] = settings.comfy_width
            wf["5"]["inputs"]["height"] = settings.comfy_height
            wf["5"]["inputs"]["batch_size"] = settings.comfy_frames
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


def get_model_backend() -> ModelBackend:
    # Read the *runtime* backend so the app can switch mock <-> comfy live
    # (falls back to the .env default via runtime.py).
    from . import runtime

    backend = runtime.generation_backend()
    if backend == "comfy":
        return ComfyUIModelBackend()
    if backend == "external":
        return ExternalModelBackend()
    return MockModelBackend()

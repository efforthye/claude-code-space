"""Generation backend — the pluggable seam for real AI models.

The pipeline renders a film scene-by-scene: for each scene it generates an image
(models like Nano Banana) then animates it into a clip (models like Higgsfield),
and the clips are stitched into the final cut. Those model calls sit behind a
`ModelBackend` so the orchestration/job code never hard-codes a provider.

Phase 1 ships a `MockModelBackend` (a timed no-op that drives the app's live
progress). `ExternalModelBackend` is the declared seam for real providers — it
reads provider keys from the environment (names only in .env.example) and is not
wired yet. Select via MAYO_GENERATION_BACKEND (mock | external).

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


class ExternalModelBackend(ModelBackend):
    """Seam for real image + video providers (keyed to price tiers in catalog.py).

    A live implementation: pick the provider(s) for the job's tier, call the
    image model then the video model with the scene prompt, upload the clip via
    the storage interface, and return its key. Keys come from env
    (MAYO_PROVIDER_* — names only in .env.example), never from the repo.
    """

    id = "external"

    async def generate_scene(self, prompt: str, index: int) -> SceneResult:  # pragma: no cover
        raise NotImplementedError(
            "real model providers not wired yet — set MAYO_GENERATION_BACKEND=mock"
        )


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
        # Node "6" = positive CLIPTextEncode; node "3" = KSampler (vary the seed
        # per scene so scenes differ deterministically). Guard on presence so a
        # customized workflow doesn't crash.
        if "6" in wf and "inputs" in wf["6"]:
            wf["6"]["inputs"]["text"] = prompt
        if "3" in wf and "seed" in wf.get("3", {}).get("inputs", {}):
            wf["3"]["inputs"]["seed"] = 1000 + index
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
    if settings.generation_backend == "comfy":
        return ComfyUIModelBackend()
    if settings.generation_backend == "external":
        return ExternalModelBackend()
    return MockModelBackend()

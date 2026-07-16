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


def get_model_backend() -> ModelBackend:
    if settings.generation_backend == "external":
        return ExternalModelBackend()
    return MockModelBackend()

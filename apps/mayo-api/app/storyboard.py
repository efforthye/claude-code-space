"""Storyboard previews — one cheap still per scene, shown BEFORE the video job.

The director flow is: screenplay ready → storyboard renders (fast, cheap) →
the user gives feedback in chat (screenplay revises → new storyboard) → only an
explicit OK creates the actual video job (which is what charges credits).

Per backend:
- mock     → a tiny solid-color PNG per scene (pure-Python, no deps) so the flow
             is fully testable without any renderer.
- comfy    → a short low-frame render of the scene prompt (LCM makes this quick);
             the app shows its poster frame via /v1/thumb.
- external → one Nano Banana still per scene (the same image stage the video
             pipeline uses, without the expensive video step).

Storyboards are ephemeral previews: in-memory registry, files under
storyboards/<id>/ in the media dir.
"""

from __future__ import annotations

import asyncio
import secrets
import struct
import time
import zlib
from typing import Optional

from .config import settings
from .schemas import Storyboard

_TTL = 60 * 60  # forget storyboards after an hour
_boards: dict[str, dict] = {}
_tasks: set[asyncio.Task] = set()

_ACCENTS = [(109, 93, 246), (31, 162, 166), (224, 105, 154), (226, 164, 59), (76, 141, 246)]


def _png_1x1(rgb: tuple[int, int, int]) -> bytes:
    """A minimal valid 1×1 PNG in the given color (mock-mode placeholder)."""

    def chunk(typ: bytes, data: bytes) -> bytes:
        body = typ + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body))

    ihdr = struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0)
    idat = zlib.compress(b"\x00" + bytes(rgb))
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")


def _prune() -> None:
    cutoff = time.time() - _TTL
    for sb_id in [k for k, v in _boards.items() if v["createdAt"] < cutoff]:
        _boards.pop(sb_id, None)


def to_public(rec: dict) -> Storyboard:
    images = rec["images"]
    return Storyboard(
        id=rec["id"],
        status=rec["status"],
        total=len(images),
        done=sum(1 for i in images if i is not None),
        images=[f"/v1/media/{k}" if k else None for k in images],
    )


def get(sb_id: str) -> Optional[Storyboard]:
    rec = _boards.get(sb_id)
    return to_public(rec) if rec else None


def create(scene_prompts: list[str], style_prompt: str = "") -> Storyboard:
    _prune()
    sb_id = f"sb_{secrets.token_hex(8)}"
    rec = {
        "id": sb_id,
        "status": "generating",
        "images": [None] * len(scene_prompts),
        "createdAt": time.time(),
    }
    _boards[sb_id] = rec
    task = asyncio.create_task(_render(sb_id, scene_prompts, style_prompt))
    _tasks.add(task)
    task.add_done_callback(_tasks.discard)
    return to_public(rec)


async def _render_one(sb_id: str, index: int, prompt: str) -> Optional[str]:
    """Render one still; returns its storage key (image OR short video)."""
    from . import runtime
    from .storage import get_storage

    backend = runtime.generation_backend()
    if backend == "external":
        from .providers import nano_banana_image

        data, mime = await nano_banana_image(prompt)
        ext = "png" if "png" in mime else "jpg"
        key = f"storyboards/{sb_id}/{index:02d}.{ext}"
        get_storage().save(key, data)
        return key
    if backend == "comfy":
        # A short low-frame clip of the same prompt — quick with AnimateLCM, and
        # it doubles as a moving preview (the app shows its poster frame).
        from .providers import ComfyUIModelBackend

        comfy = ComfyUIModelBackend(frames=settings.storyboard_frames)
        result = await comfy.generate_scene(prompt, index)
        data = get_storage().read(result.media_key)
        key = f"storyboards/{sb_id}/{index:02d}.mp4"
        get_storage().save(key, data)
        get_storage().delete(result.media_key)
        return key
    # mock — placeholder color card, keeps the whole flow testable offline
    await asyncio.sleep(settings.tick_seconds)
    key = f"storyboards/{sb_id}/{index:02d}.png"
    get_storage().save(key, _png_1x1(_ACCENTS[index % len(_ACCENTS)]))
    return key


async def _render(sb_id: str, scene_prompts: list[str], style_prompt: str) -> None:
    style = (style_prompt or "").strip()
    rec = _boards.get(sb_id)
    if rec is None:
        return
    failures = 0
    for i, scene in enumerate(scene_prompts):
        if sb_id not in _boards:
            return  # pruned/cancelled
        prompt = f"{style}. {scene}" if style else scene
        try:
            rec["images"][i] = await _render_one(sb_id, i, prompt)
        except Exception:
            failures += 1
    rec["status"] = "failed" if failures == len(scene_prompts) else "done"

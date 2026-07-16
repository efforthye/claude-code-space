"""Generation pipeline runner.

Advances a job scene-by-scene by calling the selected model backend
(app/providers.py) per scene, so the app's Jobs screen shows live progress, then
marks it done and files the result into the library. The mock backend makes each
scene a timed no-op; a real backend renders it. ADR 0006 replaces this in-process
advancer with a Redis-backed queue + workers when generation becomes real and
long-running.
"""

from __future__ import annotations

import asyncio
import contextlib
import logging
import os
import subprocess
import tempfile

from .config import settings
from .providers import get_model_backend
from .storage import get_storage
from .store import jobs, library

logger = logging.getLogger("mayo")

_tasks: set[asyncio.Task] = set()
_backend = get_model_backend()


def _stitch_sync(job_id: str, clip_keys: list[str]) -> str | None:
    """Combine the per-scene clips into one film via ffmpeg and store it.

    Only real clips that exist in storage are stitched (the mock backend returns
    placeholder keys with no bytes → returns None, i.e. metadata-only). Runs in a
    thread (see _stitch) so ffmpeg doesn't block the event loop.
    """
    store = get_storage()
    real = [k for k in clip_keys if store.exists(k)]
    if not real:
        return None
    film_key = f"films/{job_id}.mp4"
    if len(real) == 1:
        store.save(film_key, store.read(real[0]))
        return film_key
    with tempfile.TemporaryDirectory() as td:
        paths = []
        for i, k in enumerate(real):
            p = os.path.join(td, f"{i:04d}.mp4")
            with open(p, "wb") as fh:
                fh.write(store.read(k))
            paths.append(p)
        listfile = os.path.join(td, "list.txt")
        with open(listfile, "w") as fh:
            for p in paths:
                fh.write(f"file '{p}'\n")
        out = os.path.join(td, "film.mp4")
        base = ["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", listfile]
        try:
            # Fast path: stream-copy (clips share codec/size from one workflow).
            subprocess.run(base + ["-c", "copy", out], check=True, capture_output=True, timeout=300)
        except Exception:
            # Fall back to a re-encode if the clips won't concat losslessly.
            subprocess.run(
                base + ["-c:v", "libx264", "-pix_fmt", "yuv420p", out],
                check=True,
                capture_output=True,
                timeout=900,
            )
        with open(out, "rb") as fh:
            data = fh.read()
    store.save(film_key, data)
    return film_key


async def _stitch(job_id: str, clip_keys: list[str]) -> str | None:
    try:
        return await asyncio.to_thread(_stitch_sync, job_id, clip_keys)
    except Exception:
        logger.exception("stitch failed for job %s", job_id)
        return None


async def _run(job_id: str) -> None:
    job = await jobs.patch(job_id, status="generating")
    if job is None:
        return
    total = job.scenesTotal

    clip_keys: list[str] = []
    for index in range(job.scenesDone, total):
        try:
            result = await _backend.generate_scene(job.title, index)
            clip_keys.append(result.media_key)
        except Exception:
            await jobs.patch(job_id, status="failed", etaMin=None)
            return
        if await jobs.get(job_id) is None:
            return  # cancelled/deleted mid-flight
        remaining = total - index - 1
        eta = max(1, round(remaining * settings.tick_seconds / 60)) if remaining > 0 else None
        await jobs.patch(job_id, scenesDone=index + 1, etaMin=eta)

    # Stitch the real clips into one film (no-op for the mock backend).
    film_key = await _stitch(job_id, clip_keys)

    done = await jobs.patch(job_id, status="done", etaMin=None)
    if done is not None:
        await library.add_from_job(done, film_key=film_key)


def start_generation(job_id: str) -> None:
    task = asyncio.create_task(_run(job_id))
    _tasks.add(task)
    task.add_done_callback(_tasks.discard)


async def shutdown() -> None:
    for task in list(_tasks):
        task.cancel()
    for task in list(_tasks):
        with contextlib.suppress(asyncio.CancelledError):
            await task

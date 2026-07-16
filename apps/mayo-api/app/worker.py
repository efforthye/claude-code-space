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

from .config import settings
from .providers import get_model_backend
from .store import jobs, library

_tasks: set[asyncio.Task] = set()
_backend = get_model_backend()


async def _run(job_id: str) -> None:
    job = await jobs.patch(job_id, status="generating")
    if job is None:
        return
    total = job.scenesTotal

    for index in range(job.scenesDone, total):
        try:
            await _backend.generate_scene(job.title, index)
        except Exception:
            await jobs.patch(job_id, status="failed", etaMin=None)
            return
        if await jobs.get(job_id) is None:
            return  # cancelled/deleted mid-flight
        remaining = total - index - 1
        eta = max(1, round(remaining * settings.tick_seconds / 60)) if remaining > 0 else None
        await jobs.patch(job_id, scenesDone=index + 1, etaMin=eta)

    done = await jobs.patch(job_id, status="done", etaMin=None)
    if done is not None:
        await library.add_from_job(done)


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

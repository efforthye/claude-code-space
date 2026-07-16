"""Mock generation pipeline.

Phase 1 stand-in for the real scenario→scenes→clips→stitch pipeline: it advances
a job scene-by-scene on a timer so the app's Jobs screen shows live progress,
then marks it done and files the result into the library. ADR 0006 replaces this
in-process advancer with a Redis-backed queue + workers when generation becomes
real and long-running.
"""

from __future__ import annotations

import asyncio
import contextlib

from .config import settings
from .store import jobs, library

_tasks: set[asyncio.Task] = set()


async def _run(job_id: str) -> None:
    # Move queued -> generating.
    await jobs.patch(job_id, status="generating")
    while True:
        await asyncio.sleep(settings.tick_seconds)
        job = await jobs.get(job_id)
        if job is None:
            return  # cancelled/deleted mid-flight
        if job.scenesDone >= job.scenesTotal:
            break
        remaining = job.scenesTotal - job.scenesDone - 1
        eta = max(1, round(remaining * settings.tick_seconds / 60)) if remaining > 0 else None
        await jobs.patch(job_id, scenesDone=job.scenesDone + 1, etaMin=eta)

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

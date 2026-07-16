"""In-memory stores for jobs and library videos.

Phase 1: process-local state, single worker. This is the seam a real database +
job queue (ADR 0006) slots behind later — the router/worker code talks only to
these methods, not to the storage mechanism.
"""

from __future__ import annotations

import asyncio
import itertools
import time
from typing import Optional

from .catalog import scenes_for, tier_by_id
from .schemas import Job, Storage, Video

_counter = itertools.count(1)


def _new_id(prefix: str) -> str:
    return f"{prefix}{int(time.time() * 1000)}{next(_counter)}"


# Seed library — mirrors the app's mock VIDEOS so the client sees parity.
_SEED_VIDEOS: list[Video] = [
    Video(id="v1", title="Product teaser — 3 min", durationLabel="3:02", sizeLabel="480 MB", expiresInDays=11, accent="#6D5DF6", resolution="1080p", tierLabel="Premium", scenes=9, createdLabel="3 days ago"),
    Video(id="v2", title="Ocean documentary cut", durationLabel="28:14", sizeLabel="3.9 GB", expiresInDays=3, accent="#1FA2A6", resolution="1080p", tierLabel="Standard", scenes=64, createdLabel="1 week ago"),
    Video(id="v3", title="Wedding recap film", durationLabel="12:41", sizeLabel="1.6 GB", expiresInDays=1, accent="#E0699A", resolution="4K", tierLabel="Premium", scenes=31, createdLabel="2 weeks ago"),
]

_SEED_JOBS: list[Job] = [
    Job(id="j1", title="Lighthouse keeper — cinematic short", status="generating", scenesDone=7, scenesTotal=18, etaMin=12, tierLabel="Premium", seconds=180),
    Job(id="j2", title="Neon city chase (30 min)", status="queued", scenesDone=0, scenesTotal=92, tierLabel="Standard", seconds=1800),
    Job(id="j3", title="Product teaser — 3 min", status="done", scenesDone=9, scenesTotal=9, tierLabel="Premium", seconds=180),
    Job(id="j4", title="Documentary intro", status="failed", scenesDone=3, scenesTotal=20, tierLabel="Draft", seconds=200),
]

_ACCENTS = ["#6D5DF6", "#1FA2A6", "#E0699A", "#E2A43B", "#4C8DF6"]


class JobStore:
    def __init__(self) -> None:
        self._jobs: dict[str, Job] = {j.id: j.model_copy() for j in _SEED_JOBS}
        self._lock = asyncio.Lock()

    async def list(self) -> list[Job]:
        async with self._lock:
            return [j.model_copy() for j in self._jobs.values()]

    async def get(self, job_id: str) -> Optional[Job]:
        async with self._lock:
            j = self._jobs.get(job_id)
            return j.model_copy() if j else None

    async def create(
        self,
        prompt: str,
        seconds: int,
        tier_id: str,
        scene_prompts: list[str] | None = None,
    ) -> Job:
        tier = tier_by_id(tier_id)
        title = (prompt.strip().splitlines()[0][:60] if prompt.strip() else "Untitled film")
        # When the director supplied per-scene prompts, the scene count follows
        # them; otherwise derive it from the requested length.
        total = len(scene_prompts) if scene_prompts else scenes_for(seconds)
        job = Job(
            id=_new_id("j"),
            title=title,
            status="queued",
            scenesDone=0,
            scenesTotal=total,
            tierLabel=tier.label if tier else tier_id,
            seconds=seconds,
            scenePrompts=scene_prompts or None,
        )
        async with self._lock:
            self._jobs[job.id] = job
        return job.model_copy()

    async def remove(self, job_id: str) -> bool:
        async with self._lock:
            return self._jobs.pop(job_id, None) is not None

    async def patch(self, job_id: str, **fields) -> Optional[Job]:
        async with self._lock:
            j = self._jobs.get(job_id)
            if not j:
                return None
            updated = j.model_copy(update=fields)
            self._jobs[job_id] = updated
            return updated.model_copy()


class LibraryStore:
    def __init__(self) -> None:
        self._videos: dict[str, Video] = {v.id: v.model_copy() for v in _SEED_VIDEOS}
        self._lock = asyncio.Lock()

    async def list(self) -> list[Video]:
        async with self._lock:
            return [v.model_copy() for v in self._videos.values()]

    async def get(self, video_id: str) -> Optional[Video]:
        async with self._lock:
            v = self._videos.get(video_id)
            return v.model_copy() if v else None

    async def add_from_job(self, job: Job, film_key: str | None = None) -> Video:
        idx = len(self._videos)
        video = Video(
            id=_new_id("v"),
            title=job.title,
            durationLabel=_fmt_clock(job.seconds or 0),
            sizeLabel="— MB",
            expiresInDays=14,
            accent=_ACCENTS[idx % len(_ACCENTS)],
            resolution="512p" if film_key else "1080p",
            tierLabel=job.tierLabel or "Standard",
            scenes=job.scenesTotal,
            createdLabel="just now",
            url=f"/v1/media/{film_key}" if film_key else None,
        )
        async with self._lock:
            self._videos[video.id] = video
        return video.model_copy()

    async def extend(self, video_id: str, add_days: int) -> Optional[Video]:
        async with self._lock:
            v = self._videos.get(video_id)
            if not v:
                return None
            # add_days == 0 means keep indefinitely -> use a large sentinel.
            new_days = 3650 if add_days == 0 else max(v.expiresInDays, 0) + add_days
            updated = v.model_copy(update={"expiresInDays": new_days})
            self._videos[video_id] = updated
            return updated.model_copy()

    async def storage(self) -> Storage:
        # Static for now; a real backend derives this from the storage interface.
        return Storage(usedLabel="18.2 GB", totalLabel="50 GB", usedRatio=0.36)


def _fmt_clock(seconds: int) -> str:
    m, s = divmod(max(seconds, 0), 60)
    return f"{m}:{s:02d}"


jobs = JobStore()
library = LibraryStore()

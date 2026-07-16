"""In-memory stores for jobs and library videos.

Phase 1: process-local state, single worker. This is the seam a real database +
job queue (ADR 0006) slots behind later — the router/worker code talks only to
these methods, not to the storage mechanism.
"""

from __future__ import annotations

import asyncio
import itertools
import os
import time
from typing import Optional

from .catalog import scenes_for, tier_by_id
from .config import settings
from .schemas import ExploreComment, ExploreItem, Job, Storage, Video


def _dir_size(path: str) -> int:
    total = 0
    for root, _dirs, files in os.walk(path):
        for name in files:
            try:
                total += os.path.getsize(os.path.join(root, name))
            except OSError:
                pass
    return total

_counter = itertools.count(1)


def _new_id(prefix: str) -> str:
    return f"{prefix}{int(time.time() * 1000)}{next(_counter)}"


# No seed videos/jobs — the Library and Jobs show only REAL content the user
# generated, imported, or edited (placeholder seeds had no playable file, which
# was confusing). Fresh installs start empty until the first generation.
_SEED_VIDEOS: list[Video] = []

_SEED_JOBS: list[Job] = []

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

    async def retry(self, job_id: str) -> Optional[Job]:
        async with self._lock:
            j = self._jobs.get(job_id)
            if not j:
                return None
            updated = j.model_copy(update={"status": "queued", "scenesDone": 0, "etaMin": None})
            self._jobs[job_id] = updated
            return updated.model_copy()

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

    async def add_film(
        self,
        title: str,
        film_key: str,
        size_bytes: int,
        tier_label: str = "Local",
        created_label: str = "just now",
        scenes: int = 1,
    ) -> Video:
        idx = len(self._videos)
        video = Video(
            id=_new_id("v"),
            title=title,
            durationLabel="—",
            sizeLabel=_fmt_size(size_bytes),
            expiresInDays=14,
            accent=_ACCENTS[idx % len(_ACCENTS)],
            resolution="512p",
            tierLabel=tier_label,
            scenes=scenes,
            createdLabel=created_label,
            url=f"/v1/media/{film_key}",
        )
        async with self._lock:
            self._videos[video.id] = video
        return video.model_copy()

    async def add_imported(self, title: str, film_key: str, size_bytes: int) -> Video:
        return await self.add_film(title, film_key, size_bytes, "Local", "imported")

    async def remove(self, video_id: str) -> bool:
        async with self._lock:
            video = self._videos.pop(video_id, None)
        if video is None:
            return False
        if video.url:
            key = video.url.split("/v1/media/", 1)[-1]
            try:
                from .storage import get_storage

                get_storage().delete(key)
            except Exception:
                pass
        return True

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
        # Real usage: sum of bytes stored under the local media root vs a cap.
        used = _dir_size(settings.storage_local_path)
        # The client meters `usedBytes` against the current plan's cap; these
        # labels are a sensible default (free tier) for when it doesn't.
        cap = 300 * 1024 * 1024  # free-tier default
        return Storage(
            usedLabel=_fmt_size(used),
            totalLabel="300 MB",
            usedRatio=min(1.0, used / cap) if cap else 0.0,
            usedBytes=used,
        )


def _fmt_clock(seconds: int) -> str:
    m, s = divmod(max(seconds, 0), 60)
    return f"{m}:{s:02d}"


def _fmt_size(nbytes: int) -> str:
    mb = nbytes / (1024 * 1024)
    if mb >= 1024:
        return f"{mb / 1024:.1f} GB"
    return f"{mb:.1f} MB"


class ExploreStore:
    """Public feed of REAL user-published creations — no dummy seed. Empty until
    someone publishes a video to it."""

    def __init__(self) -> None:
        self._items: dict[str, ExploreItem] = {}
        self._comments: dict[str, list[ExploreComment]] = {}
        self._lock = asyncio.Lock()

    async def list(self, sort: str = "popular") -> list[ExploreItem]:
        async with self._lock:
            items = [e.model_copy() for e in self._items.values()]
        if sort == "latest":
            items.reverse()  # dict preserves insertion order; newest last
        else:  # popular
            items.sort(key=lambda e: e.likes, reverse=True)
        return items

    async def publish(self, video: Video, prompt: str) -> ExploreItem:
        item = ExploreItem(
            id=_new_id("e"),
            title=video.title,
            prompt=(prompt.strip() or video.title),
            author="@me",
            likes=0,
            durationLabel=video.durationLabel,
            accent=video.accent,
            tierLabel=video.tierLabel,
            url=video.url,
            createdLabel="just now",
        )
        async with self._lock:
            self._items[item.id] = item
        return item.model_copy()

    async def like(self, item_id: str) -> Optional[ExploreItem]:
        async with self._lock:
            item = self._items.get(item_id)
            if not item:
                return None
            updated = item.model_copy(update={"likes": item.likes + 1})
            self._items[item_id] = updated
            return updated.model_copy()

    async def comments(self, item_id: str) -> Optional[list[ExploreComment]]:
        async with self._lock:
            if item_id not in self._items:
                return None
            return [c.model_copy() for c in self._comments.get(item_id, [])]

    async def add_comment(self, item_id: str, text: str) -> Optional[ExploreComment]:
        async with self._lock:
            item = self._items.get(item_id)
            if not item:
                return None
            comment = ExploreComment(id=_new_id("c"), author="@me", text=text)
            self._comments.setdefault(item_id, []).append(comment)
            self._items[item_id] = item.model_copy(update={"comments": item.comments + 1})
            return comment.model_copy()


jobs = JobStore()
library = LibraryStore()
explore = ExploreStore()

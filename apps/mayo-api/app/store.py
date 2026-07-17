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

from .catalog import clips_for_duration, tier_by_id
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
        self._owners: dict[str, str] = {}  # job id -> user id (for cancel refunds)
        self._lock = asyncio.Lock()

    def owner_of(self, job_id: str) -> Optional[str]:
        return self._owners.get(job_id)

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
        style_prompt: str = "",
        charged_credits: int | None = None,
        owner_id: str | None = None,
    ) -> Job:
        tier = tier_by_id(tier_id)
        title = (prompt.strip().splitlines()[0][:60] if prompt.strip() else "Untitled film")
        # Fill the requested LENGTH: render enough fixed-length clips to reach it.
        needed = clips_for_duration(seconds)
        if scene_prompts:
            # Pad the director's scenes (cycling) so the film still hits the length.
            if len(scene_prompts) < needed:
                scene_prompts = [scene_prompts[i % len(scene_prompts)] for i in range(needed)]
            total = len(scene_prompts)
        else:
            total = needed
        job = Job(
            id=_new_id("j"),
            title=title,
            status="queued",
            scenesDone=0,
            scenesTotal=total,
            tierLabel=tier.label if tier else tier_id,
            seconds=seconds,
            scenePrompts=scene_prompts or None,
            stylePrompt=style_prompt or None,
            chargedCredits=charged_credits,
        )
        async with self._lock:
            self._jobs[job.id] = job
            if owner_id:
                self._owners[job.id] = owner_id
        return job.model_copy()

    async def remove(self, job_id: str) -> bool:
        async with self._lock:
            self._owners.pop(job_id, None)
            return self._jobs.pop(job_id, None) is not None

    async def append_scene_url(self, job_id: str, url: str) -> None:
        async with self._lock:
            j = self._jobs.get(job_id)
            if not j:
                return
            urls = list(j.sceneUrls or []) + [url]
            self._jobs[job_id] = j.model_copy(update={"sceneUrls": urls})

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
    """Video metadata. Media files live on disk already; the metadata is also
    persisted (media/.library.json) so the Library survives API restarts."""

    def __init__(self) -> None:
        import os as _os

        from . import db

        self._videos: dict[str, Video] = {v.id: v.model_copy() for v in _SEED_VIDEOS}
        self._lock = asyncio.Lock()
        legacy = _os.path.join(settings.storage_local_path, ".library.json")
        records = db.migrate_legacy_json(
            "video", legacy, lambda raw: [(v["id"], v) for v in raw]
        ) or db.load("video")
        for raw in records:
            try:
                v = Video.model_validate(raw)
                self._videos[v.id] = v
            except Exception:
                continue

    def _persist(self) -> None:
        """Write-through to SQLite; call while holding self._lock (or right after a pop)."""
        from . import db

        try:
            db.replace_kind("video", [(v.id, v.model_dump()) for v in self._videos.values()])
        except Exception:
            pass

    async def list(self) -> list[Video]:
        async with self._lock:
            return [v.model_copy() for v in self._videos.values()]

    async def get(self, video_id: str) -> Optional[Video]:
        async with self._lock:
            v = self._videos.get(video_id)
            return v.model_copy() if v else None

    async def add_from_job(
        self, job: Job, film_key: str | None = None, duration_seconds: int | None = None
    ) -> Video:
        idx = len(self._videos)
        # Prefer the REAL stitched length (clips × clip-seconds) over the requested
        # length, which can differ (fixed-length clips, director scene count).
        label_seconds = duration_seconds if duration_seconds is not None else (job.seconds or 0)
        size_label = "— MB"
        if film_key:
            try:
                from .storage import get_storage

                size_label = _fmt_size(len(get_storage().read(film_key)))
            except Exception:
                pass  # metadata-only / storage hiccup — keep the placeholder
        video = Video(
            id=_new_id("v"),
            title=job.title,
            durationLabel=_fmt_clock(label_seconds),
            sizeLabel=size_label,
            expiresInDays=14,
            accent=_ACCENTS[idx % len(_ACCENTS)],
            resolution="512p" if film_key else "1080p",
            tierLabel=job.tierLabel or "Standard",
            scenes=job.scenesTotal,
            createdLabel="just now",
            url=f"/v1/media/{film_key}" if film_key else None,
            prompt=job.title,
            scenePrompts=job.scenePrompts,
        )
        async with self._lock:
            self._videos[video.id] = video
            self._persist()
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
        # Measure the real length (ffprobe) so edited/imported films don't show
        # "—" — an unknown duration also breaks trim/split in the editor.
        duration_label = "—"
        try:
            from .worker import _probe  # lazy — worker imports this module

            secs = await _probe(film_key)
            if secs > 0:
                duration_label = _fmt_clock(int(round(secs)))
        except Exception:
            pass  # no ffprobe (dev container) — keep the placeholder
        video = Video(
            id=_new_id("v"),
            title=title,
            durationLabel=duration_label,
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
            self._persist()
        return video.model_copy()

    async def add_imported(self, title: str, film_key: str, size_bytes: int) -> Video:
        return await self.add_film(title, film_key, size_bytes, "Local", "imported")

    async def backfill_labels(self) -> int:
        """One-time repair for records created before real duration/size labels
        existed ("—" / "— MB"): probe the stored file and fill them in."""
        from .storage import get_storage

        async with self._lock:
            items = [v.model_copy() for v in self._videos.values()]
        fixed = 0
        for v in items:
            if not v.url:
                continue
            key = v.url.split("/v1/media/", 1)[-1]
            updates: dict = {}
            if v.durationLabel in ("—", "-", ""):
                try:
                    from .worker import _probe  # lazy — worker imports this module

                    secs = await _probe(key)
                    if secs > 0:
                        updates["durationLabel"] = _fmt_clock(int(round(secs)))
                except Exception:
                    pass
            if v.sizeLabel in ("— MB", "—", "-", ""):
                try:
                    store = get_storage()
                    if store.exists(key):
                        updates["sizeLabel"] = _fmt_size(len(store.read(key)))
                except Exception:
                    pass
            if updates:
                async with self._lock:
                    cur = self._videos.get(v.id)
                    if cur:
                        self._videos[v.id] = cur.model_copy(update=updates)
                        self._persist()
                        fixed += 1
        return fixed

    async def remove(self, video_id: str) -> bool:
        async with self._lock:
            video = self._videos.pop(video_id, None)
            self._persist()
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

    async def set_youtube_url(self, video_id: str, url: str) -> None:
        async with self._lock:
            v = self._videos.get(video_id)
            if v:
                self._videos[video_id] = v.model_copy(update={"youtubeUrl": url})
                self._persist()

    async def extend(self, video_id: str, add_days: int) -> Optional[Video]:
        async with self._lock:
            v = self._videos.get(video_id)
            if not v:
                return None
            # add_days == 0 means keep indefinitely -> use a large sentinel.
            new_days = 3650 if add_days == 0 else max(v.expiresInDays, 0) + add_days
            updated = v.model_copy(update={"expiresInDays": new_days})
            self._videos[video_id] = updated
            self._persist()
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
        from . import db

        self._items: dict[str, ExploreItem] = {}
        self._comments: dict[str, list[ExploreComment]] = {}
        self._lock = asyncio.Lock()
        for raw in db.load("explore"):
            try:
                item = ExploreItem.model_validate(raw)
                self._items[item.id] = item
            except Exception:
                continue
        for raw in db.load("explore_comment"):
            try:
                c = ExploreComment.model_validate(raw.get("comment", raw))
                self._comments.setdefault(raw.get("itemId", ""), []).append(c)
            except Exception:
                continue

    def _persist(self) -> None:
        """Write-through to SQLite; call while holding self._lock."""
        from . import db

        try:
            db.replace_kind("explore", [(i.id, i.model_dump()) for i in self._items.values()])
            db.replace_kind(
                "explore_comment",
                [
                    (c.id, {"itemId": item_id, "comment": c.model_dump()})
                    for item_id, cl in self._comments.items()
                    for c in cl
                ],
            )
        except Exception:
            pass

    async def list(self, sort: str = "popular") -> list[ExploreItem]:
        async with self._lock:
            items = [e.model_copy() for e in self._items.values()]
        if sort == "latest":
            items.reverse()  # dict preserves insertion order; newest last
        else:
            # Popular = engagement + freshness: likes weigh most, comments count
            # double-ish, and newer items get a decaying boost so the feed isn't
            # frozen by early winners (position n from the end ~ freshness).
            total = len(items)
            def score(pair: tuple[int, ExploreItem]) -> float:
                idx, e = pair
                freshness = (idx + 1) / total * 3 if total else 0  # newest -> +3
                return e.likes * 3 + e.comments * 2 + freshness
            ranked = sorted(enumerate(items), key=score, reverse=True)
            items = [e for _, e in ranked]
        return items

    async def publish(self, video: Video, prompt: str, author: str = "@me") -> ExploreItem:
        item = ExploreItem(
            id=_new_id("e"),
            title=video.title,
            prompt=(prompt.strip() or video.title),
            author=author,
            likes=0,
            durationLabel=video.durationLabel,
            accent=video.accent,
            tierLabel=video.tierLabel,
            url=video.url,
            createdLabel="just now",
        )
        async with self._lock:
            self._items[item.id] = item
            self._persist()
        return item.model_copy()

    async def like(self, item_id: str) -> Optional[ExploreItem]:
        async with self._lock:
            item = self._items.get(item_id)
            if not item:
                return None
            updated = item.model_copy(update={"likes": item.likes + 1})
            self._items[item_id] = updated
            self._persist()
            return updated.model_copy()

    async def unlike(self, item_id: str) -> Optional[ExploreItem]:
        async with self._lock:
            item = self._items.get(item_id)
            if not item:
                return None
            updated = item.model_copy(update={"likes": max(0, item.likes - 1)})
            self._items[item_id] = updated
            self._persist()
            return updated.model_copy()

    async def comments(self, item_id: str) -> Optional[list[ExploreComment]]:
        async with self._lock:
            if item_id not in self._items:
                return None
            return [c.model_copy() for c in self._comments.get(item_id, [])]

    async def add_comment(self, item_id: str, text: str, author: str = "@me") -> Optional[ExploreComment]:
        async with self._lock:
            item = self._items.get(item_id)
            if not item:
                return None
            comment = ExploreComment(id=_new_id("c"), author=author, text=text)
            self._comments.setdefault(item_id, []).append(comment)
            self._items[item_id] = item.model_copy(update={"comments": item.comments + 1})
            self._persist()
            return comment.model_copy()


jobs = JobStore()
library = LibraryStore()
explore = ExploreStore()

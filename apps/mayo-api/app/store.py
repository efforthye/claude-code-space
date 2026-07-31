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

from .catalog import clips_for_duration, tier_by_id
from .config import settings
from .schemas import ExploreComment, ExploreItem, Job, Storage, Video


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

    async def list_all(self) -> list[Job]:
        """Every job regardless of owner — admin console only."""
        async with self._lock:
            return [j.model_copy() for j in self._jobs.values()]

    async def list(self, owner_id: str | None = None) -> list[Job]:
        """Jobs visible to a caller: their own plus ownerless (legacy/anonymous)."""
        async with self._lock:
            return [
                j.model_copy()
                for j in self._jobs.values()
                if self._owners.get(j.id) in (None, owner_id)
            ]

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
        aspect: str = "16:9",
        video_model: str | None = None,
        stage: str = "clips",
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
            aspect=aspect,
            videoModel=video_model,
            stage=stage,
        )
        async with self._lock:
            self._jobs[job.id] = job
            if owner_id:
                self._owners[job.id] = owner_id
        return job.model_copy()

    async def set_segments(
        self, job_id: str, segments: list, stage: str | None = None
    ) -> Optional[Job]:
        """Replace a job's beat sheet, optionally advancing its stage."""
        async with self._lock:
            job = self._jobs.get(job_id)
            if job is None:
                return None
            job.segments = segments
            if stage:
                job.stage = stage
            job.scenesTotal = len(segments) or job.scenesTotal
            return job.model_copy()

    async def set_segment(self, job_id: str, segment) -> Optional[Job]:
        """Replace ONE segment in place — the unit of review and of billing."""
        async with self._lock:
            job = self._jobs.get(job_id)
            if job is None or not 0 <= segment.index < len(job.segments):
                return None
            job.segments[segment.index] = segment
            return job.model_copy()

    async def request_stop(self, job_id: str) -> Optional[Job]:
        async with self._lock:
            job = self._jobs.get(job_id)
            if job is None:
                return None
            job.stopRequested = True
            return job.model_copy()

    async def add_spend(self, job_id: str, credits: int) -> None:
        async with self._lock:
            job = self._jobs.get(job_id)
            if job is not None:
                job.spentCredits += credits

    async def set_clip_mode(self, job_id: str, mode: str) -> Optional[Job]:
        async with self._lock:
            job = self._jobs.get(job_id)
            if job is None:
                return None
            job.clipMode = mode
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

    async def list(self, owner_id: str | None = None) -> list[Video]:
        """Videos visible to a caller: their own plus ownerless (legacy/anonymous)."""
        async with self._lock:
            return [
                v.model_copy()
                for v in self._videos.values()
                if v.ownerId in (None, owner_id)
            ]

    async def list_all(self) -> list[Video]:
        """Every video regardless of owner — admin console only."""
        async with self._lock:
            return [v.model_copy() for v in self._videos.values()]

    async def get(self, video_id: str) -> Optional[Video]:
        async with self._lock:
            v = self._videos.get(video_id)
            return v.model_copy() if v else None

    async def add_from_job(
        self,
        job: Job,
        film_key: str | None = None,
        duration_seconds: int | None = None,
        owner_id: str | None = None,
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
        from .providers import size_for_aspect

        size = size_for_aspect(job.aspect) if film_key else None
        video = Video(
            id=_new_id("v"),
            title=job.title,
            aspect=job.aspect,
            durationLabel=_fmt_clock(label_seconds),
            sizeLabel=size_label,
            expiresInDays=14,
            accent=_ACCENTS[idx % len(_ACCENTS)],
            resolution=f"{size[0]}×{size[1]}" if size else ("512p" if film_key else "1080p"),
            tierLabel=job.tierLabel or "Standard",
            scenes=job.scenesTotal,
            createdLabel="just now",
            url=f"/v1/media/{film_key}" if film_key else None,
            prompt=job.title,
            scenePrompts=job.scenePrompts,
            stylePrompt=job.stylePrompt,
            ownerId=owner_id,
            promptPublic=prompt_public,
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
        owner_id: str | None = None,
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
            ownerId=owner_id,
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

    async def storage(self, owner_id: str | None = None) -> Storage:
        # Per-user usage: a signed-in user is metered over ONLY their own files
        # (a fresh account starts at 0 — legacy ownerless files don't count
        # against them); the anonymous/dev caller is metered over the ownerless
        # pool it actually sees.
        from .storage import get_storage

        store = get_storage()
        videos = await self.list(owner_id)
        if owner_id:
            videos = [v for v in videos if v.ownerId == owner_id]
        used = 0
        for v in videos:
            if v.url and "/v1/media/" in v.url:
                try:
                    used += store.size(v.url.split("/v1/media/", 1)[-1])
                except Exception:
                    pass
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


def _is_vertical(aspect: str) -> bool:
    """True for shapes taller than they are wide (9:16, 4:5).

    Parsed rather than matched against a list so an aspect we start offering
    later lands in the right lane without another edit here.
    """
    try:
        w, h = (float(x) for x in aspect.split(":", 1))
        return h > w
    except (ValueError, AttributeError):
        return False


class ExploreStore:
    """Public feed of REAL user-published creations — no dummy seed. Empty until
    someone publishes a video to it."""

    def __init__(self) -> None:
        from . import db

        self._items: dict[str, ExploreItem] = {}
        self._comments: dict[str, list[ExploreComment]] = {}
        self._lock = asyncio.Lock()
        records = db.load("explore")
        for idx, raw in enumerate(records):
            try:
                item = ExploreItem.model_validate(raw)
                if not item.createdAt:
                    # Legacy record without a timestamp: stagger by stored order
                    # (newest last) so the decayed ranking keeps their order.
                    item = item.model_copy(
                        update={"createdAt": time.time() - (len(records) - idx) * 3600}
                    )
                self._items[item.id] = item
            except Exception:
                continue
        # Per-account likes (one like per user per item, ADR 0015 follow-up).
        self._liked: dict[str, set[str]] = {}
        for raw in db.load("explore_like"):
            try:
                self._liked.setdefault(raw["itemId"], set()).add(raw["userId"])
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
            db.replace_kind(
                "explore_like",
                [
                    (f"{item_id}:{user_id}", {"itemId": item_id, "userId": user_id})
                    for item_id, likers in self._liked.items()
                    for user_id in likers
                ],
            )
        except Exception:
            pass

    async def list(
        self, sort: str = "popular", orientation: str = "all", author: str = ""
    ) -> list[ExploreItem]:
        """The PUBLIC feed — owner-hidden items never appear here.

        `orientation` splits the feed into the two ways a film can actually be
        watched. Mixing them in one pager does not work: a 9:16 short shown in a
        landscape player is a thin strip between two black walls, and a 16:9
        film in a vertical pager is a letterboxed sliver. Square and other
        shapes count as horizontal, since a landscape player wastes less of
        them than a portrait one does.
        """
        async with self._lock:
            items = [e.model_copy() for e in self._items.values() if not e.hidden]
        if orientation != "all":
            want_vertical = orientation == "vertical"
            items = [e for e in items if _is_vertical(e.aspect) == want_vertical]
        if author:
            items = [e for e in items if e.author == author]
        if sort == "latest":
            items.reverse()  # dict preserves insertion order; newest last
        else:
            items.sort(key=self._score, reverse=True)
        return items

    async def mine(self, owner_id: str) -> list[ExploreItem]:
        """Everything this account published — hidden included — newest first."""
        async with self._lock:
            items = [e.model_copy() for e in self._items.values() if e.ownerId == owner_id]
        items.reverse()
        return items

    async def set_hidden(self, item_id: str, owner_id: str, hidden: bool) -> Optional[ExploreItem]:
        """Owner-only hide/unhide; None when the item isn't theirs (or missing)."""
        async with self._lock:
            item = self._items.get(item_id)
            if not item or item.ownerId != owner_id:
                return None
            updated = item.model_copy(update={"hidden": hidden})
            self._items[item_id] = updated
            self._persist()
            return updated.model_copy()

    async def remove_owned(self, item_id: str, owner_id: str) -> bool:
        """Owner-only permanent delete (comments go with it)."""
        async with self._lock:
            item = self._items.get(item_id)
            if not item or item.ownerId != owner_id:
                return False
            self._items.pop(item_id, None)
            self._comments.pop(item_id, None)
            self._liked.pop(item_id, None)
            self._persist()
        return True

    @staticmethod
    def _score(e: ExploreItem, now: float | None = None) -> float:
        """Popular ranking (ADR 0015) = engagement value × time decay.

        Signal weights follow the industrial short-video ordering (deep actions
        outweigh shallow ones: shares > comments > likes > views — TikTok's
        ranking is a weighted sum of predicted engagement probabilities), and
        the decay is Hacker News' gravity form score/(age+2)^g with a softer g
        for a small feed. The +1 numerator floor lets brand-new zero-engagement
        items surface near the top while they're fresh, then fade unless they
        earn engagement — no more feed frozen by early winners.
        """
        engagement = (
            e.likes * 3.0 + e.comments * 5.0 + e.shares * 8.0 + e.views * 0.3
            # Completed watches: deeper than a view, shallower than a like —
            # short-video rankers treat completion rate as a core signal.
            + e.watches * 1.5
        )
        age_hours = max(0.0, ((now or time.time()) - (e.createdAt or 0)) / 3600)
        return (engagement + 1.0) / (age_hours + 2.0) ** 1.5

    async def view(self, item_id: str) -> Optional[ExploreItem]:
        """Count a reel impression (the app pings when a reel becomes active)."""
        async with self._lock:
            item = self._items.get(item_id)
            if not item:
                return None
            updated = item.model_copy(update={"views": item.views + 1})
            self._items[item_id] = updated
            self._persist()
            return updated.model_copy()

    async def watch(self, item_id: str) -> Optional[ExploreItem]:
        """Count a COMPLETED watch (the reel played to its end)."""
        async with self._lock:
            item = self._items.get(item_id)
            if not item:
                return None
            updated = item.model_copy(update={"watches": item.watches + 1})
            self._items[item_id] = updated
            self._persist()
            return updated.model_copy()

    async def insert(self, item: ExploreItem) -> ExploreItem:
        """Add a fully-built item (used by the sample seeder)."""
        async with self._lock:
            self._items[item.id] = item
            self._persist()
        return item.model_copy()

    async def remove(self, item_id: str) -> bool:
        """Remove a published item (admin moderation)."""
        async with self._lock:
            existed = self._items.pop(item_id, None) is not None
            self._comments.pop(item_id, None)
            if existed:
                self._persist()
        return existed

    async def remove_by_author(self, author: str) -> int:
        """Remove all items by an author (used to clear '@mayo-sample' seeds)."""
        async with self._lock:
            doomed = [i for i, e in self._items.items() if e.author == author]
            for item_id in doomed:
                self._items.pop(item_id, None)
                self._comments.pop(item_id, None)
            if doomed:
                self._persist()
        return len(doomed)

    async def share(self, item_id: str) -> Optional[ExploreItem]:
        """Count a completed external share — the strongest ranking signal."""
        async with self._lock:
            item = self._items.get(item_id)
            if not item:
                return None
            updated = item.model_copy(update={"shares": item.shares + 1})
            self._items[item_id] = updated
            self._persist()
            return updated.model_copy()

    async def publish(
        self,
        video: Video,
        prompt: str,
        author: str = "@me",
        owner_id: str | None = None,
        prompt_public: bool = False,
    ) -> ExploreItem:
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
            createdAt=time.time(),
            aspect=video.aspect,
            # Publish the recipe too — anyone can reuse this as a template.
            scenePrompts=video.scenePrompts,
            stylePrompt=video.stylePrompt,
            ownerId=owner_id,
        )
        async with self._lock:
            self._items[item.id] = item
            self._persist()
        return item.model_copy()

    async def like(self, item_id: str, user_id: str | None = None) -> Optional[ExploreItem]:
        """Signed-in likes are one-per-account (idempotent); anonymous likes
        keep the plain counter (the app's device guard limits repeats)."""
        async with self._lock:
            item = self._items.get(item_id)
            if not item:
                return None
            if user_id:
                likers = self._liked.setdefault(item_id, set())
                if user_id in likers:
                    return item.model_copy(update={"likedByMe": True})  # already liked
                likers.add(user_id)
            updated = item.model_copy(update={"likes": item.likes + 1})
            self._items[item_id] = updated
            self._persist()
            return updated.model_copy(update={"likedByMe": bool(user_id)})

    async def unlike(self, item_id: str, user_id: str | None = None) -> Optional[ExploreItem]:
        async with self._lock:
            item = self._items.get(item_id)
            if not item:
                return None
            if user_id:
                likers = self._liked.get(item_id, set())
                if user_id not in likers:
                    return item.model_copy()  # nothing to undo for this account
                likers.discard(user_id)
            updated = item.model_copy(update={"likes": max(0, item.likes - 1)})
            self._items[item_id] = updated
            self._persist()
            return updated.model_copy()

    def annotate_liked(self, items: list[ExploreItem], user_id: str | None) -> list[ExploreItem]:
        """Stamp likedByMe for the calling account (no-op for anonymous)."""
        if not user_id:
            return items
        return [
            i.model_copy(update={"likedByMe": user_id in self._liked.get(i.id, set())})
            for i in items
        ]

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



class FollowStore:
    """Who each account follows, by creator handle.

    Server-side rather than on the device, for two reasons. A device-local list
    vanishes on reinstall and never reaches a second device, so "the people I
    follow" would quietly mean "the people I followed on this phone". And the
    personalised feed (MAYO-34) has to rank against follows, which it cannot do
    from storage it never sees.

    Signed-out visitors keep the on-device list in the app; it merges up on the
    first sign-in rather than being thrown away.
    """

    def __init__(self) -> None:
        from . import db

        self._by_user: dict[str, list[str]] = {}
        for raw in db.load("follows"):
            uid = raw.get("userId")
            if uid:
                self._by_user[uid] = list(raw.get("authors") or [])
        self._lock = asyncio.Lock()

    def _persist(self) -> None:
        """Write-through to SQLite; call while holding self._lock."""
        from . import db

        try:
            db.replace_kind(
                "follows",
                [(uid, {"userId": uid, "authors": a}) for uid, a in self._by_user.items()],
            )
        except Exception:
            pass  # best-effort; the in-memory set still applies this run

    async def following(self, user_id: str) -> list[str]:
        async with self._lock:
            return list(self._by_user.get(user_id) or [])

    async def is_following(self, user_id: str, author: str) -> bool:
        async with self._lock:
            return author in (self._by_user.get(user_id) or [])

    async def set(self, user_id: str, author: str, follow: bool) -> list[str]:
        """Follow or unfollow, idempotently. Returns the new list, newest first."""
        author = (author or "").strip()
        if not author:
            return await self.following(user_id)
        async with self._lock:
            current = list(self._by_user.get(user_id) or [])
            if follow and author not in current:
                current.insert(0, author)
            elif not follow:
                current = [a for a in current if a != author]
            self._by_user[user_id] = current
            self._persist()
            return list(current)

    async def merge(self, user_id: str, authors: list[str]) -> list[str]:
        """Fold a device's signed-out follows into the account's list."""
        async with self._lock:
            current = list(self._by_user.get(user_id) or [])
            for a in reversed([x.strip() for x in authors if x and x.strip()]):
                if a not in current:
                    current.insert(0, a)
            self._by_user[user_id] = current
            self._persist()
            return list(current)


jobs = JobStore()
library = LibraryStore()
explore = ExploreStore()
follows = FollowStore()

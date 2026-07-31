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
import math
import time
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


def _xfade_filter(durations: list[float], dissolve: float) -> tuple[str, str]:
    """Build the ffmpeg xfade chain for N clips; returns (filter, out label).

    Each transition starts `dissolve` seconds before the end of the material
    accumulated so far — with frame chaining (batch 45) the frames on both
    sides already match, so the dissolve reads as one continuous move."""
    parts: list[str] = []
    prev = "[0:v]"
    acc = 0.0
    for i in range(1, len(durations)):
        acc += durations[i - 1] - dissolve
        label = f"[v{i}]"
        parts.append(
            f"{prev}[{i}:v]xfade=transition=fade:duration={dissolve:.3f}:offset={acc:.3f}{label}"
        )
        prev = label
    return ";".join(parts), prev


def _path_seconds(path: str) -> float:
    try:
        probe = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "csv=p=0", path],
            capture_output=True, timeout=60,
        )
        return float(probe.stdout.strip() or 0)
    except Exception:
        return 0.0


def _dissolve_stitch_sync(paths: list[str], out: str) -> bool:
    """Try a cross-dissolve stitch; False means 'use the plain concat instead'.

    Skipped when disabled, when any clip carries audio (xfade here is video-
    only — silently dropping sound would be a regression), or when a clip is
    too short to absorb the overlap."""
    dissolve = settings.stitch_dissolve_seconds
    if dissolve <= 0 or len(paths) < 2:
        return False
    from .compose import _has_audio

    if any(_has_audio(p) for p in paths):
        return False
    durations = [_path_seconds(p) for p in paths]
    if any(d <= dissolve * 2 for d in durations):
        return False
    fc, out_label = _xfade_filter(durations, dissolve)
    cmd = ["ffmpeg", "-y"]
    for p in paths:
        cmd += ["-i", p]
    cmd += ["-filter_complex", fc, "-map", out_label,
            "-c:v", "libx264", "-pix_fmt", "yuv420p", out]
    try:
        subprocess.run(cmd, check=True, capture_output=True, timeout=900)
        return True
    except Exception:
        return False


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
        # Preferred: a short cross-dissolve between scenes (config
        # MAYO_STITCH_DISSOLVE); falls through to the plain concat whenever it
        # can't apply safely (audio present, clips too short, ffmpeg error).
        if _dissolve_stitch_sync(paths, out):
            with open(out, "rb") as fh:
                data = fh.read()
            store.save(film_key, data)
            return film_key
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



def _eta_clip_seconds() -> float:
    """Expected seconds per clip before any real measurement, by backend."""
    from . import runtime

    backend = runtime.generation_backend()
    if backend == "comfy":
        return settings.comfy_clip_eta_seconds
    if backend == "external":
        return 90.0
    return settings.tick_seconds


def _probe_seconds_sync(key: str) -> float:
    """Measured duration (s) of a stored video via ffprobe; 0.0 on any failure."""
    from .storage import get_storage

    store = get_storage()
    if not key or not store.exists(key):
        return 0.0
    try:
        with tempfile.NamedTemporaryFile(suffix=".mp4") as fh:
            fh.write(store.read(key))
            fh.flush()
            out = subprocess.run(
                ["ffprobe", "-v", "error", "-show_entries", "format=duration",
                 "-of", "default=noprint_wrappers=1:nokey=1", fh.name],
                capture_output=True, timeout=60,
            )
        return max(0.0, float(out.stdout.strip() or 0))
    except Exception:
        return 0.0


async def _probe(key: str | None) -> float:
    if not key:
        return 0.0
    return await asyncio.to_thread(_probe_seconds_sync, key)


def _extra_clips_needed(requested: float, measured: float, have: int, cap: int) -> int:
    """How many more clips to render so the film reaches `requested` seconds,
    based on the measured average clip length; bounded by the scene cap."""
    if requested <= 0 or measured <= 0 or measured + 0.25 >= requested or have >= cap:
        return 0
    avg = measured / max(1, have)
    return max(0, min(math.ceil((requested - measured) / max(avg, 0.1)), cap - have))


async def _prev_frame(clip_keys: list[str]) -> bytes | None:
    """The last frame of the most recent clip, to seed the next scene.

    Image-to-video starts from this frame, so scene N+1 begins exactly where
    scene N ended — continuous cuts instead of a slideshow. None for the first
    scene or when the frame can't be extracted (the scene still renders)."""
    if not clip_keys:
        return None
    from . import segments as seg

    try:
        return await asyncio.to_thread(seg.last_frame_of, clip_keys[-1])
    except Exception:
        return None


async def _run(job_id: str) -> None:
    job = await jobs.patch(job_id, status="generating")
    if job is None:
        return
    total = job.scenesTotal
    # per job: live backend switch, output shape, and cinematic variant
    backend = get_model_backend(job.aspect, getattr(job, "videoModel", "") or None)

    clip_keys: list[str] = []
    start_index = job.scenesDone
    run_started = time.monotonic()
    await jobs.patch(job_id, etaMin=max(1, round((total - start_index) * _eta_clip_seconds() / 60)))
    # Character/style consistency: the same style + character-sheet block is
    # prepended to EVERY scene prompt (prompt anchoring — the exact descriptor
    # phrases repeating verbatim is what keeps subjects consistent, ADR 0014).
    style = (job.stylePrompt or "").strip()

    def _full_prompt(scene: str) -> str:
        return f"{style}. {scene}" if style else scene

    for index in range(job.scenesDone, total):
        # Prefer the director's per-scene prompt; fall back to the job title.
        scene_prompt = _full_prompt(
            job.scenePrompts[index]
            if job.scenePrompts and index < len(job.scenePrompts)
            else job.title
        )
        try:
            result = await backend.generate_scene(
                scene_prompt, index, init_image=await _prev_frame(clip_keys)
            )
            clip_keys.append(result.media_key)
        except Exception:
            await jobs.patch(job_id, status="failed", etaMin=None)
            return
        if await jobs.get(job_id) is None:
            return  # cancelled/deleted mid-flight
        # Expose the just-finished clip so the app can preview it mid-generation.
        if get_storage().exists(result.media_key):
            await jobs.append_scene_url(job_id, f"/v1/media/{result.media_key}")
        remaining = total - index - 1
        # ETA from the measured average scene time so far (real backends take
        # minutes per clip; before the first scene finishes, the per-backend
        # default from _eta_clip_seconds applies).
        avg = (time.monotonic() - run_started) / max(1, index + 1 - start_index)
        eta = max(1, round(remaining * avg / 60)) if remaining > 0 else None
        await jobs.patch(job_id, scenesDone=index + 1, etaMin=eta)

    # Stitch the real clips into one film (no-op for the mock backend).
    film_key = await _stitch(job_id, clip_keys)

    # VERIFY the result length against the request: clips can come out shorter
    # than planned (provider/backend variance), so probe the stitched film and,
    # while it falls short, render more scenes and re-stitch — the requested
    # duration is a floor, not a hope. Bounded by max_scenes and 5 top-up rounds.
    store = get_storage()
    measured = await _probe(film_key)
    requested = float(job.seconds or 0)
    rounds = 0
    while film_key and rounds < 5:
        extra = _extra_clips_needed(requested, measured, len(clip_keys), settings.max_scenes)
        if extra <= 0:
            break
        rounds += 1
        total += extra
        await jobs.patch(job_id, scenesTotal=total)
        for _ in range(extra):
            index = len(clip_keys)
            scene_prompt = _full_prompt(
                job.scenePrompts[index % len(job.scenePrompts)]
                if job.scenePrompts
                else job.title
            )
            try:
                result = await backend.generate_scene(
                    scene_prompt, index, init_image=await _prev_frame(clip_keys)
                )
            except Exception:
                logger.exception("top-up scene %s failed for job %s", index, job_id)
                rounds = 5  # keep what we have instead of failing the job
                break
            clip_keys.append(result.media_key)
            if await jobs.get(job_id) is None:
                return  # cancelled/deleted mid-extension
            if store.exists(result.media_key):
                await jobs.append_scene_url(job_id, f"/v1/media/{result.media_key}")
            await jobs.patch(job_id, scenesDone=len(clip_keys))
        film_key = await _stitch(job_id, clip_keys) or film_key
        measured = await _probe(film_key)

    # Duration label: prefer the MEASURED stitched length; fall back to the
    # configured clips × clip-length estimate when probing isn't possible.
    real_clips = sum(1 for k in clip_keys if store.exists(k))
    clip_seconds = settings.comfy_frames / max(1, settings.comfy_fps)
    duration_seconds = (
        round(measured)
        if measured > 0
        else (round(real_clips * clip_seconds) if real_clips else None)
    )

    # "Done" has to mean there is a film. Reporting success with no media is
    # the failure mode this project already banned once (batch 33): the user is
    # told it worked, opens the library, and finds nothing playable.
    #
    # The mock backend legitimately produces no bytes — it exists to exercise
    # the pipeline offline — so it is the one case where an empty result is not
    # a failure. Everything else is.
    if film_key is None and backend.id != "mock":
        await jobs.patch(
            job_id,
            status="failed",
            etaMin=None,
            failureReason=(
                "생성은 끝났는데 재생 가능한 파일이 없어요. "
                f"생성 백엔드({backend.id})가 실제 영상을 만들지 못했습니다."
            ),
        )
        logger.error("job %s produced no media on backend %s", job_id, backend.id)
        return

    done = await jobs.patch(job_id, status="done", etaMin=None)
    if done is not None:
        # The finished film belongs to whoever created (and paid for) the job.
        await library.add_from_job(
            done,
            film_key=film_key,
            duration_seconds=duration_seconds,
            owner_id=jobs.owner_of(job_id),
        )


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

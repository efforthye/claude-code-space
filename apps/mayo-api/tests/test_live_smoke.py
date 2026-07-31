"""Smoke tests that hit the REAL providers. Opt-in, and they cost money.

    pytest -m live -s

Deselected by default (see pytest.ini) because a clip takes minutes and a few
dollars; running them on every edit would make the suite unusable. That is the
only reason the rest of the suite uses a stub — not because faking it is
preferable.

What these exist to catch is exactly what the stub let through on 2026-08-01:
the pipeline "working" in tests while the real API had a wrong model id, the
wrong image argument, and a response shape nobody had checked. Green tests said
nothing about any of it.

Run them after touching providers.py, config, or anything about how a render is
submitted. Each one prints what it spent.
"""

import os

import pytest

pytestmark = pytest.mark.live


def _require_key() -> None:
    if not os.getenv("HF_KEY"):
        pytest.skip("HF_KEY not set — live tests need real credentials")


def test_image_generation_really_works_and_honours_the_aspect():
    """~1 Higgsfield credit (about $0.06)."""
    _require_key()
    import struct

    from app.providers import _higgsfield_image_sync

    data = _higgsfield_image_sync("a lone lighthouse at golden hour, 35mm", aspect="9:16")
    assert data[:8] == b"\x89PNG\r\n\x1a\n" or data[:2] == b"\xff\xd8", "not an image"

    if data[:8] == b"\x89PNG\r\n\x1a\n":
        w, h = struct.unpack(">II", data[16:24])
        print(f"\n  image {w}x{h}")
        # The whole point of using this model for stills: DoP has no aspect
        # parameter, so shorts are decided here or not at all.
        assert h > w, f"asked for 9:16 and got {w}x{h}"


def test_a_clip_really_renders():
    """~6 Higgsfield credits (about $0.36). Takes 3-6 minutes."""
    _require_key()
    import time

    from app.providers import _higgsfield_image_sync, _higgsfield_video_sync

    still = _higgsfield_image_sync("a calm ocean at dawn, cinematic", aspect="16:9")
    t0 = time.time()
    url = _higgsfield_video_sync(
        "slow dolly in, shallow depth of field", still, "higgsfield-ai/dop/lite"
    )
    print(f"\n  clip in {time.time() - t0:.0f}s -> {url[:70]}")
    assert url.startswith("http")


def test_the_director_is_really_claude_when_a_key_is_present():
    """Costs a few cents of Anthropic tokens, no Higgsfield credits."""
    if not os.getenv("ANTHROPIC_API_KEY"):
        pytest.skip("ANTHROPIC_API_KEY not set")
    import asyncio

    from app.planner import ClaudeScenarioPlanner

    plan = asyncio.run(
        ClaudeScenarioPlanner().plan("a cat chasing a butterfly through cherry blossoms", 30, "standard")
    )
    print(f"\n  {len(plan.scenes)} scenes: {[s.heading for s in plan.scenes][:3]}")
    assert plan.scenes, "the director returned no scenes"
    assert all(s.prompt.strip() for s in plan.scenes)

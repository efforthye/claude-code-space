import pytest

"""Stage 1 of the staged flow: the beat sheet, and the gate in front of money.

The gate is the feature. Everything here exists so that an unreviewed plan
cannot turn into a paid render — at $0.384 a scene, a ten-minute mistake is $23.
"""

from fastapi.testclient import TestClient

from app import segments as seg
from app.main import app
from app.planner import Scene, Screenplay
from app.schemas import Segment

client = TestClient(app)

# Premium gating on, without touching the frozen settings instance.
_GATED = type("S", (), {"premium_gating": True})()


def _job(seconds: int = 60) -> str:
    r = client.post("/v1/jobs", json={"prompt": "a lighthouse at dusk", "seconds": seconds})
    assert r.status_code == 201, r.text
    return r.json()["id"]


def _screenplay(n: int) -> Screenplay:
    return Screenplay(
        title="t",
        logline="l",
        style="s",
        scenes=[
            Scene(index=i, heading=f"beat {i}", prompt=f"prompt {i}", seconds=10) for i in range(n)
        ],
    )


# --- laying a screenplay onto a timeline ------------------------------------


def test_segments_cover_the_whole_requested_duration():
    step = int(seg.segment_seconds())
    out = seg.segments_from_screenplay(_screenplay(3), seconds=60)
    assert len(out) == 60 // step
    assert out[0].startSec == 0 and out[0].endSec == step
    assert out[-1].endSec == 60
    # Contiguous, no gaps or overlaps — the film is the timeline.
    for a, b in zip(out, out[1:]):
        assert a.endSec == b.startSec


def test_a_short_screenplay_cycles_to_fill_the_length():
    # The user asked for a duration; scenes are repeated rather than the film
    # being cut short, matching what the worker already does with scenePrompts.
    out = seg.segments_from_screenplay(_screenplay(2), seconds=50)
    assert len(out) == 50 // int(seg.segment_seconds())
    assert out[0].prompt == out[2].prompt == out[4].prompt == "prompt 0"


def test_a_final_partial_slice_is_not_padded_past_the_duration():
    # A duration that is not a whole number of clips ends on a short one rather
    # than running past what the user asked for.
    step = int(seg.segment_seconds())
    seconds = step * 2 + 1
    out = seg.segments_from_screenplay(_screenplay(1), seconds=seconds)
    assert [(s.startSec, s.endSec) for s in out] == [
        (0, step),
        (step, step * 2),
        (step * 2, seconds),
    ]


def test_the_beat_sheet_describes_the_clips_that_will_actually_be_rendered():
    """The invariant that was broken until 2026-08-01.

    SEGMENT_SECONDS was hard-coded to 10 while the renderer's clip length came
    from the backend — two seconds on ComfyUI, five on Higgsfield. A ten-second
    short was therefore planned as ONE beat covering the whole film and rendered
    as several clips, so what the user approved was not what got made.
    """
    from app.catalog import clips_for_duration

    for seconds in (10, 30, 60, 180):
        beats = seg.segments_from_screenplay(_screenplay(3), seconds=seconds)
        assert len(beats) == clips_for_duration(seconds), seconds


def test_no_scenes_means_no_segments_rather_than_a_crash():
    assert seg.segments_from_screenplay(_screenplay(0), seconds=60) == []


# --- the gate ---------------------------------------------------------------


def test_stage_is_complete_needs_every_segment():
    segs = [Segment(index=i, startSec=i * 10, endSec=i * 10 + 10) for i in range(3)]
    assert not seg.stage_is_complete(segs, "approved")
    for s in segs[:2]:
        s.status = "approved"
    assert not seg.stage_is_complete(segs, "approved")
    segs[2].status = "approved"
    assert seg.stage_is_complete(segs, "approved")


def test_stage_is_complete_accepts_having_gone_further():
    # A segment already rendered obviously clears the "approved" gate.
    segs = [Segment(index=0, startSec=0, endSec=10, status="rendered")]
    assert seg.stage_is_complete(segs, "approved")


def test_an_empty_beat_sheet_never_clears_a_gate():
    assert not seg.stage_is_complete([], "approved")


# --- the endpoints ----------------------------------------------------------


def test_planning_beats_produces_a_reviewable_timeline():
    job_id = _job(60)
    r = client.post(f"/v1/jobs/{job_id}/beats", json={"prompt": "a lighthouse at dusk"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["stage"] == "beats"
    from app.catalog import clips_for_duration

    assert len(body["segments"]) == clips_for_duration(60)
    assert all(s["status"] == "draft" for s in body["segments"])
    assert body["segments"][0]["text"]


def test_the_gate_refuses_to_advance_while_a_beat_is_unapproved():
    job_id = _job(30)
    client.post(f"/v1/jobs/{job_id}/beats", json={"prompt": "x"})
    r = client.post(f"/v1/jobs/{job_id}/advance")
    assert r.status_code == 409
    assert "approve every beat" in r.json()["detail"]


def test_approving_everything_opens_the_next_stage():
    job_id = _job(30)
    n = len(client.post(f"/v1/jobs/{job_id}/beats", json={"prompt": "x"}).json()["segments"])
    for i in range(n):
        assert client.post(f"/v1/jobs/{job_id}/segments/{i}/approve").status_code == 200
    r = client.post(f"/v1/jobs/{job_id}/advance")
    assert r.status_code == 200, r.text
    assert r.json()["stage"] == "stills"


def test_rewriting_one_beat_leaves_the_others_alone_and_un_approves_it():
    job_id = _job(30)
    before = client.post(f"/v1/jobs/{job_id}/beats", json={"prompt": "x"}).json()["segments"]
    client.post(f"/v1/jobs/{job_id}/segments/1/approve")

    r = client.post(
        f"/v1/jobs/{job_id}/segments/1/rewrite", json={"instruction": "make it rain"}
    )
    assert r.status_code == 200, r.text
    after = r.json()["segments"]

    # Neighbours untouched — that is the point of per-segment editing.
    assert after[0]["text"] == before[0]["text"]
    assert after[2]["text"] == before[2]["text"]
    # A rewrite invalidates its own approval, so the gate re-closes.
    assert after[1]["status"] == "draft"
    assert after[1]["rewrites"] == 1


def test_rewriting_a_segment_that_does_not_exist_is_a_404():
    job_id = _job(30)
    client.post(f"/v1/jobs/{job_id}/beats", json={"prompt": "x"})
    r = client.post(f"/v1/jobs/{job_id}/segments/99/rewrite", json={"instruction": "x"})
    assert r.status_code == 404


def test_legacy_jobs_are_untouched_by_any_of_this():
    # Jobs created the old way go straight to rendering, exactly as before.
    r = client.post("/v1/jobs", json={"prompt": "old style", "seconds": 20})
    assert r.status_code == 201
    assert r.json()["stage"] == "clips"
    assert r.json()["segments"] == []


# --- stage 2: stills --------------------------------------------------------


def _approved_job(seconds: int = 30) -> tuple[str, int]:
    """A job whose beat sheet is approved and which sits at the stills stage."""
    job_id = _job(seconds)
    n = len(client.post(f"/v1/jobs/{job_id}/beats", json={"prompt": "x"}).json()["segments"])
    for i in range(n):
        client.post(f"/v1/jobs/{job_id}/segments/{i}/approve")
    assert client.post(f"/v1/jobs/{job_id}/advance").json()["stage"] == "stills"
    return job_id, n


def test_stills_render_for_every_segment():
    job_id, n = _approved_job()
    r = client.post(f"/v1/jobs/{job_id}/stills")
    assert r.status_code == 200, r.text
    segs = r.json()["segments"]
    assert len(segs) == n
    assert all(s["imageKey"] for s in segs)
    assert all(s["status"] == "imaged" for s in segs)
    assert all(s["imageRuns"] == 1 for s in segs)


def test_stills_refuse_to_run_at_the_wrong_stage():
    job_id = _job(30)
    client.post(f"/v1/jobs/{job_id}/beats", json={"prompt": "x"})
    r = client.post(f"/v1/jobs/{job_id}/stills")  # still at "beats"
    assert r.status_code == 409


def test_the_image_gate_refuses_until_every_still_is_approved():
    job_id, n = _approved_job()
    client.post(f"/v1/jobs/{job_id}/stills")
    r = client.post(f"/v1/jobs/{job_id}/advance")
    assert r.status_code == 409
    assert "approve every still" in r.json()["detail"]

    for i in range(n):
        client.post(f"/v1/jobs/{job_id}/segments/{i}/approve")
    r = client.post(f"/v1/jobs/{job_id}/advance")
    assert r.status_code == 200, r.text
    assert r.json()["stage"] == "clips"


def test_reimaging_one_segment_leaves_the_rest_untouched():
    job_id, _ = _approved_job()
    before = client.post(f"/v1/jobs/{job_id}/stills").json()["segments"]
    for i in range(len(before)):
        client.post(f"/v1/jobs/{job_id}/segments/{i}/approve")

    r = client.post(f"/v1/jobs/{job_id}/segments/1/reimage")
    assert r.status_code == 200, r.text
    after = r.json()["segments"]

    assert after[0]["imageRuns"] == 1 and after[2]["imageRuns"] == 1
    assert after[1]["imageRuns"] == 2
    # A fresh image is unreviewed again, so the gate re-closes on it.
    assert after[1]["status"] == "imaged"
    assert after[0]["status"] == "imageApproved"

    assert client.post(f"/v1/jobs/{job_id}/advance").status_code == 409


def test_approve_means_the_right_thing_at_each_stage():
    job_id, _ = _approved_job()
    segs = client.post(f"/v1/jobs/{job_id}/stills").json()["segments"]
    assert segs[0]["status"] == "imaged"
    after = client.post(f"/v1/jobs/{job_id}/segments/0/approve").json()["segments"]
    # Same endpoint, different meaning — the app should not have to know.
    assert after[0]["status"] == "imageApproved"


# --- stage 3: continuity ----------------------------------------------------


def test_the_first_clip_starts_from_its_own_still():
    segs = [
        Segment(index=0, startSec=0, endSec=10, imageKey="a.png"),
        Segment(index=1, startSec=10, endSec=20, imageKey="b.png"),
    ]
    from app.storage import get_storage

    get_storage().save("a.png", b"still-a")
    # No predecessor, so there is nothing to be continuous with.
    assert seg.continuity_source(segs, 0) == b"still-a"


def test_a_later_clip_prefers_the_previous_clip_last_frame(monkeypatch):
    segs = [
        Segment(index=0, startSec=0, endSec=10, imageKey="a.png", clipKey="c0.mp4"),
        Segment(index=1, startSec=10, endSec=20, imageKey="b.png"),
    ]
    from app.storage import get_storage

    get_storage().save("b.png", b"still-b")
    monkeypatch.setattr(seg, "last_frame_of", lambda key: b"frame-from-c0")
    # This is what makes the cut continuous instead of a jump.
    assert seg.continuity_source(segs, 1) == b"frame-from-c0"


def test_it_falls_back_to_the_still_when_the_frame_cannot_be_read(monkeypatch):
    segs = [
        Segment(index=0, startSec=0, endSec=10, clipKey="missing.mp4"),
        Segment(index=1, startSec=10, endSec=20, imageKey="b2.png"),
    ]
    from app.storage import get_storage

    get_storage().save("b2.png", b"still-b2")
    monkeypatch.setattr(seg, "last_frame_of", lambda key: None)
    # A mock-backend clip has no bytes; rendering must still proceed.
    assert seg.continuity_source(segs, 1) == b"still-b2"


def test_re_rendering_invalidates_only_the_next_clip():
    segs = [
        Segment(index=i, startSec=i * 10, endSec=i * 10 + 10, clipKey=f"c{i}.mp4")
        for i in range(4)
    ]
    # Clip 2 started from clip 1's last frame, so only clip 2 is broken.
    # Clip 3 still follows clip 2's own frame — telling the user to redo
    # everything after would cost forty renders instead of one.
    assert seg.invalidated_by(segs, 1) == [2]


def test_nothing_is_invalidated_at_the_end_or_before_rendering():
    segs = [Segment(index=i, startSec=i * 10, endSec=i * 10 + 10) for i in range(3)]
    assert seg.invalidated_by(segs, 2) == []  # last segment
    assert seg.invalidated_by(segs, 0) == []  # next one not rendered yet


def test_last_frame_of_a_missing_clip_is_none_rather_than_an_error():
    assert seg.last_frame_of("nope/does-not-exist.mp4") is None


# --- stage 3: money ---------------------------------------------------------


def _clips_job(monkeypatch, seconds: int = 30):
    """A job at the clips gate, with the renderer stubbed so no money moves."""
    job_id, n = _approved_job(seconds)
    client.post(f"/v1/jobs/{job_id}/stills")
    for i in range(n):
        client.post(f"/v1/jobs/{job_id}/segments/{i}/approve")
    client.post(f"/v1/jobs/{job_id}/advance")

    async def fake_render(job, segs, index, model=None):
        out = segs[index].model_copy()
        out.clipKey = f"clips/{job}/{index:04d}.mp4"
        out.status = "rendered"
        out.clipRuns = segs[index].clipRuns + 1
        return out

    monkeypatch.setattr(seg, "render_segment_clip", fake_render)
    return job_id, n


def test_the_quote_says_what_it_costs_and_what_a_stop_costs(monkeypatch):
    job_id, n = _clips_job(monkeypatch)
    q = client.get(f"/v1/jobs/{job_id}/clip-quote").json()
    assert q["remaining"] == n
    assert q["perClipCredits"] > 0
    assert q["remainingCredits"] == q["perClipCredits"] * n
    assert q["spentCredits"] == 0
    # An ETA that assumed parallelism would understate it: continuity chains
    # render one at a time.
    assert q["etaSeconds"] >= n


def test_stop_on_reject_renders_exactly_one_clip(monkeypatch):
    job_id, n = _clips_job(monkeypatch)
    r = client.post(f"/v1/jobs/{job_id}/clips", json={"mode": "stopOnReject"})
    assert r.status_code == 200, r.text

    import asyncio, time

    for _ in range(40):
        segs = client.get(f"/v1/jobs/{job_id}").json()["segments"]
        if sum(1 for s in segs if s["clipKey"]) >= 1:
            break
        time.sleep(0.05)
    segs = client.get(f"/v1/jobs/{job_id}").json()["segments"]
    rendered = [s for s in segs if s["clipKey"]]
    # One clip, then it waits for a verdict — the point of the mode.
    assert len(rendered) == 1, [s["status"] for s in segs]


def test_render_all_keeps_going_to_the_end(monkeypatch):
    job_id, n = _clips_job(monkeypatch)
    client.post(f"/v1/jobs/{job_id}/clips", json={"mode": "renderAll"})

    import time

    for _ in range(60):
        segs = client.get(f"/v1/jobs/{job_id}").json()["segments"]
        if all(s["clipKey"] for s in segs):
            break
        time.sleep(0.05)
    segs = client.get(f"/v1/jobs/{job_id}").json()["segments"]
    assert all(s["clipKey"] for s in segs), [s["status"] for s in segs]


def test_stop_is_recorded_and_reports_what_was_spent(monkeypatch):
    job_id, _ = _clips_job(monkeypatch)
    r = client.post(f"/v1/jobs/{job_id}/stop")
    assert r.status_code == 200
    assert r.json()["stopped"] is True
    assert "spentCredits" in r.json()
    # The flag persists, so the renderer sees it between clips.
    assert client.get(f"/v1/jobs/{job_id}").json()["stopRequested"] is True


def test_a_stopped_job_renders_nothing_further(monkeypatch):
    job_id, _ = _clips_job(monkeypatch)
    client.post(f"/v1/jobs/{job_id}/stop")
    client.post(f"/v1/jobs/{job_id}/clips", json={"mode": "renderAll"})

    import time

    time.sleep(0.3)
    segs = client.get(f"/v1/jobs/{job_id}").json()["segments"]
    assert not any(s["clipKey"] for s in segs)


def test_clips_refuse_before_the_stills_gate_is_cleared():
    job_id = _job(30)
    client.post(f"/v1/jobs/{job_id}/beats", json={"prompt": "x"})
    r = client.post(f"/v1/jobs/{job_id}/clips", json={"mode": "renderAll"})
    assert r.status_code == 409


def test_reclip_refuses_an_anonymous_caller(monkeypatch):
    # A re-render is a fresh paid clip; without a session there is nobody to
    # bill, and rendering anyway was a free tunnel around the charge.
    job_id, _ = _clips_job(monkeypatch)
    assert client.post(f"/v1/jobs/{job_id}/segments/0/reclip").status_code == 401


def test_reclip_charges_the_signed_in_caller(monkeypatch):
    from app import catalog
    from app.auth import store as users

    job_id, _ = _clips_job(monkeypatch)
    user = users.create_user(
        "reclip-payer@example.com", "R", provider="email", password="pw12345678"
    )
    token = users.create_session(user["id"])
    before = int(users.users[user["id"]]["credits"])

    r = client.post(
        f"/v1/jobs/{job_id}/segments/0/reclip", headers={"X-Mayo-Session": token}
    )
    assert r.status_code == 200, r.text
    per_clip = catalog.credits_per_scene(catalog.tier_by_id("standard"))
    assert int(users.users[user["id"]]["credits"]) == before - per_clip
    assert client.get(f"/v1/jobs/{job_id}").json()["spentCredits"] == per_clip


def test_a_failed_clip_render_refunds_the_charge(monkeypatch):
    # The charge lands before the render is submitted; when the render then
    # fails, the money must come back and the job must say why it stopped.
    import asyncio

    from app.auth import store as users

    job_id, _ = _clips_job(monkeypatch)

    async def boom(job, segs, index, model=None):
        raise RuntimeError("provider fell over")

    monkeypatch.setattr(seg, "render_segment_clip", boom)
    user = users.create_user(
        "refund-clip@example.com", "R", provider="email", password="pw12345678"
    )
    before = int(users.users[user["id"]]["credits"])

    asyncio.run(seg.render_clips(job_id, user["id"]))

    assert int(users.users[user["id"]]["credits"]) == before  # charged, then refunded
    job = client.get(f"/v1/jobs/{job_id}").json()
    assert job["spentCredits"] == 0
    assert job["failureReason"] and "실패" in job["failureReason"]
    assert not any(s["clipKey"] for s in job["segments"])


def test_per_scene_price_follows_the_tier():
    from app import catalog

    draft = catalog.credits_per_scene(catalog.tier_by_id("draft"))
    premium = catalog.credits_per_scene(catalog.tier_by_id("premium"))
    assert premium > draft >= 1


# --- entering the staged flow -----------------------------------------------


def test_a_staged_job_starts_at_the_beats_gate_and_costs_nothing():
    r = client.post(
        "/v1/jobs", json={"prompt": "a lighthouse", "seconds": 30, "staged": True}
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["stage"] == "beats"
    # Nothing is spent until the clips stage — charging here would defeat the
    # gates the staged flow exists to provide.
    assert body["chargedCredits"] in (None, 0)
    assert body["spentCredits"] == 0


def test_a_plain_job_still_renders_in_one_pass():
    r = client.post("/v1/jobs", json={"prompt": "a lighthouse", "seconds": 30})
    assert r.status_code == 201
    assert r.json()["stage"] == "clips"


def test_planning_is_free_but_every_external_render_is_gated(monkeypatch):
    # The FREE part of the staged flow is the text: planning, reviewing and
    # rewriting beats. Everything that hits the external provider — stills,
    # reimage, clips, reclip — spends the owner's provider money, so all of it
    # sits behind the premium gate. A free stills "preview" that ran real image
    # generations was a paywall bypass, not a feature.
    # settings is a frozen dataclass, so the router's reference is swapped
    # wholesale — the pattern test_gating.py already uses.
    from app.auth import store as users
    from app.routers import jobs as jobs_router

    monkeypatch.setattr(jobs_router, "settings", _GATED)
    monkeypatch.setattr(jobs_router.runtime, "generation_backend", lambda: "external")

    # This test is about WHERE the paywall sits, not about image generation —
    # stub the renderer so it does not reach for a provider SDK.
    async def fake_image(job_id, segment, style=""):
        out = segment.model_copy()
        out.imageKey = f"stills/{job_id}/{segment.index}.png"
        out.status = "imaged"
        out.imageRuns = segment.imageRuns + 1
        return out

    monkeypatch.setattr(seg, "render_segment_image", fake_image)

    r = client.post("/v1/jobs", json={"prompt": "x", "seconds": 20, "staged": True})
    assert r.status_code == 201, r.text
    job_id = r.json()["id"]

    # Planning and review cost nothing and stay open.
    assert client.post(f"/v1/jobs/{job_id}/beats", json={"prompt": "x"}).status_code == 200
    n = len(client.get(f"/v1/jobs/{job_id}").json()["segments"])
    for i in range(n):
        client.post(f"/v1/jobs/{job_id}/segments/{i}/approve")
    assert client.post(f"/v1/jobs/{job_id}/advance").status_code == 200

    # Free/anonymous callers bounce off every render endpoint.
    assert client.post(f"/v1/jobs/{job_id}/stills").status_code == 402
    assert client.post(f"/v1/jobs/{job_id}/segments/0/reimage").status_code == 402

    # A premium account passes and renders the stills.
    vip = users.create_user(
        "staged-vip@example.com", "V", provider="email", password="pw12345678"
    )
    users.set_plan(vip["id"], "pro")
    vip_h = {"X-Mayo-Session": users.create_session(vip["id"])}
    assert client.post(f"/v1/jobs/{job_id}/stills", headers=vip_h).status_code == 200
    for i in range(n):
        client.post(f"/v1/jobs/{job_id}/segments/{i}/approve")
    client.post(f"/v1/jobs/{job_id}/advance")

    # The clips stage keeps its gate for the free caller.
    r = client.post(f"/v1/jobs/{job_id}/clips", json={"mode": "renderAll"})
    assert r.status_code == 402, r.text


def test_a_one_pass_job_is_still_gated_at_creation(monkeypatch):
    from app.routers import jobs as jobs_router

    monkeypatch.setattr(jobs_router, "settings", _GATED)
    monkeypatch.setattr(jobs_router.runtime, "generation_backend", lambda: "external")
    r = client.post("/v1/jobs", json={"prompt": "x", "seconds": 20})
    assert r.status_code == 402


# --- the reviewable plan (2026-08-01) ---------------------------------------


def test_the_review_text_is_the_beat_not_the_slug():
    """What the user approves has to describe the shot, not label it.

    `text` fell back to `heading` — a four-word slug like "Dawn over the
    harbour" — so the beat sheet was a list of labels and reviewing it told you
    nothing about what would be made.
    """
    from app.planner import Scene, Screenplay

    sp = Screenplay(
        title="t",
        logline="l",
        style="s",
        scenes=[
            Scene(
                index=0,
                heading="Dawn over the harbour",
                beat="등대지기가 바람을 밀고 문을 연다. 불빛이 그의 얼굴을 스친다.",
                prompt="35mm anamorphic, f/2.8 ...",
                seconds=5,
            )
        ],
    )
    out = seg.segments_from_screenplay(sp, seconds=int(seg.segment_seconds()))
    assert out[0].text.startswith("등대지기"), out[0].text


def test_moments_are_rebased_onto_the_films_clock():
    """The director writes moments inside its own scene; the sheet shows the film."""
    from app.planner import Moment, Scene, Screenplay

    step = int(seg.segment_seconds())
    sp = Screenplay(
        title="t",
        logline="l",
        style="s",
        scenes=[
            Scene(
                index=0,
                heading="h",
                beat="b",
                timeline=[Moment(fromSec=0, toSec=1, action="문이 열린다")],
                prompt="p",
                seconds=step,
            )
        ],
    )
    out = seg.segments_from_screenplay(sp, seconds=step * 2)
    # Second segment starts at `step`, so its first moment must too.
    assert out[1].timeline[0].fromSec == step
    # And nothing may run past the slice it belongs to.
    for s_ in out:
        for m in s_.timeline:
            assert s_.startSec <= m.fromSec and m.toSec <= s_.endSec


def test_a_second_render_start_is_refused_while_one_is_in_flight():
    """Pressing the button twice must not bill the film twice.

    A clip takes minutes, and render_clips picks work by looking for segments
    with no clipKey — so two loops started seconds apart both see the same empty
    segment, both charge for it, and both submit it. The owner hit this: the
    button gave no feedback, so they pressed it five times and five renderers
    billed the same film in parallel.
    """
    seg._rendering.add("j-busy")
    try:
        assert seg.is_rendering_clips("j-busy")
        assert not seg.is_rendering_clips("j-idle")
    finally:
        seg._rendering.discard("j-busy")
    assert not seg.is_rendering_clips("j-busy")


def test_the_in_flight_flag_clears_even_when_the_render_raises():
    """A crashed render must not lock the job out of ever rendering again."""
    import asyncio

    async def boom(job_id, owner_id=None):
        raise RuntimeError("provider exploded")

    original = seg._render_clips
    seg._render_clips = boom
    try:
        with pytest.raises(RuntimeError):
            asyncio.run(seg.render_clips("j-crash"))
    finally:
        seg._render_clips = original
    assert not seg.is_rendering_clips("j-crash")


def test_approving_everything_never_approves_what_does_not_exist():
    """A blanket approve must not mark un-rendered segments as reviewed.

    Approving is a claim about an artefact. Marking a segment imageApproved
    when no still was ever rendered would send a blank frame to the (paid)
    renderer.
    """
    from app.schemas import Segment

    drafted = Segment(index=0, startSec=0, endSec=5, text="t", prompt="p", status="draft")
    imaged = drafted.model_copy(update={"imageKey": "k", "status": "imaged"})
    clipped = imaged.model_copy(update={"clipKey": "c", "status": "rendered"})

    # A beat always exists, so it can always be approved.
    assert seg.can_reach(drafted, "approved")
    # A still that was never rendered cannot be.
    assert not seg.can_reach(drafted, "imageApproved")
    assert seg.can_reach(imaged, "imageApproved")
    assert not seg.can_reach(imaged, "clipApproved")
    assert seg.can_reach(clipped, "clipApproved")

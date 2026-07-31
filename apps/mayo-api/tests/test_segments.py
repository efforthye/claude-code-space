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
    out = seg.segments_from_screenplay(_screenplay(3), seconds=60)
    assert len(out) == 6
    assert out[0].startSec == 0 and out[0].endSec == 10
    assert out[-1].endSec == 60
    # Contiguous, no gaps or overlaps — the film is the timeline.
    for a, b in zip(out, out[1:]):
        assert a.endSec == b.startSec


def test_a_short_screenplay_cycles_to_fill_the_length():
    # The user asked for a duration; scenes are repeated rather than the film
    # being cut short, matching what the worker already does with scenePrompts.
    out = seg.segments_from_screenplay(_screenplay(2), seconds=50)
    assert len(out) == 5
    assert out[0].prompt == out[2].prompt == out[4].prompt == "prompt 0"


def test_a_final_partial_slice_is_not_padded_past_the_duration():
    out = seg.segments_from_screenplay(_screenplay(1), seconds=25)
    assert [(s.startSec, s.endSec) for s in out] == [(0, 10), (10, 20), (20, 25)]


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
    assert len(body["segments"]) == 6
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

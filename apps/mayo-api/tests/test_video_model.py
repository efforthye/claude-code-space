"""The chosen cinematic variant must survive all the way to the renderer.

A variant that is accepted by the API, stored on the job, and then ignored by
the worker is the worst kind of bug here: the user pays for one model and
silently gets another.
"""

from fastapi.testclient import TestClient

from app import catalog
from app.main import app
from app.providers import ExternalModelBackend, get_model_backend

client = TestClient(app)


def test_every_offered_variant_maps_to_a_real_application_id():
    # The three ids verified against the live API on 2026-08-01. Offering a
    # variant in the catalog that has no application id would fail only at
    # render time, after the user has been charged.
    offered = [m.id for m in catalog.MODELS if m.kind == "video" and m.id.startswith("dop-")]
    assert offered, "no cinematic variants offered"
    for model_id in offered:
        app_id = catalog.higgsfield_app_for(model_id)
        assert app_id and app_id.startswith("higgsfield-ai/dop/"), model_id


def test_unknown_variant_falls_back_to_the_default_rather_than_breaking():
    assert catalog.higgsfield_app_for("nonsense") is None
    assert catalog.higgsfield_app_for("") is None
    assert catalog.higgsfield_app_for(None) is None


def test_choice_reaches_the_backend(monkeypatch):
    from app import runtime

    monkeypatch.setattr(runtime, "generation_backend", lambda: "external")
    backend = get_model_backend("9:16", "dop-lite")
    assert isinstance(backend, ExternalModelBackend)
    assert backend.video_model == "dop-lite"
    assert backend.aspect == "9:16"


def test_job_remembers_the_variant_it_was_created_with():
    r = client.post(
        "/v1/jobs",
        json={"prompt": "a lighthouse at dusk", "seconds": 10, "videoModel": "dop-turbo"},
    )
    assert r.status_code == 201, r.text
    assert r.json()["videoModel"] == "dop-turbo"


def test_eta_accounts_for_the_concurrency_cap():
    # Higgsfield refuses a 5th simultaneous request, so 8 scenes are two rounds,
    # not one. An ETA that assumed unlimited parallelism would be half the truth.
    per_scene = catalog.HIGGSFIELD_SECONDS_PER_SCENE["dop-lite"]
    assert catalog.eta_seconds(4, "dop-lite", concurrency=4) == per_scene
    assert catalog.eta_seconds(8, "dop-lite", concurrency=4) == per_scene * 2
    assert catalog.eta_seconds(5, "dop-lite", concurrency=4) == per_scene * 2

    # A slower variant must estimate longer for the same film.
    assert catalog.eta_seconds(6, "dop-standard") > catalog.eta_seconds(6, "dop-lite")


def test_estimate_returns_money_and_scene_count():
    r = client.post("/v1/jobs/estimate", json={"prompt": "x", "seconds": 60, "tier": "premium"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["scenes"] == 6
    # Pay-as-you-go: the first minute sits entirely in the top band.
    assert body["usd"] == catalog.payg_usd(6)
    assert body["usd"] > 0


def test_payg_bands_are_marginal_and_never_dip_below_the_2x_floor():
    # Banded like income tax: the first six scenes always cost the top rate.
    assert catalog.payg_usd(1) == 3.00
    assert catalog.payg_usd(6) == 18.00
    assert catalog.payg_usd(7) == 20.00  # 6 x $3.00 + 1 x $2.00

    # Measured scene cost, ADR 0017 v3.
    scene_cost = 5.83 * 0.0625 + 0.02
    for scenes in (1, 6, 60, 180, 360, 1000):
        assert catalog.payg_usd(scenes) / (scenes * scene_cost) >= 2.0, scenes

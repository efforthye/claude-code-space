"""Aspect-ratio presets — jobs really render at the chosen shape."""

from fastapi.testclient import TestClient

from app.main import app
from app.providers import ASPECT_SIZES, ComfyUIModelBackend, size_for_aspect

client = TestClient(app)


def test_aspect_sizes_are_valid_latents():
    # SD latent constraint: every preset dimension is a multiple of 8.
    for aspect, (w, h) in ASPECT_SIZES.items():
        assert w % 8 == 0 and h % 8 == 0, aspect
    assert size_for_aspect("9:16") == (360, 640)
    assert size_for_aspect(None) is None and size_for_aspect("weird") is None


def test_job_carries_aspect_and_validates():
    r = client.post(
        "/v1/jobs", json={"prompt": "shorts test", "seconds": 4, "tier": "draft", "aspect": "9:16"}
    )
    assert r.status_code == 201 and r.json()["aspect"] == "9:16"
    # default stays 16:9; junk is rejected by the schema
    d = client.post("/v1/jobs", json={"prompt": "d", "seconds": 4, "tier": "draft"})
    assert d.json()["aspect"] == "16:9"
    bad = client.post(
        "/v1/jobs", json={"prompt": "b", "seconds": 4, "tier": "draft", "aspect": "3:7"}
    )
    assert bad.status_code == 422


def test_comfy_workflow_gets_aspect_size(monkeypatch, tmp_path):
    import json

    wf_path = tmp_path / "wf.json"
    wf_path.write_text(json.dumps({
        "5": {"inputs": {"width": 512, "height": 512, "batch_size": 16}},
        "6": {"inputs": {"text": ""}},
    }))
    from app.config import settings as _s

    backend = ComfyUIModelBackend(size=size_for_aspect("9:16"))
    monkeypatch.setattr(backend, "_workflow_path", lambda: str(wf_path))
    wf = backend._build_prompt("a scene", 0)
    assert wf["5"]["inputs"]["width"] == 360 and wf["5"]["inputs"]["height"] == 640

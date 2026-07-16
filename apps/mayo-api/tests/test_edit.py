from app.compose import _key_from_url
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_key_from_url():
    assert _key_from_url("/v1/media/films/abc.mp4") == "films/abc.mp4"
    assert _key_from_url(None) is None
    assert _key_from_url("/other/path") is None


def test_edit_no_usable_clips_400():
    # Seed videos (v1..v3) have no url -> not editable -> 400, no ffmpeg reached.
    res = client.post("/v1/edit", json={"title": "x", "clips": [{"videoId": "v1"}]})
    assert res.status_code == 400


def test_edit_requires_clips():
    res = client.post("/v1/edit", json={"title": "x", "clips": []})
    assert res.status_code == 422

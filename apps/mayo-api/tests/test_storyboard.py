"""Storyboard previews — per-scene stills rendered before the video job."""

import time

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_storyboard_renders_per_scene_images():
    # Context-managed client: keeps a live event loop between requests so the
    # storyboard's background render task actually runs.
    with TestClient(app) as c:
        r = c.post(
            "/v1/director/storyboard",
            json={"scenePrompts": ["a cat on a roof", "the cat jumps"], "stylePrompt": "watercolor"},
        )
        assert r.status_code == 201
        board = r.json()
        assert board["status"] == "generating"
        assert board["total"] == 2

        # mock backend: one tick (0.05s in tests) per scene
        deadline = time.time() + 5
        while time.time() < deadline:
            board = c.get(f"/v1/director/storyboard/{board['id']}").json()
            if board["status"] != "generating":
                break
            time.sleep(0.05)
        assert board["status"] == "done"
        assert board["done"] == 2
        assert all(p and p.startswith("/v1/media/storyboards/") for p in board["images"])

        # the placeholder files are real, servable media
        media = c.get(board["images"][0])
        assert media.status_code == 200
        assert media.content[:8] == b"\x89PNG\r\n\x1a\n"


def test_storyboard_unknown_id_404():
    assert client.get("/v1/director/storyboard/sb_nope").status_code == 404


def test_storyboard_requires_scenes():
    r = client.post("/v1/director/storyboard", json={"scenePrompts": []})
    assert r.status_code == 422

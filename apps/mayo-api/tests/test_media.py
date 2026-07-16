from fastapi.testclient import TestClient

from app.main import app
from app.storage import get_storage

client = TestClient(app)


def test_media_serves_full_and_range():
    get_storage().save("films/_test.mp4", b"0123456789")

    full = client.get("/v1/media/films/_test.mp4")
    assert full.status_code == 200
    assert full.content == b"0123456789"
    assert full.headers.get("accept-ranges") == "bytes"

    part = client.get("/v1/media/films/_test.mp4", headers={"Range": "bytes=2-4"})
    assert part.status_code == 206
    assert part.content == b"234"
    assert part.headers.get("content-range") == "bytes 2-4/10"


def test_media_missing_is_404():
    assert client.get("/v1/media/films/does-not-exist.mp4").status_code == 404

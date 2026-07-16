from fastapi.testclient import TestClient

from app.compose import _drawtext_filter, _escape_drawtext
from app.main import app
from app.storage import get_storage


def test_audio_upload_roundtrip():
    client = TestClient(app)
    r = client.post(
        "/v1/edit/audio", content=b"fake-m4a-bytes", headers={"Content-Type": "audio/mp4"}
    )
    assert r.status_code == 201
    key = r.json()["key"]
    assert key.startswith("edits/audio-") and key.endswith(".m4a")
    assert get_storage().read(key) == b"fake-m4a-bytes"

    empty = client.post("/v1/edit/audio", content=b"", headers={"Content-Type": "audio/mp4"})
    assert empty.status_code == 400


def test_escape_drawtext_handles_special_chars():
    out = _escape_drawtext("a:b'c\\d")
    # colons and backslashes escaped; apostrophe swapped for a typographic one
    assert "\\:" in out
    assert "\\\\" in out
    assert "'" not in out


def test_drawtext_filter_positions_and_text():
    f = _drawtext_filter("안녕 mayo", "top")
    assert f.startswith("drawtext=")
    assert "text='안녕 mayo'" in f
    assert "h*0.08" in f  # top position
    assert "boxcolor=black@0.5" in f
    # centre + bottom map to different y expressions
    assert "(h-text_h)/2" in _drawtext_filter("x", "center")
    assert "h-text_h-h*0.08" in _drawtext_filter("x", "bottom")

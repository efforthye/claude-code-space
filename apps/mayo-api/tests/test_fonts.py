"""Caption fonts — language detection + cached download with graceful fallback."""

import os

from app import fonts


def test_language_detection():
    assert fonts._lang_of("안녕하세요") == "ko"
    assert fonts._lang_of("こんにちは") == "ja"
    assert fonts._lang_of("你好世界") == "zh"
    assert fonts._lang_of("hello world") == "latin"
    assert fonts._lang_of("hi 안녕") == "ko"  # first CJK script wins


def test_font_path_uses_cache_and_falls_back(monkeypatch, tmp_path):
    from app.config import settings

    # Pre-seed a "downloaded" font in the cache — no network needed.
    cache = os.path.join(settings.storage_local_path, "fonts")
    os.makedirs(cache, exist_ok=True)
    kr = os.path.join(cache, "NotoSansKR.ttf")
    with open(kr, "wb") as fh:
        fh.write(b"fake-font")
    assert fonts.font_path("auto", "안녕") == kr
    # title style covers Korean -> Black Han Sans; simulate its download failing
    # so it falls back to the cached per-language Noto.
    monkeypatch.setattr(
        fonts, "_fetch", lambda fn, url: kr if fn == "NotoSansKR.ttf" else None
    )
    assert fonts.font_path("title", "안녕") == kr


def test_drawtext_includes_resolved_font(monkeypatch):
    from app import compose

    monkeypatch.setattr("app.fonts.font_path", lambda style, text: "/tmp/fake.ttf")
    filt = compose._drawtext_filter("자막 테스트", "bottom", "auto")
    assert "fontfile=/tmp/fake.ttf" in filt and "drawtext=" in filt

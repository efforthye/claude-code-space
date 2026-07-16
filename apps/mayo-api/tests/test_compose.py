from app.compose import _drawtext_filter, _escape_drawtext


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

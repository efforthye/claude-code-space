"""Caption fonts — free, open-license fonts fetched on demand (editor drawtext).

The editor lets users pick a caption STYLE; the actual font file is chosen per
language (Hangul → Noto Sans KR, kana → JP, hanzi → SC, else Noto Sans) and
downloaded once from the Google Fonts repo (all OFL-licensed) into
<media>/fonts/. If a download fails, we fall back to the host font configured
in MAYO_EDIT_FONT — captions never break the render (compose retries without
filters anyway).
"""

from __future__ import annotations

import os
from typing import Optional

from .config import settings

_GF = "https://raw.githubusercontent.com/google/fonts/main/ofl"

# style -> language -> (filename, url). "auto"/gothic use per-language Noto;
# display styles fall back to gothic for scripts they don't cover.
_NOTO = {
    "ko": ("NotoSansKR.ttf", f"{_GF}/notosanskr/NotoSansKR%5Bwght%5D.ttf"),
    "ja": ("NotoSansJP.ttf", f"{_GF}/notosansjp/NotoSansJP%5Bwght%5D.ttf"),
    "zh": ("NotoSansSC.ttf", f"{_GF}/notosanssc/NotoSansSC%5Bwght%5D.ttf"),
    "latin": ("NotoSans.ttf", f"{_GF}/notosans/NotoSans%5Bwdth,wght%5D.ttf"),
}
_STYLES = {
    # Korean display faces (OFL): bold title face + handwriting.
    "title": ("BlackHanSans.ttf", f"{_GF}/blackhansans/BlackHanSans-Regular.ttf", {"ko", "latin"}),
    "hand": ("NanumPenScript.ttf", f"{_GF}/nanumpenscript/NanumPenScript-Regular.ttf", {"ko"}),
}


def _lang_of(text: str) -> str:
    for ch in text:
        if "가" <= ch <= "힣" or "ᄀ" <= ch <= "ᇿ":
            return "ko"
        if "぀" <= ch <= "ヿ":
            return "ja"
        if "一" <= ch <= "鿿":
            return "zh"
    return "latin"


def _fetch(filename: str, url: str) -> Optional[str]:
    """Local path of the cached font, downloading it on first use."""
    path = os.path.join(settings.storage_local_path, "fonts", filename)
    if os.path.exists(path) and os.path.getsize(path) > 0:
        return path
    try:
        import httpx

        resp = httpx.get(url, timeout=60, follow_redirects=True)
        resp.raise_for_status()
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "wb") as fh:
            fh.write(resp.content)
        return path
    except Exception:
        return None


def font_path(style: str, text: str) -> Optional[str]:
    """Best font file for a caption: requested style if it covers the text's
    script, else the language's Noto Sans, else the configured host font."""
    lang = _lang_of(text)
    if style in _STYLES:
        filename, url, scripts = _STYLES[style]
        if lang in scripts:
            path = _fetch(filename, url)
            if path:
                return path
    filename, url = _NOTO[lang]
    path = _fetch(filename, url)
    if path:
        return path
    if settings.edit_font and os.path.exists(settings.edit_font):
        return settings.edit_font
    return None

import asyncio
import json
import os
from types import SimpleNamespace

from app import providers as providers_mod
from app.providers import (
    ComfyUIModelBackend,
    ExternalModelBackend,
    MockModelBackend,
    get_model_backend,
)


def test_default_backend_is_mock():
    assert isinstance(get_model_backend(), MockModelBackend)


def test_comfy_backend_is_selected(monkeypatch):
    # Selection now reads the runtime backend (app-switchable), not settings.
    from app import runtime

    monkeypatch.setattr(runtime, "generation_backend", lambda: "comfy")
    assert isinstance(providers_mod.get_model_backend(), ComfyUIModelBackend)


def test_comfy_workflow_injects_prompt_and_seed():
    # The bundled workflow exists and the prompt/seed get injected into it.
    wf = ComfyUIModelBackend()._build_prompt("a neon city at night", 5)
    assert wf["6"]["inputs"]["text"] == "a neon city at night"
    assert wf["3"]["inputs"]["seed"] == 1005
    # Sanity: the workflow file is valid JSON on disk.
    path = ComfyUIModelBackend()._workflow_path()
    assert os.path.exists(path)
    json.load(open(path))


def test_mock_backend_renders_a_scene():
    result = asyncio.run(MockModelBackend().generate_scene("a film", 3))
    assert result.media_key == "mock/0003.mp4"


def test_external_backend_is_selected(monkeypatch):
    from app import runtime

    monkeypatch.setattr(runtime, "generation_backend", lambda: "external")
    assert isinstance(providers_mod.get_model_backend(), ExternalModelBackend)


def test_nano_banana_parses_rest_image(monkeypatch):
    # Nano Banana (Gemini) returns the image as base64 at
    # candidates[0].content.parts[].inlineData.data — verify we decode it.
    import base64

    import httpx

    png = b"\x89PNG\r\n\x1a\n mayo"
    payload = {
        "candidates": [
            {"content": {"parts": [{"inlineData": {"data": base64.b64encode(png).decode(),
                                                   "mimeType": "image/png"}}]}}
        ]
    }

    class FakeResp:
        def raise_for_status(self):
            pass

        def json(self):
            return payload

    class FakeClient:
        def __init__(self, *a, **k):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        async def post(self, *a, **k):
            return FakeResp()

    monkeypatch.setattr(httpx, "AsyncClient", FakeClient)
    monkeypatch.setattr(
        providers_mod,
        "settings",
        SimpleNamespace(
            gemini_api_key="test-key",
            gemini_api_base="https://example/v1beta",
            nano_banana_model="gemini-2.5-flash-image",
            external_aspect_ratio="16:9",
        ),
    )
    data, mime = asyncio.run(providers_mod.nano_banana_image("a cat over the city"))
    assert data == png
    assert mime == "image/png"


def test_nano_banana_requires_key(monkeypatch):
    monkeypatch.setattr(
        providers_mod,
        "settings",
        SimpleNamespace(
            gemini_api_key="",
            gemini_api_base="x",
            nano_banana_model="m",
            external_aspect_ratio="16:9",
        ),
    )

    try:
        asyncio.run(providers_mod.nano_banana_image("x"))
        raise AssertionError("expected RuntimeError")
    except RuntimeError as exc:
        assert "GEMINI_API_KEY" in str(exc)

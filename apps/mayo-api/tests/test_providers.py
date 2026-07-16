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


def test_external_backend_not_wired():
    async def call():
        await ExternalModelBackend().generate_scene("a film", 0)

    try:
        asyncio.run(call())
        raise AssertionError("expected NotImplementedError")
    except NotImplementedError:
        pass

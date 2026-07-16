import asyncio

from app.providers import ExternalModelBackend, MockModelBackend, get_model_backend


def test_default_backend_is_mock():
    assert isinstance(get_model_backend(), MockModelBackend)


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

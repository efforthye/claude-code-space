"""A published film must not publish how it was made, unless the creator says so.

The prompt is the work — the part that took iterations to get right. Publishing
a video is not consent to hand over the recipe, so the recipe is redacted by
default and the creator opts in.

The thing these tests protect: redaction must NOT break remixing. "Make like
this" re-seeds from the stored recipe on the server, so the text never has to
reach a client to be reused.
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.routers.explore import redact_recipe
from app.schemas import ExploreItem

client = TestClient(app)


def _item(**kw) -> ExploreItem:
    base = dict(
        id="e_1",
        title="Lighthouse",
        prompt="a lighthouse keeper finds a bottle, 35mm, golden hour",
        author="@someone",
        likes=0,
        durationLabel="30s",
        accent="#fff",
        tierLabel="Premium",
        scenePrompts=["scene one", "scene two"],
        stylePrompt="warm palette, soft grain",
        ownerId="u_creator",
    )
    base.update(kw)
    return ExploreItem(**base)


def test_a_stranger_sees_the_film_and_not_the_recipe():
    hidden = redact_recipe(_item(), viewer_id="u_stranger")
    assert hidden.prompt == ""
    assert hidden.scenePrompts is None
    assert hidden.stylePrompt is None
    # Everything that makes the feed useful survives.
    assert hidden.title == "Lighthouse"
    assert hidden.author == "@someone"


def test_anonymous_viewers_are_strangers_too():
    hidden = redact_recipe(_item(), viewer_id=None)
    assert hidden.prompt == ""


def test_the_creator_always_sees_their_own_recipe():
    mine = redact_recipe(_item(), viewer_id="u_creator")
    assert mine.prompt.startswith("a lighthouse keeper")
    assert mine.scenePrompts == ["scene one", "scene two"]


def test_opting_in_shows_it_to_everyone():
    shared = redact_recipe(_item(promptPublic=True), viewer_id="u_stranger")
    assert shared.prompt.startswith("a lighthouse keeper")
    assert shared.stylePrompt == "warm palette, soft grain"


def test_redaction_does_not_mutate_the_stored_item():
    original = _item()
    redact_recipe(original, viewer_id="u_stranger")
    # The store still holds the recipe — remix depends on it.
    assert original.prompt.startswith("a lighthouse keeper")
    assert original.scenePrompts == ["scene one", "scene two"]


def test_default_is_private():
    assert _item().promptPublic is False


@pytest.mark.parametrize("path", ["/v1/public/explore"])
def test_public_feed_never_returns_a_private_recipe(path):
    r = client.get(path)
    assert r.status_code == 200
    for item in r.json():
        if not item.get("promptPublic"):
            assert item.get("prompt") == ""
            assert not item.get("scenePrompts")
            assert not item.get("stylePrompt")

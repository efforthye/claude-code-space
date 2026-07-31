"""The Explore feed's two lanes, and following a creator.

A feed that mixes shapes cannot be watched: a 9:16 short in a landscape player
is a strip between two black walls, and a 16:9 film in a vertical pager is a
letterboxed sliver. The lane split is therefore load-bearing, not cosmetic, and
these tests hold it to that.
"""

import asyncio

from fastapi.testclient import TestClient

from app.main import app
from app.schemas import Video
from app.store import ExploreStore, FollowStore

client = TestClient(app)


def _video(vid: str, aspect: str) -> Video:
    return Video(
        id=vid,
        title=f"Film {vid}",
        durationLabel="0:02",
        sizeLabel="1 MB",
        expiresInDays=14,
        accent="#6D5DF6",
        resolution="512p",
        tierLabel="Local",
        scenes=1,
        createdLabel="now",
        url=f"/v1/media/films/{vid}.mp4",
        aspect=aspect,
    )


def _fresh_store() -> ExploreStore:
    from app import db

    db.replace_kind("explore", [])
    db.replace_kind("explore_comments", [])
    return ExploreStore()


def test_each_lane_returns_only_what_it_can_play():
    store = _fresh_store()
    asyncio.run(store.publish(_video("short", "9:16"), "a short"))
    asyncio.run(store.publish(_video("film", "16:9"), "a film"))
    asyncio.run(store.publish(_video("tall", "4:5"), "a tall one"))

    vertical = asyncio.run(store.list("latest", "vertical"))
    horizontal = asyncio.run(store.list("latest", "horizontal"))

    assert {i.aspect for i in vertical} == {"9:16", "4:5"}
    assert {i.aspect for i in horizontal} == {"16:9"}
    # Nothing may fall out of the feed entirely by being in neither lane.
    assert len(vertical) + len(horizontal) == len(asyncio.run(store.list("latest", "all")))


def test_square_is_watchable_in_the_landscape_lane():
    # 1:1 wastes less of a landscape player than a portrait one, and it must
    # land somewhere — an item in no lane is an item nobody can find.
    store = _fresh_store()
    asyncio.run(store.publish(_video("sq", "1:1"), "a square"))
    assert len(asyncio.run(store.list("latest", "horizontal"))) == 1
    assert asyncio.run(store.list("latest", "vertical")) == []


def test_an_unknown_aspect_still_appears_somewhere():
    store = _fresh_store()
    asyncio.run(store.publish(_video("weird", "nonsense"), "malformed"))
    assert len(asyncio.run(store.list("latest", "horizontal"))) == 1


def test_the_api_rejects_a_lane_that_does_not_exist():
    assert client.get("/v1/explore?orientation=vertical").status_code == 200
    assert client.get("/v1/explore?orientation=sideways").status_code == 422
    assert client.get("/v1/public/explore?orientation=horizontal").status_code == 200


def test_anonymous_browsing_can_pick_a_lane_too():
    # mayo.im has no session; the lane toggle has to work before sign-in or the
    # web feed is unusable for everyone who has not made an account.
    r = client.get("/v1/public/explore?orientation=vertical")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_following_is_idempotent_and_reversible():
    from app import db

    db.replace_kind("follows", [])
    store = FollowStore()

    assert asyncio.run(store.set("u1", "@ana", True)) == ["@ana"]
    # Following twice must not duplicate the handle.
    assert asyncio.run(store.set("u1", "@ana", True)) == ["@ana"]
    assert asyncio.run(store.set("u1", "@bo", True)) == ["@bo", "@ana"]
    assert asyncio.run(store.set("u1", "@ana", False)) == ["@bo"]
    # Unfollowing someone you never followed is not an error.
    assert asyncio.run(store.set("u1", "@nobody", False)) == ["@bo"]


def test_follows_are_per_account_and_survive_a_restart():
    from app import db

    db.replace_kind("follows", [])
    store = FollowStore()
    asyncio.run(store.set("u1", "@ana", True))
    asyncio.run(store.set("u2", "@bo", True))

    # A device-local list would have lost this. Rebuilding from storage is the
    # whole reason the follow list lives on the server.
    reloaded = FollowStore()
    assert asyncio.run(reloaded.following("u1")) == ["@ana"]
    assert asyncio.run(reloaded.following("u2")) == ["@bo"]


def test_signed_out_follows_merge_up_instead_of_being_lost():
    from app import db

    db.replace_kind("follows", [])
    store = FollowStore()
    asyncio.run(store.set("u1", "@ana", True))

    merged = asyncio.run(store.merge("u1", ["@bo", "@ana", "@cy"]))
    assert set(merged) == {"@ana", "@bo", "@cy"}
    assert len(merged) == 3, "the already-followed handle was duplicated"


def test_following_requires_an_account():
    # Anonymous visitors keep their follows on the device; the server list is
    # per account, so there is nothing to write to without one.
    assert client.get("/v1/explore/following/list").status_code in (401, 403)
    assert client.post("/v1/explore/following/@ana").status_code in (401, 403)

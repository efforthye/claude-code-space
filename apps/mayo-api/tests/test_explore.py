import asyncio

from fastapi.testclient import TestClient

from app.main import app
from app.schemas import Video
from app.store import ExploreStore

client = TestClient(app)


def _video(vid: str) -> Video:
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
    )


def test_explore_store_publish_like_and_sort():
    # Stores persist to SQLite now — start this test from clean kinds.
    from app import db

    db.replace_kind("explore", [])
    db.replace_kind("explore_comment", [])
    store = ExploreStore()
    a = asyncio.run(store.publish(_video("a"), "prompt a"))
    b = asyncio.run(store.publish(_video("b"), "prompt b"))
    asyncio.run(store.like(b.id))
    asyncio.run(store.like(b.id))

    popular = asyncio.run(store.list("popular"))
    assert popular[0].id == b.id  # most-liked first
    assert popular[0].url and popular[0].prompt == "prompt b"

    latest = asyncio.run(store.list("latest"))
    assert latest[0].id == b.id  # newest first


def test_explore_endpoint_returns_list_and_validates_sort():
    assert client.get("/v1/explore").status_code == 200
    assert isinstance(client.get("/v1/explore?sort=latest").json(), list)
    assert client.get("/v1/explore?sort=bogus").status_code == 422


def test_publish_unknown_video_404():
    assert client.post("/v1/explore", json={"videoId": "nope"}).status_code == 404


def test_ranking_engagement_ordering_and_time_decay():
    """ADR 0015: comments > likes > views in weight; old winners decay."""
    from app.schemas import ExploreItem

    def item(iid: str, likes=0, comm=0, views=0, shares=0, age_h=0.0):
        import time as _t

        return ExploreItem(
            id=iid, title=iid, prompt=iid, author="@t", likes=likes,
            durationLabel="0:02", accent="#000", tierLabel="Local",
            comments=comm, views=views, shares=shares,
            createdAt=_t.time() - age_h * 3600,
        )

    score = ExploreStore._score
    # deeper engagement outweighs shallower at equal age
    assert score(item("c", comm=2)) > score(item("l", likes=2)) > score(item("v", views=2))
    # shares are the strongest single signal
    assert score(item("s", shares=2)) > score(item("c2", comm=2))
    # a week-old heavily-liked item loses to a fresh, mildly-engaged one
    old_winner = item("old", likes=10, age_h=24 * 7)
    fresh = item("new", likes=1, age_h=1)
    assert score(fresh) > score(old_winner)


def test_view_ping_and_recipe_on_published_item():
    from app import db

    db.replace_kind("explore", [])
    db.replace_kind("explore_comment", [])
    store = ExploreStore()
    video = _video("t").model_copy(
        update={"scenePrompts": ["scene one"], "stylePrompt": "watercolor, a tabby cat"}
    )
    item = asyncio.run(store.publish(video, "prompt t"))
    assert item.scenePrompts == ["scene one"]  # recipe published for template reuse
    assert item.stylePrompt == "watercolor, a tabby cat"
    assert item.createdAt > 0
    viewed = asyncio.run(store.view(item.id))
    assert viewed is not None and viewed.views == 1
    shared = asyncio.run(store.share(item.id))
    assert shared is not None and shared.shares == 1


def test_seed_endpoint_fills_and_clears_samples(monkeypatch):
    from app import db
    from app.routers import explore as explore_router

    db.replace_kind("explore", [])
    db.replace_kind("explore_comment", [])
    # no ffmpeg in the dev container — stub the clip generator
    monkeypatch.setattr(explore_router, "_gen_sample_clip_sync", lambda hue, label: b"fake-mp4")

    r = client.post("/v1/explore/seed")
    assert r.status_code == 200
    items = r.json()
    assert len(items) == 6
    assert all(i["author"] == "@mayo-sample" for i in items)
    assert all(i["url"] and i["url"].startswith("/v1/media/films/sample-") for i in items)
    # varied engagement + ages so the popular ranking is visible
    assert any(i["likes"] > 0 for i in items) and any(i["views"] > 0 for i in items)

    # re-seeding with clear replaces instead of duplicating
    r2 = client.post("/v1/explore/seed?clear=true")
    assert r2.status_code == 200
    feed = client.get("/v1/explore?sort=latest").json()
    samples = [i for i in feed if i["author"] == "@mayo-sample"]
    assert len(samples) == 6

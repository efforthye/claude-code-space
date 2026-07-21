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


def test_public_reel_endpoints_open_but_gated_on_published(monkeypatch):
    """Shared links work with NO auth — but only for explore-published items."""
    from fastapi.testclient import TestClient as TC

    from app import db
    from app.main import app as app_
    from app.storage import get_storage

    db.replace_kind("explore", [])
    db.replace_kind("explore_comment", [])
    store = ExploreStore()
    monkeypatch.setattr("app.routers.public.explore_store", store)
    get_storage().save("films/pub-test.mp4", b"fake-mp4-bytes")
    video = _video("pub").model_copy(update={"url": "/v1/media/films/pub-test.mp4"})
    item = asyncio.run(store.publish(video, "public prompt"))

    anon = TC(app_)  # no API key, no session — like a share recipient
    meta = anon.get(f"/v1/public/reels/{item.id}")
    assert meta.status_code == 200 and meta.json()["title"] == video.title
    media = anon.get(f"/v1/public/media/{item.id}")
    assert media.status_code == 200 and media.content == b"fake-mp4-bytes"
    # unpublished/unknown ids stay closed
    assert anon.get("/v1/public/reels/e-nope").status_code == 404
    assert anon.get("/v1/public/media/e-nope").status_code == 404

    # OG preview page: crawler-facing HTML with absolute image/video meta tags
    # and a human redirect to the mayo.im reel page.
    og = anon.get(f"/v1/public/reel-og/{item.id}")
    assert og.status_code == 200 and "text/html" in og.headers["content-type"]
    assert f'content="https://mayo.im/reel/{item.id}"' in og.text
    assert f"/v1/public/thumb/{item.id}" in og.text
    assert 'property="og:image"' in og.text and 'property="og:video"' in og.text
    assert anon.get("/v1/public/reel-og/e-nope").status_code == 404


def test_anonymous_explore_reads_via_public_mirror():
    from fastapi.testclient import TestClient as TC

    from app.main import app as app_

    anon = TC(app_)  # no key, no session — a logged-out mayo.im visitor
    r = anon.get("/v1/public/explore?sort=latest")
    assert r.status_code == 200 and isinstance(r.json(), list)
    assert anon.get("/v1/public/explore?sort=bogus").status_code == 422
    assert anon.get("/v1/public/explore/e-nope/comments").status_code == 404
    assert anon.post("/v1/public/explore/e-nope/view").status_code == 404


def test_one_like_per_account_and_annotation():
    from app import db
    from app.auth import store as users

    db.replace_kind("explore", [])
    db.replace_kind("explore_comment", [])
    db.replace_kind("explore_like", [])
    store = ExploreStore()
    item = asyncio.run(store.publish(_video("likeme"), "p"))
    user = users.create_user("liker@example.com", "L", provider="email", password="pw12345678")

    first = asyncio.run(store.like(item.id, user["id"]))
    second = asyncio.run(store.like(item.id, user["id"]))  # idempotent
    assert first.likes == 1 and second.likes == 1 and second.likedByMe

    annotated = store.annotate_liked(asyncio.run(store.list("latest")), user["id"])
    assert annotated[0].likedByMe is True
    other = store.annotate_liked(asyncio.run(store.list("latest")), "someone-else")
    assert other[0].likedByMe is False

    asyncio.run(store.unlike(item.id, user["id"]))
    asyncio.run(store.unlike(item.id, user["id"]))  # second undo is a no-op
    final = asyncio.run(store.list("latest"))[0]
    assert final.likes == 0


def test_my_posts_hide_unhide_and_owner_delete(monkeypatch):
    """Owner-only post management: /mine lists hidden too, hide pulls from the
    public feed (and public share routes), delete is permanent, and another
    account can touch none of it."""
    from app import db
    from app.store import explore as live_store

    db.replace_kind("explore", [])
    db.replace_kind("explore_comment", [])
    db.replace_kind("explore_like", [])
    fresh = ExploreStore()
    for mod in ("app.routers.explore", "app.routers.public"):
        monkeypatch.setattr(f"{mod}.explore_store", fresh)

    owner = client.post(
        "/v1/auth/register",
        json={"email": "poster@example.com", "password": "password1", "name": "Poster"},
    ).json()
    other = client.post(
        "/v1/auth/register",
        json={"email": "lurker@example.com", "password": "password1", "name": "Lurker"},
    ).json()
    oh = {"X-Mayo-Session": owner["token"]}
    xh = {"X-Mayo-Session": other["token"]}

    video = _video("mine1")
    item = asyncio.run(
        fresh.publish(video, "my prompt", author="@Poster", owner_id=owner["user"]["id"])
    )

    # /mine requires sign-in and shows the post; others see an empty list.
    assert client.get("/v1/explore/mine").status_code == 401
    mine = client.get("/v1/explore/mine", headers=oh).json()
    assert [i["id"] for i in mine] == [item.id]
    assert client.get("/v1/explore/mine", headers=xh).json() == []

    # Hide: gone from the public feed + public reel route, still in /mine.
    assert client.post(f"/v1/explore/{item.id}/hide", headers=xh).status_code == 404
    hid = client.post(f"/v1/explore/{item.id}/hide", headers=oh)
    assert hid.status_code == 200 and hid.json()["hidden"] is True
    assert all(i["id"] != item.id for i in client.get("/v1/explore?sort=latest").json())
    assert client.get(f"/v1/public/reels/{item.id}").status_code == 404
    assert client.get("/v1/explore/mine", headers=oh).json()[0]["hidden"] is True

    # Unhide restores it publicly.
    assert client.post(f"/v1/explore/{item.id}/unhide", headers=oh).status_code == 200
    assert any(i["id"] == item.id for i in client.get("/v1/explore?sort=latest").json())

    # Delete: owner-only and permanent.
    assert client.delete(f"/v1/explore/{item.id}", headers=xh).status_code == 404
    assert client.delete(f"/v1/explore/{item.id}", headers=oh).json()["deleted"] is True
    assert client.get("/v1/explore/mine", headers=oh).json() == []
    assert client.get(f"/v1/public/reels/{item.id}").status_code == 404
    assert live_store is not None  # silence unused-import lint in minimal runs


def test_watch_ping_and_completion_weight():
    """Completed watches count via /watch and outrank plain views (ADR 0015)."""
    from app import db
    from app.schemas import ExploreItem as _EI
    import time as _t

    db.replace_kind("explore", [])
    db.replace_kind("explore_comment", [])
    store = ExploreStore()
    item = asyncio.run(store.publish(_video("watchme"), "p"))
    watched = asyncio.run(store.watch(item.id))
    assert watched is not None and watched.watches == 1
    assert asyncio.run(store.watch("e-nope")) is None

    def mk(iid, **kw):
        return _EI(
            id=iid, title=iid, prompt=iid, author="@t",
            durationLabel="0:02", accent="#000", tierLabel="Local",
            createdAt=_t.time(), **{"likes": 0, **kw},
        )

    # a completed watch is worth more than a view, less than a like
    assert ExploreStore._score(mk("w", watches=2)) > ExploreStore._score(mk("v", views=2))
    assert ExploreStore._score(mk("l", likes=2)) > ExploreStore._score(mk("w2", watches=2))

import asyncio

from app import db
from app.schemas import Video


def test_docs_roundtrip_and_order():
    db.replace_kind("t_kind", [("b", {"id": "b", "n": 2}), ("a", {"id": "a", "n": 1})])
    docs = db.load("t_kind")
    assert [d["id"] for d in docs] == ["b", "a"]  # insertion order preserved
    db.replace_kind("t_kind", [("a", {"id": "a", "n": 9})])
    assert db.load("t_kind") == [{"id": "a", "n": 9}]
    db.replace_kind("t_kind", [])
    assert db.load("t_kind") == []


def test_explore_feed_survives_a_restart():
    # Publish into one store instance, then build a fresh instance (as a process
    # restart would) and expect the item + comment to come back from SQLite.
    from app.store import ExploreStore

    store1 = ExploreStore()
    video = Video(
        id="v_test", title="persisted film", durationLabel="0:10", sizeLabel="1 MB",
        expiresInDays=14, accent="#123456", resolution="512p", tierLabel="Local",
        scenes=1, createdLabel="now", url="/v1/media/films/x.mp4",
    )

    async def scenario():
        item = await store1.publish(video, "prompt here")
        await store1.like(item.id)
        await store1.add_comment(item.id, "nice!")
        return item

    item = asyncio.run(scenario())

    store2 = ExploreStore()  # fresh instance = simulated restart

    async def check():
        items = await store2.list("latest")
        found = next((i for i in items if i.id == item.id), None)
        assert found is not None and found.likes == 1 and found.comments == 1
        comments = await store2.comments(item.id)
        assert comments and comments[0].text == "nice!"

    asyncio.run(check())

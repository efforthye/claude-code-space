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

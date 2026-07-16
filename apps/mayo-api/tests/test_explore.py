from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_explore_feed_sorted_by_likes():
    res = client.get("/v1/explore")
    assert res.status_code == 200
    items = res.json()
    assert len(items) >= 4
    likes = [i["likes"] for i in items]
    assert likes == sorted(likes, reverse=True)
    assert all(i["prompt"] for i in items)  # prompt powers "make like this"


def test_like_increments():
    items = client.get("/v1/explore").json()
    target = items[0]["id"]
    before = items[0]["likes"]
    liked = client.post(f"/v1/explore/{target}/like")
    assert liked.status_code == 200
    assert liked.json()["likes"] == before + 1


def test_like_unknown_404():
    assert client.post("/v1/explore/nope/like").status_code == 404

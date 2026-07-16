import asyncio

import httpx
from fastapi.testclient import TestClient
from httpx import ASGITransport

from app.main import app

client = TestClient(app)


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_catalog_tiers_and_models():
    tiers = client.get("/v1/catalog/tiers").json()
    assert {t["id"] for t in tiers} == {"draft", "standard", "premium"}
    models = client.get("/v1/catalog/models").json()
    assert any(m["kind"] == "video" for m in models)
    assert any(m["kind"] == "image" for m in models)


def test_catalog_directors():
    directors = client.get("/v1/catalog/directors").json()
    assert any(d["id"] == "claude-opus-4-8" for d in directors)
    assert all({"id", "name", "tier", "blurb"} <= set(d) for d in directors)


def test_estimate():
    r = client.post("/v1/jobs/estimate", json={"prompt": "x", "seconds": 60, "tier": "standard"})
    assert r.status_code == 200
    # 60s @ standard (14/min) -> 14 credits
    assert r.json()["credits"] == 14


def test_estimate_rejects_unknown_tier():
    r = client.post("/v1/jobs/estimate", json={"seconds": 60, "tier": "nope"})
    assert r.status_code == 400


def test_create_job_generates_and_completes():
    # The generation worker uses asyncio.create_task, which needs a persistent
    # event loop — Starlette's TestClient spins one loop per request, so we run
    # this lifecycle inside a single loop via an async ASGI client instead.
    async def scenario():
        transport = ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
            r = await ac.post(
                "/v1/jobs", json={"prompt": "A short test film", "seconds": 4, "tier": "draft"}
            )
            assert r.status_code == 201
            job = r.json()
            assert job["status"] == "queued"
            # 4s / 2s-per-clip (16 frames / 8 fps) -> 2 clips to fill the length
            assert job["scenesTotal"] == 2
            job_id = job["id"]

            final = job
            for _ in range(100):
                await asyncio.sleep(0.1)
                final = (await ac.get(f"/v1/jobs/{job_id}")).json()
                if final["status"] == "done":
                    break

            videos = (await ac.get("/v1/library/videos")).json()
            return final, videos

    final, videos = asyncio.run(scenario())
    assert final["status"] == "done"
    assert final["scenesDone"] == final["scenesTotal"]
    assert any(v["title"] == "A short test film" for v in videos)


def test_delete_job():
    created = client.post("/v1/jobs", json={"seconds": 600, "tier": "standard"}).json()
    job_id = created["id"]
    assert client.delete(f"/v1/jobs/{job_id}").status_code == 204
    assert client.get(f"/v1/jobs/{job_id}").status_code == 404


def test_billing_products_and_validate():
    products = client.get("/v1/billing/products").json()
    ids = {p["planId"] for p in products}
    assert "pro" in ids and "studio" in ids
    assert "free" not in ids  # free isn't purchasable

    pro = next(p for p in products if p["planId"] == "pro")
    result = client.post(
        "/v1/billing/validate", json={"productId": pro["id"], "platform": "mock"}
    ).json()
    assert result == {"entitled": True, "planId": "pro"}

    bad = client.post("/v1/billing/validate", json={"productId": "im.mayo.nope.monthly"})
    assert bad.status_code == 400


def test_extend_and_publish():
    videos = client.get("/v1/library/videos").json()
    vid = videos[0]["id"]
    before = videos[0]["expiresInDays"]
    extended = client.post(f"/v1/library/videos/{vid}/extend", json={"plan": "d7"}).json()
    assert extended["expiresInDays"] == before + 7

    pub = client.post(
        f"/v1/library/videos/{vid}/publish",
        json={"title": "My film", "visibility": "unlisted"},
    ).json()
    assert pub["accepted"] is True
    assert pub["visibility"] == "unlisted"

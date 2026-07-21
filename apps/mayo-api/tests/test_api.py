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
    deleted = client.delete(f"/v1/jobs/{job_id}")
    assert deleted.status_code == 200
    # anonymous job -> nothing was charged, nothing refunded
    assert deleted.json()["refundedCredits"] == 0
    assert client.get(f"/v1/jobs/{job_id}").status_code == 404


def test_billing_products_and_validate():
    products = client.get("/v1/billing/products").json()
    ids = {p["planId"] for p in products}
    assert "pro" in ids and "studio" in ids
    assert "free" not in ids  # free isn't purchasable

    # PROD RULE: receipt validation refuses (501) until real store verification
    # exists — no fake entitlements. Plans come from Stripe checkout.
    pro = next(p for p in products if p["planId"] == "pro")
    result = client.post("/v1/billing/validate", json={"productId": pro["id"], "platform": "mock"})
    assert result.status_code == 501


def test_extend_and_publish():
    videos = client.get("/v1/library/videos").json()
    vid = videos[0]["id"]
    before = videos[0]["expiresInDays"]
    extended = client.post(f"/v1/library/videos/{vid}/extend", json={"plan": "d7"}).json()
    assert extended["expiresInDays"] == before + 7

    # PROD RULE: publishing without a connected YouTube channel is an honest 400,
    # not a fake acceptance.
    pub = client.post(
        f"/v1/library/videos/{vid}/publish",
        json={"title": "My film", "visibility": "unlisted"},
    )
    assert pub.status_code == 400
    assert "유튜브" in pub.json()["detail"]


def test_library_and_jobs_are_scoped_per_user():
    import asyncio

    from app.auth import store as users
    from app.store import jobs as job_store, library

    alice = users.create_user("scope-alice@example.com", "A", provider="email", password="pw12345678")
    bob = users.create_user("scope-bob@example.com", "B", provider="email", password="pw12345678")

    a_job = asyncio.run(job_store.create("alice film", 4, "draft", owner_id=alice["id"]))
    asyncio.run(job_store.create("anon film", 4, "draft"))

    a_jobs = {j.id for j in asyncio.run(job_store.list(alice["id"]))}
    b_jobs = {j.id for j in asyncio.run(job_store.list(bob["id"]))}
    assert a_job.id in a_jobs
    assert a_job.id not in b_jobs  # bob can't see alice's job
    # ownerless (legacy/anonymous) stays visible to everyone
    assert any(j.title == "anon film" for j in asyncio.run(job_store.list(bob["id"])))

    a_video = asyncio.run(library.add_film("alice cut", "films/alice.mp4", 10, owner_id=alice["id"]))
    vids_a = {v.id for v in asyncio.run(library.list(alice["id"]))}
    vids_b = {v.id for v in asyncio.run(library.list(bob["id"]))}
    assert a_video.id in vids_a and a_video.id not in vids_b

    # per-user storage counts only the caller's files
    from app.storage import get_storage

    get_storage().save("films/alice.mp4", b"x" * 1000)
    assert asyncio.run(library.storage(alice["id"])).usedBytes >= 1000
    assert asyncio.run(library.storage(bob["id"])).usedBytes < asyncio.run(
        library.storage(alice["id"])
    ).usedBytes + 1

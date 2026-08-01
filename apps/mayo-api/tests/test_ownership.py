"""Ownership guards (IDOR): a job/video id is NOT a credential.

Every mutator (and the detail reads, which carry the user's prompts) answers
403 to any session that is not the resource's owner — an admin passes, and
ownerless (anonymous/legacy) resources stay open, matching how they list.
"""

import asyncio

from fastapi.testclient import TestClient

from app import auth as auth_mod
from app.auth import store as users
from app.main import app
from app.schemas import Segment
from app.store import jobs as job_store
from app.store import library

client = TestClient(app)


def _user(email: str):
    u = users.by_email(email) or users.create_user(
        email, "U", provider="email", password="pw12345678"
    )
    return u, users.create_session(u["id"])


def _owned_job(owner_id: str) -> str:
    job = asyncio.run(job_store.create("mine", 4, "draft", owner_id=owner_id))
    seg = Segment(index=0, startSec=0, endSec=4)
    asyncio.run(job_store.set_segments(job.id, [seg], stage="beats"))
    return job.id


def test_every_job_endpoint_rejects_a_different_account():
    owner, owner_tok = _user("own-jobs@example.com")
    _, thief_tok = _user("thief-jobs@example.com")
    job_id = _owned_job(owner["id"])
    h = {"X-Mayo-Session": thief_tok}

    assert client.get(f"/v1/jobs/{job_id}", headers=h).status_code == 403
    assert client.post(f"/v1/jobs/{job_id}/retry", headers=h).status_code == 403
    assert (
        client.post(f"/v1/jobs/{job_id}/beats", json={"prompt": "x"}, headers=h).status_code
        == 403
    )
    assert (
        client.post(
            f"/v1/jobs/{job_id}/segments/0/rewrite", json={"instruction": "x"}, headers=h
        ).status_code
        == 403
    )
    assert client.post(f"/v1/jobs/{job_id}/segments/0/approve", headers=h).status_code == 403
    assert client.post(f"/v1/jobs/{job_id}/stills", headers=h).status_code == 403
    assert client.post(f"/v1/jobs/{job_id}/segments/0/reimage", headers=h).status_code == 403
    assert client.post(f"/v1/jobs/{job_id}/advance", headers=h).status_code == 403
    assert client.get(f"/v1/jobs/{job_id}/clip-quote", headers=h).status_code == 403
    assert (
        client.post(f"/v1/jobs/{job_id}/clips", json={"mode": "renderAll"}, headers=h).status_code
        == 403
    )
    assert client.post(f"/v1/jobs/{job_id}/stop", headers=h).status_code == 403
    assert client.post(f"/v1/jobs/{job_id}/segments/0/reclip", headers=h).status_code == 403
    assert client.delete(f"/v1/jobs/{job_id}", headers=h).status_code == 403

    # Anonymous callers bounce off an owned job the same way.
    assert client.post(f"/v1/jobs/{job_id}/stop").status_code == 403
    assert client.delete(f"/v1/jobs/{job_id}").status_code == 403

    # None of that touched the job; the owner still reads and deletes it.
    oh = {"X-Mayo-Session": owner_tok}
    assert client.get(f"/v1/jobs/{job_id}", headers=oh).status_code == 200
    assert client.delete(f"/v1/jobs/{job_id}", headers=oh).status_code == 200


def test_library_endpoints_reject_a_different_account():
    owner, owner_tok = _user("own-lib@example.com")
    _, thief_tok = _user("thief-lib@example.com")
    video = asyncio.run(
        library.add_film("mine", "films/own-lib-test.mp4", 10, owner_id=owner["id"])
    )
    h = {"X-Mayo-Session": thief_tok}

    assert client.get(f"/v1/library/videos/{video.id}", headers=h).status_code == 403
    assert client.delete(f"/v1/library/videos/{video.id}", headers=h).status_code == 403
    assert (
        client.post(
            f"/v1/library/videos/{video.id}/extend", json={"plan": "d7"}, headers=h
        ).status_code
        == 403
    )
    assert (
        client.post(
            f"/v1/library/videos/{video.id}/publish", json={"title": "t"}, headers=h
        ).status_code
        == 403
    )
    assert client.delete(f"/v1/library/videos/{video.id}").status_code == 403

    oh = {"X-Mayo-Session": owner_tok}
    assert client.get(f"/v1/library/videos/{video.id}", headers=oh).status_code == 200
    assert client.delete(f"/v1/library/videos/{video.id}", headers=oh).status_code == 204


def test_ownerless_resources_stay_open():
    # Legacy/anonymous jobs and videos have no owner to protect; locking them
    # would strand the anonymous dev flow they exist for.
    job = asyncio.run(job_store.create("anon", 4, "draft"))
    assert client.get(f"/v1/jobs/{job.id}").status_code == 200
    assert client.delete(f"/v1/jobs/{job.id}").status_code == 200


def test_an_admin_passes_the_ownership_guard(monkeypatch):
    from types import SimpleNamespace

    owner, _ = _user("own-adm@example.com")
    _, admin_tok = _user("adm-owner@example.com")
    monkeypatch.setattr(
        auth_mod, "settings", SimpleNamespace(admin_emails=["adm-owner@example.com"])
    )
    job_id = _owned_job(owner["id"])
    h = {"X-Mayo-Session": admin_tok}
    assert client.get(f"/v1/jobs/{job_id}", headers=h).status_code == 200
    assert client.delete(f"/v1/jobs/{job_id}", headers=h).status_code == 200

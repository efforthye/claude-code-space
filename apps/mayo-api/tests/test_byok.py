from fastapi.testclient import TestClient

from app.auth import store as users
from app.main import app

client = TestClient(app)


def _session():
    user = users.create_user("byok@example.com", "Byok", provider="email", password="pw12345678")
    return user, users.create_session(user["id"])


def test_keys_require_signin():
    assert client.get("/v1/auth/me/keys").status_code == 401
    assert client.put("/v1/auth/me/keys", json={"anthropic": "sk-x"}).status_code == 401


def test_keys_roundtrip_masked_and_removable():
    user, token = _session()
    h = {"X-Mayo-Session": token}

    # store two keys -> response is masked (never the full value)
    r = client.put(
        "/v1/auth/me/keys", json={"anthropic": "sk-ant-secret-1234", "higgsfield": "id:sec9999"}, headers=h
    )
    assert r.status_code == 200
    keys = r.json()["keys"]
    assert keys["anthropic"] == "…1234" and keys["higgsfield"] == "…9999"
    assert "sk-ant-secret" not in str(r.json())

    # read back masked; omitted provider untouched, empty string removes
    assert client.get("/v1/auth/me/keys", headers=h).json()["keys"]["anthropic"] == "…1234"
    r2 = client.put("/v1/auth/me/keys", json={"anthropic": ""}, headers=h)
    assert "anthropic" not in r2.json()["keys"]
    assert r2.json()["keys"]["higgsfield"] == "…9999"

    # raw value lives on the user record for provider calls
    assert users.byok_key(users.users[user["id"]], "higgsfield") == "id:sec9999"


def test_estimate_applies_byok_factor_for_key_holders():
    _user, token = _session()
    h = {"X-Mayo-Session": token}
    client.put("/v1/auth/me/keys", json={"anthropic": "sk-ant-abc"}, headers=h)

    body = {"prompt": "x", "seconds": 60, "tier": "standard"}  # base 14 credits
    anon = client.post("/v1/jobs/estimate", json=body).json()["credits"]
    mine = client.post("/v1/jobs/estimate", json=body, headers=h).json()["credits"]
    assert anon == 14
    assert mine == 1  # round(14 * 0.1) -> 1

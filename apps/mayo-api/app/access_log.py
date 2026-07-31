"""Structured access logging for authentication events.

Writes one JSON object per line to its own file so [[elk]]'s Filebeat can parse
it with an `ndjson` parser and give real fields — `client.ip`,
`client.geo.country_iso_code`, `event.outcome` — instead of a text blob you can
only grep. Keeping it out of `mayo-api.log` matters: that file is uvicorn's
plain-text output, and mixing two formats in one stream forces the parser to
guess.

WHERE THE CLIENT IP COMES FROM
The API sits behind a named Cloudflare tunnel, so `request.client.host` is the
tunnel's local end (127.0.0.1) and useless. Cloudflare adds the real values:

    CF-Connecting-IP   the client address
    CF-IPCountry       ISO 3166-1 alpha-2, or XX when unknown, T1 for Tor

That is why there is no GeoIP database here — the edge already resolved it, for
free, and a bundled database would only go stale. Requests that arrive on the
LAN without passing the tunnel simply have no country, and are recorded as such
rather than guessed at.

PRIVACY
An IP address is personal data under both GDPR and Korea's PIPA. The default
records it in full because the owner asked for it, but `MAYO_ACCESS_LOG_IP`
switches to `masked` (last octet / last 80 bits zeroed, enough for
country-level analytics) or `none`. Retention is bounded by the ELK ILM policy
— 30 days, see wiki/infra/elk.md — not kept forever.
"""

from __future__ import annotations

import ipaddress
import json
import logging
import os
import time
from typing import Any, Optional

from fastapi import Request

logger = logging.getLogger("mayo")

# Default next to the other launchd logs so Filebeat picks it up from the
# directory it already mounts.
_DEFAULT_PATH = os.path.expanduser("~/Library/Logs/mayo-auth.log")
_PATH = os.getenv("MAYO_ACCESS_LOG", _DEFAULT_PATH)
_IP_MODE = os.getenv("MAYO_ACCESS_LOG_IP", "full").strip().lower()  # full | masked | none


def _mask_ip(raw: str) -> str:
    """Zero the host portion: 203.0.113.47 -> 203.0.113.0, v6 -> /48."""
    try:
        addr = ipaddress.ip_address(raw)
    except ValueError:
        return ""
    if addr.version == 4:
        return str(ipaddress.ip_network(f"{addr}/24", strict=False).network_address)
    return str(ipaddress.ip_network(f"{addr}/48", strict=False).network_address)


def client_ip(request: Optional[Request]) -> str:
    """The caller's address, preferring what the Cloudflare edge observed."""
    if request is None:
        return ""
    h = request.headers
    raw = (h.get("cf-connecting-ip") or "").strip()
    if not raw:
        # X-Forwarded-For is a chain; the client is the leftmost entry.
        fwd = (h.get("x-forwarded-for") or "").split(",")[0].strip()
        raw = fwd
    if not raw and request.client:
        raw = request.client.host or ""
    if not raw:
        return ""
    if _IP_MODE == "none":
        return ""
    if _IP_MODE == "masked":
        return _mask_ip(raw)
    return raw


def client_country(request: Optional[Request]) -> str:
    """ISO-3166-1 alpha-2 from the Cloudflare edge, or "" when not behind it.

    Cloudflare sends XX when it cannot determine the country and T1 for Tor;
    both are recorded as unknown rather than passed through as if they were
    real countries.
    """
    if request is None:
        return ""
    code = (request.headers.get("cf-ipcountry") or "").strip().upper()
    if code in ("", "XX", "T1"):
        return ""
    return code


def _write(record: dict[str, Any]) -> None:
    try:
        os.makedirs(os.path.dirname(_PATH) or ".", exist_ok=True)
        with open(_PATH, "a", encoding="utf-8") as fh:
            fh.write(json.dumps(record, ensure_ascii=False) + "\n")
    except Exception:
        # Telemetry must never break a login. Losing a log line is acceptable;
        # refusing a sign-in because the disk is full is not.
        logger.exception("access log write failed")


def log_auth_event(
    action: str,
    request: Optional[Request],
    *,
    outcome: str = "success",
    user: Optional[dict] = None,
    email: str = "",
    reason: str = "",
) -> dict[str, str]:
    """Record one auth event and return {ip, country} for the caller to reuse.

    Field names follow ECS where one exists, so Kibana's built-in columns and
    map visualisations work without custom mappings.
    """
    ip = client_ip(request)
    country = client_country(request)

    record: dict[str, Any] = {
        "@timestamp": time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime()) + "Z",
        "event": {"category": "authentication", "action": action, "outcome": outcome},
        "service": {"name": "mayo-api"},
        "client": {"ip": ip, "geo": {"country_iso_code": country}},
    }
    if user:
        record["user"] = {"id": user.get("id", ""), "email": user.get("email", "")}
    elif email:
        # A failed login has no user — keep the attempted address so repeated
        # attempts against one account are visible.
        record["user"] = {"email": email}
    if reason:
        record["event"]["reason"] = reason
    ua = request.headers.get("user-agent") if request else None
    if ua:
        record["user_agent"] = {"original": ua[:400]}

    _write(record)
    return {"ip": ip, "country": country}


def stamp_last_login(store: Any, user: dict, where: dict[str, str]) -> None:
    """Remember where an account last signed in from, for the admin console.

    Only the latest value is kept — this is "where is this account being used
    from", not a history. The history lives in the log file with a 30-day life.
    """
    try:
        user["lastLoginAt"] = time.time()
        if where.get("ip"):
            user["lastLoginIp"] = where["ip"]
        if where.get("country"):
            user["lastLoginCountry"] = where["country"]
        store.save()
    except Exception:
        logger.exception("last-login stamp failed")

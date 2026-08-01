"""Business ledger + owner alerts.

Every business-meaningful event — signup, payment, generation started/finished/
failed, credits moved — is appended to the SQLite `ledger` kind (who, when,
credits, prompt, outcome) and mirrored to the owner's Telegram when configured.

Telegram setup (names only; values live in the host .env):
  MAYO_TELEGRAM_BOT_TOKEN  — from @BotFather
  MAYO_TELEGRAM_CHAT_ID    — the owner's chat id (message the bot once, then
                             GET /getUpdates to read the id)
Unset -> alerts are a silent no-op; the ledger always records regardless.
"""

from __future__ import annotations

import asyncio
import logging
import secrets
import time

from .config import settings

logger = logging.getLogger("uvicorn.error")

_EVENT_LABELS = {
    "signup": "신규 가입",
    "purchase": "결제",
    "job_created": "생성 시작",
    "job_done": "생성 완료",
    "job_failed": "생성 실패",
    "credits": "크레딧 변동",
}


def record(event: str, user_id: str | None = None, telegram: bool = True, **fields) -> None:
    """Append one ledger row; never raises (bookkeeping must not break the app)."""
    from . import db

    row = {
        "id": f"l_{secrets.token_hex(6)}",
        "at": time.time(),
        "event": event,
        "userId": user_id or "",
        **fields,
    }
    try:
        db.append("ledger", row["id"], row)
    except Exception:
        logger.exception("ledger append failed for %s", event)
    if telegram:
        _telegram_async(event, row)


def _format(event: str, row: dict) -> str:
    label = _EVENT_LABELS.get(event, event)
    parts = [f"[mayo] {label}"]
    if row.get("email"):
        parts.append(f"user: {row['email']}")
    elif row.get("userId"):
        parts.append(f"user: {row['userId']}")
    for key in ("title", "prompt", "credits", "amount", "product", "reason"):
        if row.get(key) not in (None, ""):
            value = str(row[key])
            parts.append(f"{key}: {value[:120]}")
    return "\n".join(parts)


def _telegram_async(event: str, row: dict) -> None:
    """Fire-and-forget Telegram send; silent no-op when unconfigured."""
    if not (settings.telegram_bot_token and settings.telegram_chat_id):
        return

    async def _send() -> None:
        import httpx

        try:
            async with httpx.AsyncClient(timeout=10) as client:
                await client.post(
                    f"https://api.telegram.org/bot{settings.telegram_bot_token}/sendMessage",
                    json={"chat_id": settings.telegram_chat_id, "text": _format(event, row)},
                )
        except Exception:
            logger.warning("telegram alert failed for %s", event)

    try:
        asyncio.get_running_loop().create_task(_send())
    except RuntimeError:
        pass  # no loop (sync/test context) — the ledger row is already saved


def for_user(user_id: str, limit: int = 100) -> list[dict]:
    """One user's own history (credit top-ups, spends, generations), newest
    first — served to THAT user, so rows are filtered strictly by userId."""
    from . import db

    rows = [r for r in db.load("ledger") if r.get("userId") == user_id]
    rows.sort(key=lambda r: r.get("at", 0), reverse=True)
    return rows[: max(1, min(500, limit))]


def entries(limit: int = 100) -> list[dict]:
    """Newest-first ledger rows for the admin console."""
    from . import db

    rows = db.load("ledger")
    rows.sort(key=lambda r: r.get("at", 0), reverse=True)
    return rows[: max(1, min(500, limit))]

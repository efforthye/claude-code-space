"""SQLite persistence — a real database file (media/mayo.db) behind the stores.

The stores keep their fast in-memory dicts and write through to SQLite on every
mutation; on startup they load from the DB. Records are stored as JSON documents
in one `docs(kind, id, doc)` table — pragmatic at this scale, and the seam to a
relational schema / Postgres later is `load()`/`replace_kind()` only (ADR 0013).

WAL mode keeps concurrent reads cheap; a process-wide lock serializes writes
(SQLite itself would too). One-time migration imports the legacy JSON files
(.users.json / .library.json) the first time a kind is empty.
"""

from __future__ import annotations

import json
import os
import sqlite3
import threading
from typing import Iterable

from .config import settings

_lock = threading.Lock()
_conn: sqlite3.Connection | None = None

_SCHEMA = """
CREATE TABLE IF NOT EXISTS docs (
    kind TEXT NOT NULL,
    id   TEXT NOT NULL,
    doc  TEXT NOT NULL,
    seq  INTEGER,  -- insertion order within a kind (feed ordering)
    PRIMARY KEY (kind, id)
);
CREATE INDEX IF NOT EXISTS docs_kind_seq ON docs (kind, seq);
"""


def _path() -> str:
    return os.path.join(settings.storage_local_path, "mayo.db")


def conn() -> sqlite3.Connection:
    global _conn
    if _conn is None:
        os.makedirs(settings.storage_local_path or ".", exist_ok=True)
        c = sqlite3.connect(_path(), check_same_thread=False)
        c.execute("PRAGMA journal_mode=WAL")
        c.executescript(_SCHEMA)
        c.commit()
        _conn = c
    return _conn


def load(kind: str) -> list[dict]:
    """All documents of a kind, in insertion order."""
    with _lock:
        rows = conn().execute(
            "SELECT doc FROM docs WHERE kind = ? ORDER BY seq", (kind,)
        ).fetchall()
    return [json.loads(r[0]) for r in rows]


def replace_kind(kind: str, docs: Iterable[tuple[str, dict]]) -> None:
    """Write-through save: replace every document of a kind in one transaction.

    `docs` is (id, document) in the order they should be listed. Small data sets
    (users, sessions, library metadata, feed items) make wholesale replacement
    the simplest correct strategy; per-row updates arrive with the relational
    schema if scale ever demands it.
    """
    rows = [(kind, doc_id, json.dumps(doc), i) for i, (doc_id, doc) in enumerate(docs)]
    with _lock:
        c = conn()
        c.execute("DELETE FROM docs WHERE kind = ?", (kind,))
        c.executemany("INSERT INTO docs (kind, id, doc, seq) VALUES (?, ?, ?, ?)", rows)
        c.commit()


def append(kind: str, doc_id: str, doc: dict) -> None:
    """Upsert ONE document of a kind (append-friendly: no wholesale replace).

    Used by append-only kinds (audit log, metric snapshots) where rewriting the
    whole kind on every write would be wasteful.
    """
    with _lock:
        c = conn()
        row = c.execute(
            "SELECT seq FROM docs WHERE kind = ? AND id = ?", (kind, doc_id)
        ).fetchone()
        if row:
            c.execute(
                "UPDATE docs SET doc = ? WHERE kind = ? AND id = ?",
                (json.dumps(doc), kind, doc_id),
            )
        else:
            nxt = c.execute(
                "SELECT COALESCE(MAX(seq), -1) + 1 FROM docs WHERE kind = ?", (kind,)
            ).fetchone()[0]
            c.execute(
                "INSERT INTO docs (kind, id, doc, seq) VALUES (?, ?, ?, ?)",
                (kind, doc_id, json.dumps(doc), nxt),
            )
        c.commit()


def exists(kind: str, doc_id: str) -> bool:
    """Whether a document of this kind/id is already stored.

    The cheap primitive behind idempotency checks (processed Stripe event ids,
    consumed App Store transaction ids) — loading the whole kind to answer a
    point lookup would grow with history.
    """
    with _lock:
        row = conn().execute(
            "SELECT 1 FROM docs WHERE kind = ? AND id = ?", (kind, doc_id)
        ).fetchone()
    return row is not None


def migrate_legacy_json(kind: str, path: str, to_docs) -> list[dict]:
    """If `kind` is empty but a legacy JSON file exists, import it once.

    `to_docs(raw)` maps the parsed legacy JSON to a list of (id, doc). Returns
    the loaded documents either way.
    """
    existing = load(kind)
    if existing:
        return existing
    try:
        with open(path) as fh:
            raw = json.load(fh)
    except Exception:
        return []
    docs = to_docs(raw)
    if docs:
        replace_kind(kind, docs)
        try:
            os.rename(path, path + ".migrated")
        except Exception:
            pass
    return [d for _, d in docs]

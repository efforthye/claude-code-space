"""Auto-import generated clips into the Library on startup.

Scans settings.import_dir (e.g. ComfyUI's output folder) for *.mp4, copies new
ones into the storage backend, and adds a Library video for each — so anything
generated locally (even via the smoke test) is immediately viewable in the app.
Deduped via a small state file so restarts don't re-import.
"""

from __future__ import annotations

import glob
import json
import os

from .config import settings
from .storage import get_storage
from .store import library

_STATE = os.path.join(settings.storage_local_path, ".imported.json")


def _load_seen() -> set[str]:
    try:
        with open(_STATE) as fh:
            return set(json.load(fh))
    except Exception:
        return set()


def _save_seen(seen: set[str]) -> None:
    try:
        os.makedirs(settings.storage_local_path, exist_ok=True)
        with open(_STATE, "w") as fh:
            json.dump(sorted(seen), fh)
    except Exception:
        pass


async def import_from_dir(max_items: int = 20) -> int:
    """Import up to `max_items` newest un-imported .mp4s. Returns the count added."""
    directory = settings.import_dir
    if not directory or not os.path.isdir(directory):
        return 0
    files = sorted(
        glob.glob(os.path.join(directory, "*.mp4")),
        key=os.path.getmtime,
        reverse=True,
    )[:max_items]

    seen = _load_seen()
    store = get_storage()
    added = 0
    for path in files:
        name = os.path.basename(path)
        if name in seen:
            continue
        try:
            with open(path, "rb") as fh:
                data = fh.read()
        except Exception:
            continue
        film_key = f"films/import-{name}"
        store.save(film_key, data)
        await library.add_imported(name.rsplit(".", 1)[0], film_key, len(data))
        seen.add(name)
        added += 1
    if added:
        _save_seen(seen)
    return added

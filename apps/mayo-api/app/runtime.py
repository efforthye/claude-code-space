"""Runtime-mutable settings the app can flip without touching the host .env.

These start from the .env defaults (see config.py) but can be changed at runtime
via /v1/settings and persist to a small JSON file so the choice survives API
restarts — so the operator sets things once *from the app*, not by SSHing in.
"""

from __future__ import annotations

import json
import os

from .config import settings

_PATH = os.path.join(settings.storage_local_path, ".runtime.json")
_VALID_BACKENDS = {"mock", "comfy", "external"}


def _load() -> dict:
    try:
        with open(_PATH) as fh:
            return json.load(fh)
    except Exception:
        return {}


_state = {
    "generation_backend": _load().get("generation_backend", settings.generation_backend),
}


def _save() -> None:
    try:
        os.makedirs(os.path.dirname(_PATH) or ".", exist_ok=True)
        with open(_PATH, "w") as fh:
            json.dump(_state, fh)
    except Exception:
        pass  # best-effort persistence; in-memory value still applies


def generation_backend() -> str:
    return _state["generation_backend"]


def set_generation_backend(value: str) -> None:
    if value not in _VALID_BACKENDS:
        raise ValueError(f"invalid generation backend '{value}'")
    _state["generation_backend"] = value
    _save()

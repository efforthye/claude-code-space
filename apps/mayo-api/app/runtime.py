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
# AI director backends — mock (offline), local (free Ollama), claude (paid, best).
_VALID_PLANNERS = {"mock", "local", "claude"}


def _valid_director_models() -> set[str]:
    # Imported lazily to avoid an import cycle at module load (catalog -> schemas).
    from .catalog import DIRECTOR_MODELS

    return {m.id for m in DIRECTOR_MODELS}


def _load() -> dict:
    try:
        with open(_PATH) as fh:
            return json.load(fh)
    except Exception:
        return {}


_loaded = _load()
_state = {
    "generation_backend": _loaded.get("generation_backend", settings.generation_backend),
    # AI director backend + which director model to use (app-switchable, ADR 0008).
    "planner_backend": _loaded.get("planner_backend", settings.planner_backend),
    "director_model": _loaded.get("director_model", settings.director_model),
    # BYOK: the user runs on their own provider API key(s) (Higgsfield/Claude/…),
    # so they pay a fraction of the price. See ADR-to-come; pricing seam only for now.
    "byok": bool(_loaded.get("byok", False)),
}

# Fraction of the normal price charged when BYOK is on (10%).
BYOK_PRICE_FACTOR = 0.1


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


def planner_backend() -> str:
    return _state["planner_backend"]


def set_planner_backend(value: str) -> None:
    if value not in _VALID_PLANNERS:
        raise ValueError(f"invalid director backend '{value}'")
    _state["planner_backend"] = value
    _save()


def director_model() -> str:
    return _state["director_model"]


def set_director_model(value: str) -> None:
    if value not in _valid_director_models():
        raise ValueError(f"unknown director model '{value}'")
    _state["director_model"] = value
    _save()


def byok() -> bool:
    return bool(_state["byok"])


def set_byok(value: bool) -> None:
    _state["byok"] = bool(value)
    _save()


def price_factor() -> float:
    """Multiplier applied to credit prices (1.0 normally, 0.1 with BYOK)."""
    return BYOK_PRICE_FACTOR if byok() else 1.0

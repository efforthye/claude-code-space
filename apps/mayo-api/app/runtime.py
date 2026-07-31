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
# Generation backends the PRODUCT can be set to. "mock" is deliberately absent:
# it produces keys with no bytes, and leaving it selectable is how a dev stub
# ends up being what a real user gets — which is exactly what happened
# (2026-08-01: the runtime had been left on mock, so jobs reported "done" with
# nothing playable behind them).
#
# MockModelBackend still exists for tests, which need to exercise the pipeline
# offline, but nothing in configuration can reach it any more.
_VALID_BACKENDS = {"comfy", "external"}
# AI director backends — local (free Ollama), claude (paid, best). Same reason.
_VALID_PLANNERS = {"local", "claude"}


def _testing() -> bool:
    """True only under the test suite, which needs a renderer that does nothing.

    Gating the stub on MAYO_ENV=test keeps ONE code path instead of a parallel
    injection seam, while making it unreachable in any real deployment — the
    mini does not run as env=test.
    """
    import os

    return os.getenv("MAYO_ENV", "dev") == "test"


def _valid_backends() -> set[str]:
    return (_VALID_BACKENDS | {"mock"}) if _testing() else _VALID_BACKENDS


def _valid_planners() -> set[str]:
    return (_VALID_PLANNERS | {"mock"}) if _testing() else _VALID_PLANNERS


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
    # A previously persisted "mock" must not survive the removal. The state file
    # on the mini held exactly that, which is why real jobs were being answered
    # by a stub. Fall forward to local generation rather than honouring it.
    value = _state["generation_backend"]
    return value if value in _valid_backends() else "comfy"


def set_generation_backend(value: str) -> None:
    if value not in _valid_backends():
        raise ValueError(f"invalid generation backend '{value}'")
    _state["generation_backend"] = value
    _save()


def planner_backend() -> str:
    value = _state["planner_backend"]
    if value in _valid_planners():
        return value
    # Same fall-forward. Claude when the host can reach it, local otherwise —
    # both real, neither canned.
    import os

    return "claude" if os.getenv("ANTHROPIC_API_KEY") else "local"


def set_planner_backend(value: str) -> None:
    if value not in _valid_planners():
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

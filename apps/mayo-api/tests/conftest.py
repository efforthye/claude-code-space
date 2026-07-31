import os

# Speed up the mock generation worker so job-completion tests run fast.
# Must be set before app.config.settings is constructed (i.e. before app import).
os.environ.setdefault("MAYO_TICK_SECONDS", "0.05")
os.environ.setdefault("MAYO_ENV", "test")

# Tests run with MAYO_ENV=test, which is the ONLY context where the offline
# stub backend is selectable — see app/runtime.py.


def pytest_configure() -> None:
    """Pin both backends to the offline stub for the suite.

    Done through the normal setters, which accept "mock" only when
    MAYO_ENV=test (see app/runtime.py). Previously this happened by accident —
    "mock" was the shipped default — and that accident is what left the mini
    rendering stubs for real jobs. Now the suite has to ask for it explicitly.
    """
    from app import runtime

    runtime.set_generation_backend("mock")
    runtime.set_planner_backend("mock")

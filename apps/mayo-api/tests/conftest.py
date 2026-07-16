import os

# Speed up the mock generation worker so job-completion tests run fast.
# Must be set before app.config.settings is constructed (i.e. before app import).
os.environ.setdefault("MAYO_TICK_SECONDS", "0.05")
os.environ.setdefault("MAYO_ENV", "test")

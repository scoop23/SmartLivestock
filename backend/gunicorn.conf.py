"""Render defaults for API requests and synchronous forecast calculations."""

import os

# Keep one model-loaded process on small instances. A second request thread
# allows ordinary API calls to proceed while a forecast waits for PostgreSQL.
workers = int(os.environ.get("WEB_CONCURRENCY", "1"))
worker_class = "gthread"
threads = int(os.environ.get("GUNICORN_THREADS", "2"))
timeout = int(os.environ.get("GUNICORN_TIMEOUT", "150"))
graceful_timeout = 30
bind = f"0.0.0.0:{os.environ.get('PORT', '8000')}"
accesslog = "-"
errorlog = "-"

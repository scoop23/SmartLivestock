#!/usr/bin/env bash
set -e
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT/backend"
unset DATABASE_URL
export SMARTLIVESTOCK_ENV_FILE=.env.local
if command -v pipenv >/dev/null 2>&1 && [[ -f Pipfile ]]; then
  exec pipenv run python manage.py runserver 127.0.0.1:8000
elif [[ -x .venv/bin/python ]]; then
  exec .venv/bin/python manage.py runserver 127.0.0.1:8000
else
  exec python3 manage.py runserver 127.0.0.1:8000
fi

#!/bin/sh

(cd frontend && npm run dev) &

(cd backend && python -m pipenv run python manage.py runserver) &

wait

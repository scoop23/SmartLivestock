FROM python:3.13-slim AS base

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

RUN pip install --no-cache-dir pipenv

COPY Pipfile Pipfile.lock ./

RUN pipenv install --system --deploy

COPY . .

RUN useradd --create-home --shell /usr/sbin/nologin appuser \
    && chown -R appuser:appuser /app

EXPOSE 8000

# Compose selects this target for local development and overrides the command
# with Django's autoreloading development server.
FROM base AS development
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]

# The default image runs behind Gunicorn; do not use Django runserver in production.
FROM base AS production
USER appuser
CMD ["sh", "-c", "python manage.py collectstatic --noinput && exec gunicorn smartlivestock.wsgi:application --bind 0.0.0.0:8000 --workers 3 --timeout 120"]

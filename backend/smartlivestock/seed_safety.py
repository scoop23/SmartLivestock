"""Shared safeguards for synthetic seed commands that can change operational tables."""

import os
import sys

from django.conf import settings
from django.core.management.base import CommandError
from django.db import connections


def assert_safe_seed_database(*, clean=False, dry_run=False):
    """Allow tests, local development, or an explicitly acknowledged staging database."""
    connection = connections["default"]
    database_name = str(connection.settings_dict.get("NAME") or "")
    in_test_run = "test" in sys.argv or (
        connection.vendor == "sqlite" and "memory" in database_name.lower()
    )
    target_env = os.environ.get("SMARTLIVESTOCK_DEMO_ENV", "").strip().lower()
    is_render = any(
        os.environ.get(key)
        for key in ("RENDER", "RENDER_SERVICE_ID", "RENDER_EXTERNAL_HOSTNAME")
    )

    if target_env == "production":
        raise CommandError("Refusing to run synthetic seed data against production.")
    if is_render and target_env != "staging":
        raise CommandError(
            "Refusing to seed an unidentified Render service. Use a separate staging database and set "
            "SMARTLIVESTOCK_DEMO_ENV=staging with its exact database acknowledgement."
        )
    if not settings.DEBUG and target_env != "staging" and not in_test_run:
        raise CommandError(
            "Refusing to seed with DEBUG disabled unless the database is explicitly identified as staging."
        )

    if target_env == "development" and connection.vendor == "postgresql":
        host = str(connection.settings_dict.get("HOST") or "").lower()
        if host not in {"localhost", "127.0.0.1", "::1", "db", "smartlivestock-db"}:
            raise CommandError("Development seeding requires local PostgreSQL; no database changes were made.")

    is_test_memory_database = connection.vendor == "sqlite" and "memory" in database_name.lower()
    if not is_test_memory_database and not in_test_run:
        expected_ack = f"{target_env}:{database_name}"
        if (
            target_env not in {"development", "staging"}
            or os.environ.get("SMARTLIVESTOCK_DEMO_DATABASE_ACK") != expected_ack
        ):
            raise CommandError(
                "Set SMARTLIVESTOCK_DEMO_ENV=development|staging and "
                "SMARTLIVESTOCK_DEMO_DATABASE_ACK=<environment>:<database-name> for this exact database. "
                "No database changes were made."
            )

    if clean and not dry_run and not in_test_run:
        if os.environ.get("SMARTLIVESTOCK_DEMO_ALLOW_CLEANUP") != "YES":
            raise CommandError(
                "--clean requires SMARTLIVESTOCK_DEMO_ALLOW_CLEANUP=YES after confirming "
                "this is the intended development or staging database."
            )

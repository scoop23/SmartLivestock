"""Use Django's selected database for synthetic seed commands.

Database selection belongs to SMARTLIVESTOCK_ENV_FILE / DATABASE_URL.
Cleanup authorization is the command's --clean flag; individual seeds retain
ownership checks so unrelated records are preserved.
"""
from django.core.management.base import CommandError
from django.db import connections


def assert_safe_seed_database(*, clean=False, dry_run=False):
    """Require a configured database without additional demo environment flags."""
    if not connections["default"].settings_dict.get("NAME"):
        raise CommandError("Configure DATABASE_URL directly or through SMARTLIVESTOCK_ENV_FILE before running a seed command.")

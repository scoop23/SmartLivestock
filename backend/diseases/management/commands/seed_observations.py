"""Compatibility alias for the ownership-tracked disease/mortality analytics demo."""

from django.core.management import call_command
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = (
        "Deprecated compatibility command; forwards to the ownership-tracked disease/mortality analytics demo."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--clean",
            action="store_true",
            help="Delete only objects tracked as owned by the disease/mortality analytics demo.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show the demo command's planned action without changing data.",
        )

    def handle(self, *args, **options):
        call_command(
            "seed_disease_mortality_analytics_demo",
            clean=options["clean"],
            dry_run=options["dry_run"],
        )

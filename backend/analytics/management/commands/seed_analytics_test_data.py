"""
Master Test-Data Management Command for SmartLivestock Analytics.

=============================================================================
EDUCATIONAL OVERVIEW:
=============================================================================
This master command coordinates the deterministic seeding and cleaning of synthetic
test records across all 5 analytics test domains:
  1. Monthly Production (Milk, Farmer-reported Meat, Eggs, Wool)
  2. Calving & Offspring Records
  3. Disease Surveillance Cases
  4. Livestock Mortality Records
  5. Pre-Movement Inspection & Transport Clearance Certificates

SAFETY GUARANTEES:
  - Running without --clean seeds realistic synthetic test datasets with distinct markers.
  - Running with --clean removes ONLY records marked with the project's seed markers.
  - Real farmer accounts, registered inventory, production yields, and certificates are NEVER touched.
"""

from django.core.management import call_command
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = (
        "Deterministically seeds or cleans all synthetic test datasets for SmartLivestock analytics.\n"
        "Runs: seed_productions, seed_calving, seed_diseases, seed_mortality, seed_inspections.\n"
        "Use --clean to safely purge ONLY synthetic records carrying project seed markers."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--clean",
            action="store_true",
            help="Safely remove all synthetic analytics test records across all domains.",
        )
        parser.add_argument(
            "--months",
            type=int,
            default=36,
            help="Number of months for time-series production series (default: 36).",
        )

    def handle(self, *args, **options):
        clean_mode = options["clean"]
        months = options["months"]

        if clean_mode:
            self.stdout.write(self.style.NOTICE("Initiating clean across all synthetic analytics datasets..."))
            
            # Clean in reverse dependency order
            self.stdout.write("1. Cleaning synthetic livestock inspections & clearances...")
            call_command("seed_inspections", clean=True)

            self.stdout.write("2. Cleaning synthetic mortality records...")
            call_command("seed_mortality", clean=True)

            self.stdout.write("3. Cleaning synthetic disease cases...")
            call_command("seed_diseases", clean=True)

            self.stdout.write("4. Cleaning synthetic calving records...")
            call_command("seed_calving", clean=True)

            self.stdout.write("5. Cleaning synthetic production records...")
            call_command("seed_productions", clean=True)

            self.stdout.write(
                self.style.SUCCESS(
                    "\nAll synthetic analytics test data cleaned successfully.\n"
                    "Real farmer data and authoritative municipal records remain completely intact."
                )
            )
            return

        self.stdout.write(self.style.NOTICE(f"Seeding synthetic analytics test datasets (Production: {months} months)..."))

        self.stdout.write("\n--- [1/5] Production Time-Series (Milk, Meat, Eggs, Wool) ---")
        call_command("seed_productions", months=months, production_type="ALL")

        self.stdout.write("\n--- [2/5] Calving & Reproduction Records ---")
        call_command("seed_calving", count=24)

        self.stdout.write("\n--- [3/5] Disease Surveillance Cases ---")
        call_command("seed_diseases", count=25)

        self.stdout.write("\n--- [4/5] Livestock Mortality Records ---")
        call_command("seed_mortality", count=20)

        self.stdout.write("\n--- [5/5] Pre-Movement Inspections & Clearances ---")
        call_command("seed_inspections", count=24)

        self.stdout.write(
            self.style.SUCCESS(
                "\n=======================================================\n"
                "  ALL SYNTHETIC ANALYTICS TEST DATA SEEDED SUCCESSFULLY!\n"
                "=======================================================\n"
                "To clean all test records safely at any time:\n"
                "  python manage.py seed_analytics_test_data --clean\n"
            )
        )

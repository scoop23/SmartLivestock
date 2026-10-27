"""Print a read-only catalog and demo plan for SmartLivestock seed commands."""

import re

from django.core.management import get_commands, load_command_class
from django.core.management.base import BaseCommand


SEED_NOTES = {
    "seed_analytics_test_data": (
        "Core multi-domain analytics dataset",
        "Monthly farmer production, slaughter, auction sales, calving, disease, mortality, inspections, and clearances. "
        "The master command also seeds auction sales, even though its built-in help omits that command; --clean is marker-scoped.",
    ),
    "seed_productions": (
        "Production trends",
        "Synthetic monthly milk, farmer-reported meat, egg, and wool records; useful for commodity time-series charts.",
    ),
    "seed_slaughters": (
        "Slaughterhouse activity",
        "Synthetic daily slaughter events. Head count and carcass weight are separate measures from farmer-reported meat.",
    ),
    "seed_auction": (
        "Live animal sales",
        "Synthetic auction/live-sale records for animal head counts and transaction values.",
    ),
    "seed_calving": (
        "Birth and offspring history",
        "Synthetic calving records linked to eligible livestock; supports reproductive and lineage views.",
    ),
    "seed_diseases": (
        "Disease surveillance",
        "Synthetic disease cases for surveillance summaries and disease trend views.",
    ),
    "seed_mortality": (
        "Mortality surveillance",
        "Synthetic mortality records, optionally associated with seeded disease cases.",
    ),
    "seed_inspections": (
        "Pre-movement inspection and clearance",
        "Synthetic inspection items and transport clearances for inspection/report summaries.",
    ),
    "seed_forecast_quality_demo": (
        "Forecast quality comparison",
        "Select one isolated ideal or poor synthetic scenario for milk, meat, slaughter, and auction forecasts. "
        "The scenarios share analytics APIs; clean the current scenario before switching.",
    ),
    "seed_surveillance_demo": (
        "Disease and mortality alert walkthrough",
        "Creates linked, clearly marked synthetic surveillance fixtures and tracks their ownership. "
        "Useful for demonstrating alert logic, not evidence of forecast accuracy.",
    ),
    "seed_disease_mortality_analytics_demo": (
        "Disease and mortality analytics examples",
        "Creates marked synthetic disease/mortality records and demo farmer fixtures for analytics examples.",
    ),
    "seed_individual_milk_forecasting": (
        "Individual-cow milk forecast",
        "Uses isolated demo-cow and daily-observation tables, separate from ordinary farmer production records.",
    ),
    "seed_cat_b301_10_milk_demo": (
        "CAT-B301-10 milk example",
        "Creates 60 isolated synthetic daily observations. Inspect this command before running: it can set the "
        "matching inventory animal's birth date when preparing the example.",
    ),
    "seed_milk_anomaly_demo": (
        "Milk anomaly and review workflow",
        "Creates owned demo accounts, livestock, milk history, and review notifications. The command has database "
        "safety checks and uses SMARTLIVESTOCK_DEMO_PASSWORD for demo logins.",
    ),
    "seed_farmers": (
        "Farmer account fixtures",
        "Creates synthetic farmer reference accounts; this is setup data, not an analytics-only seed.",
    ),
    "seed_observations": (
        "Disease observation fixtures",
        "Creates synthetic disease cases and mortality records linked to existing livestock inventory; check its help for cleanup behavior.",
    ),
}


class Command(BaseCommand):
    help = "Scan installed seed management commands and print a read-only analytics demo plan."

    def add_arguments(self, parser):
        parser.add_argument(
            "--demo",
            action="store_true",
            help="Print a recommended presentation sequence and commands. Does not run seeds.",
        )

    def handle(self, *args, **options):
        commands_by_name = get_commands()
        seed_names = sorted(name for name in commands_by_name if name.startswith("seed_"))

        self.stdout.write(self.style.SUCCESS("SmartLivestock seed command catalog (read-only)"))
        self.stdout.write("This command only inspects installed command descriptions. It does not read or change database rows.\n")

        for name in seed_names:
            app_name = commands_by_name[name]
            command = load_command_class(app_name, name)
            help_text = re.sub(r"\s+", " ", command.help or command.__doc__ or "").strip()
            if name in SEED_NOTES:
                title, scope = SEED_NOTES[name]
                self.stdout.write(f"{name} [{title}]\n  Seeds: {scope}")
            else:
                self.stdout.write(f"{name} [{app_name}]\n  Seeds: See command help; no analytics-specific description is registered.")
            if help_text:
                self.stdout.write(f"  Command help: {help_text}")
            self.stdout.write(f"  Options: python manage.py {name} --help\n")

        if options["demo"]:
            self.stdout.write(self.style.SUCCESS("Recommended analytics presentation sequence"))
            self.stdout.write(
                "1. Confirm manage.py uses your disposable local PostgreSQL database. Do not seed Render or other operational data.\n"
                "2. Forecast analytics: python manage.py seed_forecast_quality_demo --scenario ideal\n"
                "   Open the forecast-quality views to show synthetic milk, meat, slaughter, and auction examples.\n"
                "   To compare poor quality, run: python manage.py seed_forecast_quality_demo --scenario ideal --clean\n"
                "   Then run: python manage.py seed_forecast_quality_demo --scenario poor\n"
                "3. GIS movement: python manage.py seed_inspections\n"
                "   Open GIS Map and enable Movement. The seed creates inspection and clearance records with mixed review statuses;\n"
                "   only clearances with APPROVED status are drawn as official movement records.\n"
                "Both seeds create synthetic data. Verify command prerequisites and the configured local database before running."
            )

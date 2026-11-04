"""Print a read-only catalog and demo plan for SmartLivestock seed commands."""

import re

from django.core.management import get_commands, load_command_class
from django.core.management.base import BaseCommand


SEED_NOTES = {
    "seed_analytics_roles_demo": (
        "Role-based analytics demo bundle",
        "Uses up to three existing survey Farmer accounts from seed_farmers and creates clearly marked CBAT, MAO, and Auction demo accounts, then seeds 36 months of production/slaughter, 104 weeks of Auction transfers, and 24 months of irregular disease/mortality events. "
        "It never creates or changes Farmer accounts. Disease/mortality months use reversible synthetic coverage confirmations in the selected Farmer's barangay; --clean removes owned records but preserves seed_farmers accounts/profiles and demo staff accounts. Requires SMARTLIVESTOCK_DEMO_PASSWORD for first-time staff accounts and explicit database acknowledgement.",
    ),
    "seed_analytics_test_data": (
        "Core multi-domain analytics dataset",
        "Monthly farmer production (Meat, Eggs, Wool by default; Milk and Slaughter are available as opt-in demos), "
        "legacy sale summaries, current ownership transfers when approved AUCTION and MAO users exist, calving, disease, mortality, inspections, and clearances. "
        "Use --clean for marker-scoped cleanup across all domains. The command allows local development or an explicitly acknowledged staging database and refuses production.",
    ),
    "seed_productions": (
        "Production trends",
        "Synthetic monthly farmer-reported meat, egg, and wool records by default (Milk omitted by default; opt-in via --include-milk); useful for commodity time-series charts.",
    ),
    "seed_slaughters": (
        "Slaughterhouse activity",
        "Synthetic daily slaughter events (omitted from master seed by default; opt-in via --include-slaughter). Head count and carcass weight are separate measures from farmer-reported meat.",
    ),
    "seed_auction": (
        "Legacy live animal sale summaries",
        "Synthetic aggregate records for older LiveAnimalSale reports. Current completed transfers use seed_ownership_transfers.",
    ),
    "seed_ownership_transfers": (
        "Current auction ownership transfers",
        "Creates per-animal synthetic certificate rows through the Auction-to-MAO workflow; approved rows include reviewer and provenance markers. Production is refused; staging requires the exact database acknowledgement.",
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
        "The ideal auction series has 104 weeks averaging 2,500 synthetic external head-transfer rows per week, calibrated to the published 2022 species mix. "
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
        "Creates 60 isolated synthetic daily observations and a demo-only assumed age. It does not change the canonical inventory animal.",
    ),
    "seed_milk_anomaly_demo": (
        "Milk anomaly and review workflow",
        "Creates owned demo accounts, livestock, milk history, and review notifications. The command has database "
        "safety checks and uses SMARTLIVESTOCK_DEMO_PASSWORD for demo logins.",
    ),
    "seed_farmers": (
        "Farmer account fixtures",
        "Creates survey-based farmer fixtures. Use --clean --dry-run to preview, or --clean --email <email> for one exact fixture; cleanup keeps accounts and farmer profiles. Production is refused; staging requires the exact database acknowledgement.",
    ),
    "seed_observations": (
        "Legacy disease observation command",
        "Forwards to the ownership-tracked disease/mortality analytics demo; --clean removes only objects owned by that demo.",
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
                "1. Confirm the exact local or staging PostgreSQL target. Never identify an operational database as staging.\n"
                "2. Set SMARTLIVESTOCK_DEMO_PASSWORD for first-time CBAT, MAO, and Auction demo accounts.\n"
                "3. Run: python manage.py seed_analytics_roles_demo --scenario ideal\n"
                "   This uses Farmer accounts from seed_farmers and prepares CBAT, MAO, and Auction demo accounts plus synthetic role/analytics data.\n"
                "4. Clean only this bundle's marked data with: python manage.py seed_analytics_roles_demo --scenario ideal --clean\n"
                "   The role accounts and Farmer profiles remain. Use --dry-run to preview an action.\n"
                "All generated records are synthetic; this bundle does not cover every analytics page, such as census or NLP review."
            )

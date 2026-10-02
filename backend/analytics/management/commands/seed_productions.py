"""
Deterministic Seed Command for SmartLivestock Predictive Analytics Testing.

Safety Guarantees:
1. Never deletes or modifies real farmer records, inventory, or unseeded production.
2. Uses the distinct deterministic marker: AI_SEED::PREDICTIVE_ANALYTICS::V1 in `notes`.
3. `--clean` strictly queries `notes__contains="AI_SEED::PREDICTIVE_ANALYTICS::V1"` and deletes ONLY those.
4. Idempotent: Refuses to duplicate seed data if marker is already present.
5. Deterministic: Uses fixed numpy seed (random_state=42) for reproducible data variation.
"""

from datetime import date
from decimal import Decimal
import numpy as np

from django.core.management.base import BaseCommand
from django.utils import timezone

from production.models import ProductionRecord
from livestock.models import LivestockInventory
from users.models import User

SEED_MARKER = "AI_SEED::PREDICTIVE_ANALYTICS::V1"


class Command(BaseCommand):
    help = (
        "Deterministically seeds or cleans test production records for predictive analytics.\n"
        "All generated records carry the marker 'AI_SEED::PREDICTIVE_ANALYTICS::V1' in notes.\n"
        "Use --clean to safely remove ONLY seeded records without touching real production data."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--clean",
            action="store_true",
            help="Safely remove ONLY seeded test production records.",
        )
        parser.add_argument(
            "--months",
            type=int,
            default=36,
            help="Number of consecutive monthly observations to generate (default: 36).",
        )
        parser.add_argument(
            "--production-type",
            type=str,
            default="MILK",
            choices=["MILK", "MEAT", "EGGS", "WOOL"],
            help="Type of production yield to seed (default: MILK).",
        )
        parser.add_argument(
            "--unit",
            type=str,
            default="LITERS",
            choices=["LITERS", "KILOGRAMS", "PIECES"],
            help="Measurement unit (default: LITERS).",
        )

    def handle(self, *args, **options):
        if options["clean"]:
            self._handle_clean()
            return

        self._handle_seed(
            months=options["months"],
            production_type=options["production_type"],
            unit=options["unit"],
        )

    def _handle_clean(self):
        """Safely delete ONLY records containing the deterministic seed marker."""
        seed_qs = ProductionRecord.objects.filter(notes__contains=SEED_MARKER)
        count = seed_qs.count()

        if count == 0:
            self.stdout.write(self.style.WARNING("No seeded test records found to clean."))
            return

        deleted_count, _ = seed_qs.delete()
        self.stdout.write(
            self.style.SUCCESS(
                f"Successfully removed {deleted_count} predictive analytics seed production records.\n"
                f"Real farmer production records, inventory, and users were NOT modified."
            )
        )

    def _handle_seed(self, months: int, production_type: str, unit: str):
        # 1. Idempotency Check: Do not duplicate if marker already exists
        existing_count = ProductionRecord.objects.filter(notes__contains=SEED_MARKER).count()
        if existing_count > 0:
            self.stdout.write(
                self.style.WARNING(
                    f"Found {existing_count} existing seeded records with marker '{SEED_MARKER}'.\n"
                    f"To re-seed fresh data, first run:\n"
                    f"  python manage.py seed_productions --clean"
                )
            )
            return

        # 2. Locate Anchor Livestock & Users
        # Find approved Cattle/Carabao/Dairy inventory to anchor the production record
        anchor_inventory = (
            LivestockInventory.objects.filter(
                status="APPROVED",
                livestock_type__name__iregex=r"(cattle|cow|carabao|goat)",
            ).first()
            or LivestockInventory.objects.filter(status="APPROVED").first()
        )

        # Reviewer: MAO user for authoritative APPROVED status
        mao_user = (
            User.objects.filter(role__role_name__icontains="MAO").first()
            or User.objects.filter(is_superuser=True).first()
            or User.objects.first()
        )

        creator_user = (
            (anchor_inventory.farmer.user if (anchor_inventory and anchor_inventory.farmer and anchor_inventory.farmer.user) else None)
            or mao_user
        )

        if not mao_user:
            self.stdout.write(self.style.ERROR("Cannot seed: No user account found in database."))
            return

        # 3. Generate Deterministic Synthetic Monthly Series
        # We start `months` months ago and end on the previous month so all observations are completed historical periods.
        rng = np.random.RandomState(42)  # Fixed seed for reproducibility

        today = timezone.localdate()
        # Compute start month: e.g. for months=36, starting 36 months before current month
        start_year = today.year - (months // 12) - 1
        start_month = (today.month - (months % 12))
        if start_month <= 0:
            start_month += 12
            start_year -= 1

        records_to_create = []
        created_dates = []

        # Synthetic curve parameters:
        # Base level: 420 Liters
        # Gentle upward trend: +1.5 Liters/month
        # Annual seasonality: sinusoidal cycle with peak in Q3 (monsoon/calving) and dip in Q1 (dry heat)
        # Realistic noise: Gaussian sigma=12
        # Occasional operational anomalies: small drop or boost
        base_level = 420.0
        trend_slope = 1.8

        cur_year = start_year
        cur_month = start_month

        for step in range(months):
            # Advance to next calendar month
            cur_month += 1
            if cur_month > 12:
                cur_month = 1
                cur_year += 1

            # Observation date set to the 15th of the month
            obs_date = date(cur_year, cur_month, 15)
            created_dates.append(obs_date)

            # Seasonality: 12-month period wave
            month_angle = 2.0 * np.pi * (cur_month - 1) / 12.0
            seasonal_component = 35.0 * np.sin(month_angle - 1.0)

            # Trend
            trend_component = trend_slope * step

            # Noise & realistic occasional fluctuation
            noise = rng.normal(loc=0.0, scale=14.0)
            if step == 14:  # realistic mild drought/feed shortage dip
                noise -= 32.0
            elif step == 26:  # realistic lactation peak boost
                noise += 28.0

            monthly_qty = round(max(150.0, base_level + trend_component + seasonal_component + noise), 2)

            record = ProductionRecord(
                livestock=anchor_inventory,
                production_type=production_type,
                quantity=Decimal(str(monthly_qty)),
                unit=unit,
                record_date=obs_date,
                status=ProductionRecord.ProductionStatus.APPROVED,
                notes=f"{SEED_MARKER} Month {step + 1}/{months} (Observed: {monthly_qty} {unit})",
                reviewed_by=mao_user,
                reviewed_at=timezone.now(),
                review_remarks="Approved synthetic test observation for ML predictive analytics verification.",
                created_by=creator_user,
            )
            records_to_create.append(record)

        # 4. Bulk Insert
        ProductionRecord.objects.bulk_create(records_to_create)

        self.stdout.write(
            self.style.SUCCESS(
                f"\nPredictive analytics seed complete.\n"
                f"-----------------------------------------\n"
                f"  Dataset Details:\n"
                f"    Production Type:    {production_type}\n"
                f"    Unit:               {unit}\n"
                f"    Frequency:          MONTHLY\n"
                f"    Months Seeded:      {months}\n"
                f"    Date Range:         {created_dates[0]} to {created_dates[-1]}\n"
                f"    Records Created:    {len(records_to_create)}\n"
                f"    Seed Marker:        {SEED_MARKER}\n"
                f"    Anchor Inventory:   {anchor_inventory.id if anchor_inventory else 'None'}\n"
                f"-----------------------------------------\n"
                f"To remove ONLY these test records without modifying real production:\n"
                f"  python manage.py seed_productions --clean\n"
            )
        )

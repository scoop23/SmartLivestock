"""
Deterministic Seed Command for SmartLivestock Production Predictive Analytics Testing.

=============================================================================
EDUCATIONAL OVERVIEW & SAFETY GUARANTEES:
=============================================================================
1. Non-Destructive Synthetic Testing:
   These records are strictly synthetic test benches for model benchmark evaluation
   and forecasting charts. They must NEVER overwrite or delete real farmer production data.

2. Deterministic Seed Marker:
   Every generated record carries the marker: AI_SEED::ANALYTICS_TEST::PRODUCTION::V2
   Cleaning (--clean) strictly queries records where notes contain this marker (or the legacy
   marker AI_SEED::PREDICTIVE_ANALYTICS::V1) and deletes ONLY those. Real records are untouched.

3. Farmer-Reported Meat vs. Slaughterhouse-Derived Meat:
   In municipal livestock management, meat output can originate from two separate sources:
     - Slaughterhouse facility records (tracked via SlaughterRecord and carcass_weight).
     - Farmer-reported on-farm production / direct farm gate yield.
   To prevent double-counting slaughter events, farmer-reported meat records intentionally have
   `slaughter = None`. This distinction allows analytics pipelines to aggregate farmer output
   independently from municipal abattoir slaughter figures.

4. Unit Purity Rule:
   Different production yields have incompatible physical units:
     - Milk: LITERS
     - Meat: KILOGRAMS
     - Eggs: PIECES
     - Wool: KILOGRAMS
   Never combine different units into a single numeric axis. Each predictive time series
   strictly models a single (production_type, unit) pair.
"""

from datetime import date
from decimal import Decimal
from typing import List, Tuple
import numpy as np

from django.core.management.base import BaseCommand
from django.db.models import Q
from django.utils import timezone

from production.models import ProductionRecord
from livestock.models import LivestockInventory
from users.models import User
from analytics.seed_markers import SEED_MARKER_PRODUCTION_V2, SEED_MARKER_PRODUCTION_LEGACY

# Default target specifications: (production_type, unit, base_level, trend_slope, seasonal_amp, noise_sigma)
COMMODITY_CONFIGS = {
    "MILK": {
        "unit": ProductionRecord.UnitType.LITERS,
        "base_level": 420.0,
        "trend_slope": 1.8,
        "seasonal_amp": 35.0,
        "noise_sigma": 14.0,
        "min_val": 150.0,
        "species_pattern": r"(cattle|cow|carabao|dairy|goat)",
    },
    "MEAT": {
        "unit": ProductionRecord.UnitType.KILOGRAMS,
        "base_level": 850.0,
        "trend_slope": 2.5,
        "seasonal_amp": 60.0,
        "noise_sigma": 25.0,
        "min_val": 300.0,
        "species_pattern": r"(cattle|swine|pig|hog|goat)",
    },
    "EGGS": {
        "unit": ProductionRecord.UnitType.PIECES,
        "base_level": 3200.0,
        "trend_slope": 15.0,
        "seasonal_amp": 280.0,
        "noise_sigma": 80.0,
        "min_val": 1200.0,
        "species_pattern": r"(poultry|chicken|duck|layer)",
    },
    "WOOL": {
        "unit": ProductionRecord.UnitType.KILOGRAMS,
        "base_level": 180.0,
        "trend_slope": 0.8,
        "seasonal_amp": 25.0,
        "noise_sigma": 8.0,
        "min_val": 50.0,
        "species_pattern": r"(sheep|goat|cattle)",
    },
}


class Command(BaseCommand):
    help = (
        "Deterministically seeds or cleans synthetic test production records for predictive analytics.\n"
        "All generated records carry the deterministic marker 'AI_SEED::ANALYTICS_TEST::PRODUCTION::V2'.\n"
        "Use --clean to safely remove ONLY synthetic records without modifying real farmer data."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--clean",
            action="store_true",
            help="Safely remove ONLY seeded synthetic production records.",
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
            choices=["ALL", "MILK", "MEAT", "EGGS", "WOOL"],
            help="Commodity to seed: MILK (default), MEAT, EGGS, WOOL, or ALL (seeds all 4).",
        )
        parser.add_argument(
            "--unit",
            type=str,
            default=None,
            choices=["LITERS", "KILOGRAMS", "PIECES"],
            help="Optional unit override (must be compatible with chosen commodity).",
        )

    def handle(self, *args, **options):
        if options["clean"]:
            self._handle_clean()
            return

        self._handle_seed(
            months=options["months"],
            production_type=options["production_type"],
            unit_override=options["unit"],
        )

    def _handle_clean(self):
        """Safely delete ONLY records containing the deterministic seed markers."""
        # Query specifically for test markers — never touch records without markers
        seed_qs = ProductionRecord.objects.filter(
            Q(notes__contains=SEED_MARKER_PRODUCTION_V2)
            | Q(notes__contains=SEED_MARKER_PRODUCTION_LEGACY)
        )
        count = seed_qs.count()

        if count == 0:
            self.stdout.write(self.style.WARNING("No seeded test production records found to clean."))
            return

        deleted_count, _ = seed_qs.delete()
        self.stdout.write(
            self.style.SUCCESS(
                f"Successfully removed {deleted_count} synthetic production seed records.\n"
                f"Real farmer production records, inventory, and accounts were NOT modified."
            )
        )

    def _handle_seed(self, months: int, production_type: str, unit_override: str):
        # Determine which commodities to generate
        if production_type == "ALL":
            commodities_to_seed = ["MILK", "MEAT", "EGGS", "WOOL"]
        else:
            commodities_to_seed = [production_type]

        # Check existing seeded records
        existing_count = ProductionRecord.objects.filter(
            Q(notes__contains=SEED_MARKER_PRODUCTION_V2)
            | Q(notes__contains=SEED_MARKER_PRODUCTION_LEGACY)
        ).count()

        if existing_count > 0:
            self.stdout.write(
                self.style.WARNING(
                    f"Found {existing_count} existing synthetic seed records in the database.\n"
                    f"To replace or re-seed fresh test data, first run:\n"
                    f"  python manage.py seed_productions --clean"
                )
            )
            return

        # Reviewer: MAO user for authoritative APPROVED status
        mao_user = (
            User.objects.filter(role__role_name__icontains="MAO").first()
            or User.objects.filter(is_superuser=True).first()
            or User.objects.first()
        )
        if not mao_user:
            self.stdout.write(self.style.ERROR("Cannot seed: No user account found in database."))
            return

        # Fixed random seed ensures exact reproducibility across runs
        rng = np.random.RandomState(42)

        today = timezone.localdate()
        start_year = today.year - (months // 12) - 1
        start_month = (today.month - (months % 12))
        if start_month <= 0:
            start_month += 12
            start_year -= 1

        total_created = 0

        for commodity in commodities_to_seed:
            cfg = COMMODITY_CONFIGS[commodity]
            unit = unit_override or cfg["unit"]

            # Locate appropriate anchor inventory for this commodity species
            anchor_inventory = (
                LivestockInventory.objects.filter(
                    status="APPROVED",
                    livestock_type__name__iregex=cfg["species_pattern"],
                ).first()
                or LivestockInventory.objects.filter(status="APPROVED").first()
            )

            creator_user = (
                (anchor_inventory.farmer.user if (anchor_inventory and anchor_inventory.farmer and anchor_inventory.farmer.user) else None)
                or mao_user
            )

            records_to_create: List[ProductionRecord] = []
            cur_year = start_year
            cur_month = start_month

            for step in range(months):
                cur_month += 1
                if cur_month > 12:
                    cur_month = 1
                    cur_year += 1

                obs_date = date(cur_year, cur_month, 15)

                # 12-month annual sinusoidal wave
                month_angle = 2.0 * np.pi * (cur_month - 1) / 12.0
                seasonal_component = cfg["seasonal_amp"] * np.sin(month_angle - 1.0)
                trend_component = cfg["trend_slope"] * step
                noise = rng.normal(loc=0.0, scale=cfg["noise_sigma"])

                # Add realistic episodic perturbations (e.g. wet season dip, feed flush boost)
                if step == 14:
                    noise -= cfg["noise_sigma"] * 2.2
                elif step == 26:
                    noise += cfg["noise_sigma"] * 2.0

                monthly_qty = round(max(cfg["min_val"], cfg["base_level"] + trend_component + seasonal_component + noise), 2)

                # -------------------------------------------------------------------------
                # EDUCATIONAL NOTE: FARMER-REPORTED MEAT PRODUCTION
                # -------------------------------------------------------------------------
                # A farmer-reported meat production record is different from a slaughterhouse event.
                # A slaughter-linked ProductionRecord represents an output produced by a specific
                # slaughter facility event (with a foreign key link to SlaughterRecord).
                # Here, `slaughter` is intentionally NULL so that descriptive and predictive
                # analytics can distinguish direct farmer production from abattoir throughput.
                # -------------------------------------------------------------------------
                record = ProductionRecord(
                    livestock=anchor_inventory,
                    production_type=commodity,
                    quantity=Decimal(str(monthly_qty)),
                    unit=unit,
                    record_date=obs_date,
                    status=ProductionRecord.ProductionStatus.APPROVED,
                    slaughter=None,  # Intentionally NULL for farmer-reported output
                    notes=f"{SEED_MARKER_PRODUCTION_V2} [{commodity}] Month {step + 1}/{months} (Yield: {monthly_qty} {unit})",
                    reviewed_by=mao_user,
                    reviewed_at=timezone.now(),
                    review_remarks="Approved synthetic test observation for ML predictive analytics verification.",
                    created_by=creator_user,
                )
                records_to_create.append(record)

            ProductionRecord.objects.bulk_create(records_to_create)
            total_created += len(records_to_create)

            self.stdout.write(
                f"  -> Seeded {len(records_to_create)} monthly records for {commodity} ({unit})"
            )

        self.stdout.write(
            self.style.SUCCESS(
                f"\nProduction predictive analytics seed completed successfully!\n"
                f"-----------------------------------------------------------\n"
                f"  Commodities Seeded: {', '.join(commodities_to_seed)}\n"
                f"  Total Records:      {total_created}\n"
                f"  Months per Series:  {months}\n"
                f"  Seed Marker:        {SEED_MARKER_PRODUCTION_V2}\n"
                f"-----------------------------------------------------------\n"
                f"To remove ONLY these synthetic test records:\n"
                f"  python manage.py seed_productions --clean\n"
            )
        )

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
from analytics.seed_markers import (
    SEED_MARKER_PRODUCTION_V2,
    SEED_MARKER_PRODUCTION_LEGACY,
    SEED_MARKER_FORECAST_QUALITY_IDEAL,
    SEED_MARKER_FORECAST_QUALITY_POOR,
)

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


def shift_month(month_start: date, offset: int) -> date:
    """Return the first day of a month moved by `offset` calendar months."""
    month_index = month_start.year * 12 + month_start.month - 1 + offset
    return date(month_index // 12, month_index % 12 + 1, 1)


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
            "--clean-milk-only",
            action="store_true",
            help="Safely remove ONLY seeded synthetic milk records without removing other commodities.",
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
            default="ALL",
            choices=["ALL", "MILK", "MEAT", "EGGS", "WOOL"],
            help="Commodity to seed: ALL (default: Meat, Eggs, Wool), MEAT, EGGS, WOOL, or MILK.",
        )
        parser.add_argument(
            "--include-milk",
            action="store_true",
            default=False,
            help="Explicitly include synthetic MILK time series when production_type is ALL (omitted by default).",
        )
        parser.add_argument(
            "--unit",
            type=str,
            default=None,
            choices=["LITERS", "KILOGRAMS", "PIECES"],
            help="Optional unit override (must be compatible with chosen commodity).",
        )
        parser.add_argument(
            "--fill-gaps",
            action="store_true",
            help="Create records only for months without an approved record in the selected series.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Report the records that would be created without inserting them.",
        )

    def handle(self, *args, **options):
        if options["clean"]:
            self._handle_clean()
            return

        if options.get("clean_milk_only"):
            self._handle_clean(milk_only=True)
            return

        self._handle_seed(
            months=options["months"],
            production_type=options["production_type"],
            unit_override=options["unit"],
            fill_gaps=options["fill_gaps"],
            dry_run=options["dry_run"],
            include_milk=options.get("include_milk", False),
        )

    def _handle_clean(self, milk_only: bool = False):
        """Safely delete ONLY records containing the deterministic seed markers."""
        # Query specifically for test markers — never touch records without markers
        seed_qs = ProductionRecord.objects.filter(
            Q(notes__contains=SEED_MARKER_PRODUCTION_V2)
            | Q(notes__contains=SEED_MARKER_PRODUCTION_LEGACY)
        ).exclude(
            Q(notes__contains=SEED_MARKER_FORECAST_QUALITY_IDEAL)
            | Q(notes__contains=SEED_MARKER_FORECAST_QUALITY_POOR)
        )
        if milk_only:
            seed_qs = seed_qs.filter(production_type="MILK")

        count = seed_qs.count()

        if count == 0:
            target_desc = "synthetic milk production records" if milk_only else "seeded test production records"
            self.stdout.write(self.style.WARNING(f"No {target_desc} found to clean."))
            return

        deleted_count, _ = seed_qs.delete()
        label = "synthetic milk production seed records" if milk_only else "synthetic production seed records"
        self.stdout.write(
            self.style.SUCCESS(
                f"Successfully removed {deleted_count} {label}.\n"
                f"Real farmer production records, inventory, and accounts were NOT modified."
            )
        )

    def _handle_seed(
        self,
        months: int,
        production_type: str,
        unit_override: str,
        fill_gaps: bool = False,
        dry_run: bool = False,
        include_milk: bool = False,
    ):
        if months < 1:
            self.stderr.write(self.style.ERROR("--months must be at least 1."))
            return
        # Determine which commodities to generate
        if production_type == "ALL":
            commodities_to_seed = ["MEAT", "EGGS", "WOOL"]
            if include_milk:
                commodities_to_seed.insert(0, "MILK")
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

        # Use an existing authorized account only as the synthetic record creator.
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

        # Use a complete range ending with the last finished calendar month.
        # For October 2026, 36 observations cover Oct 2023 through Sep 2026.
        today = timezone.localdate()
        last_complete_month = shift_month(date(today.year, today.month, 1), -1)
        first_month = shift_month(last_complete_month, -(months - 1))
        target_months = [shift_month(first_month, step) for step in range(months)]

        total_created = 0

        for commodity in commodities_to_seed:
            cfg = COMMODITY_CONFIGS[commodity]
            unit = unit_override or cfg["unit"]

            # A real recorded observation already covers its month. In gap-fill
            # mode we skip it so synthetic output is never added to real output.
            existing_months = set()
            skipped_months = 0
            if fill_gaps:
                first_day_after_range = shift_month(first_month, months)
                recorded_dates = ProductionRecord.objects.filter(
                    production_type=commodity,
                    unit=unit,
                    status=ProductionRecord.ProductionStatus.RECORDED,
                    slaughter__isnull=True,
                    record_date__gte=first_month,
                    record_date__lt=first_day_after_range,
                ).values_list("record_date", flat=True)
                existing_months = {(record_date.year, record_date.month) for record_date in recorded_dates}

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
            for step, month_start in enumerate(target_months):
                if fill_gaps and (month_start.year, month_start.month) in existing_months:
                    skipped_months += 1
                    continue

                obs_date = date(month_start.year, month_start.month, 15)

                # 12-month annual sinusoidal wave
                month_angle = 2.0 * np.pi * (month_start.month - 1) / 12.0
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
                    farmer_at_record=anchor_inventory.farmer if anchor_inventory else None,
                    production_type=commodity,
                    quantity=Decimal(str(monthly_qty)),
                    unit=unit,
                    record_date=obs_date,
                    status=ProductionRecord.ProductionStatus.RECORDED,
                    slaughter=None,  # Intentionally NULL for farmer-reported output
                    notes=f"{SEED_MARKER_PRODUCTION_V2} [{commodity}] Month {step + 1}/{months} (Yield: {monthly_qty} {unit})",
                    review_remarks="Synthetic farmer-recorded observation for predictive analytics testing.",
                    created_by=creator_user,
                )
                records_to_create.append(record)

            if dry_run:
                self.stdout.write(
                    f"  -> Would create {len(records_to_create)} {commodity} records; "
                    f"preserve existing recorded months: {skipped_months}"
                )
            else:
                ProductionRecord.objects.bulk_create(records_to_create)
                self.stdout.write(
                    f"  -> Seeded {len(records_to_create)} monthly records for {commodity} ({unit}); "
                    f"preserved {skipped_months} existing recorded month(s)"
                )
            total_created += len(records_to_create)

        self.stdout.write(
            self.style.SUCCESS(
                f"\nProduction predictive analytics seed {'preview' if dry_run else 'completed successfully'}!\n"
                f"-----------------------------------------------------------\n"
                f"  Commodities Seeded: {', '.join(commodities_to_seed)}\n"
                f"  Total Records:      {total_created}\n"
                f"  Date Range:         {first_month:%Y-%m} to {last_complete_month:%Y-%m}\n"
                f"  Fill Gaps Only:     {fill_gaps}\n"
                f"  Months per Series:  {months}\n"
                f"  Seed Marker:        {SEED_MARKER_PRODUCTION_V2}\n"
                f"-----------------------------------------------------------\n"
                f"To remove ONLY these synthetic test records:\n"
                f"  python manage.py seed_productions --clean\n"
            )
        )

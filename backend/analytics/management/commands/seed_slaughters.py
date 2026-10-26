"""
Deterministic Seed Command for Slaughter Records (SmartLivestock Analytics).

=============================================================================
EDUCATIONAL OVERVIEW & LIVESTOCK CONCEPTS:
=============================================================================
1. Head Counts vs. Carcass Weight:
   In abattoir (slaughterhouse) analytics, animal count (heads slaughtered) and meat
   yield (carcass weight in kg) measure two fundamentally different economic units:
     - Head count reflects animal throughput and slaughterhouse capacity utilization.
     - Carcass weight (dressing weight) reflects actual meat biomass produced for consumption.
   They must NEVER be combined into a single number or time series.

2. Farmer Meat vs. Slaughterhouse Meat (Double-Counting Prevention):
   Farmer-reported meat (ProductionRecord with production_type='MEAT' and slaughter=None)
   represents on-farm or direct farmgate meat production.
   Slaughterhouse meat (SlaughterRecord) represents official municipal abattoir throughput.
   Keeping them separate prevents the same animal's meat from being counted twice.

3. Deterministic Seed Marker:
   Every generated record carries: AI_SEED::ANALYTICS_TEST::SLAUGHTER::V1 in `review_remarks`.
   Running with `--clean` deletes ONLY records containing this exact marker.
"""

from datetime import date, timedelta
from decimal import Decimal
import numpy as np

from django.core.management.base import BaseCommand
from django.db.models import Q
from django.utils import timezone

from production.models import SlaughterRecord
from livestock.models import LivestockType, Barangay
from users.models import User
from analytics.seed_markers import (
    SEED_MARKER_SLAUGHTER,
    SEED_MARKER_FORECAST_QUALITY_IDEAL,
    SEED_MARKER_FORECAST_QUALITY_POOR,
)


class Command(BaseCommand):
    help = (
        "Deterministically seeds or cleans synthetic municipal slaughterhouse records.\n"
        "Carries marker 'AI_SEED::ANALYTICS_TEST::SLAUGHTER::V1' in review_remarks.\n"
        "Use --clean to safely remove ONLY synthetic records without modifying real records."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--clean",
            action="store_true",
            help="Safely remove ONLY seeded synthetic slaughter records.",
        )
        parser.add_argument(
            "--months",
            type=int,
            default=3,
            help="Number of recent calendar months to generate daily slaughter activity for (default: 3).",
        )

    def handle(self, *args, **options):
        if options["clean"]:
            self._handle_clean()
            return

        months = options["months"]
        if months < 1:
            self.stderr.write(self.style.ERROR("--months must be at least 1."))
            return

        self._handle_seed(months=months)

    def _handle_clean(self):
        seed_qs = SlaughterRecord.objects.filter(review_remarks__contains=SEED_MARKER_SLAUGHTER).exclude(
            Q(review_remarks__contains=SEED_MARKER_FORECAST_QUALITY_IDEAL)
            | Q(review_remarks__contains=SEED_MARKER_FORECAST_QUALITY_POOR)
        )
        count = seed_qs.count()

        if count == 0:
            self.stdout.write(self.style.WARNING("No seeded synthetic slaughter records found to clean."))
            return

        deleted_count, _ = seed_qs.delete()
        self.stdout.write(
            self.style.SUCCESS(
                f"Successfully removed {deleted_count} synthetic slaughter records.\n"
                f"Real municipal slaughterhouse records were NOT modified."
            )
        )

    def _handle_seed(self, months: int):
        existing_count = SlaughterRecord.objects.filter(
            review_remarks__contains=SEED_MARKER_SLAUGHTER
        ).count()
        if existing_count > 0:
            self.stdout.write(
                self.style.WARNING(
                    f"Found {existing_count} existing synthetic slaughter records.\n"
                    f"Run 'python manage.py seed_slaughters --clean' before re-seeding."
                )
            )
            return

        # The generated carcass weights below describe cattle. Do not silently
        # attach them to an unrelated first lookup value (for example, poultry).
        livestock_type = (
            LivestockType.objects.filter(name__icontains="cattle").first()
            or LivestockType.objects.filter(name__icontains="cow").first()
        )
        if not livestock_type:
            self.stdout.write(self.style.ERROR("Cannot seed cattle slaughter data: add a Cattle/Cow LivestockType first."))
            return

        barangay = Barangay.objects.first()

        mao_user = (
            User.objects.filter(role__role_name__icontains="MAO").first()
            or User.objects.filter(is_superuser=True).first()
            or User.objects.first()
        )
        if not mao_user:
            self.stdout.write(self.style.ERROR("Cannot seed: No user account found."))
            return

        rng = np.random.RandomState(42)
        today = timezone.localdate()

        records_to_create = []

        # Include each calendar month from the first day of the oldest requested
        # month through today, producing one facility-total row per day.
        start_year, start_month = today.year, today.month
        for _ in range(months - 1):
            start_month -= 1
            if start_month == 0:
                start_month = 12
                start_year -= 1
        start_date = date(start_year, start_month, 1)

        for day_offset in range((today - start_date).days + 1):
            record_date = start_date + timedelta(days=day_offset)
            month_offset = (record_date.year - start_year) * 12 + record_date.month - start_month
            holiday_multiplier = 1.35 if record_date.month in (11, 12) else 1.0
            trend_bump = month_offset * 0.15

            # One daily facility total; carcass kilograms remain separate from head count.
            heads = max(1, int(round(float(rng.uniform(1, 5)) * holiday_multiplier + trend_bump)))
            avg_carcass_per_head = float(rng.uniform(185.0, 215.0))
            total_carcass_kg = round(heads * avg_carcass_per_head, 2)
            slaughter = SlaughterRecord(
                livestock=None,
                batch=None,
                barangay=barangay,
                livestock_type=livestock_type,
                quantity=heads,
                carcass_weight=Decimal(str(total_carcass_kg)),
                record_date=record_date,
                status=SlaughterRecord.StatusType.APPROVED,
                reviewed_by=mao_user,
                reviewed_at=timezone.now(),
                review_remarks=f"{SEED_MARKER_SLAUGHTER} Synthetic daily municipal abattoir total for {record_date}.",
                created_by=mao_user,
            )
            records_to_create.append(slaughter)

        SlaughterRecord.objects.bulk_create(records_to_create)
        self.stdout.write(
            self.style.SUCCESS(
                f"Successfully seeded {len(records_to_create)} daily synthetic slaughter records "
                f"across {months} calendar months ({start_date} through {today}) "
                f"with marker '{SEED_MARKER_SLAUGHTER}'."
            )
        )

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

from datetime import date
from decimal import Decimal
import numpy as np

from django.core.management.base import BaseCommand
from django.utils import timezone

from production.models import SlaughterRecord
from livestock.models import LivestockType, Barangay
from users.models import User
from analytics.seed_markers import SEED_MARKER_SLAUGHTER


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
            default=36,
            help="Number of historical months to generate slaughter activity for (default: 36).",
        )

    def handle(self, *args, **options):
        if options["clean"]:
            self._handle_clean()
            return

        self._handle_seed(months=options["months"])

    def _handle_clean(self):
        seed_qs = SlaughterRecord.objects.filter(review_remarks__contains=SEED_MARKER_SLAUGHTER)
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

        livestock_type = (
            LivestockType.objects.filter(name__icontains="cattle").first()
            or LivestockType.objects.filter(name__icontains="cow").first()
            or LivestockType.objects.first()
        )
        if not livestock_type:
            self.stdout.write(self.style.ERROR("Cannot seed: No LivestockType found in database."))
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

        # Generate realistic monthly slaughterhouse throughput over requested months
        # Base: ~15 heads per month with slight upward trend and seasonal spike near December/holidays
        for m_idx in range(months):
            month_offset = months - 1 - m_idx
            year = today.year - (month_offset // 12)
            month = today.month - (month_offset % 12)
            if month <= 0:
                month += 12
                year -= 1

            # Seasonal holiday bump in November & December (festivals, holiday meat demand)
            holiday_multiplier = 1.35 if month in (11, 12) else 1.0
            trend_bump = m_idx * 0.15

            # Number of events per month (2 to 4 slaughter batches)
            num_batches = int(rng.choice([2, 3, 4]))
            for b_idx in range(num_batches):
                base_heads = float(rng.uniform(3, 8)) * holiday_multiplier + trend_bump
                heads = max(1, int(round(base_heads)))

                # Average carcass weight ~180-220 kg per head for cattle
                avg_carcass_per_head = float(rng.uniform(185.0, 215.0))
                total_carcass_kg = round(heads * avg_carcass_per_head, 2)

                day = min(28, int(rng.choice([5, 12, 19, 26])))
                record_date = date(year, month, day)

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
                    review_remarks=(
                        f"{SEED_MARKER_SLAUGHTER} Synthetic municipal abattoir record "
                        f"for month {m_idx + 1}/{months}."
                    ),
                    created_by=mao_user,
                )
                records_to_create.append(slaughter)

        SlaughterRecord.objects.bulk_create(records_to_create)
        self.stdout.write(
            self.style.SUCCESS(
                f"Successfully seeded {len(records_to_create)} synthetic slaughter records across {months} months "
                f"with marker '{SEED_MARKER_SLAUGHTER}'."
            )
        )

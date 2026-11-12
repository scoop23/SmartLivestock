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

from datetime import date, datetime, time, timedelta
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

        # Fetch species for realistic municipal abattoir throughput
        cattle_type = (
            LivestockType.objects.filter(name__icontains="cattle").first()
            or LivestockType.objects.filter(name__icontains="cow").first()
        )
        carabao_type = (
            LivestockType.objects.filter(name__icontains="carabao").first()
            or LivestockType.objects.filter(name__icontains="buffalo").first()
        )
        swine_type = (
            LivestockType.objects.filter(name__icontains="swine").first()
            or LivestockType.objects.filter(name__icontains="hog").first()
            or LivestockType.objects.filter(name__icontains="pig").first()
        )

        if not cattle_type:
            self.stdout.write(self.style.ERROR("Cannot seed slaughter data: Cattle LivestockType not found."))
            return

        barangays = list(Barangay.objects.all())
        default_barangay = barangays[0] if barangays else None

        mao_user = (
            User.objects.filter(role__role_name__icontains="MAO").first()
            or User.objects.filter(is_superuser=True).first()
            or User.objects.first()
        )
        if not mao_user:
            self.stdout.write(self.style.ERROR("Cannot seed: No user account found."))
            return

        staff_user = (
            User.objects.filter(role__role_name__icontains="SLAUGHTER").first()
            or mao_user
        )

        rng = np.random.RandomState(42)
        today = timezone.localdate()

        records_to_create = []

        # Include each calendar month from the first day of the oldest requested
        # month through today, producing facility-total rows per day.
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
            holiday_multiplier = 1.25 if record_date.month in (11, 12) else 1.0

            # Select barangay rotation
            b_idx = day_offset % len(barangays) if barangays else 0
            rec_barangay = barangays[b_idx] if barangays else default_barangay

            # Leave the most recent 3 days as PENDING so MAO has real review queue items
            is_pending = (today - record_date).days < 3
            status = SlaughterRecord.StatusType.PENDING if is_pending else SlaughterRecord.StatusType.APPROVED
            reviewer = None if is_pending else mao_user
            aware_created = timezone.make_aware(datetime.combine(record_date, time(8, 0)))
            aware_reviewed = None if is_pending else timezone.make_aware(datetime.combine(record_date, time(17, 0)))

            # 1. Cattle throughput
            cattle_heads = max(1, int(round(float(rng.uniform(8, 22)) * holiday_multiplier)))
            cattle_avg_kg = float(rng.uniform(220.0, 260.0))
            cattle_total_kg = round(cattle_heads * cattle_avg_kg, 2)
            cattle_rec = SlaughterRecord(
                livestock=None, batch=None, barangay=rec_barangay,
                livestock_type=cattle_type, quantity=cattle_heads,
                carcass_weight=Decimal(str(cattle_total_kg)), record_date=record_date,
                status=status, reviewed_by=reviewer, reviewed_at=aware_reviewed,
                review_remarks=f"{SEED_MARKER_SLAUGHTER} Daily cattle abattoir total for {record_date}.",
                created_by=staff_user,
            )
            cattle_rec._demo_created_at = aware_created
            cattle_rec._demo_reviewed_at = aware_reviewed
            records_to_create.append(cattle_rec)

            # 2. Carabao throughput (if type exists)
            if carabao_type:
                carabao_heads = max(1, int(round(float(rng.uniform(4, 12)) * holiday_multiplier)))
                carabao_avg_kg = float(rng.uniform(210.0, 250.0))
                carabao_total_kg = round(carabao_heads * carabao_avg_kg, 2)
                carabao_rec = SlaughterRecord(
                    livestock=None, batch=None, barangay=rec_barangay,
                    livestock_type=carabao_type, quantity=carabao_heads,
                    carcass_weight=Decimal(str(carabao_total_kg)), record_date=record_date,
                    status=status, reviewed_by=reviewer, reviewed_at=aware_reviewed,
                    review_remarks=f"{SEED_MARKER_SLAUGHTER} Daily carabao abattoir total for {record_date}.",
                    created_by=staff_user,
                )
                carabao_rec._demo_created_at = aware_created
                carabao_rec._demo_reviewed_at = aware_reviewed
                records_to_create.append(carabao_rec)

            # 3. Swine / Hogs throughput (if type exists)
            if swine_type:
                swine_heads = max(5, int(round(float(rng.uniform(35, 85)) * holiday_multiplier)))
                swine_avg_kg = float(rng.uniform(65.0, 85.0))
                swine_total_kg = round(swine_heads * swine_avg_kg, 2)
                swine_rec = SlaughterRecord(
                    livestock=None, batch=None, barangay=rec_barangay,
                    livestock_type=swine_type, quantity=swine_heads,
                    carcass_weight=Decimal(str(swine_total_kg)), record_date=record_date,
                    status=status, reviewed_by=reviewer, reviewed_at=aware_reviewed,
                    review_remarks=f"{SEED_MARKER_SLAUGHTER} Daily swine abattoir total for {record_date}.",
                    created_by=staff_user,
                )
                swine_rec._demo_created_at = aware_created
                swine_rec._demo_reviewed_at = aware_reviewed
                records_to_create.append(swine_rec)

        SlaughterRecord.objects.bulk_create(records_to_create, batch_size=500)
        # auto_now_add on created_at replaces the historical date during INSERT.
        # Restore historical created_at and reviewed_at so backtesting cutoffs can validate.
        for r in records_to_create:
            r.created_at = r._demo_created_at
            r.reviewed_at = r._demo_reviewed_at
        SlaughterRecord.objects.bulk_update(records_to_create, ["created_at", "reviewed_at"], batch_size=500)
        self.stdout.write(
            self.style.SUCCESS(
                f"Successfully seeded {len(records_to_create)} daily synthetic slaughter records "
                f"across {months} calendar months ({start_date} through {today}) "
                f"with marker '{SEED_MARKER_SLAUGHTER}'."
            )
        )

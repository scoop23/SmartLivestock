"""
Deterministic Seed Command for Calving Records (SmartLivestock Descriptive Analytics).

=============================================================================
EDUCATIONAL OVERVIEW & DOMAIN SEPARATION:
=============================================================================
1. Calving is an Independent Domain Event:
   Calving represents a biological reproduction event linking a maternal dam to her offspring.
   It must NEVER be represented as a generic production record.

2. Deterministic & Non-Destructive:
   Carries the marker 'AI_SEED::ANALYTICS_TEST::CALVING::V1' in notes.
   `--clean` safely removes ONLY records with this marker. Real calving events remain intact.
"""

from datetime import date
from decimal import Decimal
import numpy as np

from django.core.management.base import BaseCommand
from django.utils import timezone

from production.models import CalvingRecord
from livestock.models import LivestockInventory
from users.models import User
from analytics.seed_markers import SEED_MARKER_CALVING


class Command(BaseCommand):
    help = (
        "Deterministically seeds or cleans synthetic calving records.\n"
        "Carries marker 'AI_SEED::ANALYTICS_TEST::CALVING::V1' in notes.\n"
        "Use --clean to safely remove ONLY synthetic records without modifying real records."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--clean",
            action="store_true",
            help="Safely remove ONLY seeded synthetic calving records.",
        )
        parser.add_argument(
            "--count",
            type=int,
            default=24,
            help="Number of synthetic calving records to generate (default: 24).",
        )

    def handle(self, *args, **options):
        if options["clean"]:
            self._handle_clean()
            return

        self._handle_seed(count=options["count"])

    def _handle_clean(self):
        seed_qs = CalvingRecord.objects.filter(notes__contains=SEED_MARKER_CALVING)
        count = seed_qs.count()

        if count == 0:
            self.stdout.write(self.style.WARNING("No seeded synthetic calving records found to clean."))
            return

        offspring_ids = list(seed_qs.exclude(offspring_inventory__isnull=True).values_list("offspring_inventory_id", flat=True))
        if offspring_ids:
            LivestockInventory.objects.filter(pk__in=offspring_ids).delete()
        deleted_count, _ = seed_qs.delete()
        self.stdout.write(
            self.style.SUCCESS(
                f"Successfully removed {deleted_count} synthetic calving records.\n"
                f"Real farmer calving records were NOT modified."
            )
        )

    def _handle_seed(self, count: int):
        existing_count = CalvingRecord.objects.filter(notes__contains=SEED_MARKER_CALVING).count()
        if existing_count > 0:
            self.stdout.write(
                self.style.WARNING(
                    f"Found {existing_count} existing synthetic calving records.\n"
                    f"Run 'python manage.py seed_calving --clean' before re-seeding."
                )
            )
            return

        # Find dams (approved female cattle/carabao)
        dams = list(
            LivestockInventory.objects.filter(
                status="APPROVED",
                operational_status="ACTIVE",
            )[:8]
        )
        if not dams:
            # Fallback to any approved inventory
            dams = list(LivestockInventory.objects.filter(status="APPROVED")[:8])

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
        for i in range(count):
            dam = dams[i % len(dams)] if dams else None
            creator_user = (dam.farmer.user if (dam and dam.farmer and dam.farmer.user) else None) or mao_user

            # Spread dates over the last 18 months
            month_offset = i % 18
            calving_year = today.year - (month_offset // 12)
            calving_month = today.month - (month_offset % 12)
            if calving_month <= 0:
                calving_month += 12
                calving_year -= 1

            calving_day = min(28, (i % 25) + 1)
            if calving_year == today.year and calving_month == today.month:
                calving_day = min(calving_day, today.day)
            calving_date = date(calving_year, calving_month, calving_day)
            sex = CalvingRecord.SexType.FEMALE if (i % 2 == 0) else CalvingRecord.SexType.MALE
            birth_weight = round(Decimal(str(26.0 + rng.uniform(2.0, 14.0))), 2)

            record = CalvingRecord(
                dam=dam,
                calf_tag=f"CALF-TEST-{i+1:03d}",
                calf_sex=sex,
                birth_weight=birth_weight,
                sire_tag=f"SIRE-AI-{100 + (i % 5)}",
                calving_date=calving_date,
                breed="Brahman Cross" if (i % 2 == 0) else "Holstein-Friesian Cross",
                calving_ease="Normal / Unassisted" if (i % 4 != 0) else "Slight Assistance",
                notes=f"{SEED_MARKER_CALVING} Dam #{dam.tag_number if dam else 'N/A'}",
                status=CalvingRecord.StatusType.APPROVED,
                reviewed_by=mao_user,
                reviewed_at=timezone.now(),
                review_remarks="Approved synthetic calving test record.",
                created_by=creator_user,
            )
            records_to_create.append(record)

        CalvingRecord.objects.bulk_create(records_to_create)
        from livestock.reconciliation import reconcile_approved_calving
        for record in records_to_create:
            reconcile_approved_calving(record)
        self.stdout.write(
            self.style.SUCCESS(
                f"Successfully seeded {len(records_to_create)} synthetic calving records with marker '{SEED_MARKER_CALVING}'."
            )
        )

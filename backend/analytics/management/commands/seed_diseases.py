"""
Deterministic Seed Command for Disease Surveillance Records (SmartLivestock Descriptive Analytics).

=============================================================================
EDUCATIONAL OVERVIEW & SAFETY GUARANTEES:
=============================================================================
1. Authoritative Surveillance Data:
   Descriptive epidemiology dashboards aggregate APPROVED disease cases.
   Pending or unverified reports are excluded from official health metrics.

2. Deterministic Marker:
   Every generated record carries the marker: AI_SEED::ANALYTICS_TEST::DISEASE::V1 in `review_remarks`.
   `--clean` safely removes ONLY seeded test cases without modifying real farmer disease reports.
"""

from datetime import date
import numpy as np

from django.core.management.base import BaseCommand
from django.utils import timezone

from diseases.models import DiseaseCase
from livestock.models import LivestockInventory
from users.models import User
from analytics.seed_markers import SEED_MARKER_DISEASE

DISEASE_NAMES = [
    "Foot and Mouth Disease (FMD)",
    "Hemorrhagic Septicemia",
    "Bovine Mastitis",
    "Fasciolosis (Liver Fluke)",
    "Surra (Trypanosomiasis)",
]


class Command(BaseCommand):
    help = (
        "Deterministically seeds or cleans synthetic disease surveillance cases.\n"
        "Carries marker 'AI_SEED::ANALYTICS_TEST::DISEASE::V1' in review_remarks.\n"
        "Use --clean to safely remove ONLY synthetic records without modifying real records."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--clean",
            action="store_true",
            help="Safely remove ONLY seeded synthetic disease records.",
        )
        parser.add_argument(
            "--count",
            type=int,
            default=25,
            help="Number of synthetic disease cases to generate (default: 25).",
        )
        parser.add_argument(
            "--months",
            type=int,
            default=12,
            help="Number of historical months across which to distribute records (default: 12).",
        )

    def handle(self, *args, **options):
        if options["clean"]:
            self._handle_clean()
            return

        self._handle_seed(count=options["count"], months=options.get("months", 12))

    def _handle_clean(self):
        seed_qs = DiseaseCase.objects.filter(review_remarks__contains=SEED_MARKER_DISEASE)
        count = seed_qs.count()

        if count == 0:
            self.stdout.write(self.style.WARNING("No seeded synthetic disease records found to clean."))
            return

        deleted_count, _ = seed_qs.delete()
        self.stdout.write(
            self.style.SUCCESS(
                f"Successfully removed {deleted_count} synthetic disease records.\n"
                f"Real farmer disease records were NOT modified."
            )
        )

    def _handle_seed(self, count: int, months: int = 12):
        existing_count = DiseaseCase.objects.filter(review_remarks__contains=SEED_MARKER_DISEASE).count()
        if existing_count > 0:
            self.stdout.write(
                self.style.WARNING(
                    f"Found {existing_count} existing synthetic disease records.\n"
                    f"Run 'python manage.py seed_diseases --clean' before re-seeding."
                )
            )
            return

        animals = list(LivestockInventory.objects.filter(status="APPROVED")[:10])
        if not animals:
            self.stdout.write(self.style.ERROR("Cannot seed: No approved livestock inventory found."))
            return

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
            animal = animals[i % len(animals)]
            creator_user = (animal.farmer.user if (animal.farmer and animal.farmer.user) else None) or mao_user

            disease_name = DISEASE_NAMES[i % len(DISEASE_NAMES)]
            affected = int(rng.choice([1, 2, 3, 5, 8]))

            month_offset = i % max(1, months)
            year = today.year - (month_offset // 12)
            month = today.month - (month_offset % 12)
            if month <= 0:
                month += 12
                year -= 1

            record_date = date(year, month, min(28, (i % 24) + 1))

            record = DiseaseCase(
                livestock=animal,
                name=disease_name,
                affected_count=affected,
                record_date=record_date,
                status=DiseaseCase.DiseaseStatus.APPROVED,
                reviewed_by=mao_user,
                reviewed_at=timezone.now(),
                review_remarks=f"{SEED_MARKER_DISEASE} Validated clinical surveillance case #{i+1}.",
                created_by=creator_user,
            )
            records_to_create.append(record)

        DiseaseCase.objects.bulk_create(records_to_create)
        self.stdout.write(
            self.style.SUCCESS(
                f"Successfully seeded {len(records_to_create)} synthetic disease cases with marker '{SEED_MARKER_DISEASE}'."
            )
        )

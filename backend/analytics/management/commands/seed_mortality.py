"""
Deterministic Seed Command for Mortality Records (SmartLivestock Descriptive Analytics).

=============================================================================
EDUCATIONAL OVERVIEW & DISEASE-MORTALITY TRACEABILITY:
=============================================================================
1. Dual Attribution of Livestock Deaths:
   In livestock epidemiology, mortality can stem from two distinct etiologies:
     a) Disease-Linked Mortality: A death occurring as an outcome of a diagnosed outbreak.
        This is modeled via the ForeignKey `source_disease_case`.
     b) Independent Mortality: Deaths caused by environmental factors, injury, or physiological
        stress (e.g. heat stroke, dystocia, snake bite, bloat) with `source_disease_case = None`.
   The analytics dashboard must distinguish these causes rather than assuming all deaths are contagious.

2. Deterministic & Safe:
   Carries the marker 'AI_SEED::ANALYTICS_TEST::MORTALITY::V1' in `review_remarks`.
   `--clean` safely removes ONLY synthetic mortality records.
"""

from datetime import date
import numpy as np

from django.core.management.base import BaseCommand
from django.utils import timezone

from diseases.models import DiseaseCase, MortalityRecord
from livestock.models import LivestockInventory
from users.models import User
from analytics.seed_markers import SEED_MARKER_MORTALITY, SEED_MARKER_DISEASE

INDEPENDENT_CAUSES = [
    "Heat Stress / Severe Dehydration",
    "Dystocia / Calving Complication",
    "Acute Ruminal Tympany (Bloat)",
    "Trauma / Physical Injury",
    "Old Age / Natural Causes",
]


class Command(BaseCommand):
    help = (
        "Deterministically seeds or cleans synthetic mortality records.\n"
        "Carries marker 'AI_SEED::ANALYTICS_TEST::MORTALITY::V1' in review_remarks.\n"
        "Use --clean to safely remove ONLY synthetic records without modifying real records."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--clean",
            action="store_true",
            help="Safely remove ONLY seeded synthetic mortality records.",
        )
        parser.add_argument(
            "--count",
            type=int,
            default=20,
            help="Number of synthetic mortality records to generate (default: 20).",
        )

    def handle(self, *args, **options):
        if options["clean"]:
            self._handle_clean()
            return

        self._handle_seed(count=options["count"])

    def _handle_clean(self):
        seed_qs = MortalityRecord.objects.filter(review_remarks__contains=SEED_MARKER_MORTALITY)
        count = seed_qs.count()

        if count == 0:
            self.stdout.write(self.style.WARNING("No seeded synthetic mortality records found to clean."))
            return

        deleted_count, _ = seed_qs.delete()
        self.stdout.write(
            self.style.SUCCESS(
                f"Successfully removed {deleted_count} synthetic mortality records.\n"
                f"Real farmer mortality records were NOT modified."
            )
        )

    def _handle_seed(self, count: int):
        existing_count = MortalityRecord.objects.filter(review_remarks__contains=SEED_MARKER_MORTALITY).count()
        if existing_count > 0:
            self.stdout.write(
                self.style.WARNING(
                    f"Found {existing_count} existing synthetic mortality records.\n"
                    f"Run 'python manage.py seed_mortality --clean' before re-seeding."
                )
            )
            return

        animals = list(LivestockInventory.objects.filter(status="APPROVED")[:10])
        if not animals:
            self.stdout.write(self.style.ERROR("Cannot seed: No approved livestock inventory found."))
            return

        # Find existing disease cases to link (can be seeded or real approved)
        disease_cases = list(DiseaseCase.objects.filter(status=DiseaseCase.DiseaseStatus.APPROVED)[:6])

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

            month_offset = i % 12
            year = today.year - (month_offset // 12)
            month = today.month - (month_offset % 12)
            if month <= 0:
                month += 12
                year -= 1

            record_date = date(year, month, min(28, (i % 24) + 1))
            deaths = int(rng.choice([1, 1, 2, 3]))

            # Alternate between disease-linked mortality and independent causes
            if disease_cases and (i % 2 == 0):
                disease_case = disease_cases[(i // 2) % len(disease_cases)]
                cause = f"Complications arising from {disease_case.name}"
                source_case = disease_case
            else:
                cause = INDEPENDENT_CAUSES[i % len(INDEPENDENT_CAUSES)]
                source_case = None

            record = MortalityRecord(
                livestock=animal,
                death_count=deaths,
                cause=cause,
                source_disease_case=source_case,
                record_date=record_date,
                status=MortalityRecord.MortalityRecordStatus.APPROVED,
                reviewed_by=mao_user,
                reviewed_at=timezone.now(),
                review_remarks=f"{SEED_MARKER_MORTALITY} Verified municipal mortality entry #{i+1}.",
                created_by=creator_user,
            )
            records_to_create.append(record)

        MortalityRecord.objects.bulk_create(records_to_create)
        self.stdout.write(
            self.style.SUCCESS(
                f"Successfully seeded {len(records_to_create)} synthetic mortality records with marker '{SEED_MARKER_MORTALITY}'."
            )
        )

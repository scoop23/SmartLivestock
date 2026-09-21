from django.core.management.base import BaseCommand
from django.utils import timezone
from livestock.models import LivestockInventory
from diseases.models import DiseaseCase, MortalityRecord
from users.models import User


class Command(BaseCommand):
    help = "Seeds realistic disease cases and mortality records linked to existing livestock inventory"

    def handle(self, *args, **kwargs):
        inventories = list(LivestockInventory.objects.select_related("created_by").all()[:10])
        if not inventories:
            self.stdout.write(self.style.WARNING("No livestock inventories found. Run seed_farmers first."))
            return

        sibat_user = User.objects.filter(role__role_name="SIBAT").first() or User.objects.first()

        sample_diseases = [
            ("Limping / Weak Legs", 1, "PENDING", None, None),
            ("Coughing / Runny Nose", 2, "VERIFIED", sibat_user, "On-farm physical check completed. Mild pneumonic wheezing. Prescribed oral electrolytes and temporary stall isolation. [Severity: MODERATE] [Action: PEN_ISOLATION] [Temp: 39.8°C]"),
            ("Skin Sores / Blisters", 1, "PENDING", None, None),
            ("High Fever / Hot Ears", 1, "VERIFIED", sibat_user, "Hot ears and elevated body temperature. Antipyretic administered. [Severity: MILD] [Action: TREATMENT_PRESCRIBED] [Temp: 40.1°C]"),
        ]

        sample_mortalities = [
            ("Sudden Death / Severe Bloat", 1, "APPROVED", sibat_user, "Carcass verified on site. Severe tympany/bloat with no signs of anthrax. Supervised 2m deep pit burial with lime. [Severity: CRITICAL] [Action: BIOSECURE_BURIAL]"),
            ("Calving / Birthing Complications", 1, "PENDING", None, None),
            ("Physical Injury / Severe Fracture", 1, "VERIFIED", sibat_user, "Severe unrecoverable pelvic injury following ravine fall. [Severity: SEVERE]"),
        ]

        created_count = 0

        for i, (d_name, count, status, reviewer, remarks) in enumerate(sample_diseases):
            animal = inventories[i % len(inventories)]
            DiseaseCase.objects.create(
                livestock=animal,
                name=d_name,
                affected_count=count,
                record_date=timezone.now().date(),
                status=status,
                reviewed_by=reviewer,
                reviewed_at=timezone.now() if reviewer else None,
                review_remarks=remarks or "",
                created_by=animal.created_by,
            )
            created_count += 1

        for j, (cause, count, status, reviewer, remarks) in enumerate(sample_mortalities):
            animal = inventories[(j + 2) % len(inventories)]
            MortalityRecord.objects.create(
                livestock=animal,
                death_count=count,
                cause=cause,
                record_date=timezone.now().date(),
                status=status,
                reviewed_by=reviewer,
                reviewed_at=timezone.now() if reviewer else None,
                review_remarks=remarks or "",
                created_by=animal.created_by,
            )
            created_count += 1

        self.stdout.write(
            self.style.SUCCESS(f"Successfully seeded {created_count} observation records (Disease & Mortality)!")
        )

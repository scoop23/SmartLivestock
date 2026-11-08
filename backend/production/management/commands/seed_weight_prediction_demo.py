"""Create explicitly synthetic weigh-ins for a livestock profile demonstration."""

from datetime import timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from livestock.models import LivestockInventory
from production.models import WeightRecord
from smartlivestock.seed_safety import assert_safe_seed_database


MARKER = "WEIGHT_PREDICTION_DEMO_V1:"


class Command(BaseCommand):
    help = "Seed 13 synthetic weekly weigh-ins for a 30-day linear weight prediction demo."

    def add_arguments(self, parser):
        parser.add_argument("--tag", default="CAT-B301-10")
        parser.add_argument("--dry-run", action="store_true")
        parser.add_argument("--clean", action="store_true")
        parser.add_argument("--include-existing", action="store_true", help="Explicitly add marked synthetic records alongside existing weigh-ins, preserving them.")

    @transaction.atomic
    def handle(self, *args, **options):
        assert_safe_seed_database(clean=options["clean"], dry_run=options["dry_run"])
        animals = LivestockInventory.objects.select_for_update().select_related("farmer__user").filter(tag_number=options["tag"])
        if animals.count() != 1:
            raise CommandError("The tag must identify exactly one livestock record.")
        animal = animals.get()
        owned = WeightRecord.objects.filter(livestock=animal, notes__startswith=MARKER, created_by=animal.farmer.user)
        if options["clean"]:
            count = owned.count()
            if not options["dry_run"]:
                owned.delete()
            self.stdout.write(f"{'Would remove' if options['dry_run'] else 'Removed'} {count} marked demo weigh-ins only.")
            return
        if animal.status != "APPROVED" or animal.operational_status != "ACTIVE" or animal.quantity != 1:
            raise CommandError("Select an approved, active individual animal.")
        existing = WeightRecord.objects.filter(livestock=animal).exclude(pk__in=owned.values("pk"))
        if existing.exists() and not options["include_existing"]:
            raise CommandError("This animal has other weigh-ins. Select a demo animal to avoid mixing synthetic and real history.")
        if owned.exists():
            self.stdout.write("Marked demo history already exists; no changes made. Clean it explicitly before regenerating.")
            return
        today = timezone.localdate()
        anchor = existing.filter(weighing_date__lte=today).order_by("-weighing_date").first()
        anchor_date = anchor.weighing_date if anchor else today - timedelta(days=84)
        anchor_weight = float(anchor.weight) if anchor else 280
        existing_dates = set(existing.values_list("weighing_date", flat=True))
        # A visible, imperfect upward trend: 280 kg to roughly 322 kg over 84 days.
        # These are simulated measurement dates. Actual insertion timestamps stay current.
        variation = [0, 0.4, -0.6, 0.8, -0.3, 0.5, -0.7, 0.2, 0.6, -0.4, 0.3, -0.2, 0]
        rows = [WeightRecord(
            livestock=animal, created_by=animal.farmer.user,
            weighing_date=today - timedelta(days=84 - index * 7),
            weight=Decimal(str(round(max(1, anchor_weight + ((today - timedelta(days=84 - index * 7)) - anchor_date).days * 0.5 + noise), 2))),
            notes=f"{MARKER} SYNTHETIC demonstration weigh-in; not an actual measurement.",
        ) for index, noise in enumerate(variation) if today - timedelta(days=84 - index * 7) not in existing_dates]
        if not options["dry_run"]:
            WeightRecord.objects.bulk_create(rows)
        self.stdout.write(self.style.SUCCESS(
            f"{'Would create' if options['dry_run'] else 'Created'} {len(rows)} synthetic weigh-ins for {animal.tag_number} "
            f"(profile ID {animal.pk}), covering the last 84 days. "
            "Inventory weight is unchanged. These records demonstrate the existing linear estimate, not real prediction accuracy."
        ))

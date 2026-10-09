"""Seed an isolated milk-forecast demonstration for CAT-B301-10."""

import math
import random
from datetime import timedelta

from dateutil.relativedelta import relativedelta
from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction
from django.db.utils import DatabaseError
from django.utils import timezone

from analytics.models import IndividualMilkDemoCow, IndividualMilkDemoObservation
from analytics.seed_markers import SEED_MARKER_INDIVIDUAL_MILK_DEMO
from livestock.models import LivestockInventory


TAG_NUMBER = "CAT-B301-10"
DEMO_ID = "demo-cow-cat-b301-10"
OBSERVATION_COUNT = 60


class Command(BaseCommand):
    help = "Seed 60 isolated synthetic daily milk observations for CAT-B301-10."

    def add_arguments(self, parser):
        """Add cleanup mode; it removes demo rows only and never changes the animal."""
        parser.add_argument(
            "--clean",
            action="store_true",
            help="Remove this cow's synthetic demo records (the livestock birth date is retained).",
        )

    def handle(self, *args, **options):
        """Seed or clean the target demo data without creating production submissions."""
        if not self._demo_tables_are_ready():
            if options["clean"]:
                self.stdout.write(self.style.WARNING("Milk demo tables are missing; nothing was cleaned."))
                return
            raise CommandError(
                "Milk demo tables are missing. Apply migrations first with `python manage.py migrate analytics`."
            )

        if options["clean"]:
            self._clean_demo_data()
            return

        animals = LivestockInventory.objects.select_related("livestock_type").filter(tag_number=TAG_NUMBER)
        if animals.count() != 1:
            raise CommandError(f"Expected exactly one livestock record tagged {TAG_NUMBER}.")
        animal = animals.get()
        if (
            animal.entry_type != LivestockInventory.EntryType.INDIVIDUAL
            or animal.quantity != 1
            or animal.sex.upper() not in {"FEMALE", "F"}
            or "cattle" not in animal.livestock_type.name.lower()
        ):
            raise CommandError(f"{TAG_NUMBER} must be an individual female cattle record to seed this demo.")

        today = timezone.localdate()
        # This is the explicitly requested age correction on the canonical animal record.
        birth_date = today - relativedelta(years=6)

        with transaction.atomic():
            animal.birth_date = birth_date
            animal.save(update_fields=["birth_date"])
            self._clean_demo_data(report=False)
            demo_cow = IndividualMilkDemoCow.objects.create(
                demo_id=DEMO_ID,
                tag_number=TAG_NUMBER,
                breed=animal.breed or "",
                sex="FEMALE",
                birth_date=birth_date,
                weight_kg=animal.weight,
                # No calving date is invented; the feature is omitted if it is unknown.
                calving_date=None,
                seed_marker=SEED_MARKER_INDIVIDUAL_MILK_DEMO,
            )
            self._create_observations(demo_cow, today)

        self.stdout.write(self.style.SUCCESS(
            f"Set {TAG_NUMBER}'s birth date to {birth_date} (6 years old) and created "
            f"{OBSERVATION_COUNT} isolated synthetic daily observations from "
            f"{today - timedelta(days=OBSERVATION_COUNT - 1)} through {today}."
        ))
        self.stdout.write(
            "These are demonstration records, not approved ProductionRecord submissions; "
            "they do not make the real livestock-profile forecast ready."
        )

    def _demo_tables_are_ready(self):
        """Check migration state before querying demo models, including during clean."""
        required_tables = {
            IndividualMilkDemoCow._meta.db_table,
            IndividualMilkDemoObservation._meta.db_table,
        }
        try:
            return required_tables.issubset(set(connection.introspection.table_names()))
        except DatabaseError as error:
            raise CommandError("Cannot inspect the database schema; check database connectivity.") from error

    def _clean_demo_data(self, report=True):
        """Delete only the uniquely identified CAT-B301-10 demonstration rows."""
        demo_cow = IndividualMilkDemoCow.objects.filter(
            demo_id=DEMO_ID,
            seed_marker=SEED_MARKER_INDIVIDUAL_MILK_DEMO,
        ).first()
        if demo_cow is None:
            if report:
                self.stdout.write("No CAT-B301-10 demo rows were found.")
            return

        # The FK cascade removes only this demo cow's isolated synthetic observations.
        deleted, _ = demo_cow.delete()
        if report:
            self.stdout.write(self.style.SUCCESS(
                f"Removed {deleted} CAT-B301-10 demo rows. The canonical livestock and birth date were untouched."
            ))

    def _create_observations(self, cow, today):
        """Generate varied daily demo yields for the model's date-based lag features."""
        rng = random.Random(30110)
        first_day = today - timedelta(days=OBSERVATION_COUNT - 1)
        # A modest lactation-like curve plus weekly variation and noise avoids a perfect trend.
        rows = []
        for day_index in range(OBSERVATION_COUNT):
            record_date = first_day + timedelta(days=day_index)
            trend = 8.4 - 0.012 * day_index
            weekly_variation = 0.28 * math.sin(2 * math.pi * day_index / 7)
            seasonal_variation = 0.18 * math.sin(2 * math.pi * day_index / 30)
            temporary_dip = 1.3 if 34 <= day_index <= 37 else 0
            liters = max(0.5, trend + weekly_variation + seasonal_variation - temporary_dip + rng.gauss(0, 0.35))
            rows.append(IndividualMilkDemoObservation(
                cow=cow,
                record_date=record_date,
                milk_quantity_liters=round(liters, 2),
                disease_active=34 <= day_index <= 37,
                seed_marker=SEED_MARKER_INDIVIDUAL_MILK_DEMO,
            ))

        IndividualMilkDemoObservation.objects.bulk_create(rows, batch_size=OBSERVATION_COUNT)

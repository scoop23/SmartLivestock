"""Create or safely remove isolated demo cows for the milk-forecast prototype."""

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


BREEDS = {
    "Holstein-Friesian Cross": (15.0, 430, 620),
    "Jersey Cross": (12.5, 350, 520),
    "Sahiwal Cross": (9.0, 330, 520),
    "Brahman Dairy Cross": (7.5, 380, 600),
}


class Command(BaseCommand):
    help = "Seed or clean isolated synthetic cows for individual 7-day milk forecasting."

    def add_arguments(self, parser):
        """Expose a safe clean mode and small dataset-size controls to the CLI."""
        parser.add_argument("--clean", action="store_true", help="Remove only this command's synthetic demo records.")
        parser.add_argument("--cows", type=int, default=24, help="Number of synthetic cows to generate (default: 24).")
        parser.add_argument("--days", type=int, default=120, help="Daily observations per cow (30–180, default: 120).")

    def handle(self, *args, **options):
        """Run either the marker-scoped clean flow or a repeatable demo-data seed."""
        # Seed/clean must check table availability before any ORM delete is attempted.
        tables_ready = self._demo_tables_are_ready()
        if options["clean"]:
            if not tables_ready:
                self.stdout.write(self.style.WARNING(
                    "Demo tables do not exist yet; nothing was cleaned. "
                    "Run `python manage.py migrate analytics` after the database is reachable."
                ))
                return
            self._clean_demo_data()
            return
        if not tables_ready:
            raise CommandError(
                "The individual milk demo tables are missing. Apply their migration first with "
                "`python manage.py migrate analytics`, then rerun this command."
            )
        if options["cows"] < 2 or options["cows"] > 50:
            raise CommandError("--cows must be between 2 and 50.")
        if options["days"] < 30 or options["days"] > 180:
            raise CommandError("--days must be between 30 and 180.")

        # Re-seeding replaces only the explicitly marked demo set, keeping runs repeatable.
        with transaction.atomic():
            self._clean_demo_data(report=False)
            cow_count, observation_count = self._create_demo_data(options["cows"], options["days"])
        self.stdout.write(self.style.SUCCESS(
            f"Created {cow_count} synthetic demo cows with {observation_count} daily milk observations. "
            "No farmer inventory or ProductionRecord rows were changed."
        ))

    def _demo_tables_are_ready(self):
        """Check the database schema before ORM operations, so missing migrations fail clearly."""
        required_tables = {
            IndividualMilkDemoCow._meta.db_table,
            IndividualMilkDemoObservation._meta.db_table,
        }
        try:
            existing_tables = set(connection.introspection.table_names())
        except DatabaseError as error:
            raise CommandError(
                "Cannot inspect the database schema. Check database connectivity, then apply migrations."
            ) from error
        return required_tables.issubset(existing_tables)

    def _clean_demo_data(self, report=True):
        """Delete only records with this demo command's unique marker.

        Keeping the marker filter here is the safety boundary: real production,
        livestock inventory, and unrelated analytics seeds are never selected.
        """
        observations, _ = IndividualMilkDemoObservation.objects.filter(
            seed_marker=SEED_MARKER_INDIVIDUAL_MILK_DEMO
        ).delete()
        cows, _ = IndividualMilkDemoCow.objects.filter(
            seed_marker=SEED_MARKER_INDIVIDUAL_MILK_DEMO
        ).delete()
        if report:
            self.stdout.write(self.style.SUCCESS(
                f"Removed {cows} demo cows and {observations} demo observations; real livestock data was untouched."
            ))

    def _create_demo_data(self, cow_count, days):
        """Generate varied longitudinal cows and their independent daily observations."""
        rng = random.Random(20261009)
        today = timezone.localdate()
        first_day = today - timedelta(days=days - 1)
        breeds = list(BREEDS)
        cows = []
        observations = []

        for cow_index in range(1, cow_count + 1):
            # Fixed, seeded attributes make the demo repeatable and easy to compare.
            breed = breeds[(cow_index - 1) % len(breeds)]
            base_yield, min_weight, max_weight = BREEDS[breed]
            age_months = rng.randint(30, 96)
            birth_date = today - relativedelta(months=age_months)
            weight = rng.randint(min_weight, max_weight)
            calving_date = first_day - timedelta(days=rng.randint(30, 180))
            cow = IndividualMilkDemoCow.objects.create(
                demo_id=f"demo-cow-{cow_index:03d}",
                tag_number=f"DEMO-COW-{cow_index:03d}",
                breed=breed,
                sex="FEMALE",
                birth_date=birth_date,
                weight_kg=weight,
                calving_date=calving_date,
                seed_marker=SEED_MARKER_INDIVIDUAL_MILK_DEMO,
            )
            cows.append(cow)

            # An occasional short health spell produces a realistic, temporary yield dip.
            spell_start = rng.randint(12, max(13, days - 12))
            spell_length = rng.randint(3, 7)
            for day_index in range(days):
                record_date = first_day + timedelta(days=day_index)
                days_since_calving = (record_date - calving_date).days
                disease_active = spell_start <= day_index < spell_start + spell_length
                lactation_curve = 0.58 + 0.62 * math.exp(-((days_since_calving - 45) / 78) ** 2)
                age_factor = min(1.08, 0.82 + age_months / 280)
                weight_factor = 0.92 + (weight - 400) / 2200
                seasonal_factor = 1 + 0.035 * math.sin(2 * math.pi * record_date.timetuple().tm_yday / 365)
                weekly_factor = 1 + 0.025 * math.sin(2 * math.pi * day_index / 7)
                illness_factor = 0.72 if disease_active else 1.0
                noise = rng.gauss(0, 0.85)
                milk_liters = max(
                    0.2,
                    base_yield * lactation_curve * age_factor * weight_factor
                    * seasonal_factor * weekly_factor * illness_factor + noise,
                )
                observations.append(IndividualMilkDemoObservation(
                    cow=cow,
                    record_date=record_date,
                    milk_quantity_liters=round(milk_liters, 2),
                    disease_active=disease_active,
                    seed_marker=SEED_MARKER_INDIVIDUAL_MILK_DEMO,
                ))

        # Bulk insert makes seeding hundreds or thousands of daily rows efficient.
        IndividualMilkDemoObservation.objects.bulk_create(observations, batch_size=1000)
        return len(cows), len(observations)

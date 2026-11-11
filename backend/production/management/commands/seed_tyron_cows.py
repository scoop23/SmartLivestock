"""
Management command to seed two dairy cows with complete milk and weight production records
for farmer Tyron Lindog in Barangay Manggas, Padre Garcia.

Usage:
  python manage.py seed_tyron_cows
  python manage.py seed_tyron_cows --clean
"""

from datetime import date, timedelta
from decimal import Decimal
import random

from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import DecimalField, ExpressionWrapper, F, Q
from django.utils import timezone

from livestock.models import Farmer, LivestockInventory, LivestockType
from production.models import BreedingRecord, FeedingRecord, ProductionRecord, WeightRecord
from smartlivestock.seed_tags import next_seed_livestock_tag
from users.models import User


class Command(BaseCommand):
    help = "Seed 2 dairy cows with complete milk and weight production records for farmer Tyron Lindog"

    SEED_MARKER = "[seed_tyron_cows]"
    OFFICER_NOTE = "Registration details reviewed. Dairy cow listed under the farmer?s livestock inventory in Barangay Manggas."
    LEGACY_COWS = {"CO-2023-04981": "PG-MAN-204-06", "CO-2023-05124": "PG-MAN-204-07"}

    def add_arguments(self, parser):
        parser.add_argument(
            "--clean",
            action="store_true",
            help="Remove the 2 cows and their associated milk and weight records",
        )

    def handle(self, *args, **options):
        clean_mode = options.get("clean", False)

        # 1. Locate Farmer Tyron Lindog
        farmer = Farmer.objects.filter(user__username="tyron.lindog").first()
        if not farmer:
            farmer = Farmer.objects.filter(
                user__first_name__iexact="Tyron",
                user__last_name__iexact="Lindog",
            ).first()

        if not farmer:
            self.stderr.write(self.style.ERROR("Farmer Tyron Lindog was not found in the database."))
            return

        owned_cows = Q(certificate_verification__seed_command="seed_tyron_cows") | Q(review_remarks__startswith=self.SEED_MARKER)
        for certificate, tag in self.LEGACY_COWS.items():
            owned_cows |= Q(ownership_certificate_number=certificate, tag_number=tag)
        cows_qs = LivestockInventory.objects.filter(owned_cows, farmer=farmer)

        # Handle --clean flag
        if clean_mode:
            with transaction.atomic():
                cow_ids = list(cows_qs.values_list("id", flat=True))
                milk_deleted, _ = ProductionRecord.objects.filter(livestock_id__in=cow_ids).delete()
                weight_deleted, _ = WeightRecord.objects.filter(livestock_id__in=cow_ids).delete()
                FeedingRecord.objects.filter(livestock_id__in=cow_ids, notes="Fresh chopped forage and dairy concentrate offered after milking.").delete()
                BreedingRecord.objects.filter(dam_id__in=cow_ids, notes="Service recorded; observe for return to heat and arrange pregnancy check.").delete()
                cows_deleted, _ = cows_qs.delete()

            self.stdout.write(
                self.style.SUCCESS(
                    f"Successfully cleaned records for Tyron Lindog:\n"
                    f"  - Cows removed: {cows_deleted}\n"
                    f"  - Milk records removed: {milk_deleted}\n"
                    f"  - Weight records removed: {weight_deleted}"
                )
            )
            return

        cattle_type = LivestockType.objects.filter(name__iexact="Cattle").first()
        if not cattle_type:
            cattle_type = LivestockType.objects.first()

        mao_reviewer = User.objects.filter(role__role_name="MAO").first()
        if not mao_reviewer:
            mao_reviewer = User.objects.filter(is_staff=True).first()

        tyron_user = farmer.user
        now = timezone.now()

        # Seed data configuration
        # Cow 1: Holstein-Friesian Cross (High yield dairy)
        # Cow 2: Jersey-Sahiwal Cross (Rich cream dairy)
        cows_def = [
            {
                "breed": "Holstein-Friesian Cross",
                "birth_date": date(2023, 3, 14),
                "certificate_no": "CO-2023-04981",
                "weight_baseline": Decimal("418.00"),
                "latest_weight": Decimal("448.00"),
                "milk_morning_range": (7.4, 9.6),
                "milk_afternoon_range": (5.2, 7.3),
                "weight_history": [
                    (date(2026, 2, 15), Decimal("418.00"), "Post-calving baseline weight"),
                    (date(2026, 4, 20), Decimal("425.50"), "Routine tape weigh-in"),
                    (date(2026, 6, 18), Decimal("432.00"), "Mid-lactation weight check"),
                    (date(2026, 8, 22), Decimal("438.50"), "Herd health monitoring"),
                    (date(2026, 10, 10), Decimal("444.00"), "Monthly routine weight check"),
                    (date(2026, 11, 8), Decimal("448.00"), "Latest herd measurement"),
                ],
                "notes_options": [
                    "Clean morning milk collected",
                    "Normal milking, good udder health",
                    "Dairy concentrate and napier fed",
                    "High morning yield",
                    "Good appetite and rumination",
                    "",
                    "",
                    "",
                ],
            },
            {
                "breed": "Jersey-Sahiwal Cross",
                "birth_date": date(2023, 8, 22),
                "certificate_no": "CO-2023-05124",
                "weight_baseline": Decimal("388.00"),
                "latest_weight": Decimal("416.50"),
                "milk_morning_range": (5.8, 7.4),
                "milk_afternoon_range": (4.1, 5.7),
                "weight_history": [
                    (date(2026, 2, 15), Decimal("388.00"), "Heifer baseline weight before first calving"),
                    (date(2026, 4, 20), Decimal("395.50"), "Post-calving recovery weigh-in"),
                    (date(2026, 6, 18), Decimal("402.00"), "Routine monthly check"),
                    (date(2026, 8, 22), Decimal("408.50"), "Lactation stage condition check"),
                    (date(2026, 10, 10), Decimal("413.00"), "Quarterly weigh-in"),
                    (date(2026, 11, 8), Decimal("416.50"), "Latest weigh-in, healthy body condition"),
                ],
                "notes_options": [
                    "Normal morning collection",
                    "Good appetite, fed silage and mineral block",
                    "Clean session",
                    "Afternoon collection normal",
                    "Healthy appetite",
                    "",
                    "",
                    "",
                ],
            },
        ]

        total_milk_records = 0
        total_weight_records = 0
        total_feeding_records = 0
        total_breeding_records = 0
        created_cows = []

        # Deterministic pseudo-randomness for realistic yet reproducible fluctuations
        rng = random.Random(20261111)

        with transaction.atomic():
            Farmer.objects.select_for_update().get(pk=farmer.pk)
            for cow_info in cows_def:
                cow = LivestockInventory.objects.select_for_update().filter(
                    farmer=farmer, breed=cow_info["breed"],
                    ownership_certificate_number=cow_info["certificate_no"],
                ).first()
                if cow is None:
                    cow = LivestockInventory.objects.create(
                        farmer=farmer,
                        tag_number=next_seed_livestock_tag(self, tyron_user),
                        livestock_type=cattle_type,
                        entry_type=LivestockInventory.EntryType.INDIVIDUAL,
                        quantity=1,
                        breed=cow_info["breed"],
                        sex="Female",
                        birth_date=cow_info["birth_date"],
                        weight=cow_info["latest_weight"],
                        ownership_certificate_number=cow_info["certificate_no"],
                        ownership_certificate_recorded_by=mao_reviewer,
                        ownership_certificate_recorded_at=now - timedelta(days=200),
                        status=LivestockInventory.StatusType.APPROVED,
                        operational_status=LivestockInventory.OperationalStatus.ACTIVE,
                        operational_status_changed_at=now - timedelta(days=200),
                        reviewed_by=mao_reviewer,
                        reviewed_at=now - timedelta(days=200),
                        review_remarks=self.OFFICER_NOTE,
                        certificate_verification={"seed_command": "seed_tyron_cows", "synthetic": True},
                        created_by=tyron_user,
                    )
                elif cow.tag_number == self.LEGACY_COWS[cow_info["certificate_no"]]:
                    cow.tag_number = next_seed_livestock_tag(self, tyron_user)
                    cow.save(update_fields=["tag_number"])
                if cow.review_remarks.startswith(self.SEED_MARKER):
                    metadata = dict(cow.certificate_verification or {})
                    metadata.update(seed_command="seed_tyron_cows", synthetic=True)
                    cow.certificate_verification = metadata
                    cow.review_remarks = self.OFFICER_NOTE
                    cow.save(update_fields=["certificate_verification", "review_remarks"])
                created_cows.append(cow)

                # 2. Complete Weight Production History
                weight_rows = []
                for weighing_date, weight_val, note in cow_info["weight_history"]:
                    if not WeightRecord.objects.filter(livestock=cow, weighing_date=weighing_date).exists():
                        weight_rows.append(
                            WeightRecord(
                                livestock=cow,
                                weighing_date=weighing_date,
                                weight=weight_val,
                                notes=note,
                                created_by=tyron_user,
                            )
                        )
                if weight_rows:
                    WeightRecord.objects.bulk_create(weight_rows)
                    total_weight_records += len(weight_rows)

                # 3. Complete Milk Production History (Daily Morning & Afternoon sessions for 60 days)
                start_date = date(2026, 11, 11) - timedelta(days=59)
                end_date = date(2026, 11, 11)
                curr_date = start_date
                milk_rows = []

                existing_dates = set(
                    ProductionRecord.objects.filter(
                        livestock=cow,
                        production_type=ProductionRecord.ProductionType.MILK,
                    ).values_list("record_date", "milking_session")
                )

                while curr_date <= end_date:
                    min_m, max_m = cow_info["milk_morning_range"]
                    wave = 0.4 * (rng.random() - 0.5)
                    m_qty = Decimal(str(round(rng.uniform(min_m, max_m) + wave, 2)))
                    m_note = rng.choice(cow_info["notes_options"])

                    if (curr_date, ProductionRecord.MilkingSession.MORNING) not in existing_dates:
                        milk_rows.append(
                            ProductionRecord(
                                livestock=cow,
                                farmer_at_record=farmer,
                                production_type=ProductionRecord.ProductionType.MILK,
                                quantity=m_qty,
                                unit=ProductionRecord.UnitType.LITERS,
                                record_date=curr_date,
                                milking_session=ProductionRecord.MilkingSession.MORNING,
                                session_conflict=False,
                                status=ProductionRecord.ProductionStatus.RECORDED,
                                anomaly_assessment_status=ProductionRecord.AnomalyAssessmentStatus.CLEAN,
                                anomaly_detected=False,
                                requires_cbat_verification=False,
                                next_review_queue=ProductionRecord.ReviewQueue.NONE,
                                notes=m_note,
                                created_by=tyron_user,
                            )
                        )

                    min_a, max_a = cow_info["milk_afternoon_range"]
                    a_qty = Decimal(str(round(rng.uniform(min_a, max_a) + wave, 2)))
                    a_note = rng.choice(cow_info["notes_options"]) if rng.random() > 0.6 else ""

                    if (curr_date, ProductionRecord.MilkingSession.AFTERNOON) not in existing_dates:
                        milk_rows.append(
                            ProductionRecord(
                                livestock=cow,
                                farmer_at_record=farmer,
                                production_type=ProductionRecord.ProductionType.MILK,
                                quantity=a_qty,
                                unit=ProductionRecord.UnitType.LITERS,
                                record_date=curr_date,
                                milking_session=ProductionRecord.MilkingSession.AFTERNOON,
                                session_conflict=False,
                                status=ProductionRecord.ProductionStatus.RECORDED,
                                anomaly_assessment_status=ProductionRecord.AnomalyAssessmentStatus.CLEAN,
                                anomaly_detected=False,
                                requires_cbat_verification=False,
                                next_review_queue=ProductionRecord.ReviewQueue.NONE,
                                notes=a_note,
                                created_by=tyron_user,
                            )
                        )

                    curr_date += timedelta(days=1)

                if milk_rows:
                    ProductionRecord.objects.bulk_create(milk_rows)
                    total_milk_records += len(milk_rows)

                breeding_day = end_date - timedelta(days=20)
                _, breeding_created = BreedingRecord.objects.get_or_create(
                    dam=cow, breeding_date=breeding_day,
                    defaults={
                        "breeding_type": BreedingRecord.BreedingType.ARTIFICIAL_INSEMINATION,
                        "sire_breed": "Holstein-Friesian" if cow_info["breed"].startswith("Holstein") else "Jersey",
                        "status": BreedingRecord.BreedingStatus.PENDING_CHECK,
                        "notes": "Service recorded; observe for return to heat and arrange pregnancy check.",
                        "created_by": tyron_user,
                    },
                )
                total_breeding_records += breeding_created
                existing_feed = set(FeedingRecord.objects.filter(
                    livestock=cow, feeding_date__range=(start_date, end_date),
                ).values_list("feeding_date", "feeding_time", "feed_type"))
                # Illustrative demo prices in PHP per kg, not live supplier quotes.
                feed_prices = {
                    FeedingRecord.FeedType.FORAGE: Decimal("0.00"),
                    FeedingRecord.FeedType.CONCENTRATE: Decimal("32.00"),
                }
                for feed_type, price in feed_prices.items():
                    FeedingRecord.objects.filter(
                        livestock=cow, feeding_date__range=(start_date, end_date),
                        feed_type=feed_type, cost__isnull=True,
                        notes="Fresh chopped forage and dairy concentrate offered after milking.",
                        created_by=tyron_user,
                    ).update(cost=ExpressionWrapper(
                        F("quantity_kg") * price,
                        output_field=DecimalField(max_digits=10, decimal_places=2),
                    ))
                feeding_rows = []
                for offset in range(60):
                    feeding_day = start_date + timedelta(days=offset)
                    for feeding_time in (FeedingRecord.FeedingTime.MORNING, FeedingRecord.FeedingTime.AFTERNOON):
                        for feed_type, feed_name, kg in (
                            (FeedingRecord.FeedType.FORAGE, "Fresh chopped Napier grass", Decimal("15.00")),
                            (FeedingRecord.FeedType.CONCENTRATE, "Dairy concentrate", Decimal("2.50")),
                        ):
                            if (feeding_day, feeding_time, feed_type) in existing_feed:
                                continue
                            feeding_rows.append(FeedingRecord(
                                livestock=cow, feeding_date=feeding_day, feeding_time=feeding_time,
                                feed_type=feed_type, feed_name=feed_name, quantity_kg=kg,
                                cost=(kg * feed_prices[feed_type]).quantize(Decimal("0.01")),
                                notes="Fresh chopped forage and dairy concentrate offered after milking.",
                                created_by=tyron_user,
                            ))
                FeedingRecord.objects.bulk_create(feeding_rows)
                total_feeding_records += len(feeding_rows)

        self.stdout.write(
            self.style.SUCCESS(
                f"\nSuccessfully seeded 2 dairy cows for {farmer.user.get_full_name()} ({farmer.user.username}) in Brgy. {farmer.barangay.barangay_name}:\n"
                f"  1. Cow {created_cows[0].tag_number}: Holstein-Friesian Cross (Current Weight: 448 kg)\n"
                f"  2. Cow {created_cows[1].tag_number}: Jersey-Sahiwal Cross (Current Weight: 416.5 kg)\n"
                f"  - Milk collection logs: {total_milk_records} session records (Sept 28 – Nov 11, 2026)\n"
                f"  - Weight monitoring logs: {total_weight_records} periodic measurements (Feb – Nov 2026)\n\n"
                f"  - Feeding logs added: {total_feeding_records}\n"
                f"  - Breeding records added: {total_breeding_records}\n"
                f"To remove these records at any time, run: python manage.py seed_tyron_cows --clean"
            )
        )

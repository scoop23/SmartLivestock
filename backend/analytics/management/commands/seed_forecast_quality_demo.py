"""Seed synthetic, isolated-quality examples for the forecast dashboard.

Examples (development PostgreSQL only):
    python manage.py seed_forecast_quality_demo --scenario ideal
    python manage.py seed_forecast_quality_demo --scenario ideal --clean
    python manage.py seed_forecast_quality_demo --scenario poor
    python manage.py seed_forecast_quality_demo --scenario poor --clean

These records are demonstrations, not operational data or evidence of model
accuracy. The ideal scenario uses explicitly simulated historical timestamps so
the dashboard can demonstrate cutoff-based backtesting.
"""

import os
import sys
from datetime import date, datetime, time, timedelta
from decimal import Decimal
from math import sin, pi

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import connections, transaction
from django.utils import timezone

from analytics.seed_markers import (
    SEED_MARKER_FORECAST_QUALITY_IDEAL,
    SEED_MARKER_FORECAST_QUALITY_POOR,
    SEED_MARKER_PRODUCTION_V2,
    SEED_MARKER_SLAUGHTER,
)
from livestock.models import Farmer, LivestockInventory, LivestockOwnershipTransfer, LivestockType
from production.models import ProductionRecord, SlaughterRecord
from users.models import User


MONTHS = 36
AUCTION_WEEKS = 104


def shift_month(month_start: date, offset: int) -> date:
    index = month_start.year * 12 + month_start.month - 1 + offset
    return date(index // 12, index % 12 + 1, 1)


def aware_at(day: date, hour: int) -> datetime:
    return timezone.make_aware(datetime.combine(day, time(hour=hour)))


class Command(BaseCommand):
    help = "Seed or clean ideal/poor synthetic forecast-quality examples for milk, meat, slaughter, and auction sales."

    def add_arguments(self, parser):
        parser.add_argument("--scenario", choices=("ideal", "poor"), required=True)
        parser.add_argument("--clean", action="store_true", help="Remove only the selected scenario's owned records.")

    def handle(self, *args, **options):
        scenario = options["scenario"]
        marker = (
            SEED_MARKER_FORECAST_QUALITY_IDEAL
            if scenario == "ideal"
            else SEED_MARKER_FORECAST_QUALITY_POOR
        )
        self._assert_safe_database(clean=options["clean"])

        if options["clean"]:
            self._clean(marker)
            return

        other_marker = (
            SEED_MARKER_FORECAST_QUALITY_POOR
            if scenario == "ideal"
            else SEED_MARKER_FORECAST_QUALITY_IDEAL
        )
        if self._scenario_exists(other_marker):
            raise CommandError(
                "The other forecast-quality scenario is already present. Clean that scenario first; "
                "the forecast APIs aggregate records and cannot display both scenarios separately."
            )
        if self._scenario_exists(marker):
            raise CommandError(
                f"The {scenario} scenario already exists. Run this command with --scenario {scenario} --clean before reseeding."
            )

        mao_user = (
            User.objects.filter(role__role_name__icontains="MAO").first()
            or User.objects.filter(is_superuser=True).first()
        )
        if not mao_user:
            raise CommandError("A MAO or superuser account is required as the synthetic record creator/reviewer.")

        cattle_type = (
            LivestockType.objects.filter(name__icontains="cattle").first()
            or LivestockType.objects.filter(name__icontains="cow").first()
        )
        if not cattle_type:
            raise CommandError("A Cattle/Cow LivestockType is required for synthetic slaughter events.")
        seller = Farmer.objects.select_related("user").first()
        if not seller:
            raise CommandError("At least one Farmer record is required as the seller for synthetic transfer events.")

        # Warn rather than silently overwrite or remove unrelated source rows.
        existing_counts = {
            "milk/meat": ProductionRecord.objects.filter(
                production_type__in=(ProductionRecord.ProductionType.MILK, ProductionRecord.ProductionType.MEAT)
            ).count(),
            "slaughter": SlaughterRecord.objects.count(),
            "ownership_transfers": LivestockOwnershipTransfer.objects.count(),
        }
        if any(existing_counts.values()):
            self.stdout.write(self.style.WARNING(
                "Existing source rows will remain and the dashboard aggregates them with this synthetic scenario. "
                "Use an isolated local database for a clean comparison. Existing rows will not be changed. "
                f"Current counts: {existing_counts}."
            ))

        with transaction.atomic():
            if scenario == "ideal":
                created = self._seed_ideal(marker, mao_user, seller, cattle_type)
            else:
                created = self._seed_poor(marker, mao_user, seller, cattle_type)
        self.stdout.write(self.style.SUCCESS(
            f"Seeded the synthetic '{scenario}' forecast-quality scenario: "
            f"{created['milk']} milk session rows, {created['farmer_meat']} farmer meat events, "
            f"{created['slaughter']} slaughter events, and {created['sales']} approved/pending ownership transfer events."
        ))
        self.stdout.write(
            "This dataset is synthetic. Its simulated dates and approval timestamps demonstrate system behavior; "
            "they are not real operational evidence or measured forecast accuracy.\n"
            f"Remove only this scenario with: python manage.py seed_forecast_quality_demo --scenario {scenario} --clean"
        )

    def _assert_safe_database(self, *, clean):
        connection = connections["default"]
        isolated_test = "test" in sys.argv and "test" in str(connection.settings_dict.get("NAME", "")).lower()
        if isolated_test:
            return
        host = str(connection.settings_dict.get("HOST") or "").strip().lower()
        target_env = os.environ.get("SMARTLIVESTOCK_DEMO_ENV", "").lower()
        db_name = str(connection.settings_dict.get("NAME") or "")
        expected_ack = f"development:{db_name}"
        if (
            connection.vendor != "postgresql"
            # An empty PostgreSQL HOST means Django uses the local Unix socket.
            or host not in {"", "localhost", "127.0.0.1", "::1"}
            or not settings.DEBUG
            or target_env != "development"
            or os.environ.get("SMARTLIVESTOCK_DEMO_DATABASE_ACK") != expected_ack
        ):
            raise CommandError(
                "Forecast demo seeds are restricted to a local PostgreSQL development database. "
                "Set SMARTLIVESTOCK_DEMO_ENV=development and "
                "SMARTLIVESTOCK_DEMO_DATABASE_ACK=development:<database-name> after verifying the target. "
                "No database changes were made."
            )
        if clean and os.environ.get("SMARTLIVESTOCK_DEMO_ALLOW_CLEANUP") != "YES":
            raise CommandError(
                "--clean requires SMARTLIVESTOCK_DEMO_ALLOW_CLEANUP=YES after confirming this is the intended local database. "
                "No database changes were made."
            )

    @staticmethod
    def _scenario_exists(marker):
        return (
            ProductionRecord.objects.filter(notes__contains=marker)
            .exists()
            or SlaughterRecord.objects.filter(review_remarks__contains=marker).exists()
            or LivestockOwnershipTransfer.objects.filter(review_remarks__contains=marker).exists()
            or LivestockInventory.objects.filter(tag_number__startswith=f"{marker}-").exists()
        )

    def _clean(self, marker):
        with transaction.atomic():
            milk_meat = ProductionRecord.objects.filter(notes__contains=marker)
            slaughter = SlaughterRecord.objects.filter(review_remarks__contains=marker)
            sales = LivestockOwnershipTransfer.objects.filter(review_remarks__contains=marker)
            animals = LivestockInventory.objects.filter(tag_number__startswith=f"{marker}-")
            counts = {"production": milk_meat.count(), "slaughter": slaughter.count(),
                      "transfers": sales.count(), "synthetic_animals": animals.count()}
            milk_meat.delete()
            slaughter.delete()
            sales.delete()
            animals.delete()
        self.stdout.write(self.style.SUCCESS(
            f"Removed only forecast demo rows owned by {marker}: {counts}. "
            "The reused Farmer, their account, and unrelated livestock or transfer records were not deleted."
        ))

    @staticmethod
    def _create_rows(model, rows):
        if not rows:
            return
        model.objects.bulk_create(rows, batch_size=1000)
        # auto_now_add replaces created_at during insert; restore the synthetic
        # historical submission time afterward for backtest demonstration.
        for row in rows:
            row.created_at = row._demo_created_at
        model.objects.bulk_update(rows, ["created_at"], batch_size=500)

    @staticmethod
    def _months_back(month_count):
        last_month = shift_month(date(timezone.localdate().year, timezone.localdate().month, 1), -1)
        first_month = shift_month(last_month, -(month_count - 1))
        return [shift_month(first_month, index) for index in range(month_count)]

    def _production_row(self, *, marker, user, day, kind, amount, status, session=None,
                        approved_time=None, review_time=None, note=""):
        record = ProductionRecord(
            livestock=None,
            batch=None,
            farmer_at_record=None,
            production_type=kind,
            quantity=Decimal(str(amount)),
            unit=(ProductionRecord.UnitType.LITERS if kind == "MILK" else ProductionRecord.UnitType.KILOGRAMS),
            record_date=day,
            milking_session=session,
            session_conflict=False,
            status=status,
            slaughter=None,
            approved_at=None,
            reviewed_by=None,
            reviewed_at=None,
            next_review_queue=(ProductionRecord.ReviewQueue.NONE if status == ProductionRecord.ProductionStatus.RECORDED else
                               ProductionRecord.ReviewQueue.FARMER if status == ProductionRecord.ProductionStatus.SUBJECT_TO_REVISION
                               else ProductionRecord.ReviewQueue.MAO),
            notes=f"{SEED_MARKER_PRODUCTION_V2} {marker} Synthetic forecast scenario; {note}"[:500],
            review_remarks=f"{marker} Synthetic fixture; no real farmer activity.",
            created_by=user,
        )
        record._demo_created_at = aware_at(day, 8)
        return record

    def _slaughter_row(self, *, marker, user, cattle_type, day, heads, kg, status,
                       review_time=None, note=""):
        row = SlaughterRecord(
            livestock=None, batch=None, barangay=None, livestock_type=cattle_type,
            quantity=heads, carcass_weight=Decimal(str(kg)) if kg is not None else None,
            record_date=day, status=status, reviewed_by=user if review_time else None,
            reviewed_at=review_time,
            review_remarks=f"{SEED_MARKER_SLAUGHTER} {marker} Synthetic fixture; {note}"[:1000],
            created_by=user,
        )
        row._demo_created_at = aware_at(day, 8)
        return row

    def _sale_row(self, *, marker, user, seller, cattle_type, day, heads, price, status,
                  review_time=None, note=""):
        """Create one marked inventory identity and transfer event per animal."""
        animal_rows = []
        transfer_rows = []
        if price is not None and heads:
            total_cents = int((Decimal(str(price)) * 100).quantize(Decimal("1")))
            base_cents, remainder_cents = divmod(total_cents, heads)
            per_animal_prices = [
                Decimal(base_cents + (1 if index < remainder_cents else 0)) / 100
                for index in range(heads)
            ]
        else:
            per_animal_prices = [None] * heads
        for index in range(heads):
            serial = getattr(self, "_demo_animal_serial", 0) + 1
            self._demo_animal_serial = serial
            animal = LivestockInventory(
                farmer=seller, livestock_type=cattle_type,
                entry_type=LivestockInventory.EntryType.INDIVIDUAL, quantity=1,
                tag_number=f"{marker}-{serial:06d}",
                status=LivestockInventory.StatusType.APPROVED,
                operational_status=(LivestockInventory.OperationalStatus.SOLD
                                    if status == LivestockOwnershipTransfer.Status.APPROVED
                                    else LivestockInventory.OperationalStatus.ACTIVE),
                operational_status_changed_at=(review_time if status == LivestockOwnershipTransfer.Status.APPROVED else None),
                reviewed_by=user, reviewed_at=review_time,
                review_remarks=f"{marker} Synthetic forecast-quality inventory fixture.",
                created_by=user,
            )
            animal._demo_created_at = aware_at(day, 7)
            animal_rows.append(animal)
            transfer = LivestockOwnershipTransfer(
                livestock=animal, previous_owner=seller,
                owner_type=LivestockOwnershipTransfer.OwnerType.EXTERNAL_INDIVIDUAL,
                external_owner_name=f"Synthetic buyer {serial}",
                external_owner_address="Demonstration data only",
                transfer_certificate_number=f"DEMO-{serial:08d}",
                original_certificate_number=f"ORIGINAL-DEMO-{serial:08d}",
                transfer_date=day, municipality="Padre Garcia", province="Batangas",
                animal_description=f"Synthetic {cattle_type.name} transfer; {note}"[:500],
                purchase_price=per_animal_prices[index],
                status=status, reviewed_by=user if review_time else None,
                reviewed_at=review_time,
                review_remarks=f"{marker} Synthetic fixture; {note}"[:1000],
                created_by=user,
            )
            transfer._demo_created_at = aware_at(day, 8)
            transfer_rows.append(transfer)
        return animal_rows, transfer_rows

    def _seed_ideal(self, marker, user, seller, cattle_type):
        months = self._months_back(MONTHS)
        production_rows = []
        meat_rows = []
        slaughter_rows = []
        for month_index, month in enumerate(months):
            next_month = shift_month(month, 1)
            days = (next_month - month).days
            annual = 1 + 0.06 * sin((month.month - 1) * 2 * pi / 12)
            trend = 1 + month_index * 0.003
            for day_number in range(1, days + 1):
                production_day = date(month.year, month.month, day_number)
                for session, base in (("MORNING", 82), ("AFTERNOON", 59), ("EVENING", 41)):
                    variation = ((day_number * 7 + month.month * 3) % 9 - 4) * 0.7
                    production_rows.append(self._production_row(
                        marker=marker, user=user, day=production_day, kind="MILK",
                        amount=round((base + variation) * annual * trend, 2),
                        status=ProductionRecord.ProductionStatus.RECORDED,
                        session=session, note="complete daily session report",
                    ))
            for event_index, day_number in enumerate((6, 16, 26)):
                event_day = date(month.year, month.month, min(day_number, days))
                kg = round((135 + 16 * event_index + month_index * 1.8) * annual, 2)
                meat_rows.append(self._production_row(
                    marker=marker, user=user, day=event_day, kind="MEAT", amount=kg,
                    status=ProductionRecord.ProductionStatus.RECORDED,
                    note="farmer-reported event yield in kilograms",
                ))
            for event_index, day_number in enumerate((9, 23)):
                event_day = date(month.year, month.month, min(day_number, days))
                heads = 4 + ((month_index + event_index) % 5)
                weight = round(heads * (188 + ((month_index + 2 * event_index) % 17)), 2)
                slaughter_rows.append(self._slaughter_row(
                    marker=marker, user=user, cattle_type=cattle_type, day=event_day,
                    heads=heads, kg=weight, status=SlaughterRecord.StatusType.APPROVED,
                    review_time=aware_at(event_day, 17), note="measured carcass weight and head count",
                ))

        self._create_rows(ProductionRecord, production_rows + meat_rows)
        self._create_rows(SlaughterRecord, slaughter_rows)

        today = timezone.localdate()
        current_week_start = today - timedelta(days=today.weekday())
        final_week_start = current_week_start - timedelta(weeks=AUCTION_WEEKS)
        sale_animals = []
        sale_rows = []
        for week_index in range(AUCTION_WEEKS):
            week_start = final_week_start + timedelta(weeks=week_index)
            for weekday in range(7):
                sale_day = week_start + timedelta(days=weekday)
                heads = 2 + ((week_index * 3 + weekday) % 5)
                for extra in range(2 if weekday == 4 else 1 if weekday == 3 else 0):
                    total_price = heads * (30000 + ((week_index + extra) % 9) * 850)
                    animals, transfers = self._sale_row(
                        marker=marker, user=user, seller=seller, cattle_type=cattle_type,
                        day=sale_day, heads=heads,
                        price=total_price, status=LivestockOwnershipTransfer.Status.APPROVED,
                        review_time=aware_at(sale_day, 17),
                        note="all weekdays represented; Thursday/Friday pattern is synthetic only",
                    )
                    sale_animals.extend(animals)
                    sale_rows.extend(transfers)
        self._create_rows(LivestockInventory, sale_animals)
        self._create_rows(LivestockOwnershipTransfer, sale_rows)
        return {"milk": len(production_rows), "farmer_meat": len(meat_rows),
                "slaughter": len(slaughter_rows), "sales": len(sale_rows)}

    def _seed_poor(self, marker, user, seller, cattle_type):
        months = self._months_back(MONTHS)
        observed_indexes = (0, 4, 8, 12, 16, 20, 24, 28, 32, 35)
        production_rows = []
        meat_rows = []
        slaughter_rows = []
        for observed_number, month_index in enumerate(observed_indexes):
            month = months[month_index]
            event_day = date(month.year, month.month, 12)
            recorded = ProductionRecord.ProductionStatus.RECORDED
            # Sparse milk reporting: some dates omit a session label, and one
            # approved session in every second month lacks a current approval time.
            for session_number, session in enumerate(("MORNING", None)):
                review_time = aware_at(event_day + timedelta(days=40), 17) if observed_number % 2 else None
                production_rows.append(self._production_row(
                    marker=marker, user=user, day=event_day + timedelta(days=session_number), kind="MILK",
                    amount=(48 if session_number == 0 else 21), status=recorded,
                    session=session, approved_time=review_time, review_time=review_time,
                    note="sparse session entry; timestamps are intentionally incomplete/late",
                ))
            meat_kg = 2400 if observed_number == 6 else 95 + observed_number * 31
            meat_review = None if observed_number % 3 == 0 else aware_at(event_day + timedelta(days=45), 17)
            meat_rows.append(self._production_row(
                marker=marker, user=user, day=event_day, kind="MEAT", amount=meat_kg,
                status=recorded,
                note="sparse event history with a suspicious high observation",
            ))
            slaughter_review = None if observed_number % 3 == 0 else aware_at(event_day + timedelta(days=50), 17)
            slaughter_rows.append(self._slaughter_row(
                marker=marker, user=user, cattle_type=cattle_type, day=event_day,
                heads=3 + observed_number, kg=(None if observed_number % 2 == 0 else 620 + observed_number * 55),
                status=SlaughterRecord.StatusType.APPROVED, review_time=slaughter_review,
                note="sparse event history; some carcass weights or review timestamps missing",
            ))

        # Unapproved rows are visible to the workflow diagnostics but excluded
        # from model training, as they should be.
        for pending_index in (2, 6, 10, 14, 18, 22, 26, 30):
            month = months[pending_index]
            pending_day = date(month.year, month.month, 22)
            production_rows.append(self._production_row(
                marker=marker, user=user, day=pending_day, kind="MEAT",
                amount=180 + pending_index, status=ProductionRecord.ProductionStatus.PENDING,
                note="pending approval; correctly excluded from approved-only forecast data",
            ))
            slaughter_rows.append(self._slaughter_row(
                marker=marker, user=user, cattle_type=cattle_type, day=pending_day,
                heads=5, kg=None, status=SlaughterRecord.StatusType.PENDING,
                note="pending approval; correctly excluded from forecast data",
            ))

        self._create_rows(ProductionRecord, production_rows + meat_rows)
        self._create_rows(SlaughterRecord, slaughter_rows)

        today = timezone.localdate()
        current_week_start = today - timedelta(days=today.weekday())
        last_complete_start = current_week_start - timedelta(weeks=1)
        sale_animals = []
        sale_rows = []
        # Only eight nonconsecutive weeks have approved transactions. Captured
        # dates skew toward Friday; this is intentionally inadequate to estimate
        # weekday effects or fill the missing weeks with confirmed zeros.
        for index, weeks_ago in enumerate((3, 6, 9, 12, 15, 18, 21, 24)):
            week_start = last_complete_start - timedelta(weeks=weeks_ago)
            weekday = 1 if index in (3, 7) else 4
            sale_day = week_start + timedelta(days=weekday)
            reviewed = None if index in (1, 4, 7) else aware_at(sale_day + timedelta(days=35), 17)
            animals, transfers = self._sale_row(
                marker=marker, user=user, seller=seller, cattle_type=cattle_type,
                day=sale_day, heads=1 + index,
                price=None if index % 3 == 0 else (28000 + index * 1100) * (1 + index),
                status=LivestockOwnershipTransfer.Status.APPROVED,
                review_time=reviewed, note="intermittent capture; missing price or approval time is intentional",
            )
            sale_animals.extend(animals)
            sale_rows.extend(transfers)
        for offset in (5, 13, 20):
            sale_day = last_complete_start - timedelta(weeks=offset) + timedelta(days=4)
            animals, transfers = self._sale_row(
                marker=marker, user=user, seller=seller, cattle_type=cattle_type,
                day=sale_day, heads=2, price=None,
                status=LivestockOwnershipTransfer.Status.SUBJECT_TO_REVISION,
                note="returned for revision; excluded from approved completed-sale totals",
            )
            sale_animals.extend(animals)
            sale_rows.extend(transfers)
        self._create_rows(LivestockInventory, sale_animals)
        self._create_rows(LivestockOwnershipTransfer, sale_rows)
        return {"milk": len(production_rows), "farmer_meat": len(meat_rows),
                "slaughter": len(slaughter_rows), "sales": len(sale_rows)}

"""Seed synthetic, isolated-quality examples for the forecast dashboard.

Examples (development PostgreSQL only):
    python manage.py seed_forecast_quality_demo --scenario ideal
    python manage.py seed_forecast_quality_demo --scenario ideal --clean
    python manage.py seed_forecast_quality_demo --scenario ideal --carabao-only
    python manage.py seed_forecast_quality_demo --scenario poor
    python manage.py seed_forecast_quality_demo --scenario poor --clean

These records are demonstrations, not operational data or evidence of model
accuracy. The ideal scenario uses explicitly simulated historical timestamps so
the dashboard can demonstrate cutoff-based backtesting.
"""

from datetime import date, datetime, time, timedelta
from decimal import Decimal
from hashlib import sha256
from math import sin, pi
from random import Random

from django.core.management.base import BaseCommand, CommandError
from django.core.management import call_command
from django.db import connection, transaction
from django.db.models import Q
from django.utils import timezone

from analytics.seed_markers import (
    SEED_MARKER_CATTLE_PRICE_DEMO,
    SEED_MARKER_FORECAST_POPULATION_IDEAL,
    SEED_MARKER_FORECAST_POPULATION_POOR,
    SEED_MARKER_FORECAST_QUALITY_IDEAL,
    SEED_MARKER_FORECAST_QUALITY_POOR,
    SEED_MARKER_PRODUCTION_V2,
    SEED_MARKER_SLAUGHTER,
)
from livestock.models import Farmer, LivestockInventory, LivestockOwnershipTransfer, LivestockType
from production.models import AnimalDisposition, ProductionRecord, SlaughterRecord
from smartlivestock.seed_tags import next_seed_colc_number, next_seed_livestock_tag
from smartlivestock.seed_safety import assert_safe_seed_database
from users.models import User


MONTHS = 36
AUCTION_WEEKS = 104
# DEPDev CALABARZON's 2022 report gave these weekly averages; together they sum to 2,500.
MARKET_WEEKLY_HEAD_AVERAGES = (
    {"code": "CAT", "label": "Cattle", "average": 1280, "lot_size": (1, 5), "price_range": None},
    {"code": "CAR", "label": "Carabao", "average": 500, "lot_size": (1, 4), "price_range": None},
    {"code": "GOA", "label": "Goat", "average": 600, "lot_size": (5, 25), "price_range": None},
    {"code": "HOR", "label": "Horse", "average": 120, "lot_size": (1, 2), "price_range": None},
)
SYNTHETIC_MARKET_ORIGINS = (
    ("Lipa City", "Batangas", "CALABARZON"),
    ("Lucena City", "Quezon", "CALABARZON"),
    ("Malolos City", "Bulacan", "Central Luzon"),
    ("Calapan City", "Oriental Mindoro", "MIMAROPA"),
    ("Naga City", "Camarines Sur", "Bicol Region"),
    ("Quezon City", "Metro Manila", "NCR"),
)


def sample_sale_labels(key, day, species_code="CAT", owner_type="EXTERNAL_INDIVIDUAL"):
    """Fictional display labels; seed provenance stays in internal remarks."""
    value = int(sha256(key.encode()).hexdigest()[:12], 16)
    first_names = ("Ramon", "Ernesto", "Roberto", "Danilo", "Eduardo", "Manuel", "Ricardo", "Antonio")
    last_names = ("Mendoza", "Villanueva", "Ramos", "Castillo", "Reyes", "Garcia", "Torres", "Navarro")
    seller = f"{first_names[value % 8]} {last_names[(value // 8) % 8]}"
    buyer = f"{first_names[(value // 64) % 8]} {last_names[(value // 512) % 8]}"
    if owner_type == LivestockOwnershipTransfer.OwnerType.COMPANY:
        buyer = f"{last_names[(value // 512) % 8]} Livestock Trading"
    elif owner_type == LivestockOwnershipTransfer.OwnerType.TRADER:
        buyer += " Livestock Trading"
    reference = sha256(key.encode()).hexdigest()[:10].upper()
    return {
        "external_seller_name": seller,
        "external_owner_name": buyer,
        "external_livestock_tag_number": f"{species_code}-{reference[:8]}",
        "transfer_certificate_number": f"BTG-{day.year}-{reference[:6]}",
        "original_certificate_number": f"COLC-{day.year}-{reference}",
    }


def weekly_counts_with_average(rng, average_heads, week_count):
    """Return varied integer weekly counts whose multiweek mean is exact."""
    weights = [rng.uniform(0.90, 1.10) for _ in range(week_count)]
    weight_total = sum(weights)
    exact_counts = [average_heads * week_count * weight / weight_total for weight in weights]
    weekly_counts = [int(value) for value in exact_counts]
    remainder = average_heads * week_count - sum(weekly_counts)
    largest_remainders = sorted(
        range(week_count),
        key=lambda index: exact_counts[index] - weekly_counts[index],
        reverse=True,
    )
    for index in largest_remainders[:remainder]:
        weekly_counts[index] += 1
    return weekly_counts


def shift_month(month_start: date, offset: int) -> date:
    index = month_start.year * 12 + month_start.month - 1 + offset
    return date(index // 12, index % 12 + 1, 1)


def aware_at(day: date, hour: int) -> datetime:
    return timezone.make_aware(datetime.combine(day, time(hour=hour)))


def synthetic_cattle_profile(rng: Random, transfer_day: date) -> dict:
    """Create demo-only traits and a deliberately trait-linked per-head price.

    These illustrative factors are not fitted market coefficients or a pricing
    recommendation. They make the seed useful for checking how trait mixes can
    change weekly recorded-price averages.
    """
    age_months = rng.choice((18, 24, 30, 36, 48, 60, 72, 84, 96, 120))
    sex = rng.choice(("MALE", "FEMALE"))
    breed, breed_weight, breed_price = rng.choice((
        ("Brahman Cross", 30, 1.08),
        ("Native Cross", -20, 0.94),
        ("Angus Cross", 25, 1.12),
        ("Dairy Cross", 0, 0.98),
    ))
    sex_weight = 35 if sex == "MALE" else 0
    weight = round(max(180, min(700, 185 + age_months * 3.25 + sex_weight + breed_weight + rng.uniform(-18, 18))), 1)
    age_factor = 0.80 if age_months < 24 else 0.91 if age_months < 36 else 1.0 if age_months <= 96 else 0.88
    sex_factor = 1.04 if sex == "MALE" else 0.98
    price = (15_000 + weight * 39) * age_factor * sex_factor * breed_price * rng.uniform(0.98, 1.02)
    price = Decimal(str(round(price / 500) * 500)).quantize(Decimal("0.01"))
    return {
        "birth_date": transfer_day - timedelta(days=age_months * 30),
        "age_at_transfer": f"{age_months // 12} years {age_months % 12} months",
        "sex": sex,
        "breed": breed,
        "weight_kg": Decimal(str(weight)),
        "purchase_price": price,
    }


class Command(BaseCommand):
    help = (
        "Seed or clean forecast-quality examples. The ideal auction scenario creates 104 weeks "
        "of synthetic benchmark-calibrated external-market transfer rows."
    )

    def add_arguments(self, parser):
        parser.add_argument("--scenario", choices=("ideal", "poor"), required=True)
        parser.add_argument("--clean", action="store_true", help="Remove only the selected scenario's owned records.")
        parser.add_argument("--dry-run", action="store_true", help="Preview cleanup counts without changing records; requires --clean.")
        parser.add_argument("--carabao-only", action="store_true", help="Append only marked carabao price-profile sales to the selected scenario; preserves existing cattle records.")
        parser.add_argument("--prices-only", action="store_true", help="Ideal only: create a focused 104-week cattle-profile demo for Registered and External prices, instead of the full market/production scenario.")
        parser.add_argument("--farmer-email", action="append", help="Use this Farmer account as a scenario owner; repeat for multiple demo farmers.")
        parser.add_argument("--farmer-count", type=int, help="Ideal only: optionally limit the number of active, approved farmers (default: all).")
        parser.add_argument("--mao-email", help="Use this active, approved MAO account as reviewer.")
        parser.add_argument("--auction-email", help="Use this active, approved Auction account to create transfer events.")

    def handle(self, *args, **options):
        scenario = options["scenario"]
        if options["carabao_only"] and (options["clean"] or options["prices_only"]):
            raise CommandError("--carabao-only appends sales only and cannot be combined with --clean or --prices-only. Use --clean alone to clean the full selected scenario.")
        if options["dry_run"] and not options["clean"]:
            raise CommandError("--dry-run currently previews cleanup only; also pass --clean.")
        if options["farmer_count"] is not None and options["farmer_count"] < 1:
            raise CommandError("--farmer-count must be at least 1.")
        if options["prices_only"] and scenario != "ideal":
            raise CommandError("--prices-only is an ideal cattle-price demonstration; use --scenario ideal.")
        marker = (
            SEED_MARKER_FORECAST_QUALITY_IDEAL
            if scenario == "ideal"
            else SEED_MARKER_FORECAST_QUALITY_POOR
        )
        if options["prices_only"]:
            marker = SEED_MARKER_CATTLE_PRICE_DEMO
        assert_safe_seed_database(clean=options["clean"], dry_run=options["dry_run"])

        if options["clean"]:
            self._clean(marker, dry_run=options["dry_run"])
            return

        other_marker = (
            SEED_MARKER_FORECAST_QUALITY_POOR
            if scenario == "ideal"
            else SEED_MARKER_FORECAST_QUALITY_IDEAL
        )
        if not options["prices_only"] and self._scenario_exists(other_marker):
            raise CommandError(
                "The other forecast-quality scenario is already present. Clean that scenario first; "
                "the forecast APIs aggregate records and cannot display both scenarios separately."
            )
        if self._scenario_exists(marker, species="Carabao" if options["carabao_only"] else None):
            if options["carabao_only"]:
                raise CommandError(
                    f"The {scenario} scenario already exists. Run this command with --scenario {scenario} --clean before reseeding."
                )
            self.stdout.write(self.style.WARNING(
                f"Existing '{scenario}' scenario found; replacing owned demo rows so weekly and monthly series include the latest completed period..."
            ))
            self._clean(marker, dry_run=False)

        mao_users = User.objects.filter(role__role_name="MAO", account_status=User.AccountStatus.APPROVED, is_active=True)
        mao_user = mao_users.filter(email__iexact=options["mao_email"]).first() if options["mao_email"] else mao_users.first()
        if not mao_user and not options["mao_email"]:
            mao_user = User.objects.filter(is_superuser=True, is_active=True).first()
        if not mao_user:
            raise CommandError("An active, approved MAO account is required as the synthetic reviewer.")
        if mao_user.role.role_name != "MAO" or mao_user.account_status != User.AccountStatus.APPROVED or not mao_user.is_active:
            raise CommandError("The selected reviewer must be an active, approved MAO account.")

        auction_user = None
        if options["auction_email"]:
            auction_user = User.objects.filter(
                email__iexact=options["auction_email"], role__role_name="AUCTION",
                account_status=User.AccountStatus.APPROVED, is_active=True,
            ).first()
            if not auction_user:
                raise CommandError("The selected Auction account must exist, be active, and be approved.")
        else:
            auction_user = User.objects.filter(
                role__role_name="AUCTION", account_status=User.AccountStatus.APPROVED, is_active=True,
            ).order_by("pk").first() or mao_user

        cattle_type = (
            LivestockType.objects.filter(name__icontains="cattle").first()
            or LivestockType.objects.filter(name__icontains="cow").first()
        )
        if not cattle_type and not options["carabao_only"]:
            raise CommandError("A Cattle/Cow LivestockType is required for synthetic livestock sales.")
        farmer_emails = options["farmer_email"] or []
        if isinstance(farmer_emails, str):
            farmer_emails = [farmer_emails]
        farmer_queryset = Farmer.objects.select_related("user").filter(
            user__role__role_name="FARMER",
        )
        if farmer_emails:
            sellers = list(farmer_queryset.filter(user__email__in=farmer_emails).order_by("pk"))
            found_emails = {seller.user.email.lower() for seller in sellers}
            missing_emails = [email for email in farmer_emails if email.lower() not in found_emails]
            if missing_emails:
                raise CommandError(f"No Farmer profile exists for: {', '.join(missing_emails)}")
        elif scenario == "ideal":
            eligible = list(farmer_queryset.filter(
                user__is_active=True, user__account_status=User.AccountStatus.APPROVED,
            ).order_by("pk"))
            count = min(options["farmer_count"], len(eligible)) if options["farmer_count"] is not None else len(eligible)
            sellers = Random(20261108).sample(eligible, count)
        else:
            seller = farmer_queryset.first()
            sellers = [seller] if seller else []
        if not sellers:
            raise CommandError("At least one Farmer record is required for synthetic farm-production and meat events.")
        self.stdout.write("Scenario farmers: " + "; ".join(
            f"{seller.user.get_full_name().strip() or seller.user.username} (farmer #{seller.pk})"
            for seller in sellers
        ))

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
            if options["carabao_only"]:
                carabao_type, _ = LivestockType.objects.get_or_create(name="Carabao")
                created = self._seed_price_profiles(
                    marker, mao_user, sellers, carabao_type, auction_user,
                    species_code="CAR", weeks=AUCTION_WEEKS if scenario == "ideal" else 2,
                )
            elif options["prices_only"]:
                created = self._seed_price_profiles(marker, mao_user, sellers, cattle_type, auction_user)
            elif scenario == "ideal":
                created = self._seed_ideal(marker, mao_user, sellers, cattle_type, auction_user)
            else:
                created = self._seed_poor(marker, mao_user, sellers, cattle_type, auction_user)
            if scenario == "ideal" and not options["carabao_only"]:
                call_command("seed_forecast_movement_demo", stdout=self.stdout)
            if not options["prices_only"] and not options["carabao_only"]:
                call_command(
                    "seed_forecast_population_demo",
                    scenario=scenario,
                    farmer_email=[seller.user.email for seller in sellers],
                    mao_email=mao_user.email,
                    stdout=self.stdout,
                )
        self.stdout.write(self.style.SUCCESS(
            f"Seeded the synthetic '{scenario}' forecast-quality scenario: "
            f"{created['farmer_meat']} farmer meat events, "
            f"and {created['sales']} approved/pending ownership transfer events."
        ))
        if options["carabao_only"]:
            self.stdout.write("Added synthetic approved Carabao sales in both Registered and External sources. Registered animals are Sold. Existing cattle and farm-production records were preserved. Example profile: Murrah Buffalo, Male, exact age 36 months, exact weight 450 kg. The poor scenario intentionally has only two weeks of history.")
        elif options["prices_only"]:
            self.stdout.write("Created 104 consecutive recorded weeks for both price sources. Price by Animal Profile can use these labeled samples automatically in local development when its source has no real approved sales. Example: Brahman, Male, 2 to under 4 years, 350 to under 500 kg. Prices and backtest scores are constructed demo results only.")
        elif scenario == "ideal":
            self.stdout.write(
                "The ideal scenario includes 104 complete recorded weeks for livestock sales and cattle/carabao price profiles "
                "(7 cattle breeds, 4 carabao breeds, both sexes, and seasonal weekly volume variation) along with 36 months of farmer meat production events."
            )
        self.stdout.write(
            "Synthetic livestock transfer prices are generated from recorded weight, age, sex, and breed. "
            "These relationships demonstrate changing animal mixes; they are not fitted market "
            "rates or a real price recommendation."
        )
        self.stdout.write(
            f"Remove this scenario at any time with: python manage.py seed_forecast_quality_demo --scenario {scenario} --clean"
        )

    @staticmethod
    def _scenario_exists(marker, species=None):
        markers = [marker]
        if marker in (SEED_MARKER_FORECAST_QUALITY_IDEAL, SEED_MARKER_CATTLE_PRICE_DEMO):
            markers = [SEED_MARKER_FORECAST_QUALITY_IDEAL, SEED_MARKER_CATTLE_PRICE_DEMO]
        for m in markers:
            if species is not None:
                if (LivestockOwnershipTransfer.objects.filter(review_remarks__contains=m).filter(
                    Q(livestock__livestock_type__name__iexact=species) | Q(external_livestock_type__iexact=species)
                ).exists() or LivestockInventory.objects.filter(
                    livestock_type__name__iexact=species, review_remarks__contains=m
                ).exists()):
                    return True
                continue
            if (
                ProductionRecord.objects.filter(notes__contains=m).exists()
                or SlaughterRecord.objects.filter(review_remarks__contains=m).exists()
                or LivestockOwnershipTransfer.objects.filter(review_remarks__contains=m).exists()
                or LivestockInventory.objects.filter(
                    Q(tag_number__startswith=f"{m}-") | Q(review_remarks__contains=m)
                ).exists()
            ):
                return True
        return False

    def _clean(self, marker, *, dry_run=False):
        markers = [marker]
        if marker in (SEED_MARKER_FORECAST_QUALITY_IDEAL, SEED_MARKER_CATTLE_PRICE_DEMO):
            markers = [SEED_MARKER_FORECAST_QUALITY_IDEAL, SEED_MARKER_CATTLE_PRICE_DEMO]
        database = connection.settings_dict
        self.stdout.write(
            f"Cleanup target: database={database['NAME']}; "
            f"host={database.get('HOST') or 'local PostgreSQL socket'}; "
            f"port={database.get('PORT') or 'default'}."
        )
        production_filter, review_filter, animal_filter = Q(), Q(), Q()
        for owned_marker in markers:
            production_filter |= Q(notes__contains=owned_marker)
            review_filter |= Q(review_remarks__contains=owned_marker)
            animal_filter |= Q(tag_number__startswith=f"{owned_marker}-") | Q(review_remarks__contains=owned_marker)
        with transaction.atomic():
            # Preview every owned group first. A zero-match clean must not reset
            # population tracking dates or change other bookkeeping records.
            synthetic_animals = LivestockInventory.objects.filter(animal_filter)
            removable_animals = synthetic_animals.filter(treatment_records__isnull=True)
            retained_animals = synthetic_animals.filter(treatment_records__isnull=False).distinct().count()
            groups = {
                "dispositions": AnimalDisposition.objects.filter(production_filter),
                "production": ProductionRecord.objects.filter(production_filter),
                "slaughter": SlaughterRecord.objects.filter(review_filter),
                "transfers": LivestockOwnershipTransfer.objects.filter(review_filter),
                "synthetic_animals": removable_animals,
            }
            totals = {name: rows.count() for name, rows in groups.items()}
            clean_movements = SEED_MARKER_FORECAST_QUALITY_IDEAL in markers
            clean_population = marker != SEED_MARKER_CATTLE_PRICE_DEMO
            if clean_movements:
                from .seed_forecast_movement_demo import clean_owned_movements
                totals["movement_inspections"] = clean_owned_movements(dry_run=True)
            if clean_population:
                from .seed_forecast_population_demo import clean_owned_population
                pop_marker = (
                    SEED_MARKER_FORECAST_POPULATION_IDEAL
                    if marker == SEED_MARKER_FORECAST_QUALITY_IDEAL
                    else SEED_MARKER_FORECAST_POPULATION_POOR
                )
                totals.update(clean_owned_population(marker=pop_marker, dry_run=True))
            if not dry_run and any(totals.values()):
                if clean_movements:
                    clean_owned_movements()
                if clean_population and (totals["population_animals"] or totals["population_changes"]):
                    clean_owned_population(marker=pop_marker)
                for rows in groups.values():
                    rows.delete()
        if retained_animals:
            self.stdout.write(self.style.WARNING(
                f"{'Would retain' if dry_run else 'Retained'} {retained_animals} demo animal(s) "
                "with linked treatment records. Their treatment history is preserved."
            ))
        if not any(totals.values()):
            self.stdout.write(self.style.WARNING(
                f"No matching forecast demo rows found for {', '.join(markers)}. "
                "Nothing was deleted or changed. The selected database may never have contained "
                "this scenario, it may already be clean, or the remaining rows may belong to another seed command. "
                "Check SMARTLIVESTOCK_ENV_FILE and the database used by your running backend."
            ))
            return
        action = "Would remove" if dry_run else "Removed"
        self.stdout.write(self.style.SUCCESS(
            f"{action} only forecast demo rows owned by {', '.join(markers)}: {totals}. "
            "The reused Farmer, their account, and unrelated livestock or transfer records are preserved."
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

    def _create_sale_dispositions(self, marker, transfers):
        """Create Farmer -> Auction sale intent declarations for registered animal transfers."""
        disposition_rows = []
        for transfer in transfers:
            if not transfer.livestock_id or not transfer.previous_owner_id:
                continue
            is_completed = transfer.status == LivestockOwnershipTransfer.Status.APPROVED
            disp = AnimalDisposition(
                livestock_id=transfer.livestock_id,
                intent=AnimalDisposition.IntentType.FOR_SALE,
                target_date=transfer.transfer_date,
                target_destination="Padre Garcia Livestock Auction Market",
                notes=f"{marker} Synthetic farmer sale intent passed to Auction."[:255],
                original_certificate_number=transfer.original_certificate_number,
                registration_status=(
                    AnimalDisposition.RegistrationStatus.COMPLETED
                    if is_completed
                    else AnimalDisposition.RegistrationStatus.CHECKED
                ),
                sale_transfer=transfer if is_completed else None,
                created_by=transfer.previous_owner.user,
            )
            disp._demo_created_at = aware_at(transfer.transfer_date, 7)
            disposition_rows.append(disp)
        self._create_rows(AnimalDisposition, disposition_rows)

    @staticmethod
    def _months_back(month_count):
        last_month = shift_month(date(timezone.localdate().year, timezone.localdate().month, 1), -1)
        first_month = shift_month(last_month, -(month_count - 1))
        return [shift_month(first_month, index) for index in range(month_count)]

    def _production_row(self, *, marker, user, day, kind, amount, status, session=None, farmer=None, note=""):
        record = ProductionRecord(
            livestock=None,
            batch=None,
            farmer_at_record=farmer,
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
                  reviewer=None, review_time=None, note="", price_from_traits=False, profiles=None):
        """Create one marked inventory identity and transfer event per animal."""
        animal_rows = []
        transfer_rows = []
        profiles = profiles if profiles is not None else [synthetic_cattle_profile(self._cattle_trait_rng, day) for _ in range(heads)]
        if price_from_traits:
            per_animal_prices = [profile["purchase_price"] for profile in profiles]
        elif price is not None and heads:
            total_cents = int((Decimal(str(price)) * 100).quantize(Decimal("1")))
            base_cents, remainder_cents = divmod(total_cents, heads)
            per_animal_prices = [
                Decimal(base_cents + (1 if index < remainder_cents else 0)) / 100
                for index in range(heads)
            ]
        else:
            per_animal_prices = [None] * heads
        for index, profile in enumerate(profiles):
            serial = getattr(self, "_demo_animal_serial", 0) + 1
            self._demo_animal_serial = serial
            colc_number = next_seed_colc_number(self, day)
            is_sold = status == LivestockOwnershipTransfer.Status.APPROVED
            animal = LivestockInventory(
                farmer=seller, livestock_type=cattle_type,
                entry_type=LivestockInventory.EntryType.INDIVIDUAL, quantity=1,
                birth_date=profile["birth_date"], breed=profile["breed"],
                sex=profile["sex"], weight=profile["weight_kg"],
                tag_number=next_seed_livestock_tag(self, seller.user),
                ownership_certificate_number="" if is_sold else colc_number,
                ownership_certificate_recorded_by=None if is_sold else (reviewer or user),
                ownership_certificate_recorded_at=None if is_sold else (review_time or aware_at(day, 7)),
                status=LivestockInventory.StatusType.APPROVED,
                operational_status=(LivestockInventory.OperationalStatus.SOLD
                                    if is_sold
                                    else LivestockInventory.OperationalStatus.ACTIVE),
                operational_status_changed_at=(review_time if is_sold else None),
                reviewed_by=reviewer or user, reviewed_at=review_time,
                review_remarks=f"{marker} Synthetic forecast-quality inventory fixture.",
                created_by=seller.user,
            )
            animal._demo_created_at = aware_at(day, 7)
            animal_rows.append(animal)
            species_code = "CAR" if cattle_type.name.casefold() == "carabao" else "CAT"
            identity_marker = marker if species_code == "CAT" else f"{marker}:{species_code}"
            labels = sample_sale_labels(f"{identity_marker}:registered:{serial}", day, species_code)
            # Ownership transfer is recorded and finalized by Auction personnel (user),
            # while the animal's prior registration/COLC was approved by MAO (reviewer).
            transfer = LivestockOwnershipTransfer(
                livestock=animal, previous_owner=seller,
                owner_type=LivestockOwnershipTransfer.OwnerType.EXTERNAL_INDIVIDUAL,
                external_owner_name=labels["external_owner_name"],
                external_owner_address="Padre Garcia, Batangas",
                transfer_certificate_number=labels["transfer_certificate_number"],
                original_certificate_number=colc_number,
                transfer_date=day, municipality="Padre Garcia", province="Batangas",
                animal_description=f"Synthetic {cattle_type.name} transfer; {note}"[:500],
                breed_at_transfer=profile["breed"],
                weight_at_transfer_kg=profile["weight_kg"],
                sex_at_transfer=profile["sex"],
                age_at_transfer=profile["age_at_transfer"],
                purchase_price=per_animal_prices[index],
                status=status, reviewed_by=user if review_time else None,
                reviewed_at=review_time,
                review_remarks=f"{marker} Synthetic fixture; {note}"[:1000],
                created_by=user,
            )
            transfer._demo_created_at = aware_at(day, 8)
            transfer_rows.append(transfer)
        return animal_rows, transfer_rows

    def _external_market_lot_rows(
        self, *, marker, auction_user, reviewer, species, seller_origin, buyer_origin,
        day, heads, certificate_number, rng, include_price=True, profiles=None,
    ):
        """Create one external ownership-transfer row per synthetic market head."""
        rows = []
        review_time = aware_at(day, 17)
        seller_city, seller_province, seller_region = seller_origin
        buyer_city, buyer_province, _ = buyer_origin
        self._demo_market_lot_serial += 1
        owner_type = rng.choice((
            LivestockOwnershipTransfer.OwnerType.EXTERNAL_INDIVIDUAL,
            LivestockOwnershipTransfer.OwnerType.COMPANY,
            LivestockOwnershipTransfer.OwnerType.TRADER,
        ))
        for index in range(heads):
            self._demo_market_animal_serial += 1
            serial = self._demo_market_animal_serial
            profile = profiles[index] if profiles is not None else synthetic_cattle_profile(rng, day) if species["code"] == "CAT" else None
            price = profile["purchase_price"] if profile and include_price else None
            if not profile and include_price and species["price_range"]:
                price = Decimal(rng.randrange(*species["price_range"], 500))
            identity_marker = marker if species["code"] == "CAT" else f"{marker}:{species['code']}"
            labels = sample_sale_labels(f"{identity_marker}:external:{serial}", day, species["code"], owner_type)
            transfer = LivestockOwnershipTransfer(
                livestock=None,
                previous_owner=None,
                external_seller_name=labels["external_seller_name"],
                external_seller_address=f"{seller_city}, {seller_province}",
                external_livestock_type=species["label"],
                external_livestock_tag_number=labels["external_livestock_tag_number"],
                origin_municipality=seller_city,
                origin_province=seller_province,
                owner_type=owner_type,
                new_owner=None,
                external_owner_name=labels["external_owner_name"],
                external_owner_address=f"{buyer_city}, {buyer_province}",
                transfer_certificate_number=labels["transfer_certificate_number"],
                original_certificate_number=labels["original_certificate_number"],
                transfer_date=day,
                municipality="Padre Garcia",
                province="Batangas",
                animal_description=(
                    f"Synthetic {species['label']} head in benchmark-calibrated market lot {certificate_number}."
                ),
                breed_at_transfer=profile["breed"] if profile else "",
                weight_at_transfer_kg=profile["weight_kg"] if profile else None,
                sex_at_transfer=profile["sex"] if profile else "",
                age_at_transfer=profile["age_at_transfer"] if profile else "",
                purchase_price=price,
                status=LivestockOwnershipTransfer.Status.APPROVED,
                created_by=auction_user,
                reviewed_by=auction_user,
                reviewed_at=review_time,
                review_remarks=(
                    f"{marker} Synthetic benchmark-calibrated external-market fixture; one row represents one head."
                ),
            )
            transfer._demo_created_at = aware_at(day, 9)
            rows.append(transfer)
        return rows

    def _dairy_inventory_rows(self, marker, reviewer, seller, cattle_type, farm_index, first_month):
        rows = []
        for animal_index in range(6):
            arrival_day = first_month + timedelta(days=animal_index)
            reviewed_time = aware_at(arrival_day, 17)
            row = LivestockInventory(
                farmer=seller,
                livestock_type=cattle_type,
                entry_type=LivestockInventory.EntryType.INDIVIDUAL,
                quantity=1,
                birth_date=arrival_day - timedelta(days=365 * (3 + animal_index % 4)),
                tag_number=next_seed_livestock_tag(self, seller.user),
                ownership_certificate_number=next_seed_colc_number(self, arrival_day),
                ownership_certificate_recorded_by=reviewer,
                ownership_certificate_recorded_at=reviewed_time,
                breed="Synthetic dairy cross",
                sex="Female",
                weight=Decimal(str(360 + animal_index * 18)),
                status=LivestockInventory.StatusType.APPROVED,
                operational_status=LivestockInventory.OperationalStatus.ACTIVE,
                created_by=seller.user,
                reviewed_by=reviewer,
                reviewed_at=reviewed_time,
                review_remarks=f"{marker} Synthetic dairy herd fixture; not a real animal.",
            )
            row._demo_created_at = aware_at(arrival_day, 7)
            rows.append(row)
        return rows

    def _seed_price_profiles(self, marker, user, sellers, cattle_type, auction_user, *, species_code="CAT", weeks=AUCTION_WEEKS):
        """Small, balanced teaching dataset with realistic weekly volume variation.

        Both sources contain all registration breed choices, both sexes, and
        four age/weight combinations distributed across weeks. Weekly volumes
        naturally fluctuate with seasonal demand and stochastic variation rather
        than a static count, while maintaining complete coverage for rolling
        training windows. The alternating, decaying adjustment is an intentionally
        learnable AR(1) example so the Ridge + ARIMA pipeline can be demonstrated
        without weakening its gates.
        """
        if species_code == "CAR":
            breeds = ("Philippine Carabao (Native)", "Murrah Buffalo", "Bulgarian Murrah", "Crossbred Dairy Carabao")
            combinations = ((24, 350), (36, 450), (36, 550), (84, 700))
        else:
            breeds = ("Brahman", "Holstein-Friesian", "Jersey", "Black Angus", "Simmental",
                      "Philippine Native (Batangas)", "Crossbred Dairy")
            combinations = ((24, 300), (36, 400), (36, 550), (84, 700))
        current_week = timezone.localdate() - timedelta(days=timezone.localdate().weekday())
        first_week = current_week - timedelta(weeks=weeks)
        price_rng = Random(19 if species_code == "CAR" else 9)
        rng = Random(27 if species_code == "CAR" else 17)
        vol_rng = Random(52 if species_code == "CAR" else 42)
        self._demo_animal_serial = 0
        self._demo_market_animal_serial = 0
        self._demo_market_lot_serial = 0
        cattle_market = next(s for s in MARKET_WEEKLY_HEAD_AVERAGES if s["code"] == species_code)

        base_profiles = [
            (breed_index, breed, sex, age, weight)
            for breed_index, breed in enumerate(breeds)
            for sex in ("MALE", "FEMALE")
            for age, weight in combinations
        ]

        count = 0
        for week_index in range(weeks):
            day = first_week + timedelta(weeks=week_index, days=4)
            adjustment = 12_000 * ((-0.97) ** week_index)
            animals, transfers = [], []

            # Seasonal volume curve (annual sine cycle: higher volume in Q4 & early spring, lower mid-year)
            # combined with bounded stochastic weekly noise to avoid unrealistic constant counts.
            seasonal = 1.0 + 0.16 * sin(2 * pi * (week_index - 10) / 52)
            noise_reg = vol_rng.uniform(-0.18, 0.18)
            noise_ext = vol_rng.uniform(-0.18, 0.18)

            reg_factor = max(0.65, min(1.40, seasonal + noise_reg))
            ext_factor = max(0.65, min(1.40, seasonal + noise_ext))

            target_reg = int(round(len(base_profiles) * reg_factor))
            target_ext = int(round(len(base_profiles) * ext_factor))

            sampled_reg = vol_rng.sample(base_profiles, k=min(len(base_profiles), target_reg))
            if target_reg > len(base_profiles):
                sampled_reg += vol_rng.choices(base_profiles, k=target_reg - len(base_profiles))

            sampled_ext = vol_rng.sample(base_profiles, k=min(len(base_profiles), target_ext))
            if target_ext > len(base_profiles):
                sampled_ext += vol_rng.choices(base_profiles, k=target_ext - len(base_profiles))

            for reg_idx, (breed_index, breed, sex, age, weight) in enumerate(sampled_reg):
                price = (10_000 + weight * 40 + age * 60 + breed_index * 700
                         + (1200 if sex == "MALE" else 0) + adjustment + price_rng.uniform(-5, 5))
                profile = {
                    "birth_date": day - timedelta(days=age * 30),
                    "age_at_transfer": f"{age // 12} years {age % 12} months",
                    "breed": breed, "sex": sex, "weight_kg": Decimal(weight),
                    "purchase_price": Decimal(str(price)).quantize(Decimal("0.01")),
                }
                registered_animals, registered = self._sale_row(
                    marker=marker, user=auction_user, reviewer=user,
                    seller=sellers[self._demo_animal_serial % len(sellers)],
                    cattle_type=cattle_type, day=day, heads=1, price=None,
                    price_from_traits=True, profiles=[profile],
                    status=LivestockOwnershipTransfer.Status.APPROVED,
                    review_time=aware_at(day, 17), note=f"constructed {cattle_type.name}-profile teaching data",
                )
                animals.extend(registered_animals)
                transfers.extend(registered)

            for ext_idx, (breed_index, breed, sex, age, weight) in enumerate(sampled_ext):
                price = (10_000 + weight * 40 + age * 60 + breed_index * 700
                         + (1200 if sex == "MALE" else 0) + adjustment + price_rng.uniform(-5, 5))
                profile = {
                    "birth_date": day - timedelta(days=age * 30),
                    "age_at_transfer": f"{age // 12} years {age % 12} months",
                    "breed": breed, "sex": sex, "weight_kg": Decimal(weight),
                    "purchase_price": Decimal(str(price)).quantize(Decimal("0.01")),
                }
                external_profile = {**profile, "purchase_price": profile["purchase_price"] + Decimal("1000")}
                transfers.extend(self._external_market_lot_rows(
                    marker=marker, auction_user=auction_user, reviewer=user,
                    species=cattle_market, seller_origin=SYNTHETIC_MARKET_ORIGINS[0],
                    buyer_origin=SYNTHETIC_MARKET_ORIGINS[1], day=day, heads=1,
                    certificate_number=f"DEMO-PRICE-{species_code}-{week_index:03d}-EXT-{ext_idx:03d}-{breed_index}-{sex}-{age}",
                    rng=rng, profiles=[external_profile],
                ))

            self._create_rows(LivestockInventory, animals)
            self._create_rows(LivestockOwnershipTransfer, transfers)
            self._create_sale_dispositions(marker, transfers)
            count += len(transfers)
        return {"milk": 0, "farmer_meat": 0, "slaughter": 0, "sales": count}

    def _seed_ideal(self, marker, user, sellers, cattle_type, auction_user=None):
        auction_user = auction_user or user
        self._cattle_trait_rng = Random(20261105)
        months = self._months_back(MONTHS)
        meat_rows = []

        for month_index, month in enumerate(months):
            next_month = shift_month(month, 1)
            days = (next_month - month).days
            annual = 1 + 0.07 * sin((month.month - 1) * 2 * pi / 12)
            trend = 1 + month_index * 0.0015
            for farm_index, seller in enumerate(sellers):
                farmer_user = seller.user
                farm_scale = 0.92 + farm_index * 0.08
                meat_days = (10, 24) if month.month in {3, 6, 9, 12} else (17,)
                for event_index, day_number in enumerate(meat_days):
                    event_day = date(month.year, month.month, min(day_number, days))
                    event_variation = ((month_index * 7 + month.month * 5 + event_index * 3 + farm_index * 13) % 21 - 10) * 2.4
                    kg = round(max(55, (155 + 38 * event_index + month_index * 0.7 + event_variation) * annual * farm_scale), 2)
                    meat_rows.append(self._production_row(
                        marker=marker, user=farmer_user, farmer=seller, day=event_day, kind="MEAT", amount=kg,
                        status=ProductionRecord.ProductionStatus.RECORDED,
                        note="farmer-reported event yield in kilograms",
                    ))

        self._create_rows(ProductionRecord, meat_rows)

        # Seed separate, explicitly synthetic cattle and carabao profile histories.
        sales_result = self._seed_price_profiles(marker, user, sellers, cattle_type, auction_user)
        carabao_type, _ = LivestockType.objects.get_or_create(name="Carabao")
        carabao_result = self._seed_price_profiles(
            marker, user, sellers, carabao_type, auction_user, species_code="CAR",
        )
        sales_result["sales"] += carabao_result["sales"]

        return {
            "milk": 0,
            "farmer_meat": len(meat_rows),
            "slaughter": 0,
            "sales": sales_result["sales"],
        }

    def _seed_poor(self, marker, user, sellers, cattle_type, auction_user=None):
        auction_user = auction_user or user
        self._cattle_trait_rng = Random(20261106)
        months = self._months_back(MONTHS)
        observed_indexes = (0, 4, 8, 12, 16, 20, 24, 28, 32, 35)
        meat_rows = []
        for observed_number, month_index in enumerate(observed_indexes):
            seller = sellers[observed_number % len(sellers)]
            farmer_user = seller.user
            month = months[month_index]
            event_day = date(month.year, month.month, 12)
            recorded = ProductionRecord.ProductionStatus.RECORDED
            meat_kg = 2400 if observed_number == 6 else 95 + observed_number * 31
            meat_rows.append(self._production_row(
                marker=marker, user=farmer_user, farmer=seller, day=event_day, kind="MEAT", amount=meat_kg,
                status=recorded,
                note="sparse event history with a suspicious high observation",
            ))

        # Unapproved rows are visible to the workflow diagnostics but excluded
        # from model training, as they should be.
        for pending_index in (2, 6, 10, 14, 18, 22, 26, 30):
            seller = sellers[pending_index % len(sellers)]
            month = months[pending_index]
            pending_day = date(month.year, month.month, 22)
            meat_rows.append(self._production_row(
                marker=marker, user=seller.user, farmer=seller, day=pending_day, kind="MEAT",
                amount=180 + pending_index, status=ProductionRecord.ProductionStatus.PENDING,
                note="pending approval; correctly excluded from approved-only forecast data",
            ))

        self._create_rows(ProductionRecord, meat_rows)

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
                marker=marker, user=auction_user, reviewer=user, seller=sellers[index % len(sellers)], cattle_type=cattle_type,
                day=sale_day, heads=1 + index,
                price=None,
                price_from_traits=index % 3 != 0,
                status=LivestockOwnershipTransfer.Status.APPROVED,
                review_time=reviewed, note="intermittent capture; missing price or approval time is intentional",
            )
            sale_animals.extend(animals)
            sale_rows.extend(transfers)
        for offset in (5, 13, 20):
            sale_day = last_complete_start - timedelta(weeks=offset) + timedelta(days=4)
            animals, transfers = self._sale_row(
                marker=marker, user=auction_user, reviewer=user, seller=sellers[offset % len(sellers)], cattle_type=cattle_type,
                day=sale_day, heads=2, price=None,
                status=LivestockOwnershipTransfer.Status.SUBJECT_TO_REVISION,
                note="returned for revision; excluded from approved completed-sale totals",
            )
            sale_animals.extend(animals)
            sale_rows.extend(transfers)

        # A separate sparse external-market series lets the poor-quality case
        # exercise its own cattle price target, with gaps in price coverage.
        external_rng = Random(20261107)
        self._demo_market_lot_serial = 0
        self._demo_market_animal_serial = 0
        cattle_market = next(species for species in MARKET_WEEKLY_HEAD_AVERAGES if species["code"] == "CAT")
        for index, weeks_ago in enumerate((3, 6, 9, 12, 15, 18, 21, 24)):
            week_start = last_complete_start - timedelta(weeks=weeks_ago)
            seller_origin_index = index % len(SYNTHETIC_MARKET_ORIGINS)
            buyer_origin_index = (seller_origin_index + 1 + index % (len(SYNTHETIC_MARKET_ORIGINS) - 1)) % len(SYNTHETIC_MARKET_ORIGINS)
            sale_day = week_start + timedelta(days=4)
            sale_rows.extend(self._external_market_lot_rows(
                marker=marker,
                auction_user=auction_user,
                reviewer=user,
                species=cattle_market,
                seller_origin=SYNTHETIC_MARKET_ORIGINS[seller_origin_index],
                buyer_origin=SYNTHETIC_MARKET_ORIGINS[buyer_origin_index],
                day=sale_day,
                heads=1 + index % 2,
                certificate_number=f"DEMO-POOR-W{weeks_ago:03d}-CAT",
                rng=external_rng,
                include_price=index % 3 != 0,
            ))
        self._create_rows(LivestockInventory, sale_animals)
        self._create_rows(LivestockOwnershipTransfer, sale_rows)
        self._create_sale_dispositions(marker, sale_rows)
        carabao_type, _ = LivestockType.objects.get_or_create(name="Carabao")
        carabao_result = self._seed_price_profiles(
            marker, user, sellers, carabao_type, auction_user, species_code="CAR", weeks=2,
        )
        return {"milk": 0, "farmer_meat": len(meat_rows),
                "slaughter": 0, "sales": len(sale_rows) + carabao_result["sales"]}

"""Seed synthetic registered-population balance history for the predictive analytics dashboard.

Examples (development PostgreSQL only):
    python manage.py seed_forecast_population_demo --scenario ideal
    python manage.py seed_forecast_population_demo --scenario ideal --clean
    python manage.py seed_forecast_population_demo --scenario poor
    python manage.py seed_forecast_population_demo --scenario poor --clean
"""

from datetime import date, datetime, time, timedelta
from dateutil.relativedelta import relativedelta
from decimal import Decimal

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models import Min, Q
from django.utils import timezone

from analytics.models import SurveillanceDemoOwnership
from analytics.seed_markers import (
    SEED_MARKER_FORECAST_POPULATION_IDEAL,
    SEED_MARKER_FORECAST_POPULATION_POOR,
)
from livestock.models import (
    Farmer,
    LivestockInventory,
    LivestockType,
    PopulationTracking,
    RegisteredPopulationChange,
)
from smartlivestock.seed_safety import assert_safe_seed_database
from smartlivestock.seed_tags import next_seed_livestock_tag
from users.models import User


PREFIX = "forecast-population-v1:"
IDEAL_MONTHS = 36
POOR_MONTHS = 2
SEASONAL_PATTERN = (0, 1, 2, 3, 2, 1, 0, 1, 2, 3, 4, 2)

SPECIES_DEFAULTS = {
    "cattle": ("Brahman Cross", Decimal("320.00")),
    "carabao": ("Philippine Carabao", Decimal("380.00")),
}


def aware_at(day: date, hour: int) -> datetime:
    return timezone.make_aware(datetime.combine(day, time(hour=hour)))


def default_breed_and_weight(species_name: str) -> tuple[str, Decimal]:
    lowered = (species_name or "").lower()
    for key, pair in SPECIES_DEFAULTS.items():
        if key in lowered:
            return pair
    return (f"Synthetic {species_name} Cross", Decimal("180.00"))


def clean_owned_population(*, marker=None, dry_run=False) -> dict[str, int]:
    """Remove only synthetic population-balance animals and their recorded change events."""
    markers = (
        [marker]
        if marker
        else [SEED_MARKER_FORECAST_POPULATION_IDEAL, SEED_MARKER_FORECAST_POPULATION_POOR]
    )
    marker_filter = Q()
    for m in markers:
        marker_filter |= Q(review_remarks__contains=m) | Q(tag_number__startswith=f"{m}-")

    ledger = SurveillanceDemoOwnership.objects.filter(identifier__startswith=PREFIX)
    if marker == SEED_MARKER_FORECAST_POPULATION_IDEAL:
        ledger = ledger.filter(identifier__startswith=f"{PREFIX}ideal:")
    elif marker == SEED_MARKER_FORECAST_POPULATION_POOR:
        ledger = ledger.filter(identifier__startswith=f"{PREFIX}poor:")

    ledger_animal_ids = set(
        ledger.filter(object_type="population_inventory").values_list("object_id", flat=True)
    )
    ledger_event_ids = set(
        ledger.filter(object_type="population_change").values_list("object_id", flat=True)
    )

    animals_qs = LivestockInventory.objects.filter(
        marker_filter | Q(pk__in=ledger_animal_ids)
    )
    animal_ids = set(animals_qs.values_list("pk", flat=True)) | ledger_animal_ids
    events_qs = RegisteredPopulationChange.objects.filter(
        Q(animal_id_reference__in=animal_ids) | Q(pk__in=ledger_event_ids)
    )

    counts = {
        "population_animals": animals_qs.count(),
        "population_changes": events_qs.count(),
    }
    if not dry_run:
        events_qs.delete()
        animals_qs.delete()
        ledger.delete()
        earliest_remaining = RegisteredPopulationChange.objects.aggregate(
            earliest=Min("recorded_at")
        )["earliest"]
        PopulationTracking.objects.update_or_create(
            pk=1,
            defaults={"started_at": earliest_remaining or timezone.now()},
        )
    return counts


class Command(BaseCommand):
    help = (
        "Seed or clean synthetic registered livestock population balance history "
        "(registrations, births, sales, deaths, and other removals) for predictive analytics."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--scenario",
            choices=("ideal", "poor"),
            default="ideal",
            help="Forecast quality scenario to seed (default: ideal).",
        )
        parser.add_argument(
            "--clean",
            action="store_true",
            help="Remove only synthetic population-forecast records owned by this command.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Preview the planned seed or clean operation without modifying the database.",
        )
        parser.add_argument(
            "--farmer-email",
            action="append",
            help="Optional Farmer account email(s) to own synthetic animals.",
        )
        parser.add_argument(
            "--mao-email",
            help="Optional active, approved MAO account email to record as reviewer.",
        )

    def handle(self, *args, **options):
        scenario = options["scenario"]
        clean = options["clean"]
        dry_run = options["dry_run"]
        assert_safe_seed_database(clean=clean, dry_run=dry_run)

        marker = (
            SEED_MARKER_FORECAST_POPULATION_IDEAL
            if scenario == "ideal"
            else SEED_MARKER_FORECAST_POPULATION_POOR
        )

        if clean:
            with transaction.atomic():
                counts = clean_owned_population(dry_run=dry_run)
            self.stdout.write(
                self.style.SUCCESS(
                    f"{'Would remove' if dry_run else 'Removed'} synthetic population-forecast records: {counts}."
                )
            )
            return

        months_count = IDEAL_MONTHS if scenario == "ideal" else POOR_MONTHS
        today = timezone.localdate()
        this_month = today.replace(day=1)
        first_month = this_month - relativedelta(months=months_count)
        months = [first_month + relativedelta(months=i) for i in range(months_count)]
        tracking_started_day = first_month - relativedelta(months=1)

        if dry_run:
            self.stdout.write(
                f"Dry run: would seed '{scenario}' population-forecast scenario covering "
                f"{months_count} completed month(s) ({months[0]:%Y-%m} through {months[-1]:%Y-%m}) "
                f"with tracking_started_at={tracking_started_day.isoformat()}."
            )
            return

        mao_users = User.objects.filter(
            role__role_name="MAO",
            account_status=User.AccountStatus.APPROVED,
            is_active=True,
        )
        mao_user = (
            mao_users.filter(email__iexact=options["mao_email"]).first()
            if options["mao_email"]
            else mao_users.first()
        )
        if not mao_user and not options["mao_email"]:
            mao_user = User.objects.filter(is_superuser=True, is_active=True).first()
        if not mao_user:
            raise CommandError("An active, approved MAO account is required as the synthetic reviewer.")

        sellers = self._select_sellers(options["farmer_email"], scenario)
        species_list = self._select_species()

        with transaction.atomic():
            # Clean any prior population demo scenario first so ideal and poor never mix.
            clean_owned_population(dry_run=False)
            created = self._seed_scenario(
                scenario=scenario,
                marker=marker,
                mao_user=mao_user,
                sellers=sellers,
                species_list=species_list,
                months=months,
                tracking_started_day=tracking_started_day,
            )

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded the '{scenario}' registered livestock population forecast scenario: "
                f"{created['months']} complete month(s), {created['animals']} synthetic inventory animals, "
                f"and {created['events']} population change events "
                f"({created['registrations']} registrations, {created['births']} births, "
                f"{created['sales']} sales, {created['deaths']} deaths, {created['removals']} other removals)."
            )
        )
        self.stdout.write(
            "Clean this population scenario at any time with: "
            f"python manage.py seed_forecast_population_demo --scenario {scenario} --clean"
        )

    def _select_sellers(self, farmer_emails, scenario: str) -> list[Farmer]:
        farmer_qs = Farmer.objects.select_related("user", "barangay").filter(
            user__role__role_name="FARMER",
            barangay__isnull=False,
        )
        if farmer_emails:
            sellers = list(farmer_qs.filter(user__email__in=farmer_emails).order_by("pk"))
            found = {s.user.email.lower() for s in sellers}
            missing = [e for e in farmer_emails if e.lower() not in found]
            if missing:
                raise CommandError(f"No Farmer profile with a barangay exists for: {', '.join(missing)}")
            return sellers

        approved = list(
            farmer_qs.filter(
                user__is_active=True,
                user__account_status=User.AccountStatus.APPROVED,
            ).order_by("barangay__barangay_name", "pk")
        )
        candidates = approved or list(farmer_qs.order_by("barangay__barangay_name", "pk"))
        if not candidates:
            raise CommandError("At least one Farmer profile with an assigned barangay is required.")

        if scenario == "poor":
            return [candidates[0]]

        # Pick one farmer per distinct barangay (up to 6 barangays) for balanced geographic coverage.
        selected = []
        seen_barangays = set()
        for farmer in candidates:
            if farmer.barangay_id not in seen_barangays:
                selected.append(farmer)
                seen_barangays.add(farmer.barangay_id)
                if len(selected) >= 6:
                    break
        return selected or [candidates[0]]

    @staticmethod
    def _select_species() -> list[LivestockType]:
        all_species = list(LivestockType.objects.order_by("pk"))
        cattle = [s for s in all_species if "cattle" in s.name.lower() or "cow" in s.name.lower()]
        carabao = [s for s in all_species if "carabao" in s.name.lower() and s not in cattle]
        selected = cattle + carabao
        if not selected:
            raise CommandError("At least a Cattle or Carabao LivestockType is required.")
        return selected

    def _seed_scenario(
        self,
        *,
        scenario: str,
        marker: str,
        mao_user: User,
        sellers: list[Farmer],
        species_list: list[LivestockType],
        months: list[date],
        tracking_started_day: date,
    ) -> dict[str, int]:
        animal_rows: list[LivestockInventory] = []
        animal_event_specs: list[list[tuple[str, int, datetime]]] = []

        # 1. Seed a small opening base herd prior to months[0] so every participating
        # barangay and species starts with a positive active head count even in an empty DB.
        base_day = tracking_started_day + timedelta(days=5)
        base_time = aware_at(base_day, 9)
        for seller in sellers:
            for species in species_list:
                breed, base_weight = default_breed_and_weight(species.name)
                for offset in range(2):
                    animal = LivestockInventory(
                        farmer=seller,
                        livestock_type=species,
                        entry_type=LivestockInventory.EntryType.INDIVIDUAL,
                        quantity=1,
                        birth_date=base_day - timedelta(days=540 + offset * 90),
                        breed=breed,
                        sex="FEMALE" if offset % 2 == 0 else "MALE",
                        weight=base_weight,
                        tag_number=next_seed_livestock_tag(self, seller.user),
                        status=LivestockInventory.StatusType.APPROVED,
                        operational_status=LivestockInventory.OperationalStatus.ACTIVE,
                        operational_status_changed_at=None,
                        reviewed_by=mao_user,
                        reviewed_at=base_time,
                        review_remarks=f"{marker} Synthetic opening base herd fixture.",
                        created_by=seller.user,
                    )
                    animal._demo_created_at = base_time
                    animal_rows.append(animal)
                    animal_event_specs.append([])

        totals = {"registrations": 0, "births": 0, "sales": 0, "deaths": 0, "removals": 0}

        # 2. Seed monthly additions (registrations, births) and removals (sales, deaths, removals).
        # Every removed animal is selected from the animals added for the same (seller, species, month)
        # so additions >= removals holds for every barangay, species, and month combination.
        for month_index, month_start in enumerate(months):
            cal_idx = month_start.month - 1
            year_idx = month_index // 12
            for spec_idx, species in enumerate(species_list):
                breed, base_weight = default_breed_and_weight(species.name)
                s_boost = SEASONAL_PATTERN[(cal_idx + spec_idx * 2) % 12]
                year_nudge = 1 if (year_idx == 2 and (cal_idx + spec_idx) % 4 == 0) else 0

                if spec_idx == 0:
                    registrations = 6 + s_boost * 2 + year_nudge
                    births = 3 + s_boost
                    sales = 3 + s_boost
                    deaths = 1 if s_boost >= 2 else 0
                    removals = 1 + (1 if s_boost >= 3 else 0)
                else:
                    registrations = 2 + s_boost + year_nudge
                    births = 1 + (s_boost // 2)
                    sales = 1 + (s_boost // 2)
                    deaths = 1 if s_boost == 4 else 0
                    removals = 1 if s_boost >= 2 else 0

                totals["registrations"] += registrations
                totals["births"] += births
                totals["sales"] += sales
                totals["deaths"] += deaths
                totals["removals"] += removals

                addition_kinds = (["registrations"] * registrations) + (["births"] * births)
                removal_kinds = (
                    (["sales"] * sales)
                    + (["deaths"] * deaths)
                    + (["removals"] * removals)
                )
                removal_kinds.extend([None] * (len(addition_kinds) - len(removal_kinds)))

                for item_idx, (add_kind, rem_kind) in enumerate(zip(addition_kinds, removal_kinds)):
                    seller = sellers[(month_index + spec_idx + item_idx) % len(sellers)]
                    add_day = date(month_start.year, month_start.month, 3 + (item_idx % 8))
                    add_time = aware_at(add_day, 9)

                    if rem_kind == "sales":
                        op_status = LivestockInventory.OperationalStatus.SOLD
                    elif rem_kind == "deaths":
                        op_status = LivestockInventory.OperationalStatus.DECEASED
                    elif rem_kind == "removals":
                        op_status = LivestockInventory.OperationalStatus.SLAUGHTERED
                    else:
                        op_status = LivestockInventory.OperationalStatus.ACTIVE

                    rem_day = date(month_start.year, month_start.month, 18 + (item_idx % 8))
                    rem_time = aware_at(rem_day, 16) if rem_kind else None

                    birth_date = (
                        add_day
                        if add_kind == "births"
                        else add_day - timedelta(days=360 + (item_idx % 6) * 60)
                    )
                    animal = LivestockInventory(
                        farmer=seller,
                        livestock_type=species,
                        entry_type=LivestockInventory.EntryType.INDIVIDUAL,
                        quantity=1,
                        birth_date=birth_date,
                        breed=breed,
                        sex="FEMALE" if item_idx % 2 == 0 else "MALE",
                        weight=base_weight + Decimal(str((item_idx % 5) * 4)),
                        tag_number=next_seed_livestock_tag(self, seller.user),
                        status=LivestockInventory.StatusType.APPROVED,
                        operational_status=op_status,
                        operational_status_changed_at=rem_time,
                        reviewed_by=mao_user,
                        reviewed_at=add_time,
                        review_remarks=f"{marker} Synthetic registered population balance fixture.",
                        created_by=seller.user,
                    )
                    animal._demo_created_at = add_time
                    animal_rows.append(animal)

                    events_for_animal = [(add_kind, 1, add_time)]
                    if rem_kind and rem_time:
                        events_for_animal.append((rem_kind, -1, rem_time))
                    animal_event_specs.append(events_for_animal)

        LivestockInventory.objects.bulk_create(animal_rows, batch_size=1000)
        for row in animal_rows:
            row.created_at = row._demo_created_at
        LivestockInventory.objects.bulk_update(animal_rows, ["created_at"], batch_size=500)

        change_rows: list[RegisteredPopulationChange] = []
        for animal, specs in zip(animal_rows, animal_event_specs):
            for kind, delta, recorded_at in specs:
                change_rows.append(
                    RegisteredPopulationChange(
                        animal_id_reference=animal.pk,
                        barangay_id=animal.farmer.barangay_id,
                        livestock_type_id=animal.livestock_type_id,
                        kind=kind,
                        delta=delta,
                        recorded_at=recorded_at,
                    )
                )

        RegisteredPopulationChange.objects.bulk_create(change_rows, batch_size=1000)

        ownership_rows = [
            SurveillanceDemoOwnership(
                identifier=f"{PREFIX}{scenario}:animal:{animal.pk}",
                object_type="population_inventory",
                object_id=animal.pk,
            )
            for animal in animal_rows
        ] + [
            SurveillanceDemoOwnership(
                identifier=f"{PREFIX}{scenario}:event:{event.pk}",
                object_type="population_change",
                object_id=event.pk,
            )
            for event in change_rows
        ]
        SurveillanceDemoOwnership.objects.bulk_create(ownership_rows, batch_size=1000)

        PopulationTracking.objects.update_or_create(
            pk=1,
            defaults={"started_at": aware_at(tracking_started_day, 8)},
        )

        return {
            "months": len(months),
            "animals": len(animal_rows),
            "events": len(change_rows),
            **totals,
        }

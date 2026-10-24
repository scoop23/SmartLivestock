"""Seed an isolated, date-relative disease and mortality dashboard demo."""

import os
import sys
from datetime import timedelta
from types import SimpleNamespace

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import connections, transaction
from django.db.models import Q
from django.utils import timezone

from analytics.models import SurveillanceDemoOwnership
from analytics.services.surveillance import complete_week_windows
from analytics.seed_markers import (
    SEED_MARKER_DISEASE,
    SEED_MARKER_MORTALITY,
    SEED_MARKER_SURVEILLANCE_DEMO,
)
from diseases.models import DiseaseCase, MortalityRecord
from diseases.serializer import DiseaseCaseSerializer, MortalityRecordSerializer
from livestock.models import (
    Barangay,
    Farmer,
    LivestockBatch,
    LivestockInventory,
    LivestockType,
)
from livestock.reconciliation import reconcile_approved_mortality
from smartlivestock.workflows import validate_review_transition
from users.models import Role, User


PREFIX = "surveillance-demo-v1:"
OBJECT_MODELS = {
    "reference_barangay": Barangay,
    "user": User,
    "farmer": Farmer,
    "batch": LivestockBatch,
    "livestock": LivestockInventory,
    "disease": DiseaseCase,
    "mortality": MortalityRecord,
}
SCENARIO_COUNTS = {
    "normal": {"previous": (1, 2), "latest": (4,), "expected": "NORMAL"},
    "watch": {"previous": (1, 2), "latest": (1, 1, 2), "expected": "WATCH"},
    "elevated": {"previous": (1, 2), "latest": (1, 1, 2, 3, 1), "expected": "ELEVATED"},
}


class Command(BaseCommand):
    help = (
        "Create clearly marked disease/mortality surveillance scenarios. "
        "Repeated runs replace only this command's owned demo rows."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--clean",
            action="store_true",
            help="Delete only this command's explicitly owned demo rows, then stop.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show the target weeks and owned-row action without changing data.",
        )

    def handle(self, *args, **options):
        clean = options["clean"]
        dry_run = options["dry_run"]
        self._assert_safe_database(clean=clean, dry_run=dry_run)
        today = timezone.localdate()
        weeks = complete_week_windows(today)

        if dry_run:
            owned = SurveillanceDemoOwnership.objects.filter(identifier__startswith=PREFIX).count()
            action = "would remove" if clean else "would replace and seed"
            self.stdout.write(
                f"Dry run: {action} {owned} explicitly owned objects. "
                f"Comparison weeks: {weeks['previous_start']}–{weeks['previous_end']} and "
                f"{weeks['latest_start']}–{weeks['latest_end']}."
            )
            self.stdout.write("No database changes were made.")
            return

        with transaction.atomic():
            self._clean_owned_objects()
            if clean:
                return
            plan = self._build_plan(today, weeks)
            self._seed(plan, today, weeks)

    def _assert_safe_database(self, *, clean, dry_run):
        connection = connections["default"]
        database_name = str(connection.settings_dict.get("NAME") or "")
        in_test_run = "test" in sys.argv or (
            connection.vendor == "sqlite" and "memory" in database_name.lower()
        )
        target_env = os.environ.get("SMARTLIVESTOCK_DEMO_ENV", "").lower()
        is_render = any(
            os.environ.get(key)
            for key in ("RENDER", "RENDER_SERVICE_ID", "RENDER_EXTERNAL_HOSTNAME")
        )

        if target_env == "production":
            raise CommandError("Refusing to run the surveillance demo seed against production.")
        if is_render and target_env != "staging":
            raise CommandError(
                "Refusing to seed an unidentified Render service. Identify a confirmed staging "
                "database with SMARTLIVESTOCK_DEMO_ENV=staging and its exact database acknowledgement."
            )
        if not settings.DEBUG and target_env != "staging" and not in_test_run:
            raise CommandError(
                "Refusing to seed with DEBUG disabled unless this database is explicitly identified as staging."
            )
        if target_env == "development" and connection.vendor == "postgresql":
            host = str(connection.settings_dict.get("HOST") or "").lower()
            if host not in {"localhost", "127.0.0.1", "::1"}:
                raise CommandError(
                    "Development seeding requires local PostgreSQL. No database changes were made."
                )

        is_test_memory_database = (
            connection.vendor == "sqlite" and "memory" in database_name.lower()
        )
        if not is_test_memory_database and not in_test_run:
            expected_ack = f"{target_env}:{database_name}"
            if (
                target_env not in {"development", "staging"}
                or os.environ.get("SMARTLIVESTOCK_DEMO_DATABASE_ACK") != expected_ack
            ):
                raise CommandError(
                    "This database needs explicit environment identification: set "
                    "SMARTLIVESTOCK_DEMO_ENV=development|staging and "
                    "SMARTLIVESTOCK_DEMO_DATABASE_ACK=<environment>:<database-name>. "
                    "No database changes were made."
                )
        if clean and not dry_run and not in_test_run:
            if os.environ.get("SMARTLIVESTOCK_DEMO_ALLOW_CLEANUP") != "YES":
                raise CommandError(
                    "--clean requires SMARTLIVESTOCK_DEMO_ALLOW_CLEANUP=YES after confirming "
                    "this is a development or staging database."
                )

    def _build_plan(self, today, weeks):
        farmer_role = Role.objects.filter(role_name=Role.UserRoles.FARMER).first()
        if farmer_role is None:
            raise CommandError("The FARMER role must exist before seeding surveillance scenarios.")
        reviewer = User.objects.filter(
            role__role_name__in=(Role.UserRoles.MAO, "ADMIN"), is_active=True
        ).order_by("pk").first()
        if reviewer is None:
            reviewer = User.objects.filter(is_superuser=True, is_active=True).order_by("pk").first()
        if reviewer is None:
            raise CommandError("An active MAO, ADMIN, or superuser account is required for valid demo approvals.")
        livestock_type = LivestockType.objects.filter(name__iexact="Cattle").first()
        if livestock_type is None:
            livestock_type = LivestockType.objects.order_by("pk").first()
        if livestock_type is None:
            raise CommandError("At least one existing livestock type is required; the command will not invent lookup data.")

        week_range = (weeks["previous_start"], weeks["latest_end"])
        candidates = []
        for barangay in Barangay.objects.order_by("pk"):
            existing = DiseaseCase.objects.filter(
                status=DiseaseCase.DiseaseStatus.APPROVED,
                record_date__range=week_range,
            ).filter(
                Q(livestock__farmer__barangay=barangay)
                | Q(batch__farmer__barangay=barangay)
            ).filter(
                Q(review_remarks__isnull=True)
                | ~Q(review_remarks__contains=SEED_MARKER_DISEASE)
            ).filter(
                Q(review_remarks__isnull=True)
                | ~Q(review_remarks__contains=SEED_MARKER_SURVEILLANCE_DEMO)
            )
            if not existing.exists():
                candidates.append(barangay)
            if len(candidates) == 4:
                break
        if len(candidates) < 4:
            raise CommandError(
                "The seed needs four distinct existing barangays with no approved disease reports "
                "in either comparison week, so each scoped scenario remains isolated. No new "
                "barangays or real-farmer reports will be created."
            )
        return {
            "farmer_role": farmer_role,
            "reviewer": reviewer,
            "livestock_type": livestock_type,
            "barangays": dict(zip(("normal", "watch", "elevated", "insufficient"), candidates)),
        }

    def _seed(self, plan, today, weeks):
        for scenario, barangay in plan["barangays"].items():
            self._track(f"{scenario}:barangay", "reference_barangay", barangay)
        for scenario, counts in SCENARIO_COUNTS.items():
            farmer_user, farmer, batch = self._create_scenario_farm(
                scenario, plan["barangays"][scenario], plan
            )
            animals = list(batch.animals.order_by("pk"))
            for period, start_key in (("previous", "previous_start"), ("latest", "latest_start")):
                for index, affected_count in enumerate(counts[period]):
                    self._create_approved_disease(
                        scenario=scenario,
                        farmer_user=farmer_user,
                        batch=batch,
                        affected_count=affected_count,
                        record_date=weeks[start_key] + timedelta(days=index),
                        reviewer=plan["reviewer"],
                    )

        self._create_association_demo(plan, today, weeks)
        self.stdout.write(self.style.SUCCESS("Disease and mortality surveillance demo is ready."))
        for scenario, counts in SCENARIO_COUNTS.items():
            barangay = plan["barangays"][scenario]
            previous = len(counts["previous"])
            latest = len(counts["latest"])
            previous_heads = sum(counts["previous"])
            latest_heads = sum(counts["latest"])
            self.stdout.write(
                f"{scenario.title()} ({barangay.barangay_name}): {previous} reports/{previous_heads} "
                f"affected heads -> {latest} reports/{latest_heads} affected heads; expected {counts['expected']}."
            )
        self.stdout.write(
            f"Insufficient data ({plan['barangays']['insufficient'].barangay_name}): "
            "no disease records in the two comparison weeks; this does not prove zero incidence."
        )
        self.stdout.write(
            "To see each alert independently, use a SIBAT/CBAT account scoped to that scenario's "
            "barangay. A municipality-wide MAO/Admin view aggregates the scenarios."
        )

    def _create_scenario_farm(self, scenario, barangay, plan):
        suffix = scenario.replace("_", "-")
        user = User.objects.create_user(
            username=f"demo-surveillance-{suffix}",
            email=f"demo-surveillance-{suffix}@example.invalid",
            password=None,
            role=plan["farmer_role"],
            first_name="Surveillance Demo",
            last_name=scenario.title(),
            account_status=User.AccountStatus.PENDING,
            is_active=False,
        )
        self._track(f"{scenario}:user", "user", user)
        farmer = Farmer.objects.create(
            user=user,
            barangay=barangay,
            address=f"DEMO ONLY - synthetic {scenario} surveillance scenario",
        )
        self._track(f"{scenario}:farmer", "farmer", farmer)

        animal_counts = {"normal": 4, "watch": 2, "elevated": 3, "association": 2}[scenario]
        batch = LivestockBatch.objects.create(
            farmer=farmer,
            livestock_type=plan["livestock_type"],
            batch_name=f"DEMO ONLY - surveillance {scenario} herd",
            batch_code=f"SURV-DEMO-{scenario.upper()}-V1",
            status=LivestockBatch.StatusType.ACTIVE,
            notes=f"{SEED_MARKER_SURVEILLANCE_DEMO} Synthetic dashboard fixture; not real livestock.",
            created_by=user,
        )
        self._track(f"{scenario}:batch", "batch", batch)
        for index in range(animal_counts):
            animal = LivestockInventory(
                farmer=farmer,
                livestock_type=plan["livestock_type"],
                batch=batch,
                entry_type=LivestockInventory.EntryType.INDIVIDUAL,
                quantity=1,
                tag_number=f"SURV-DEMO-{scenario.upper()}-{index + 1:02d}",
                breed="Demonstration crossbred",
                sex="Female",
                status=LivestockInventory.StatusType.APPROVED,
                operational_status=LivestockInventory.OperationalStatus.ACTIVE,
                created_by=user,
                reviewed_by=plan["reviewer"],
                reviewed_at=timezone.now(),
                review_remarks=(
                    f"{SEED_MARKER_SURVEILLANCE_DEMO} Synthetic demo inventory; "
                    "not a real farmer or animal record."
                ),
            )
            animal.full_clean()
            animal.save()
            self._track(f"{scenario}:livestock:{index + 1}", "livestock", animal)
        return user, farmer, batch

    def _create_approved_disease(
        self, *, scenario, farmer_user, batch, affected_count, record_date, reviewer,
        animal=None, owner_key=None,
    ):
        request = SimpleNamespace(user=farmer_user)
        target = {"livestock": animal.pk} if animal else {"batch": batch.pk}
        serializer = DiseaseCaseSerializer(
            data={
                **target,
                "name": f"DEMO ONLY: reported respiratory signs ({scenario})",
                "affected_count": affected_count,
                "record_date": record_date,
            },
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        case = serializer.save()
        self._track(
            owner_key or f"{scenario}:disease:{record_date.isoformat()}:{case.pk}",
            "disease",
            case,
        )

        verify_remark = f"{SEED_MARKER_SURVEILLANCE_DEMO} Synthetic field verification."
        validate_review_transition(
            domain="disease", role="SIBAT", current=case.status,
            target=DiseaseCase.DiseaseStatus.VERIFIED, remarks=verify_remark,
        )
        validate_review_transition(
            domain="disease", role="MAO", current=DiseaseCase.DiseaseStatus.VERIFIED,
            target=DiseaseCase.DiseaseStatus.APPROVED,
        )
        case.status = DiseaseCase.DiseaseStatus.APPROVED
        case.reviewed_by = reviewer
        case.reviewed_at = timezone.now()
        case.review_remarks = f"{SEED_MARKER_SURVEILLANCE_DEMO} Synthetic approved demo record; not a confirmed case."
        case.save(update_fields=["status", "reviewed_by", "reviewed_at", "review_remarks"])
        return case

    def _create_approved_mortality(self, *, animal, farmer_user, reviewer, record_date, label):
        serializer = MortalityRecordSerializer(
            data={
                "livestocks": [animal.pk],
                "death_count": 1,
                "cause": "DEMO ONLY: reported sudden illness; cause not confirmed.",
                "record_date": record_date,
            },
            context={"request": SimpleNamespace(user=farmer_user)},
        )
        serializer.is_valid(raise_exception=True)
        record = serializer.save()
        self._track(f"association:mortality:{label}:{record.pk}", "mortality", record)

        verify_remark = f"{SEED_MARKER_SURVEILLANCE_DEMO} Synthetic field verification."
        validate_review_transition(
            domain="mortality", role="SIBAT", current=record.status,
            target=MortalityRecord.MortalityRecordStatus.VERIFIED, remarks=verify_remark,
        )
        validate_review_transition(
            domain="mortality", role="MAO", current=MortalityRecord.MortalityRecordStatus.VERIFIED,
            target=MortalityRecord.MortalityRecordStatus.APPROVED,
        )
        record.status = MortalityRecord.MortalityRecordStatus.APPROVED
        record.reviewed_by = reviewer
        record.reviewed_at = timezone.now()
        record.review_remarks = f"{SEED_MARKER_SURVEILLANCE_DEMO} Synthetic demo association; not a causal finding."
        record.save(update_fields=["status", "reviewed_by", "reviewed_at", "review_remarks"])
        reconcile_approved_mortality(record)
        return record

    def _create_association_demo(self, plan, today, weeks):
        # These additional synthetic references stay in the Normal barangay but
        # have disease dates outside the two alert-comparison weeks.
        barangay = plan["barangays"]["normal"]
        farmer_user, farmer, herd = self._create_scenario_farm("association", barangay, plan)
        # Association-only herd has two animals; standalone animals provide a
        # same-barangay pair without an individual or herd relationship.
        herd_animals = list(herd.animals.order_by("pk"))
        # _create_scenario_farm's normal size is four; two are sufficient here.
        standalone = []
        for index in range(3):
            animal = LivestockInventory(
                farmer=farmer,
                livestock_type=plan["livestock_type"],
                entry_type=LivestockInventory.EntryType.INDIVIDUAL,
                quantity=1,
                tag_number=f"SURV-DEMO-ASSOCIATION-STANDALONE-{index + 1:02d}",
                breed="Demonstration crossbred",
                sex="Female",
                status=LivestockInventory.StatusType.APPROVED,
                operational_status=LivestockInventory.OperationalStatus.ACTIVE,
                created_by=farmer_user,
                reviewed_by=plan["reviewer"],
                reviewed_at=timezone.now(),
                review_remarks=f"{SEED_MARKER_SURVEILLANCE_DEMO} Synthetic association fixture.",
            )
            animal.full_clean()
            animal.save()
            self._track(f"association:standalone:{index + 1}", "livestock", animal)
            standalone.append(animal)

        latest_start = weeks["latest_start"]
        mortality_date = latest_start - timedelta(days=15)
        self._create_approved_disease(
            scenario="association-same-animal",
            farmer_user=farmer_user,
            batch=herd,
            affected_count=1,
            record_date=mortality_date - timedelta(days=2),
            reviewer=plan["reviewer"],
            animal=standalone[0],
            owner_key="association:disease:same-animal",
        )
        self._create_approved_disease(
            scenario="association-same-herd",
            farmer_user=farmer_user,
            batch=herd,
            affected_count=1,
            record_date=mortality_date - timedelta(days=30),
            reviewer=plan["reviewer"],
            owner_key="association:disease:same-herd",
        )

        # This is a valid event pair by current barangay only; records retain no
        # explicit disease or herd link to each other.
        barangay_case = self._create_approved_disease(
            scenario="association-same-barangay",
            farmer_user=farmer_user,
            batch=herd,
            affected_count=1,
            record_date=mortality_date - timedelta(days=7),
            reviewer=plan["reviewer"],
            animal=standalone[1],
            owner_key="association:disease:same-barangay",
        )
        self._create_approved_mortality(
            animal=standalone[0], farmer_user=farmer_user, reviewer=plan["reviewer"],
            record_date=mortality_date, label="same-animal",
        )
        self._create_approved_mortality(
            animal=herd_animals[0], farmer_user=farmer_user, reviewer=plan["reviewer"],
            record_date=mortality_date, label="same-herd",
        )
        self._create_approved_mortality(
            animal=standalone[2], farmer_user=farmer_user, reviewer=plan["reviewer"],
            record_date=mortality_date, label="same-barangay",
        )

    def _track(self, identifier, object_type, obj):
        marker, created = SurveillanceDemoOwnership.objects.get_or_create(
            identifier=f"{PREFIX}{identifier}",
            defaults={"object_type": object_type, "object_id": obj.pk},
        )
        if not created and (marker.object_type != object_type or marker.object_id != obj.pk):
            raise CommandError(f"Ownership marker conflict for {identifier}; refusing to claim another row.")

    def _clean_owned_objects(self):
        markers = list(
            SurveillanceDemoOwnership.objects.filter(identifier__startswith=PREFIX).order_by("identifier")
        )
        owned_ids = {}
        owned_objects = []
        for marker in markers:
            model = OBJECT_MODELS.get(marker.object_type)
            if model is None:
                raise CommandError(f"Unknown owned object type {marker.object_type!r}; refusing cleanup.")
            try:
                obj = model.objects.get(pk=marker.object_id)
            except model.DoesNotExist as exc:
                raise CommandError(
                    f"Ownership marker {marker.identifier} points to a missing {model.__name__} "
                    f"#{marker.object_id}; refusing cleanup."
                ) from exc
            if marker.object_type == "reference_barangay":
                continue
            owned_ids.setdefault(model, set()).add(obj.pk)
            owned_objects.append((marker, obj))

        for marker, obj in owned_objects:
            for relation in obj._meta.related_objects:
                if relation.related_model is SurveillanceDemoOwnership:
                    continue
                manager = getattr(obj, relation.get_accessor_name(), None)
                if manager is None:
                    continue
                if hasattr(manager, "all"):
                    related_ids = manager.all().values_list("pk", flat=True).iterator()
                else:
                    related_ids = (manager.pk,)
                for related_id in related_ids:
                    if related_id not in owned_ids.get(relation.related_model, set()):
                        raise CommandError(
                            f"Cannot clean {marker.identifier}: {relation.related_model.__name__} "
                            f"#{related_id} is related but is not owned by this seed. No rows were deleted."
                        )

        delete_order = ("mortality", "disease", "livestock", "batch", "farmer", "user")
        for object_type in delete_order:
            model = OBJECT_MODELS[object_type]
            object_ids = owned_ids.get(model, set())
            if object_ids:
                model.objects.filter(pk__in=object_ids).delete()
        SurveillanceDemoOwnership.objects.filter(identifier__startswith=PREFIX).delete()
        if markers:
            self.stdout.write(f"Removed {len(markers)} explicitly owned surveillance-demo objects.")

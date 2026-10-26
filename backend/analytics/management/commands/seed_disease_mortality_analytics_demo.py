"""Seed 12 complete months of approved synthetic disease and mortality data."""

import os
import sys
from calendar import monthrange
from datetime import date
from types import SimpleNamespace

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import connections, transaction
from django.utils import timezone

from analytics.models import SurveillanceDemoOwnership
from analytics.seed_markers import SEED_MARKER_DISEASE, SEED_MARKER_MORTALITY
from diseases.models import DiseaseCase, MortalityRecord
from diseases.serializer import DiseaseCaseSerializer, MortalityRecordSerializer
from livestock.models import Barangay, Farmer, LivestockInventory, LivestockType
from livestock.reconciliation import reconcile_approved_mortality
from smartlivestock.workflows import validate_review_transition
from users.models import Role, User


PREFIX = "disease-mortality-analytics-v1:"
OBJECT_MODELS = {
    "user": User,
    "farmer": Farmer,
    "livestock": LivestockInventory,
    "disease": DiseaseCase,
    "mortality": MortalityRecord,
}
MONTHS = 12
DISEASE_CASES_PER_MONTH = (1, 2, 1, 3, 2, 1, 2, 3, 1, 2, 3, 2)
MORTALITY_RECORDS_PER_MONTH = (1, 2, 1, 2, 3, 1, 2, 1, 3, 2, 1, 2)


class Command(BaseCommand):
    help = (
        "Create 12 complete months of clearly marked, approved synthetic disease and mortality records "
        "for two inactive demo farmer accounts."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--clean",
            action="store_true",
            help="Delete only rows tracked as owned by this demo seed, then stop.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show the planned month range and owned-row action without changing data.",
        )

    def handle(self, *args, **options):
        clean = options["clean"]
        dry_run = options["dry_run"]
        self._assert_safe_database(clean=clean, dry_run=dry_run)
        months = self._completed_months(timezone.localdate())

        if dry_run:
            count = SurveillanceDemoOwnership.objects.filter(identifier__startswith=PREFIX).count()
            action = "would remove" if clean else "would replace and seed"
            self.stdout.write(
                f"Dry run: {action} {count} explicitly owned objects. "
                f"Monthly event range: {months[0].isoformat()} to {months[-1].isoformat()} "
                f"({MONTHS} complete calendar months)."
            )
            self.stdout.write("No database changes were made.")
            return

        with transaction.atomic():
            self._clean_owned_objects()
            if clean:
                return
            plan = self._build_plan()
            self._seed(plan, months)

    @staticmethod
    def _completed_months(today):
        """Return month-end event dates for the 12 most recently completed months."""
        month_index = today.year * 12 + today.month - 1
        dates = []
        for offset in range(MONTHS, 0, -1):
            year, zero_month = divmod(month_index - offset, 12)
            month = zero_month + 1
            dates.append(date(year, month, monthrange(year, month)[1]))
        return dates

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
            raise CommandError("Refusing to run this synthetic analytics seed against production.")
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

    @staticmethod
    def _exactly_one(queryset, label):
        count = queryset.count()
        if count != 1:
            raise CommandError(f"Expected exactly one existing {label}; found {count}. No shared lookup data was created.")
        return queryset.get()

    def _build_plan(self):
        barangay = self._exactly_one(
            Barangay.objects.filter(barangay_name__iexact="Tangob"), "Tangob barangay"
        )
        cattle = self._exactly_one(
            LivestockType.objects.filter(name__iexact="Cattle"), "Cattle livestock type"
        )
        roles = {
            role_name: self._exactly_one(Role.objects.filter(role_name=role_name), f"{role_name} role")
            for role_name in (Role.UserRoles.FARMER, Role.UserRoles.SIBAT, Role.UserRoles.MAO)
        }
        reviewer = User.objects.filter(
            role__role_name__in=(Role.UserRoles.MAO, "ADMIN"),
            account_status=User.AccountStatus.APPROVED,
            is_active=True,
        ).order_by("pk").first()
        if reviewer is None:
            reviewer = User.objects.filter(is_superuser=True, is_active=True).order_by("pk").first()
        if reviewer is None:
            raise CommandError("An active approved MAO/Admin reviewer is required to approve the demo records.")
        return {"barangay": barangay, "cattle": cattle, "roles": roles, "reviewer": reviewer}

    def _seed(self, plan, months):
        now = timezone.now()
        farmers = []
        for suffix in ("a", "b"):
            user = self._create_demo_user(
                key=f"farmer-{suffix}",
                email=f"demo.analytics.farmer.{suffix}@smartlivestock-demo.invalid",
                username=f"demo-analytics-farmer-{suffix}",
                role=plan["roles"][Role.UserRoles.FARMER],
            )
            farmer = Farmer.objects.create(
                user=user,
                barangay=plan["barangay"],
                address=f"DEMO ONLY - synthetic analytics farm {suffix.upper()} in Tangob",
            )
            self._track(f"farmer-{suffix}:profile", "farmer", farmer)
            farmers.append({"user": user, "farmer": farmer, "mortality_animals": []})

        verifier = self._create_demo_user(
            key="sibat-verifier",
            email="demo.analytics.sibat@smartlivestock-demo.invalid",
            username="demo-analytics-sibat-verifier",
            role=plan["roles"][Role.UserRoles.SIBAT],
            assigned_barangay=plan["barangay"],
            last_name="SIBAT Verifier",
        )

        disease_count = 0
        mortality_count = 0
        for month_index, month_end in enumerate(months):
            for event_index in range(DISEASE_CASES_PER_MONTH[month_index]):
                owner_index = (month_index + event_index) % len(farmers)
                owner = farmers[owner_index]
                disease_count += 1
                disease_animal = self._create_demo_animal(
                    key=f"farmer-{chr(97 + owner_index)}:disease-animal:{month_end:%Y-%m}:{event_index + 1}",
                    owner=owner,
                    livestock_type=plan["cattle"],
                    reviewer=plan["reviewer"],
                    tag=f"DM-ANALYTICS-D-{month_end:%Y%m}-{event_index + 1}",
                )
                self._create_approved_disease(
                    key=f"disease:{month_end:%Y-%m}:{event_index + 1}",
                    farmer_user=owner["user"],
                    animal=disease_animal,
                    record_date=month_end,
                    verifier=verifier,
                    reviewer=plan["reviewer"],
                )

            for event_index in range(MORTALITY_RECORDS_PER_MONTH[month_index]):
                owner_index = (month_index + event_index) % len(farmers)
                owner = farmers[owner_index]
                mortality_count += 1
                mortality_animal = self._create_demo_animal(
                    key=f"farmer-{chr(97 + owner_index)}:mortality-animal:{month_end:%Y-%m}:{event_index + 1}",
                    owner=owner,
                    livestock_type=plan["cattle"],
                    reviewer=plan["reviewer"],
                    tag=f"DM-ANALYTICS-M-{month_end:%Y%m}-{event_index + 1}",
                )
                owner["mortality_animals"].append(mortality_animal)
                self._create_approved_mortality(
                    key=f"mortality:{month_end:%Y-%m}:{event_index + 1}",
                    farmer_user=owner["user"],
                    animal=mortality_animal,
                    record_date=month_end,
                    verifier=verifier,
                    reviewer=plan["reviewer"],
                )

        self.stdout.write(self.style.SUCCESS("Disease and mortality monthly analytics demo is ready."))
        self.stdout.write(
            f"Created 2 inactive demo farmers in {plan['barangay'].barangay_name}; "
            f"{disease_count} approved disease cases and {mortality_count} approved mortality records from "
            f"{months[0]:%b %Y} through {months[-1]:%b %Y}."
        )
        self.stdout.write(
            "Each report passed the PENDING -> VERIFIED -> APPROVED transition checks. "
            f"Mortality approvals reconciled {mortality_count} uniquely identified demo animals as deceased."
        )
        self.stdout.write(
            "All records are synthetic and explicitly marked; disease labels are not diagnoses. "
            "They are intended for analytics display, not real-world surveillance evidence."
        )
        self.stdout.write("Forecast backtests may remain limited because all reports are created and reviewed now.")

    def _create_demo_user(self, *, key, email, username, role, assigned_barangay=None, last_name="Farmer"):
        if User.objects.filter(email__iexact=email).exists() or User.objects.filter(username=username).exists():
            raise CommandError(
                f"Demo identity {email} or username {username} already exists without this seed's ownership; refusing to reuse it."
            )
        user = User.objects.create_user(
            username=username,
            email=email,
            password=None,
            role=role,
            first_name="Demo Analytics",
            last_name=last_name,
            account_status=User.AccountStatus.PENDING,
            is_active=False,
            assigned_barangay=assigned_barangay,
        )
        self._track(key, "user", user)
        return user

    def _create_demo_animal(self, *, key, owner, livestock_type, reviewer, tag):
        animal = LivestockInventory(
            farmer=owner["farmer"],
            livestock_type=livestock_type,
            entry_type=LivestockInventory.EntryType.INDIVIDUAL,
            quantity=1,
            tag_number=tag,
            breed="Synthetic demo cattle",
            sex="Female",
            status=LivestockInventory.StatusType.APPROVED,
            operational_status=LivestockInventory.OperationalStatus.ACTIVE,
            created_by=owner["user"],
            reviewed_by=reviewer,
            reviewed_at=timezone.now(),
            review_remarks=f"{SEED_MARKER_DISEASE} Synthetic demo inventory only; not a real animal.",
        )
        animal.full_clean()
        animal.save()
        self._track(key, "livestock", animal)
        return animal

    def _create_approved_disease(self, *, key, farmer_user, animal, record_date, verifier, reviewer):
        serializer = DiseaseCaseSerializer(
            data={
                "livestock": animal.pk,
                "name": "DEMO synthetic cattle illness observation (not a diagnosis)",
                "affected_count": 1,
                "record_date": record_date,
            },
            context={"request": SimpleNamespace(user=farmer_user)},
        )
        serializer.is_valid(raise_exception=True)
        case = serializer.save()
        self._track(key, "disease", case)
        self._approve_with_verification(
            domain="disease",
            record=case,
            verified_status=DiseaseCase.DiseaseStatus.VERIFIED,
            approved_status=DiseaseCase.DiseaseStatus.APPROVED,
            verifier=verifier,
            reviewer=reviewer,
            marker=SEED_MARKER_DISEASE,
            label="synthetic disease observation; not a confirmed or diagnosed case",
        )

    def _create_approved_mortality(self, *, key, farmer_user, animal, record_date, verifier, reviewer):
        serializer = MortalityRecordSerializer(
            data={
                "livestocks": [animal.pk],
                "death_count": 1,
                "cause": "DEMO synthetic mortality event (cause not established)",
                "record_date": record_date,
            },
            context={"request": SimpleNamespace(user=farmer_user)},
        )
        serializer.is_valid(raise_exception=True)
        record = serializer.save()
        self._track(key, "mortality", record)
        self._approve_with_verification(
            domain="mortality",
            record=record,
            verified_status=MortalityRecord.MortalityRecordStatus.VERIFIED,
            approved_status=MortalityRecord.MortalityRecordStatus.APPROVED,
            verifier=verifier,
            reviewer=reviewer,
            marker=SEED_MARKER_MORTALITY,
            label="synthetic mortality event; cause not established",
        )
        reconcile_approved_mortality(record)

    @staticmethod
    def _approve_with_verification(
        *, domain, record, verified_status, approved_status, verifier, reviewer, marker, label,
    ):
        verify_time = timezone.now()
        verify_remark = f"{marker} Synthetic SIBAT verification for analytics demo; not a field inspection."
        validate_review_transition(
            domain=domain,
            role=Role.UserRoles.SIBAT,
            current=record.status,
            target=verified_status,
            remarks=verify_remark,
        )
        record.status = verified_status
        record.reviewed_by = verifier
        record.reviewed_at = verify_time
        record.review_remarks = verify_remark
        record.inspection_details = {
            "verifiedBy": verifier.get_full_name().strip() or verifier.username,
            "verifiedAt": verify_time.isoformat(),
            "remarks": verify_remark,
            "verificationMode": "SYNTHETIC_DEMO",
        }
        record.save(update_fields=["status", "reviewed_by", "reviewed_at", "review_remarks", "inspection_details"])

        approve_time = timezone.now()
        approve_remark = f"{marker} Synthetic MAO-approved analytics demo; {label}."
        validate_review_transition(
            domain=domain,
            role=Role.UserRoles.MAO,
            current=record.status,
            target=approved_status,
            remarks=approve_remark,
        )
        details = dict(record.inspection_details or {})
        details.update({
            "maoRemarks": approve_remark,
            "maoReviewedBy": reviewer.get_full_name().strip() or reviewer.username,
            "maoReviewedAt": approve_time.isoformat(),
        })
        record.status = approved_status
        record.reviewed_by = reviewer
        record.reviewed_at = approve_time
        record.review_remarks = approve_remark
        record.inspection_details = details
        record.save(update_fields=["status", "reviewed_by", "reviewed_at", "review_remarks", "inspection_details"])

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
            owned_ids.setdefault(model, set()).add(obj.pk)
            owned_objects.append((marker, obj))

        for marker, obj in owned_objects:
            for relation in obj._meta.related_objects:
                if relation.related_model is SurveillanceDemoOwnership:
                    continue
                manager = getattr(obj, relation.get_accessor_name(), None)
                if manager is None:
                    continue
                related_ids = (
                    manager.all().values_list("pk", flat=True).iterator()
                    if hasattr(manager, "all")
                    else (manager.pk,)
                )
                for related_id in related_ids:
                    if related_id not in owned_ids.get(relation.related_model, set()):
                        raise CommandError(
                            f"Cannot clean {marker.identifier}: {relation.related_model.__name__} "
                            f"#{related_id} is related but is not owned by this seed. No rows were deleted."
                        )

        for object_type in ("mortality", "disease", "livestock", "farmer", "user"):
            model = OBJECT_MODELS[object_type]
            ids = owned_ids.get(model, set())
            if ids:
                model.objects.filter(pk__in=ids).delete()
        SurveillanceDemoOwnership.objects.filter(identifier__startswith=PREFIX).delete()
        if markers:
            self.stdout.write(f"Removed {len(markers)} explicitly owned disease/mortality analytics demo objects.")

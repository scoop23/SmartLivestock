"""Seed irregular synthetic disease and mortality events with monthly coverage."""

from calendar import monthrange
from datetime import date
from types import SimpleNamespace

from django.core.management.base import BaseCommand, CommandError
from django.db.models import Q
from django.db import transaction
from django.utils import timezone

from analytics.models import SurveillanceCoverageReport, SurveillanceDemoOwnership
from analytics.seed_markers import SEED_MARKER_DISEASE, SEED_MARKER_MORTALITY
from diseases.models import DiseaseCase, MortalityRecord
from diseases.serializer import DiseaseCaseSerializer, MortalityRecordSerializer
from livestock.models import Barangay, Farmer, LivestockInventory, LivestockType
from livestock.reconciliation import reconcile_approved_mortality
from smartlivestock.seed_safety import assert_safe_seed_database
from smartlivestock.workflows import validate_review_transition
from users.models import Notification, Role, User


PREFIX = "disease-mortality-analytics-v1:"
OBJECT_MODELS = {
    "user": User,
    "farmer": Farmer,
    "livestock": LivestockInventory,
    "disease": DiseaseCase,
    "mortality": MortalityRecord,
    "coverage": SurveillanceCoverageReport,
    "notification": Notification,
}
MONTHS = 24
DISEASE_CASES_PER_MONTH = (1, 2, 0, 1, 2, 0, 3, 1, 0, 1, 2, 0, 2, 1, 0, 3, 1, 0, 2, 1, 0, 2, 1, 0)
MORTALITY_RECORDS_PER_MONTH = (0, 1, 0, 0, 1, 0, 2, 0, 1, 0, 0, 1, 0, 1, 0, 2, 0, 1, 0, 1, 0, 1, 0, 0)


class Command(BaseCommand):
    help = (
        "Create 24 months of irregular, clearly marked synthetic disease and mortality events "
        "across every existing barangay, with two inactive demo farmers per barangay."
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
        parser.add_argument("--cbat-email", help="Use this active, approved CBAT account for field verification.")
        parser.add_argument("--mao-email", help="Use this active, approved MAO account for review.")
        parser.add_argument("--farmer-email", help="Use this Farmer in their own barangay; other barangays use inactive demo farmers.")

    def handle(self, *args, **options):
        clean = options["clean"]
        dry_run = options["dry_run"]
        assert_safe_seed_database(clean=clean, dry_run=dry_run)
        months = self._completed_months(timezone.localdate())

        if dry_run:
            count = SurveillanceDemoOwnership.objects.filter(identifier__startswith=PREFIX).count()
            action = "would remove" if clean else "would replace and seed"
            self.stdout.write(
                f"Dry run: {action} {count} explicitly owned objects. "
                f"Monthly event range: {months[0].isoformat()} to {months[-1].isoformat()} "
                f"({MONTHS} complete calendar months)."
            )
            if not clean:
                self.stdout.write(f"Scope: all {Barangay.objects.count()} existing barangays; existing coverage confirmations are preserved.")
            self.stdout.write("No database changes were made.")
            return

        with transaction.atomic():
            self._clean_owned_objects()
            if clean:
                return
            plan = self._build_plan(options)
            barangays = list(Barangay.objects.order_by("pk"))
            if not barangays:
                raise CommandError("Existing barangays are required; no shared lookup data was created.")
            for barangay in barangays:
                local_plan = dict(plan, barangay=barangay)
                if not plan["farmer_profile"] or plan["farmer_profile"].barangay_id != barangay.pk:
                    local_plan.update(farmer_user=None, farmer_profile=None)
                verifier = plan["verifier"]
                if verifier and verifier.assigned_barangay_id != barangay.pk and verifier.access_scope != "ALL_BARANGAYS":
                    local_plan["verifier"] = None
                self.barangay_key = f"barangay-{barangay.pk}:"
                self._seed(local_plan, months)
            self.stdout.write(self.style.SUCCESS(f"Completed synthetic analytics seed across {len(barangays)} barangays."))

    @staticmethod
    def _completed_months(today):
        """Return the final day of each of the 24 most recently completed months."""
        month_index = today.year * 12 + today.month - 1
        dates = []
        for offset in range(MONTHS, 0, -1):
            year, zero_month = divmod(month_index - offset, 12)
            month = zero_month + 1
            dates.append(date(year, month, monthrange(year, month)[1]))
        return dates

    @staticmethod
    def _exactly_one(queryset, label):
        count = queryset.count()
        if count != 1:
            raise CommandError(f"Expected exactly one existing {label}; found {count}. No shared lookup data was created.")
        return queryset.get()

    def _build_plan(self, options):
        farmer_user = None
        farmer_profile = None
        if options["farmer_email"]:
            farmer_user = User.objects.filter(
                email__iexact=options["farmer_email"],
                role__role_name=Role.UserRoles.FARMER,
            ).first()
            if farmer_user is None or not hasattr(farmer_user, "farmer_profile"):
                raise CommandError("The selected seed_farmers account must have a Farmer profile.")
            farmer_profile = farmer_user.farmer_profile
            barangay = farmer_profile.barangay
        else:
            barangay = Barangay.objects.order_by("pk").first()
            if barangay is None:
                raise CommandError("Existing barangays are required.")
        cattle = self._exactly_one(
            LivestockType.objects.filter(name__iexact="Cattle"), "Cattle livestock type"
        )
        roles = {
            role_name: self._exactly_one(Role.objects.filter(role_name=role_name), f"{role_name} role")
            for role_name in (Role.UserRoles.FARMER, Role.UserRoles.CBAT, Role.UserRoles.MAO)
        }
        reviewers = User.objects.filter(
            role__role_name=Role.UserRoles.MAO,
            account_status=User.AccountStatus.APPROVED,
            is_active=True,
        )
        reviewer = reviewers.filter(email__iexact=options["mao_email"]).first() if options["mao_email"] else reviewers.order_by("pk").first()
        if reviewer is None:
            if not options["mao_email"]:
                reviewer = User.objects.filter(is_superuser=True, is_active=True).order_by("pk").first()
        if reviewer is None:
            raise CommandError("An active approved MAO/Admin reviewer is required to approve the demo records.")
        if options["mao_email"] and reviewer.role.role_name != Role.UserRoles.MAO:
            raise CommandError("The selected reviewer must be an active, approved MAO account.")

        verifier = None
        if options["cbat_email"]:
            verifier = User.objects.filter(
                email__iexact=options["cbat_email"],
                role__role_name=Role.UserRoles.CBAT,
                account_status=User.AccountStatus.APPROVED,
                is_active=True,
            ).first()
            if verifier is None:
                raise CommandError("The selected verifier must be an active, approved CBAT account.")
        return {
            "barangay": barangay, "cattle": cattle, "roles": roles,
            "reviewer": reviewer, "verifier": verifier,
            "farmer_user": farmer_user, "farmer_profile": farmer_profile,
        }

    def _seed(self, plan, months):
        identity_suffix = f"-b{plan['barangay'].pk}"
        farmers = []
        if plan["farmer_user"]:
            farmers.append({
                "user": plan["farmer_user"],
                "farmer": plan["farmer_profile"],
                "mortality_animals": [],
            })
        else:
            for suffix in ("a", "b"):
                user = self._create_demo_user(
                    key=f"farmer-{suffix}",
                    email=f"demo.analytics.farmer.{suffix}{identity_suffix}@smartlivestock-demo.invalid",
                    username=f"demo-analytics-farmer-{suffix}{identity_suffix}",
                    role=plan["roles"][Role.UserRoles.FARMER],
                )
                farmer = Farmer.objects.create(
                    user=user,
                    barangay=plan["barangay"],
                    address=f"DEMO ONLY - synthetic analytics farm {suffix.upper()} in {plan['barangay'].barangay_name}",
                )
                self._track(f"farmer-{suffix}:profile", "farmer", farmer)
                farmers.append({"user": user, "farmer": farmer, "mortality_animals": []})

        verifier = plan["verifier"] or self._create_demo_user(
            key="cbat-verifier",
            email=f"demo.analytics.cbat{identity_suffix}@smartlivestock-demo.invalid",
            username=f"demo-analytics-cbat-verifier{identity_suffix}",
            role=plan["roles"][Role.UserRoles.CBAT],
            assigned_barangay=plan["barangay"],
            last_name="CBAT Verifier",
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
                    tag=f"DM-B{plan['barangay'].pk}-D-{month_end:%Y%m}-{event_index + 1}",
                )
                self._create_approved_disease(
                    key=f"disease:{month_end:%Y-%m}:{event_index + 1}",
                    farmer_user=owner["user"],
                    animal=disease_animal,
                    record_date=self._event_day(month_end, month_index, event_index, offset=3),
                    verifier=verifier,
                    reviewer=plan["reviewer"],
                )
                self._track_notifications("disease_case", f"disease:{month_end:%Y-%m}:{event_index + 1}")

            for event_index in range(MORTALITY_RECORDS_PER_MONTH[month_index]):
                owner_index = (month_index + event_index) % len(farmers)
                owner = farmers[owner_index]
                mortality_count += 1
                mortality_animal = self._create_demo_animal(
                    key=f"farmer-{chr(97 + owner_index)}:mortality-animal:{month_end:%Y-%m}:{event_index + 1}",
                    owner=owner,
                    livestock_type=plan["cattle"],
                    reviewer=plan["reviewer"],
                    tag=f"DM-B{plan['barangay'].pk}-M-{month_end:%Y%m}-{event_index + 1}",
                )
                owner["mortality_animals"].append(mortality_animal)
                self._create_approved_mortality(
                    key=f"mortality:{month_end:%Y-%m}:{event_index + 1}",
                    farmer_user=owner["user"],
                    animal=mortality_animal,
                    record_date=self._event_day(month_end, month_index, event_index, offset=11),
                    verifier=verifier,
                    reviewer=plan["reviewer"],
                )
                self._track_notifications("mortality_record", f"mortality:{month_end:%Y-%m}:{event_index + 1}")

        self._seed_coverage_confirmations(plan, months)
        self.stdout.write(self.style.SUCCESS("Disease and mortality event analytics demo is ready."))
        farmer_summary = (
            f"Used Farmer demo {plan['farmer_user'].email}"
            if plan["farmer_user"]
            else "Created 2 inactive analytics-only demo farmers"
        )
        self.stdout.write(
            f"{farmer_summary} in {plan['barangay'].barangay_name}; "
            f"{disease_count} approved disease cases and {mortality_count} approved mortality records from "
            f"{months[0]:%b %Y} through {months[-1]:%b %Y}."
        )
        self.stdout.write(
            "Each report passed the PENDING -> CBAT VERIFIED -> MAO APPROVED transition checks. "
            f"Mortality approvals reconciled {mortality_count} uniquely identified demo animals as deceased."
        )
        self.stdout.write(
            "All records are synthetic and explicitly marked; disease labels are not diagnoses. "
            "They are intended for analytics display, not real-world surveillance evidence."
        )
        self.stdout.write(
            "Synthetic coverage confirmations demonstrate explicit quiet months; they are not operational attestations. "
            "Existing coverage confirmations are preserved."
        )

    @staticmethod
    def _event_day(month_end, month_index, event_index, *, offset):
        days_in_month = monthrange(month_end.year, month_end.month)[1]
        day = 3 + ((month_index * 7 + event_index * 11 + offset) % (days_in_month - 5))
        return date(month_end.year, month_end.month, day)

    def _seed_coverage_confirmations(self, plan, months):
        """Add reversible synthetic coverage only where no prior attestation exists."""
        created_count = 0
        preserved_count = 0
        skipped_count = 0
        for domain, model, approved_status, marker in (
            (SurveillanceCoverageReport.Domain.DISEASE, DiseaseCase, DiseaseCase.DiseaseStatus.APPROVED, SEED_MARKER_DISEASE),
            (SurveillanceCoverageReport.Domain.MORTALITY, MortalityRecord, MortalityRecord.MortalityRecordStatus.APPROVED, SEED_MARKER_MORTALITY),
        ):
            for month_end in months:
                month_start = date(month_end.year, month_end.month, 1)
                if SurveillanceCoverageReport.objects.filter(
                    barangay=plan["barangay"], domain=domain, report_month=month_start,
                ).exists():
                    preserved_count += 1
                    continue

                events = model.objects.filter(
                    record_date__year=month_start.year,
                    record_date__month=month_start.month,
                ).filter(
                    Q(livestock__farmer__barangay=plan["barangay"])
                    | Q(batch__farmer__barangay=plan["barangay"])
                )
                if events.filter(
                    Q(review_remarks__isnull=True)
                    | ~Q(review_remarks__contains=marker)
                ).exists():
                    # Do not create a synthetic attestation over real or other
                    # seed records in the same barangay and month.
                    skipped_count += 1
                    continue
                record_count = events.count()
                approved_count = events.filter(status=approved_status).count()
                if record_count and approved_count != record_count:
                    skipped_count += 1
                    continue
                report = SurveillanceCoverageReport.objects.create(
                    barangay=plan["barangay"],
                    domain=domain,
                    report_month=month_start,
                    status=(
                        SurveillanceCoverageReport.Status.REPORTS_COMPLETE
                        if record_count
                        else SurveillanceCoverageReport.Status.NO_REPORTS_RECEIVED
                    ),
                    confirmed_by=plan["reviewer"],
                )
                self._track(f"coverage:{domain.lower()}:{month_start:%Y-%m}", "coverage", report)
                created_count += 1
        self.stdout.write(
            f"{plan['barangay'].barangay_name} coverage: {created_count} synthetic confirmations created, "
            f"{preserved_count} existing confirmations preserved, {skipped_count} months/domains skipped "
            "because they contain other records or unapproved reports."
        )
        if preserved_count or skipped_count:
            self.stdout.write(self.style.WARNING(
                "Forecast readiness can still be blocked: review existing confirmations and mixed-record months "
                "in Monthly Reporting Coverage. This seed does not attest to real reports."
            ))

    def _track_notifications(self, entity_type, record_key):
        record_marker = SurveillanceDemoOwnership.objects.filter(identifier=f"{PREFIX}{getattr(self, 'barangay_key', '')}{record_key}").first()
        if record_marker is None:
            return
        for notification in Notification.objects.filter(
            related_entity_type=entity_type,
            related_entity_id=record_marker.object_id,
        ):
            self._track(
                f"notification:{entity_type}:{record_marker.object_id}:{notification.pk}",
                "notification",
                notification,
            )

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
        verify_remark = f"{marker} Synthetic CBAT verification for analytics demo; not a field inspection."
        validate_review_transition(
            domain=domain,
            role=Role.UserRoles.CBAT,
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
            identifier=f"{PREFIX}{getattr(self, 'barangay_key', '')}{identifier}",
            defaults={"object_type": object_type, "object_id": obj.pk},
        )
        if not created and (marker.object_type != object_type or marker.object_id != obj.pk):
            raise CommandError(f"Ownership marker conflict for {identifier}; refusing to claim another row.")

    def _clean_owned_objects(self):
        # Earlier versions created notifications before the ownership ledger
        # tracked them. Recover only notifications whose entity IDs point to
        # this seed's already-owned synthetic reports.
        entity_types = {"disease": "disease_case", "mortality": "mortality_record"}
        for record_marker in SurveillanceDemoOwnership.objects.filter(
            identifier__startswith=PREFIX,
            object_type__in=entity_types,
        ):
            for notification in Notification.objects.filter(
                related_entity_type=entity_types[record_marker.object_type],
                related_entity_id=record_marker.object_id,
            ):
                self._track(
                    f"notification:{record_marker.object_type}:{record_marker.object_id}:{notification.pk}",
                    "notification",
                    notification,
                )

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

        for object_type in ("notification", "coverage", "mortality", "disease", "livestock", "farmer", "user"):
            model = OBJECT_MODELS[object_type]
            ids = owned_ids.get(model, set())
            if ids:
                model.objects.filter(pk__in=ids).delete()
        SurveillanceDemoOwnership.objects.filter(identifier__startswith=PREFIX).delete()
        if markers:
            self.stdout.write(f"Removed {len(markers)} explicitly owned disease/mortality analytics demo objects.")

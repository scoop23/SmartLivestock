"""Create the Tangob individual-cow milk anomaly and review demonstration.

Local development use:
    SMARTLIVESTOCK_DEMO_PASSWORD=<secure-local-password> python manage.py seed_milk_anomaly_demo

For PostgreSQL, explicitly set SMARTLIVESTOCK_DEMO_ENV=development or staging,
SMARTLIVESTOCK_DEMO_DATABASE_ACK=<environment>:<database-name>. To use --clean,
also set SMARTLIVESTOCK_DEMO_ALLOW_CLEANUP=YES. The command refuses production
settings/databases and never deletes objects without an ownership-ledger entry.
"""

from datetime import timedelta
from decimal import Decimal
import os
import sys

from django.conf import settings
from django.core.exceptions import ObjectDoesNotExist
from django.core.management.base import BaseCommand, CommandError
from django.db import connections, transaction
from django.utils import timezone
from rest_framework_simplejwt.token_blacklist.models import OutstandingToken

from livestock.models import Barangay, Farmer, LivestockInventory, LivestockType
from production.models import MilkAnomalyDemoOwnership, ProductionRecord
from production.services.milk_anomaly import apply_milk_anomaly_assessment
from users.models import Notification, Role, User


PREFIX = "milk-anomaly-demo-v1:"
FARMER_EMAIL = "demo.milk.farmer@smartlivestock-demo.invalid"
CBAT_EMAIL = "demo.milk.cbat@smartlivestock-demo.invalid"
MAO_EMAIL = "demo.milk.mao@smartlivestock-demo.invalid"
DAILY_PATTERN = ("9.80", "9.90", "10.00", "10.10", "10.20", "9.95", "10.05")
RECORD_TYPES = {
    MilkAnomalyDemoOwnership.ObjectType.USER: User,
    MilkAnomalyDemoOwnership.ObjectType.FARMER: Farmer,
    MilkAnomalyDemoOwnership.ObjectType.LIVESTOCK: LivestockInventory,
    MilkAnomalyDemoOwnership.ObjectType.PRODUCTION_RECORD: ProductionRecord,
    MilkAnomalyDemoOwnership.ObjectType.NOTIFICATION: Notification,
}


class Command(BaseCommand):
    help = "Seed a synthetic Tangob milk-anomaly demo in local development or opted-in staging; --clean removes only ledger-owned demo data."

    def add_arguments(self, parser):
        parser.add_argument("--clean", action="store_true", help="Delete only explicitly ledger-owned demo data and stop without recreating it.")
        parser.add_argument("--dry-run", action="store_true", help="Report the requested action without creating or deleting data.")

    def handle(self, *args, **options):
        clean = options["clean"]
        dry_run = options["dry_run"]
        self._assert_safe_database(clean=clean)

        if dry_run:
            markers = MilkAnomalyDemoOwnership.objects.filter(identifier__startswith=PREFIX)
            if clean:
                self.stdout.write(f"Dry run: would remove the milk anomaly demo; {markers.count()} demo-owned objects are currently tracked.")
            else:
                self.stdout.write(f"Dry run: would create or reuse the milk anomaly demo; {markers.count()} demo-owned objects are currently tracked.")
                self.stdout.write("Required reference data: exactly one Barangay named Tangob and a Cattle livestock type.")
            self.stdout.write("No database changes were made.")
            return

        if clean:
            with transaction.atomic():
                self._clean_owned_objects()
            return

        password = os.environ.get("SMARTLIVESTOCK_DEMO_PASSWORD", "")
        with transaction.atomic():
            barangay = self._get_reference(Barangay, "barangay_name__iexact", "Tangob", "Tangob barangay")
            cattle = self._get_reference(LivestockType, "name__iexact", "Cattle", "Cattle livestock type")
            roles = {
                name: self._get_reference(Role, "role_name", name, f"{name} role")
                for name in (Role.UserRoles.FARMER, Role.UserRoles.MAO)
            }
            # CBAT is a valid reviewer role in the model, but older databases may
            # only have SIBAT. The demo needs a CBAT account for flagged milk.
            roles[Role.UserRoles.CBAT], _ = Role.objects.get_or_create(role_name=Role.UserRoles.CBAT)

            farmer_user = self._get_or_create_user("farmer-user", FARMER_EMAIL, "demo_milk_farmer", roles[Role.UserRoles.FARMER], barangay, password)
            cbat_user = self._get_or_create_user("cbat-user", CBAT_EMAIL, "demo_milk_cbat", roles[Role.UserRoles.CBAT], barangay, password)
            mao_user = self._get_or_create_user("mao-user", MAO_EMAIL, "demo_milk_mao", roles[Role.UserRoles.MAO], barangay, password)
            farmer = self._get_or_create_farmer(farmer_user, barangay)
            cows = {
                "clean": self._get_or_create_cow("cow-clean", "DEMO-MILK-CLEAN", farmer, cattle, mao_user),
                "anomaly": self._get_or_create_cow("cow-anomaly", "DEMO-MILK-ANOMALY", farmer, cattle, mao_user),
            }
            history_counts = {
                key: self._ensure_history(key, cow, farmer_user, mao_user)
                for key, cow in cows.items()
            }
            scenarios = {
                "clean": self._get_or_create_scenario("scenario-clean", cows["clean"], farmer, farmer_user, Decimal("10.00"), "DEMO synthetic normal-baseline scenario; not real farmer data."),
                "anomaly": self._get_or_create_scenario("scenario-anomaly", cows["anomaly"], farmer, farmer_user, Decimal("15.00"), "DEMO synthetic elevated-yield anomaly scenario; not real farmer data."),
            }

            from production.views import _notify_production_route
            for key, record in scenarios.items():
                self._ensure_route_notifications(key, record, farmer_user, _notify_production_route)

            self.stdout.write(self.style.SUCCESS("Milk anomaly demonstration is ready."))
            self.stdout.write(f"Farmer: {farmer_user.email} — Tangob, Padre Garcia; reviewer accounts: {cbat_user.email}, {mao_user.email}")
            for key, cow in cows.items():
                forecast = self._forecast(cow)
                self.stdout.write(f"Cow {cow.tag_number}: {history_counts[key]} approved synthetic daily records; forecast {forecast['status']} ({len(forecast.get('forecast') or [])}/7 days).")
            for key, record in scenarios.items():
                record.refresh_from_db()
                self.stdout.write(
                    f"{key.title()} scenario: record #{record.pk}, {record.anomaly_assessment_status}, "
                    f"anomaly={record.anomaly_detected}, queue={record.next_review_queue}, "
                    f"status={record.status}, forecast comparison="
                    f"{(record.anomaly_assessment or {}).get('forecast_comparison', {}).get('status', 'unavailable')}."
                )
            self.stdout.write("Demo records are synthetic. Use the CBAT account to verify or return the flagged record, then the MAO account to make the final decision.")

    def _assert_safe_database(self, *, clean):
        is_isolated_test_run = "test" in sys.argv and "memory" in str(connections["default"].settings_dict.get("NAME", "")).lower()
        target_env = os.environ.get("SMARTLIVESTOCK_DEMO_ENV", "").lower()
        is_render = any(os.environ.get(key) for key in ("RENDER", "RENDER_SERVICE_ID", "RENDER_EXTERNAL_HOSTNAME"))
        if target_env == "production":
            raise CommandError("Refusing to seed a database explicitly identified as production.")
        if is_render and target_env != "staging":
            raise CommandError("Refusing to seed on an unidentified Render service. Set SMARTLIVESTOCK_DEMO_ENV=staging and the exact database acknowledgement only after confirming this is a staging database.")
        if not settings.DEBUG and target_env != "staging" and not is_isolated_test_run:
            raise CommandError("Refusing to seed with DEBUG disabled unless the database is explicitly identified and acknowledged as staging.")
        connection = connections["default"]
        if target_env == "development" and connection.vendor == "postgresql":
            host = str(connection.settings_dict.get("HOST") or "").lower()
            if host not in {"localhost", "127.0.0.1", "::1"}:
                raise CommandError("Development demo seeding requires local PostgreSQL. Confirm Django is connected to localhost before retrying. No database changes were made.")
        is_memory_database = connection.vendor == "sqlite" and "memory" in str(connection.settings_dict.get("NAME", "")).lower()
        if is_memory_database:
            # Django's isolated in-memory test database is safe by construction.
            pass
        else:
            db_name = str(connection.settings_dict.get("NAME") or "")
            expected_ack = f"{target_env}:{db_name}"
            if target_env not in {"development", "staging"} or os.environ.get("SMARTLIVESTOCK_DEMO_DATABASE_ACK") != expected_ack:
                raise CommandError("This database needs explicit environment identification: set SMARTLIVESTOCK_DEMO_ENV=development|staging and SMARTLIVESTOCK_DEMO_DATABASE_ACK=<environment>:<database-name>. No database changes were made.")
        if clean and os.environ.get("SMARTLIVESTOCK_DEMO_ALLOW_CLEANUP") != "YES":
            raise CommandError("--clean requires SMARTLIVESTOCK_DEMO_ALLOW_CLEANUP=YES after confirming this is a development or staging database.")

    def _get_reference(self, model, lookup, value, label):
        matches = model.objects.filter(**{lookup: value})
        if matches.count() != 1:
            raise CommandError(f"Expected exactly one existing {label}; found {matches.count()}. Add/fix shared reference data first; this command will not create it.")
        return matches.get()

    def _marker(self, identifier):
        return MilkAnomalyDemoOwnership.objects.filter(identifier=f"{PREFIX}{identifier}").first()

    def _track(self, identifier, object_type, obj):
        marker, created = MilkAnomalyDemoOwnership.objects.get_or_create(
            identifier=f"{PREFIX}{identifier}",
            defaults={"object_type": object_type, "object_id": obj.pk},
        )
        if not created and (marker.object_type != object_type or marker.object_id != obj.pk):
            raise CommandError(f"Ownership marker conflict for {identifier}; refusing to modify an object not owned by this fixture.")
        return obj

    def _owned(self, identifier, object_type):
        marker = self._marker(identifier)
        if marker is None:
            return None
        if marker.object_type != object_type:
            raise CommandError(f"Ownership marker {identifier} has an unexpected object type; refusing to continue.")
        model = RECORD_TYPES[object_type]
        try:
            return model.objects.get(pk=marker.object_id)
        except model.DoesNotExist as exc:
            raise CommandError(f"Ownership marker {identifier} points to a missing row; clean-up or repair the ledger manually first.") from exc

    def _get_or_create_user(self, key, email, username, role, barangay, password):
        user = self._owned(key, MilkAnomalyDemoOwnership.ObjectType.USER)
        if user is None:
            if User.objects.filter(email=email).exists() or User.objects.filter(username=username).exists():
                raise CommandError(f"{email} or username {username} already exists without this demo's ownership marker; refusing to reuse or change it.")
            if not password:
                raise CommandError("Set SMARTLIVESTOCK_DEMO_PASSWORD to a secure local/staging password before creating demo accounts. It is never printed or stored in source.")
            user = User.objects.create_user(
                username=username, email=email, password=password, role=role,
                account_status=User.AccountStatus.APPROVED, is_active=True,
                first_name="Demo", last_name={"farmer-user": "Farmer", "cbat-user": "CBAT Reviewer", "mao-user": "MAO Reviewer"}[key],
                assigned_barangay=barangay if key != "farmer-user" else None,
            )
            self._track(key, MilkAnomalyDemoOwnership.ObjectType.USER, user)
        elif user.role_id != role.pk or (key != "farmer-user" and user.assigned_barangay_id != barangay.pk):
            raise CommandError(f"The tracked demo account {email} no longer has the expected role/barangay; correct it explicitly before reseeding.")
        return user

    def _get_or_create_farmer(self, user, barangay):
        farmer = self._owned("farmer-profile", MilkAnomalyDemoOwnership.ObjectType.FARMER)
        if farmer is None:
            existing = Farmer.objects.filter(user=user).first()
            if existing:
                raise CommandError("The demo farmer account already has an untracked Farmer profile; refusing to claim or alter it.")
            farmer = Farmer.objects.create(user=user, barangay=barangay, address="DEMO ONLY — synthetic farm in Tangob")
            self._track("farmer-profile", MilkAnomalyDemoOwnership.ObjectType.FARMER, farmer)
        elif farmer.user_id != user.pk or farmer.barangay_id != barangay.pk:
            raise CommandError("The tracked demo farmer profile no longer matches the expected account and barangay.")
        return farmer

    def _get_or_create_cow(self, key, tag, farmer, cattle, reviewer):
        cow = self._owned(key, MilkAnomalyDemoOwnership.ObjectType.LIVESTOCK)
        if cow is None:
            cow = LivestockInventory.objects.create(
                farmer=farmer, livestock_type=cattle,
                entry_type=LivestockInventory.EntryType.INDIVIDUAL,
                quantity=1, tag_number=tag, breed="Demo Crossbred",
                sex="Female", birth_date=timezone.localdate() - timedelta(days=1800),
                status=LivestockInventory.StatusType.APPROVED,
                operational_status=LivestockInventory.OperationalStatus.ACTIVE,
                created_by=farmer.user, reviewed_by=reviewer,
                reviewed_at=timezone.now(), review_remarks="Synthetic demo fixture; not a real animal.",
            )
            self._track(key, MilkAnomalyDemoOwnership.ObjectType.LIVESTOCK, cow)
        elif cow.farmer_id != farmer.pk or cow.livestock_type_id != cattle.pk or cow.entry_type != LivestockInventory.EntryType.INDIVIDUAL:
            raise CommandError(f"Tracked cow {tag} no longer belongs to the demo farmer as an individual Cattle record.")
        return cow

    def _ensure_history(self, cow_key, cow, farmer_user, mao_user):
        start = timezone.localdate() - timedelta(days=59)
        for index in range(60):
            record_date = start + timedelta(days=index)
            identifier = f"history-{cow_key}-{record_date.isoformat()}"
            record = self._owned(identifier, MilkAnomalyDemoOwnership.ObjectType.PRODUCTION_RECORD)
            if record is None:
                record = ProductionRecord.objects.create(
                    livestock=cow,
                    farmer_at_record=cow.farmer,
                    production_type=ProductionRecord.ProductionType.MILK,
                    quantity=Decimal(DAILY_PATTERN[index % len(DAILY_PATTERN)]),
                    unit=ProductionRecord.UnitType.LITERS,
                    record_date=record_date,
                    status=ProductionRecord.ProductionStatus.APPROVED,
                    next_review_queue=ProductionRecord.ReviewQueue.NONE,
                    anomaly_assessment_status=ProductionRecord.AnomalyAssessmentStatus.NOT_APPLICABLE,
                    notes="DEMO synthetic approved daily history; not real farmer data.",
                    created_by=farmer_user, reviewed_by=mao_user, reviewed_at=timezone.now(),
                    review_remarks="Approved synthetic demonstration history.",
                )
                self._track(identifier, MilkAnomalyDemoOwnership.ObjectType.PRODUCTION_RECORD, record)
            elif record.livestock_id != cow.pk or record.record_date != record_date or record.status != ProductionRecord.ProductionStatus.APPROVED:
                raise CommandError(f"Tracked synthetic history row {identifier} no longer satisfies the approved daily-history invariant.")
        return 60

    def _get_or_create_scenario(self, key, cow, farmer, farmer_user, quantity, note):
        record = self._owned(key, MilkAnomalyDemoOwnership.ObjectType.PRODUCTION_RECORD)
        if record is None:
            record = ProductionRecord(
                livestock=cow, farmer_at_record=farmer,
                production_type=ProductionRecord.ProductionType.MILK,
                quantity=quantity, unit=ProductionRecord.UnitType.LITERS,
                record_date=timezone.localdate() + timedelta(days=1),
                status=ProductionRecord.ProductionStatus.PENDING,
                notes=note, created_by=farmer_user,
            )
            apply_milk_anomaly_assessment(record)
            record.save()
            self._track(key, MilkAnomalyDemoOwnership.ObjectType.PRODUCTION_RECORD, record)
        elif record.livestock_id != cow.pk or record.farmer_at_record_id != farmer.pk:
            raise CommandError(f"Tracked scenario {key} no longer belongs to its expected demo cow and farmer.")
        return record

    def _ensure_route_notifications(self, key, record, farmer_user, route_sender):
        if MilkAnomalyDemoOwnership.objects.filter(
            identifier__startswith=f"{PREFIX}notification-{key}-"
        ).exists():
            return
        before = set(Notification.objects.filter(
            related_entity_type="production_record", related_entity_id=record.pk,
        ).values_list("pk", flat=True))
        route_sender(record, farmer_user)
        created = Notification.objects.filter(
            related_entity_type="production_record", related_entity_id=record.pk,
        ).exclude(pk__in=before)
        for notification in created:
            self._track(
                f"notification-{key}-{notification.pk}",
                MilkAnomalyDemoOwnership.ObjectType.NOTIFICATION,
                notification,
            )

    def _forecast(self, cow):
        from django.db.models import Sum
        from production.models import CalvingRecord
        from analytics.services.predictive.livestock_milk import forecast_livestock_milk

        rows = list(ProductionRecord.objects.filter(
            livestock=cow,
            production_type=ProductionRecord.ProductionType.MILK,
            status=ProductionRecord.ProductionStatus.APPROVED,
        ).values("record_date").annotate(total=Sum("quantity")).order_by("record_date"))
        daily = [{"date": row["record_date"], "milk_liters": float(row["total"])} for row in rows]
        calvings = list(CalvingRecord.objects.filter(dam=cow, status=CalvingRecord.StatusType.APPROVED).values_list("calving_date", "reviewed_at", "created_at"))
        events = [(event_date, (reviewed_at or created_at).date()) for event_date, reviewed_at, created_at in calvings]
        return forecast_livestock_milk(cow, daily, events, weather_rows={}, weather_message="Weather omitted for the offline demo seed.")

    def _clean_owned_objects(self):
        markers = list(MilkAnomalyDemoOwnership.objects.filter(identifier__startswith=PREFIX))
        owned_ids = {}
        objects = []
        for marker in markers:
            model = RECORD_TYPES.get(marker.object_type)
            if model is None:
                raise CommandError(f"Unknown owned object type {marker.object_type!r}; refusing cleanup.")
            try:
                obj = model.objects.get(pk=marker.object_id)
            except model.DoesNotExist as exc:
                raise CommandError(f"Marker {marker.identifier} points to missing {model.__name__} #{marker.object_id}; refusing cleanup.") from exc
            owned_ids.setdefault(model, set()).add(obj.pk)
            objects.append((marker, obj))

        # Refresh-token rows are generated automatically for demo accounts and
        # are not part of the fixture ownership ledger. They belong to the
        # ledger-owned users and are removed by the user's normal cascade.
        demo_user_ids = owned_ids.get(User, set())
        if demo_user_ids:
            owned_ids[OutstandingToken] = set(
                OutstandingToken.objects.filter(user_id__in=demo_user_ids)
                .values_list("pk", flat=True)
            )
            # Notifications belong to their recipient's inbox. A notification
            # for a demo account may reference a real domain record, but
            # deleting the inbox row does not delete that referenced record.
            owned_ids[Notification] = set(
                Notification.objects.filter(user_id__in=demo_user_ids)
                .values_list("pk", flat=True)
            )

        # Refuse before deleting if any protected/cascading related data is not
        # positively present in the same ownership ledger.
        for marker, obj in objects:
            for relation in obj._meta.related_objects:
                if relation.related_model is MilkAnomalyDemoOwnership:
                    continue
                try:
                    manager = getattr(obj, relation.get_accessor_name(), None)
                except ObjectDoesNotExist:
                    manager = None
                if manager is None:
                    continue
                if hasattr(manager, "all"):
                    related_pks = manager.all().values_list("pk", flat=True).iterator()
                else:
                    related_pks = (manager.pk,)
                for related_pk in related_pks:
                    if related_pk not in owned_ids.get(relation.related_model, set()):
                        raise CommandError(
                            f"Cannot clean {marker.identifier}: {relation.related_model.__name__} #{related_pk} "
                            "is related but has no demo ownership marker. No rows were deleted."
                        )

        order = [
            MilkAnomalyDemoOwnership.ObjectType.NOTIFICATION,
            MilkAnomalyDemoOwnership.ObjectType.PRODUCTION_RECORD,
            MilkAnomalyDemoOwnership.ObjectType.LIVESTOCK,
            MilkAnomalyDemoOwnership.ObjectType.FARMER,
            MilkAnomalyDemoOwnership.ObjectType.USER,
        ]
        for object_type in order:
            model = RECORD_TYPES[object_type]
            ids = owned_ids.get(model, set())
            if ids:
                model.objects.filter(pk__in=ids).delete()
        MilkAnomalyDemoOwnership.objects.filter(identifier__startswith=PREFIX).delete()
        self.stdout.write(f"Removed {len(markers)} explicitly demo-owned objects.")

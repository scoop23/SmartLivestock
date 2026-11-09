"""Related movement fixtures derived only from owned forecast sales."""
from collections import Counter, defaultdict
from datetime import datetime, time, timedelta
from hashlib import sha256

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from analytics.models import SurveillanceDemoOwnership
from analytics.seed_markers import SEED_MARKER_FORECAST_QUALITY_IDEAL, SEED_MARKER_CATTLE_PRICE_DEMO
from livestock.models import LivestockOwnershipTransfer, LivestockType
from movements.models import LivestockInspection, LivestockInspectionItem, LivestockInspectionClearance
from smartlivestock.seed_safety import assert_safe_seed_database


PREFIX = "forecast-movement-v1:"
MARKER = "AI_SEED::FORECAST_MOVEMENT::V1"
CALABARZON_DESTINATIONS = (
    ("Batangas", ("Lipa City", "Batangas City", "Tanauan City")),
    ("Cavite", ("Dasmarinas City", "Imus City", "Bacoor City")),
    ("Laguna", ("Calamba City", "San Pablo City", "Santa Rosa City")),
    ("Rizal", ("Antipolo City", "Taytay", "Cainta")),
    ("Quezon", ("Lucena City", "Tayabas City", "Tiaong")),
)


def outbound_destination(index):
    """Balance simulated outbound permits by province, then by locality."""
    province, places = CALABARZON_DESTINATIONS[index % len(CALABARZON_DESTINATIONS)]
    return f"{places[(index // len(CALABARZON_DESTINATIONS)) % len(places)]}, {province}"


def movement_use(sale_id):
    """Repeatable illustrative purposes, not inferred real buyer intentions."""
    choices = (("BREEDING", "BREEDER"), ("FATTENING", "FATTENING"), ("SLAUGHTER", "SLAUGHTER"))
    index = int(sha256(f"movement-purpose:{sale_id}".encode()).hexdigest()[:8], 16) % len(choices)
    return choices[index]


def historical_time(day, hour):
    return timezone.make_aware(datetime.combine(day, time(hour)), timezone.get_current_timezone())


def clean_owned_movements(*, dry_run=False):
    """Only delete inspections that still have their complete owned fixture graph."""
    ledger = SurveillanceDemoOwnership.objects.filter(identifier__startswith=PREFIX)
    inspection_ids = list(ledger.filter(object_type="movement_inspection").values_list("object_id", flat=True))
    clearance_ids = set(ledger.filter(object_type="movement_clearance").values_list("object_id", flat=True))
    for inspection in LivestockInspection.objects.filter(pk__in=inspection_ids):
        clearance = LivestockInspectionClearance.objects.filter(inspection=inspection).first()
        if (not clearance or clearance.pk not in clearance_ids
                or MARKER not in clearance.review_remarks
                or inspection.items.exclude(remarks__contains=MARKER).exists()):
            raise CommandError(f"Movement inspection #{inspection.pk} has unowned changes; cleanup stopped.")
    count = len(inspection_ids)
    if not dry_run:
        LivestockInspectionClearance.objects.filter(pk__in=clearance_ids).delete()
        LivestockInspection.objects.filter(pk__in=inspection_ids).delete()
        ledger.delete()
    return count


class Command(BaseCommand):
    help = "Add related weekly movement examples to existing ideal/cattle-price forecast sales without creating livestock."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", help="Preview without changing records.")
        parser.add_argument("--clean", action="store_true", help="Remove only this movement seed's owned records.")
        parser.add_argument("--refresh-purposes", action="store_true", help="Update only owned movement purpose/classification fields to the varied seed mix.")
        parser.add_argument("--refresh-destinations", action="store_true", help="Spread owned registered-cattle outbound destinations evenly across CALABARZON; incoming origins stay unchanged.")

    def handle(self, *args, **options):
        assert_safe_seed_database(clean=options["clean"], dry_run=options["dry_run"])
        if sum(bool(options[name]) for name in ("clean", "refresh_purposes", "refresh_destinations")) > 1:
            raise CommandError("Use --clean, --refresh-purposes or --refresh-destinations separately.")
        with transaction.atomic():
            if options["clean"]:
                count = clean_owned_movements(dry_run=options["dry_run"])
                self.stdout.write(f"{'Would remove' if options['dry_run'] else 'Removed'} {count} owned movement inspections and their clearances.")
                return
            if options["refresh_purposes"]:
                clean_owned_movements(dry_run=True)  # Validate ownership without deleting.
                counts = Counter()
                ledger = SurveillanceDemoOwnership.objects.filter(identifier__startswith=PREFIX, object_type="movement_inspection")
                for entry in ledger:
                    sale_id = int(entry.identifier.split(":sale:", 1)[1].split(":", 1)[0])
                    purpose, classification = movement_use(sale_id)
                    counts[purpose] += 1
                    if not options["dry_run"]:
                        LivestockInspection.objects.filter(pk=entry.object_id).update(purpose=purpose)
                        LivestockInspectionItem.objects.filter(inspection_id=entry.object_id, remarks__contains=MARKER).update(classification=classification)
                self.stdout.write(f"{'Would refresh' if options['dry_run'] else 'Refreshed'} owned movement purposes: {dict(counts)}. Other fields unchanged.")
                return
            if options["refresh_destinations"]:
                clean_owned_movements(dry_run=True)
                ids = SurveillanceDemoOwnership.objects.filter(
                    identifier__startswith=PREFIX, object_type="movement_inspection",
                ).values_list("object_id", flat=True)
                inspections = LivestockInspection.objects.filter(pk__in=ids, shipper__isnull=False).order_by("inspection_date", "pk")
                counts = Counter()
                for index, inspection in enumerate(inspections):
                    destination = outbound_destination(index)
                    counts[destination.rsplit(", ", 1)[1]] += 1
                    if not options["dry_run"]:
                        LivestockInspection.objects.filter(pk=inspection.pk).update(destination=destination)
                self.stdout.write(f"{'Would refresh' if options['dry_run'] else 'Refreshed'} outbound destinations: {dict(counts)}. Incoming origins and other fields unchanged.")
                return
            from users.models import User
            mao_reviewer = (
                User.objects.filter(role__role_name="MAO", account_status="APPROVED", is_active=True).first()
                or User.objects.filter(is_superuser=True, is_active=True).first()
            )
            if not mao_reviewer:
                raise CommandError("An active MAO reviewer account is required to approve movement inspections.")
            sales = LivestockOwnershipTransfer.objects.filter(
                Q(review_remarks__contains=SEED_MARKER_FORECAST_QUALITY_IDEAL)
                | Q(review_remarks__contains=SEED_MARKER_CATTLE_PRICE_DEMO),
                status="APPROVED", created_by__role__role_name="AUCTION",
                reviewed_at__isnull=False,
            ).select_related("livestock__livestock_type", "previous_owner__barangay", "previous_owner__user", "created_by", "reviewed_by").order_by("transfer_date", "pk")
            weeks = defaultdict(lambda: {"registered": [], "external": []})
            for sale in sales:
                if sale.livestock_id and (not sale.previous_owner_id or sale.livestock.farmer_id != sale.previous_owner_id
                                          or sale.livestock.operational_status != "SOLD"):
                    continue
                day = sale.transfer_date - timedelta(days=sale.transfer_date.weekday())
                weeks[day]["registered" if sale.livestock_id else "external"].append(sale)
            if not weeks:
                raise CommandError("Run seed_forecast_quality_demo --scenario ideal first; no eligible owned sales were found.")
            selected = []
            farmer_counts = Counter()
            for week in sorted(weeks):
                for source, candidates in weeks[week].items():
                    if not candidates:
                        continue
                    sale = min(candidates, key=lambda row: (farmer_counts[row.previous_owner_id], row.pk)) if source == "registered" else candidates[0]
                    if source == "registered":
                        farmer_counts[sale.previous_owner_id] += 1
                    selected.append(sale)
            created = skipped = outbound_index = 0
            for sale in selected:
                destination = outbound_destination(outbound_index) if sale.livestock_id else "Padre Garcia Livestock Auction Market, Batangas"
                if sale.livestock_id:
                    outbound_index += 1
                key = f"{PREFIX}sale:{sale.pk}"
                existing = SurveillanceDemoOwnership.objects.filter(identifier=f"{key}:inspection").first()
                if existing:
                    if not LivestockInspection.objects.filter(pk=existing.object_id).exists():
                        raise CommandError("An owned movement record is missing; clean this seed before recreating it.")
                    skipped += 1
                    continue
                # A clearance is a transport authorization, not proof of arrival.
                # Both its journey and historical review are explicitly simulated.
                internal = sale.livestock_id is not None
                # External stock is inspected before the market sale; registered
                # stock is cleared after the approved sale. Neither asserts arrival.
                day = (max(sale.transfer_date, timezone.localdate(sale.reviewed_at), timezone.localdate(sale.created_at)) + timedelta(days=1)
                       if internal else sale.transfer_date - timedelta(days=1))
                if day >= timezone.localdate():
                    skipped += 1
                    continue
                if options["dry_run"]:
                    created += 1
                    continue
                owner = sale.previous_owner if internal else None
                name = (owner.user.get_full_name().strip() or owner.user.username) if owner else sale.external_seller_name
                origin = f"{owner.barangay.barangay_name}, Padre Garcia, Batangas" if owner and owner.barangay else "Padre Garcia, Batangas" if internal else ", ".join(filter(None, [sale.origin_municipality, sale.origin_province]))
                purpose, classification = movement_use(sale.pk)
                inspection = LivestockInspection.objects.create(
                    shipper=owner, shipper_name=name, destination=destination,
                    purpose=purpose, inspection_date=day, created_by=sale.created_by,
                )
                species = sale.livestock.livestock_type if internal else None
                if species is None:
                    species = LivestockType.objects.filter(name__iexact=sale.external_livestock_type).first()
                if species is None:
                    raise CommandError(f"No matching livestock type for sale #{sale.pk}.")
                LivestockInspectionItem.objects.create(
                    inspection=inspection, inventory=sale.livestock if internal else None,
                    livestock_type=species, quantity=1,
                    sex=sale.sex_at_transfer if sale.sex_at_transfer in {"MALE", "FEMALE"} else "MIXED",
                    classification=classification, remarks=f"{MARKER} Related sale #{sale.pk}; simulated transport authorization and purpose, not confirmed travel.",
                )
                clearance = LivestockInspectionClearance.objects.create(
                    inspection=inspection, control_number=f"PG-LIC-{day.year}-{sale.pk:08d}",
                    shipper_address=origin, origin=origin, status="APPROVED",
                    issued_by=mao_reviewer, reviewed_by=mao_reviewer,
                    reviewed_at=historical_time(day, 12), date_issued=day, time_issued=time(13),
                    review_remarks=f"{MARKER} Source sale #{sale.pk}. Simulated historical inspection, review and issuance; no real journey asserted.",
                )
                LivestockInspection.objects.filter(pk=inspection.pk).update(created_at=historical_time(day, 9))
                LivestockInspectionClearance.objects.filter(pk=clearance.pk).update(created_at=historical_time(day, 10))
                for suffix, kind, obj in (("inspection", "movement_inspection", inspection), ("clearance", "movement_clearance", clearance)):
                    SurveillanceDemoOwnership.objects.create(identifier=f"{key}:{suffix}", object_type=kind, object_id=obj.pk)
                created += 1
            self.stdout.write(self.style.SUCCESS(
                f"{'Would add' if options['dry_run'] else 'Added'} {created} related movement inspections and clearances; {skipped} skipped/existing. "
                f"Weekly registered/external sample over {len(weeks)} weeks; no animals or sale rows created or changed."
            ))

"""
Deterministic Seed Command for Livestock Pre-Movement Inspection & Clearance.

=============================================================================
EDUCATIONAL OVERVIEW & WORKFLOW COMPLIANCE:
=============================================================================
1. Inspection vs. Clearance Lifecycle:
   - LivestockInspection records the pre-transport animal welfare and health check.
   - Each inspection may contain multiple LivestockInspectionItem lines (some linked to
     registered farmer inventory, others aggregate commercial transport lines).
   - LivestockInspectionClearance is the official transport permit certificate.
   
2. Issuance Validation Constraint:
   The clearance model strictly enforces that `issued_by`, `date_issued`, and `time_issued`
   must ONLY be populated when `status == APPROVED`. Unapproved certificates must have null
   issuance fields so unverified permits cannot be counterfeited or misreported.

3. Cross-Join Aggregation Safety:
   One inspection can have multiple item lines. The seed creates inspections with 1 to 3 items
   to enable rigorous testing of descriptive queries without duplicate inspection counts.

4. Safe Clean:
   Carries the marker 'AI_SEED::ANALYTICS_TEST::INSPECTION::V1' in `shipper_name`.
   `--clean` safely removes clearances and inspections bearing this marker, leaving real data untouched.
"""

from datetime import date, time
from decimal import Decimal
import numpy as np

from django.core.management.base import BaseCommand
from django.utils import timezone

from movements.models import (
    LivestockInspection,
    LivestockInspectionItem,
    LivestockInspectionClearance,
)
from livestock.models import Farmer, LivestockInventory, LivestockType
from users.models import User
from analytics.seed_markers import SEED_MARKER_INSPECTION

DESTINATIONS = [
    "Padre Garcia Livestock Auction Market",
    "San Juan, Batangas",
    "Rosario Municipal Abattoir",
    "Lipa City Meat Processing",
    "Tanauan Commercial Feedlot",
]

SHIPPERS = [
    "Juan Dela Cruz",
    "Maria Santos",
    "Antonio Reyes",
    "Elena Bautista",
    "Ricardo Garcia",
    "Carmela Mendoza",
]


class Command(BaseCommand):
    help = (
        "Deterministically seeds or cleans synthetic livestock inspection and clearance records.\n"
        "Carries marker 'AI_SEED::ANALYTICS_TEST::INSPECTION::V1' in shipper_name.\n"
        "Use --clean to safely remove ONLY synthetic records without modifying real inspections."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--clean",
            action="store_true",
            help="Safely remove ONLY seeded synthetic inspection records.",
        )
        parser.add_argument(
            "--count",
            type=int,
            default=24,
            help="Number of synthetic inspections to generate (default: 24).",
        )

    def handle(self, *args, **options):
        if options["clean"]:
            self._handle_clean()
            return

        self._handle_seed(count=options["count"])

    def _handle_clean(self):
        seed_inspections = LivestockInspection.objects.filter(
            shipper_name__contains=SEED_MARKER_INSPECTION
        )
        insp_count = seed_inspections.count()

        if insp_count == 0:
            self.stdout.write(self.style.WARNING("No seeded synthetic inspection records found to clean."))
            return

        # LivestockInspectionClearance has on_delete=models.PROTECT, so clean clearances first
        clearances_qs = LivestockInspectionClearance.objects.filter(inspection__in=seed_inspections)
        clearances_count = clearances_qs.count()
        clearances_qs.delete()

        # Delete inspections (cascades to LivestockInspectionItem)
        deleted_count, _ = seed_inspections.delete()

        self.stdout.write(
            self.style.SUCCESS(
                f"Successfully removed {clearances_count} clearances and {insp_count} synthetic inspection records.\n"
                f"Real municipal inspections and official certificates were NOT modified."
            )
        )

    def _handle_seed(self, count: int):
        existing_count = LivestockInspection.objects.filter(
            shipper_name__contains=SEED_MARKER_INSPECTION
        ).count()
        if existing_count > 0:
            self.stdout.write(
                self.style.WARNING(
                    f"Found {existing_count} existing synthetic inspection records.\n"
                    f"Run 'python manage.py seed_inspections --clean' before re-seeding."
                )
            )
            return

        mao_user = (
            User.objects.filter(role__role_name__icontains="MAO").first()
            or User.objects.filter(is_superuser=True).first()
            or User.objects.first()
        )
        if not mao_user:
            self.stdout.write(self.style.ERROR("Cannot seed: No user account found in database."))
            return

        # Find registered farmers
        farmers = list(Farmer.objects.select_related("user").all()[:6])
        livestock_types = list(LivestockType.objects.all()[:4])
        if not livestock_types:
            cattle_type = LivestockType.objects.create(name="Cattle")
            livestock_types = [cattle_type]

        rng = np.random.RandomState(42)
        today = timezone.localdate()

        purposes = [
            LivestockInspection.PurposeType.SLAUGHTER,
            LivestockInspection.PurposeType.BREEDING,
            LivestockInspection.PurposeType.FATTENING,
            LivestockInspection.PurposeType.UNKNOWN,
        ]

        clearance_statuses = [
            LivestockInspectionClearance.StatusType.APPROVED,
            LivestockInspectionClearance.StatusType.APPROVED,
            LivestockInspectionClearance.StatusType.APPROVED,
            LivestockInspectionClearance.StatusType.VERIFIED,
            LivestockInspectionClearance.StatusType.PENDING,
            LivestockInspectionClearance.StatusType.SUBJECT_TO_REVISION,
        ]

        total_items_created = 0
        total_clearances_created = 0

        for i in range(count):
            shipper_farmer = farmers[i % len(farmers)] if farmers else None
            shipper_name_base = SHIPPERS[i % len(SHIPPERS)]
            shipper_name = f"{shipper_name_base} [{SEED_MARKER_INSPECTION}]"
            destination = DESTINATIONS[i % len(DESTINATIONS)]
            purpose = purposes[i % len(purposes)]

            # Spread dates over past 12 months
            month_offset = i % 12
            year = today.year - (month_offset // 12)
            month = today.month - (month_offset % 12)
            if month <= 0:
                month += 12
                year -= 1

            inspection_date = date(year, month, min(28, (i % 24) + 1))

            creator_user = (
                (shipper_farmer.user if (shipper_farmer and shipper_farmer.user) else None)
                or mao_user
            )

            inspection = LivestockInspection.objects.create(
                shipper=shipper_farmer,
                shipper_name=shipper_name,
                destination=destination,
                purpose=purpose,
                inspection_date=inspection_date,
                created_by=creator_user,
            )

            # Create 1 to 2 items per inspection to test multi-item aggregation
            num_items = 2 if (i % 3 == 0) else 1
            for item_idx in range(num_items):
                l_type = livestock_types[(i + item_idx) % len(livestock_types)]
                
                # Check if shipper has an approved active individual animal of matching type
                matching_animal = None
                if shipper_farmer and item_idx == 0:
                    matching_animal = LivestockInventory.objects.filter(
                        farmer=shipper_farmer,
                        livestock_type=l_type,
                        status="APPROVED",
                        operational_status="ACTIVE",
                        quantity=1,
                    ).first()

                if matching_animal:
                    item_qty = 1
                    item_sex = (
                        LivestockInspectionItem.SexType.FEMALE
                        if (i % 2 == 0)
                        else LivestockInspectionItem.SexType.MALE
                    )
                    inventory_fk = matching_animal
                else:
                    item_qty = int(rng.choice([2, 3, 5, 8]))
                    item_sex = LivestockInspectionItem.SexType.MIXED
                    inventory_fk = None

                classification = (
                    LivestockInspectionItem.ClassificationType.SLAUGHTER
                    if purpose == LivestockInspection.PurposeType.SLAUGHTER
                    else (
                        LivestockInspectionItem.ClassificationType.BREEDER
                        if purpose == LivestockInspection.PurposeType.BREEDING
                        else LivestockInspectionItem.ClassificationType.FATTENING
                    )
                )

                item = LivestockInspectionItem(
                    inspection=inspection,
                    livestock_type=l_type,
                    inventory=inventory_fk,
                    quantity=item_qty,
                    sex=item_sex,
                    classification=classification,
                    remarks=f"Inspected line item #{item_idx + 1} for pre-movement transit.",
                )
                item.save()
                total_items_created += 1

            # Create clearance certificate for most inspections (with realistic status mix)
            clearance_status = clearance_statuses[i % len(clearance_statuses)]
            control_num = f"CLR-TEST-{year}-{i+1:04d}"

            # Strict issuance rule enforcement:
            # ONLY populate issuance fields when status == APPROVED
            if clearance_status == LivestockInspectionClearance.StatusType.APPROVED:
                issued_by = mao_user
                date_issued = inspection_date
                time_issued = time(9, 30 + (i % 20))
            else:
                issued_by = None
                date_issued = None
                time_issued = None

            clearance = LivestockInspectionClearance(
                inspection=inspection,
                control_number=control_num,
                date_issued=date_issued,
                time_issued=time_issued,
                shipper_address="Padre Garcia, Batangas",
                origin="Padre Garcia Livestock Hub",
                vehicle_plate_number=f"ABC-{1000 + i}",
                livestock_handler_license_no=f"LHL-2026-{200 + i}",
                issued_by=issued_by,
                status=clearance_status,
                reviewed_by=mao_user if clearance_status != LivestockInspectionClearance.StatusType.PENDING else None,
                reviewed_at=timezone.now() if clearance_status != LivestockInspectionClearance.StatusType.PENDING else None,
                review_remarks=f"Synthetic inspection clearance test record ({clearance_status}).",
            )
            clearance.save()
            total_clearances_created += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"\nLivestock Inspection & Clearance seed complete!\n"
                f"---------------------------------------------------\n"
                f"  Inspections Seeded: {count}\n"
                f"  Item Lines Created: {total_items_created}\n"
                f"  Clearances Created: {total_clearances_created}\n"
                f"  Seed Marker:        {SEED_MARKER_INSPECTION}\n"
                f"---------------------------------------------------\n"
                f"To remove ONLY these synthetic test records:\n"
                f"  python manage.py seed_inspections --clean\n"
            )
        )

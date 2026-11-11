"""Create synthetic Manggas submissions for the assigned CBAT review queue."""

from datetime import timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from diseases.models import DiseaseCase, MortalityRecord
from livestock.models import Barangay, CensusSubmission, CensusSubmissionItem, Farmer, LivestockInventory, LivestockType
from production.models import CalvingRecord, CalvingRecordWorkflowEvent
from smartlivestock.seed_safety import assert_safe_seed_database
from smartlivestock.seed_tags import next_seed_livestock_tag
from users.models import User


MARKER = "[seed_manggas_pending_reviews:v1]"


class Command(BaseCommand):
    help = "Seed pending disease, mortality, calving/birth and quarterly census examples for Manggas CBAT."

    def add_arguments(self, parser):
        parser.add_argument("--reviewer", default="alexa.sibat")
        parser.add_argument("--farmers", type=int, default=3)
        parser.add_argument("--dry-run", action="store_true")

    @transaction.atomic
    def handle(self, *args, **options):
        assert_safe_seed_database(dry_run=options["dry_run"])
        if options["farmers"] < 2:
            raise CommandError("Choose at least two farmers.")
        barangay = Barangay.objects.filter(barangay_name__iexact="Manggas").first()
        reviewer = User.objects.filter(username__in=[options["reviewer"], options["reviewer"].replace(".", "_")], is_active=True).select_related("role").first()
        if not barangay or not reviewer:
            raise CommandError("Manggas and the selected active CBAT account must already exist.")
        if reviewer.role.role_name not in ("CBAT", "SIBAT") or reviewer.assigned_barangay_id != barangay.pk:
            raise CommandError("The selected CBAT/SIBAT account must be assigned to Manggas.")
        farmers = list(Farmer.objects.filter(
            barangay=barangay, user__is_active=True, user__role__role_name="FARMER",
            user__account_status=User.AccountStatus.APPROVED,
        ).select_related("user").order_by("pk")[:options["farmers"]])
        if len(farmers) < options["farmers"]:
            raise CommandError(f"Only {len(farmers)} active approved Manggas farmers are available.")
        cattle = LivestockType.objects.filter(name__iexact="Cattle").first()
        if not cattle:
            raise CommandError("Create the Cattle livestock type first.")
        if options["dry_run"]:
            self.stdout.write(f"Would seed three pending reports per farmer for {len(farmers)} Manggas farmers and a quarterly census where the period is available.")
            return
        today = timezone.localdate()
        created_reports = 0
        for index, farmer in enumerate(farmers):
            Farmer.objects.select_for_update().get(pk=farmer.pk)
            animals = {}
            for purpose in ("disease", "mortality", "dam"):
                key = f"{MARKER} farmer={farmer.pk} purpose={purpose}"
                animal = LivestockInventory.objects.filter(farmer=farmer, review_remarks=key).first()
                if animal is None:
                    animal = LivestockInventory.objects.create(
                        farmer=farmer, livestock_type=cattle,
                        tag_number=next_seed_livestock_tag(self, farmer.user),
                        entry_type="INDIVIDUAL", quantity=1, breed="Native Cross", sex="Female",
                        birth_date=today - timedelta(days=4 * 365), weight=Decimal("350"),
                        status="APPROVED", operational_status="ACTIVE", created_by=farmer.user,
                        review_remarks=key,
                    )
                animals[purpose] = animal
            day = today - timedelta(days=index)
            _, created = DiseaseCase.objects.get_or_create(
                livestock=animals["disease"],
                defaults=dict(name="Reported illness", record_date=day, affected_count=1, status="PENDING", clinical_status="OPEN", created_by=farmer.user),
            )
            DiseaseCase.objects.filter(livestock=animals["disease"], name__startswith=MARKER).update(name="Reported illness")
            created_reports += created
            mortality, created = MortalityRecord.objects.get_or_create(
                livestock=animals["mortality"],
                defaults=dict(cause="Farmer reports sudden death; cause awaiting field verification.", record_date=day, death_count=1, status="PENDING", created_by=farmer.user),
            )
            MortalityRecord.objects.filter(pk=mortality.pk, cause__startswith=MARKER).update(cause="Farmer reports sudden death; cause awaiting field verification.")
            if created:
                mortality.affected_livestock.add(animals["mortality"])
            created_reports += created
            calving, created = CalvingRecord.objects.get_or_create(
                dam=animals["dam"],
                defaults=dict(notes="Birth reported by farmer; awaiting CBAT verification.", calving_date=day, calf_sex="FEMALE", birth_weight=Decimal("28"), breed="Native Cross", status="PENDING", created_by=farmer.user),
            )
            CalvingRecord.objects.filter(pk=calving.pk, notes__startswith=MARKER).update(notes="Birth reported by farmer; awaiting CBAT verification.")
            if created:
                CalvingRecordWorkflowEvent.objects.create(
                    calving_record=calving, event_type="SUBMITTED", to_status="PENDING",
                    actor=farmer.user, remarks=MARKER,
                )
            created_reports += created
        census = CensusSubmission.objects.filter(barangay=barangay, remarks=MARKER).first()
        if census is None:
            quarter_index = today.year * 4 + (today.month - 1) // 3
            for offset in range(8):
                year, quarter = divmod(quarter_index - offset, 4)
                if CensusSubmission.objects.filter(barangay=barangay, report_year=year, report_quarter=quarter + 1).exists():
                    continue
                census = CensusSubmission.objects.create(
                    barangay=barangay, report_year=year, report_quarter=quarter + 1,
                    submitted_by=reviewer, status="PENDING", remarks=MARKER,
                )
                for farmer in farmers:
                    CensusSubmissionItem.objects.create(
                        census_submission=census, farmer=farmer, livestock_type=cattle,
                        number_of_heads=3, remarks=f"{MARKER} Synthetic farmer count.",
                    )
                break
        self.stdout.write(self.style.SUCCESS(f"Created {created_reports} pending reports for {len(farmers)} Manggas farmers. Assigned reviewer: {reviewer.username}."))
        if census:
            self.stdout.write(f"Demo census: Q{census.report_quarter} {census.report_year}, status {census.status}.")
        else:
            self.stdout.write(self.style.WARNING("All eight recent census quarters are occupied. Existing submissions were preserved."))

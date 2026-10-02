from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from .models import CensusSubmission, CensusSubmissionItem, Barangay
from smartlivestock.workflows import role_name, validate_review_transition


class CensusService:
    @staticmethod
    @transaction.atomic
    def create_census_submission(
        *,
        user,
        barangay,
        report_year,
        report_quarter,
        remarks="",
        items=None,  # items = the CensusSubmissionItems.
    ):
        """
        Business Logic
        1. Check if a census for this barangay already exists
        2. Create the CensusSubmission header
        3. Create all child CensusSubmissionItem in one atomic transaction
        """

        if role_name(user) != "SIBAT" or user.assigned_barangay_id != barangay.pk:
            raise ValidationError({"barangay": "Submit census only for your assigned barangay."})
        if any(item["farmer"].barangay_id != barangay.pk for item in (items or [])):
            raise ValidationError({"items": "Every census farmer must belong to the submission barangay."})

        # prevent dupes
        already_submitted = CensusSubmission.objects.filter(
            barangay=barangay,  # checks if barangay alr exists
            report_year=report_year,  # and so on
            report_quarter=report_quarter,
        ).exists()  # .exists() returns boolean

        if already_submitted:
            raise ValidationError(  # used raise because it treats it as an error and stop operations, if i put return then it treats it as data return.
                {
                    "error": f"Census for {barangay.barangay_name} Q{report_quarter} {report_year} has already been submitted."
                }
            )

        submission = CensusSubmission.objects.create(
            submitted_by=user,
            barangay=barangay,
            report_year=report_year,
            report_quarter=report_quarter,
            remarks=remarks,
            status=CensusSubmission.StatusType.VERIFIED,
        )

        if items:
            for item in items:  # for each item create a object submissionitem
                CensusSubmissionItem.objects.create(
                    census_submission=submission,  # get the fk of submission
                    farmer=item["farmer"],
                    livestock_type=item["livestock_type"],
                    number_of_heads=item["number_of_heads"],
                    remarks=item["remarks"],
                )

        return submission

    @staticmethod
    @transaction.atomic
    def review_census_submission(*, submission_id, reviewer, new_status, remarks=""):
        """
        Handles approval
        """

        try:
            """
            select_for_update() -> lock this operation so that others cant modify 
            good if concurrent transactions were happening.
            """
            submission = CensusSubmission.objects.select_for_update().get(
                id=submission_id
            )
        except CensusSubmission.DoesNotExist:
            raise ValidationError({"error": "Census Submission not found."})

        reviewer_role = role_name(reviewer)
        validate_review_transition(
            domain="census",
            role=reviewer_role,
            current=submission.status,
            target=new_status,
            remarks=remarks,
        )
        submission.status = new_status
        submission.reviewed_by = reviewer
        submission.review_remarks = remarks
        submission.reviewed_at = timezone.now()
        submission.save(
            update_fields=[
                "status",
                "reviewed_by",
                "review_remarks",
                "reviewed_at",
            ]
        )

        return submission

    @staticmethod
    @transaction.atomic
    def revise_census_submission(*, submission, validated_data):
        submission = CensusSubmission.objects.select_for_update().get(pk=submission.pk)
        if submission.status not in {"PENDING", "VERIFIED", "SUBJECT_TO_REVISION"}:
            raise ValidationError({"status": "An approved census snapshot is immutable."})
        barangay = validated_data.get("barangay", submission.barangay)
        if submission.submitted_by.assigned_barangay_id != barangay.pk:
            raise ValidationError({"barangay": "Census must remain in the submitting officer's assigned barangay."})
        checked_items = validated_data.get("items")
        if checked_items is None:
            if submission.items.exclude(farmer__barangay=barangay).exists():
                raise ValidationError({"items": "Census farmers must belong to the submission barangay."})
        elif any(item["farmer"].barangay_id != barangay.pk for item in checked_items):
            raise ValidationError({"items": "Census farmers must belong to the submission barangay."})
        items = validated_data.pop("items", None)
        for field in ("barangay", "report_year", "report_quarter", "remarks"):
            if field in validated_data:
                setattr(submission, field, validated_data[field])

        if items is not None:
            submission.items.all().delete()
            CensusSubmissionItem.objects.bulk_create(
                [
                    CensusSubmissionItem(census_submission=submission, **item)
                    for item in items
                ]
            )

        if submission.status == CensusSubmission.StatusType.SUBJECT_TO_REVISION:
            submission.status = CensusSubmission.StatusType.VERIFIED
            submission.reviewed_by = None
            submission.reviewed_at = None

        submission.save()
        return submission

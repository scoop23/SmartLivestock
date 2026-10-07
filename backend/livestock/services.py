from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from .models import CensusSubmission, CensusSubmissionItem, Barangay
from smartlivestock.workflows import role_name, validate_review_transition, has_all_barangay_access


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
        1. Check if a census for this barangay and reporting quarter already exists
        2. Create the CensusSubmission header
        3. Create all child CensusSubmissionItem in one atomic transaction
        """

        if role_name(user) != "SIBAT" or (not has_all_barangay_access(user) and user.assigned_barangay_id != barangay.pk):
            raise ValidationError({"barangay": "Submit census only for your assigned barangay."})
        if any(item["farmer"].barangay_id != barangay.pk for item in (items or [])):
            raise ValidationError({"items": "Every census farmer must belong to the submission barangay."})

        period_censuses = CensusSubmission.objects.filter(
            barangay=barangay,
            report_year=report_year,
            report_quarter=report_quarter,
        )

        def duplicate_period_error():
            return ValidationError({
                "error": (
                    f"A census for {barangay.barangay_name} Q{report_quarter} "
                    f"{report_year} already exists for this census period."
                )
            })

        if period_censuses.exists():
            raise duplicate_period_error()

        try:
            # The database constraint closes the race where two SIBAT users
            # submit the same barangay-period at nearly the same time.
            with transaction.atomic():
                submission = CensusSubmission.objects.create(
                    submitted_by=user,
                    barangay=barangay,
                    report_year=report_year,
                    report_quarter=report_quarter,
                    remarks=remarks,
                    status=CensusSubmission.StatusType.VERIFIED,
                )
        except IntegrityError:
            if period_censuses.exists():
                raise duplicate_period_error()
            raise

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
        if not has_all_barangay_access(submission.submitted_by) and submission.submitted_by.assigned_barangay_id != barangay.pk:
            raise ValidationError({"barangay": "Census must remain in the submitting officer's assigned barangay."})
        report_year = validated_data.get("report_year", submission.report_year)
        report_quarter = validated_data.get("report_quarter", submission.report_quarter)
        if CensusSubmission.objects.filter(
            barangay=barangay,
            report_year=report_year,
            report_quarter=report_quarter,
        ).exclude(pk=submission.pk).exists():
            raise ValidationError({
                "error": (
                    f"A census for {barangay.barangay_name} Q{report_quarter} "
                    f"{report_year} already exists for this census period."
                )
            })
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

        try:
            with transaction.atomic():
                submission.save()
        except IntegrityError:
            duplicate_period = CensusSubmission.objects.filter(
                barangay=barangay,
                report_year=report_year,
                report_quarter=report_quarter,
            ).exclude(pk=submission.pk).exists()
            if duplicate_period:
                raise ValidationError({
                    "error": (
                        f"A census for {barangay.barangay_name} Q{report_quarter} "
                        f"{report_year} already exists for this census period."
                    )
                })
            raise
        return submission

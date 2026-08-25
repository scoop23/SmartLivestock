from re import sub
from django.db import transaction
from django.urls import exceptions
from rest_framework.exceptions import ValidationError
from .models import CensusSubmission, CensusSubmissionItem, Barangay


class CensusService:
    @staticmethod
    @transaction.atomic
    def create_census_submission(
        *,
        user,
        barangay,
        report_year,
        report_quarter,
        items=None,  # items = the CensusSubmissionItems.
    ):
        """
        Business Logic
        1. Check if a census for this barangay already exists
        2. Create the CensusSubmission header
        3. Create all child CensusSubmissionItem in one atomic transaction
        """

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
            status=CensusSubmission.StatusType.PENDING,
        )

        if items:
            for item in items:  # for each item create a object submissionitem
                CensusSubmissionItem.objects.create(
                    census_submission=submission,  # get the fk of submission
                    farmer=item["farmer"],
                    livestock_type=item["livestock_type"],
                    number_of_heads=item["number_of_heads"],
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

        submission.status = new_status
        submission.reviewed_by = reviewer
        submission.review_remarks = remarks
        submission.save()

        return submission

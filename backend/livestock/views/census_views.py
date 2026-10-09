from django.db import transaction
from smartlivestock.workflows import scope_reviewer_queryset
from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework.exceptions import PermissionDenied

from livestock.serializer import CensusSubmissionSerializer
from livestock.models import CensusSubmission
from livestock.services import CensusService
from livestock.permission import isSibat, isMAO
from smartlivestock.workflows import require_action
from users.models import Notification
from users.notification_views import create_notification, notify_role


MAO_CENSUS_LINK = "/data-validation?domain=census"
SIBAT_CENSUS_LINK = "/sibat?tab=census"


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated, isSibat | isMAO])
def census_list_create(request):
    """
    GET  /api/livestock/census/ -> List all quarterly census submissions
    POST /api/livestock/census/ -> Submit a new quarterly census batch
    """
    if request.method == "POST":
        require_action(request.user, "census", "create")
        serializer = CensusSubmissionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        validated_data = serializer.validated_data
        assert isinstance(validated_data, dict)

        submission = CensusService.create_census_submission(
            user=request.user,
            barangay=validated_data["barangay"],
            report_year=validated_data["report_year"],
            report_quarter=validated_data["report_quarter"],
            remarks=validated_data.get("remarks", ""),
            items=validated_data.get("items", []),
        )

        notify_role(
            role_name="MAO",
            notification_type=Notification.NotificationType.GENERAL,
            priority=Notification.Priority.MEDIUM,
            title="Census Submission Awaiting MAO Approval",
            message=(
                f"{submission.submitted_by.get_full_name() or submission.submitted_by.username} "
                f"submitted the {submission.barangay.barangay_name} "
                f"Q{submission.report_quarter} {submission.report_year} livestock census."
            ),
            link=f"/data-validation?domain=census&recordType=CENSUS&recordId={submission.pk}",
            related_entity_type="census_submission",
            related_entity_id=submission.pk,
        )

        response_serializer = CensusSubmissionSerializer(submission)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)

    # GET
    require_action(request.user, "census", "read_all")
    submissions = (
        CensusSubmission.objects.select_related(
            "barangay", "submitted_by", "reviewed_by"
        )
        .prefetch_related("items__farmer__user", "items__livestock_type")
        .order_by("-created_at", "-submission_date")
    )

    submissions = scope_reviewer_queryset(submissions, request.user)
    serializer = CensusSubmissionSerializer(submissions, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(["GET", "PUT", "PATCH"])
@permission_classes([IsAuthenticated, isSibat | isMAO])
@transaction.atomic
def census_detail(request, pk):
    """
    GET       /api/livestock/census/<id>/ -> Retrieve single census submission
    PUT/PATCH /api/livestock/census/<id>/ -> Update census submission header/remarks
    """
    census = get_object_or_404(
        scope_reviewer_queryset(CensusSubmission.objects.select_for_update(of=("self",)).select_related("barangay", "submitted_by", "reviewed_by")
        .prefetch_related("items__farmer__user", "items__livestock_type"), request.user),
        pk=pk,
    )

    if request.method in ["PUT", "PATCH"]:
        require_action(request.user, "census", "edit_own")
        if census.submitted_by_id != request.user.id:
            raise PermissionDenied("SIBAT users may only revise census submissions they created.")
        if census.status not in {
            CensusSubmission.StatusType.PENDING,
            CensusSubmission.StatusType.VERIFIED,
            CensusSubmission.StatusType.SUBJECT_TO_REVISION,
        }:
            return Response(
                {"error": "Only VERIFIED or SUBJECT_TO_REVISION census submissions can be changed."},
                status=status.HTTP_409_CONFLICT,
            )

        serializer = CensusSubmissionSerializer(
            census,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        was_returned = census.status == CensusSubmission.StatusType.SUBJECT_TO_REVISION
        census = CensusService.revise_census_submission(
            submission=census,
            validated_data=dict(serializer.validated_data),
        )
        if was_returned:
            notify_role(
                role_name="MAO",
                notification_type=Notification.NotificationType.GENERAL,
                priority=Notification.Priority.MEDIUM,
                title="Census Submission Resubmitted",
                message=(
                    f"{census.submitted_by.get_full_name() or census.submitted_by.username} "
                    f"corrected and resubmitted the {census.barangay.barangay_name} "
                    f"Q{census.report_quarter} {census.report_year} livestock census."
                ),
                link=f"/data-validation?domain=census&recordType=CENSUS&recordId={census.pk}",
                related_entity_type="census_submission",
                related_entity_id=census.pk,
            )
        return Response(CensusSubmissionSerializer(census).data, status=status.HTTP_200_OK)

    # GET
    require_action(request.user, "census", "read_all")
    serializer = CensusSubmissionSerializer(census)
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([IsAuthenticated, isMAO])
def review_census_submission(request, pk):
    """
    POST /api/livestock/census/<id>/review/
    MAO official review action (APPROVE / REJECT)
    """
    new_status = request.data.get("status")
    remarks = request.data.get("remarks", "")

    if not new_status:
        return Response(
            {"error": "status is required (APPROVED or SUBJECT_TO_REVISION)."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    require_action(request.user, "census", "review")
    submission = CensusService.review_census_submission(
        submission_id=pk,
        reviewer=request.user,
        new_status=new_status,
        remarks=remarks,
    )

    census_label = (
        f"{submission.barangay.barangay_name} "
        f"Q{submission.report_quarter} {submission.report_year} livestock census"
    )
    if new_status == CensusSubmission.StatusType.APPROVED:
        create_notification(
            user=submission.submitted_by,
            notification_type=Notification.NotificationType.GENERAL,
            priority=Notification.Priority.MEDIUM,
            title="Census Submission Approved by MAO",
            message=(
                f"MAO approved the {census_label}."
                f"{f' Remarks: {remarks}' if remarks else ''}"
            ),
            link=SIBAT_CENSUS_LINK,
        )
    elif new_status == CensusSubmission.StatusType.SUBJECT_TO_REVISION:
        create_notification(
            user=submission.submitted_by,
            notification_type=Notification.NotificationType.GENERAL,
            priority=Notification.Priority.HIGH,
            title="Revision Required on Census Submission",
            message=f"The {census_label} requires revision. Remarks: {remarks}",
            link=SIBAT_CENSUS_LINK,
        )

    return Response(CensusSubmissionSerializer(submission).data, status=status.HTTP_200_OK)

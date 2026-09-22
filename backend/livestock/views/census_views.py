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


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated, isSibat | isMAO])
def census_list_create(request):
    """
    GET  /api/livestock/census/ -> List all quarterly census submissions
    POST /api/livestock/census/ -> Submit a new quarterly census batch
    """
    if request.method == "POST":
        if not isSibat().has_permission(request, census_list_create):
            raise PermissionDenied("Only Sibat cooperative staff can submit census batches.")
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

        response_serializer = CensusSubmissionSerializer(submission)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)

    # GET
    submissions = (
        CensusSubmission.objects.select_related(
            "barangay", "submitted_by", "reviewed_by"
        )
        .prefetch_related("items__farmer__user", "items__livestock_type")
        .order_by("-created_at", "-submission_date")
    )

    serializer = CensusSubmissionSerializer(submissions, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(["GET", "PUT", "PATCH"])
@permission_classes([IsAuthenticated, isSibat | isMAO])
def census_detail(request, pk):
    """
    GET       /api/livestock/census/<id>/ -> Retrieve single census submission
    PUT/PATCH /api/livestock/census/<id>/ -> Update census submission header/remarks
    """
    census = get_object_or_404(
        CensusSubmission.objects.select_related("barangay", "submitted_by", "reviewed_by")
        .prefetch_related("items__farmer__user", "items__livestock_type"),
        pk=pk,
    )

    if request.method in ["PUT", "PATCH"]:
        if census.status == CensusSubmission.StatusType.APPROVED:
            return Response(
                {"error": "Cannot modify a census submission that has already been approved."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = CensusSubmissionSerializer(
            census,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)

    # GET
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

    submission = CensusService.review_census_submission(
        submission_id=pk,
        reviewer=request.user,
        new_status=new_status,
        remarks=remarks,
    )

    return Response(CensusSubmissionSerializer(submission).data, status=status.HTTP_200_OK)

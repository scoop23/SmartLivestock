from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework.exceptions import PermissionDenied

from .models import DiseaseCase, MortalityRecord
from .serializer import DiseaseCaseSerializer, MortalityRecordSerializer


# ==============================================================================
# DISEASE CASE ENDPOINTS
# ==============================================================================

@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def disease_case_list_create(request):
    """
    GET  /diseases/cases/ -> List disease cases (filtered by role)
    POST /diseases/cases/ -> Submit a new disease case report
    """
    if request.method == "POST":
        serializer = DiseaseCaseSerializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    # GET
    user = request.user
    role_name = getattr(getattr(user, "role", None), "role_name", None)

    if role_name == "FARMER":
        records = DiseaseCase.objects.filter(created_by=user)
    else:
        # MAO, SIBAT: list all municipal disease cases
        records = DiseaseCase.objects.all()

    # Apply optional query param filters
    status_param = request.query_params.get("status")
    if status_param and status_param.upper() != "ALL":
        records = records.filter(status__iexact=status_param)

    livestock_param = request.query_params.get("livestock")
    if livestock_param:
        records = records.filter(livestock_id=livestock_param)

    records = records.select_related(
        "livestock__farmer__user",
        "livestock__farmer__barangay",
        "livestock__livestock_type",
        "created_by",
        "reviewed_by",
    ).order_by("-record_date", "-created_at")

    serializer = DiseaseCaseSerializer(records, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(["GET", "PUT", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def disease_case_detail(request, pk):
    """
    GET    /diseases/cases/<pk>/ -> Retrieve single disease case
    PUT    /diseases/cases/<pk>/ -> Full update
    PATCH  /diseases/cases/<pk>/ -> Partial update
    DELETE /diseases/cases/<pk>/ -> Delete case (only PENDING allowed)
    """
    user = request.user
    role_name = getattr(getattr(user, "role", None), "role_name", None)

    if role_name == "FARMER":
        record = get_object_or_404(DiseaseCase, pk=pk, created_by=user)
    else:
        record = get_object_or_404(DiseaseCase, pk=pk)

    if request.method == "DELETE":
        if record.status != DiseaseCase.DiseaseStatus.PENDING:
            return Response(
                {
                    "error": f"Cannot delete a disease case with status '{record.status}'. "
                    "Only PENDING records can be deleted."
                },
                status=status.HTTP_403_FORBIDDEN,
            )
        record.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    if request.method in ["PUT", "PATCH"]:
        if record.status == DiseaseCase.DiseaseStatus.APPROVED:
            return Response(
                {"error": "Cannot modify a disease case that has already been approved."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = DiseaseCaseSerializer(
            record,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)

    # GET
    serializer = DiseaseCaseSerializer(record)
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def review_disease_case(request, pk):
    """
    POST /diseases/cases/<pk>/review/
    Review and update the status of a disease case:
    - SIBAT: Can verify (status = VERIFIED)
    - MAO: Final municipal approval (status = APPROVED or REJECTED)
    """
    record = get_object_or_404(DiseaseCase, pk=pk)
    new_status = request.data.get("status")
    remarks = request.data.get("remarks", "")

    if not new_status:
        return Response(
            {"error": "status is required (VERIFIED, APPROVED, or REJECTED)."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user = request.user
    role_name = getattr(getattr(user, "role", None), "role_name", "")

    if role_name == "FARMER":
        raise PermissionDenied("Farmers are not authorized to review disease cases.")

    if role_name == "SIBAT":
        if new_status == DiseaseCase.DiseaseStatus.APPROVED:
            raise PermissionDenied(
                "SIBAT cooperative officers can only verify (status=VERIFIED). Final approval is reserved for MAO."
            )
        if new_status not in [DiseaseCase.DiseaseStatus.VERIFIED, DiseaseCase.DiseaseStatus.REJECTED]:
            return Response(
                {"error": "Invalid status for SIBAT review. Valid choices are VERIFIED or REJECTED."},
                status=status.HTTP_400_BAD_REQUEST,
            )
    elif role_name == "MAO":
        if new_status not in DiseaseCase.DiseaseStatus.values:
            return Response(
                {"error": f"Invalid status '{new_status}'. Valid choices are: {list(DiseaseCase.DiseaseStatus.values)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )
    else:
        raise PermissionDenied("You do not have permission to review disease cases.")

    record.status = new_status
    record.reviewed_by = user
    record.review_remarks = remarks
    record.reviewed_at = timezone.now()
    record.save()

    serializer = DiseaseCaseSerializer(record)
    return Response(serializer.data, status=status.HTTP_200_OK)


# ==============================================================================
# MORTALITY RECORD ENDPOINTS
# ==============================================================================

@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def mortality_record_list_create(request):
    """
    GET  /diseases/mortality/ -> List mortality records (filtered by role)
    POST /diseases/mortality/ -> Log a new livestock mortality record
    """
    if request.method == "POST":
        serializer = MortalityRecordSerializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    # GET
    user = request.user
    role_name = getattr(getattr(user, "role", None), "role_name", None)

    if role_name == "FARMER":
        records = MortalityRecord.objects.filter(created_by=user)
    else:
        # MAO, SIBAT: list all municipal mortality records
        records = MortalityRecord.objects.all()

    # Apply optional query param filters
    status_param = request.query_params.get("status")
    if status_param and status_param.upper() != "ALL":
        records = records.filter(status__iexact=status_param)

    livestock_param = request.query_params.get("livestock")
    if livestock_param:
        records = records.filter(livestock_id=livestock_param)

    disease_param = request.query_params.get("disease_case")
    if disease_param:
        records = records.filter(source_disease_case_id=disease_param)

    records = records.select_related(
        "livestock__farmer__user",
        "livestock__farmer__barangay",
        "livestock__livestock_type",
        "source_disease_case",
        "created_by",
        "reviewed_by",
    ).order_by("-record_date", "-created_at")

    serializer = MortalityRecordSerializer(records, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(["GET", "PUT", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def mortality_record_detail(request, pk):
    """
    GET    /diseases/mortality/<pk>/ -> Retrieve single mortality record
    PUT    /diseases/mortality/<pk>/ -> Full update
    PATCH  /diseases/mortality/<pk>/ -> Partial update
    DELETE /diseases/mortality/<pk>/ -> Delete record (only PENDING allowed)
    """
    user = request.user
    role_name = getattr(getattr(user, "role", None), "role_name", None)

    if role_name == "FARMER":
        record = get_object_or_404(MortalityRecord, pk=pk, created_by=user)
    else:
        record = get_object_or_404(MortalityRecord, pk=pk)

    if request.method == "DELETE":
        if record.status != MortalityRecord.MortalityRecordStatus.PENDING:
            return Response(
                {
                    "error": f"Cannot delete a mortality record with status '{record.status}'. "
                    "Only PENDING records can be deleted."
                },
                status=status.HTTP_403_FORBIDDEN,
            )
        record.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    if request.method in ["PUT", "PATCH"]:
        if record.status == MortalityRecord.MortalityRecordStatus.APPROVED:
            return Response(
                {"error": "Cannot modify a mortality record that has already been approved."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = MortalityRecordSerializer(
            record,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)

    # GET
    serializer = MortalityRecordSerializer(record)
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def review_mortality_record(request, pk):
    """
    POST /diseases/mortality/<pk>/review/
    Review and update the status of a mortality record:
    - SIBAT: Can verify on-farm (status = VERIFIED)
    - MAO: Final municipal approval (status = APPROVED or REJECTED)
    """
    record = get_object_or_404(MortalityRecord, pk=pk)
    new_status = request.data.get("status")
    remarks = request.data.get("remarks", "")

    if not new_status:
        return Response(
            {"error": "status is required (VERIFIED, APPROVED, or REJECTED)."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user = request.user
    role_name = getattr(getattr(user, "role", None), "role_name", "")

    if role_name == "FARMER":
        raise PermissionDenied("Farmers are not authorized to review mortality records.")

    if role_name == "SIBAT":
        if new_status == MortalityRecord.MortalityRecordStatus.APPROVED:
            raise PermissionDenied(
                "SIBAT cooperative officers can only verify (status=VERIFIED). Final approval is reserved for MAO."
            )
        if new_status not in [MortalityRecord.MortalityRecordStatus.VERIFIED, MortalityRecord.MortalityRecordStatus.REJECTED]:
            return Response(
                {"error": "Invalid status for SIBAT review. Valid choices are VERIFIED or REJECTED."},
                status=status.HTTP_400_BAD_REQUEST,
            )
    elif role_name == "MAO":
        if new_status not in MortalityRecord.MortalityRecordStatus.values:
            return Response(
                {"error": f"Invalid status '{new_status}'. Valid choices are: {list(MortalityRecord.MortalityRecordStatus.values)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )
    else:
        raise PermissionDenied("You do not have permission to review mortality records.")

    record.status = new_status
    record.reviewed_by = user
    record.review_remarks = remarks
    record.reviewed_at = timezone.now()
    record.save()

    serializer = MortalityRecordSerializer(record)
    return Response(serializer.data, status=status.HTTP_200_OK)

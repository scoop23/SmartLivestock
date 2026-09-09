from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from .models import ProductionRecord
from .serializer import ProductionRecordSerializer


@api_view(["GET", "POST"])
def production_record_list_create(request):
    """
    GET  /production/records/ -> List production records (filtered by user/role)
    POST /production/records/ -> Create a new production record
    """
    if request.method == "POST":
        serializer = ProductionRecordSerializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=201)

    # GET
    user = request.user
    role_name = getattr(getattr(user, "role", None), "role_name", None)

    if role_name == "FARMER":
        records = ProductionRecord.objects.filter(created_by=user)
    else:
        # MAO, SIBAT, ADMIN: list all records
        records = ProductionRecord.objects.all()

    records = records.select_related(
        "livestock__farmer__user",
        "livestock__farmer__barangay",
        "livestock__livestock_type",
        "created_by",
        "reviewed_by",
    ).order_by("-record_date", "-created_at")

    serializer = ProductionRecordSerializer(records, many=True)
    return Response(serializer.data, status=200)


@api_view(["GET", "PUT", "PATCH", "DELETE"])
def production_record_detail(request, pk):
    """
    GET    /production/records/<pk>/ -> Retrieve single production record
    PUT    /production/records/<pk>/ -> Full update
    PATCH  /production/records/<pk>/ -> Partial update
    DELETE /production/records/<pk>/ -> Delete record (only PENDING allowed)
    """
    user = request.user
    role_name = getattr(getattr(user, "role", None), "role_name", None)

    if role_name == "FARMER":
        record = get_object_or_404(ProductionRecord, pk=pk, created_by=user)
    else:
        record = get_object_or_404(ProductionRecord, pk=pk)

    if request.method == "DELETE":
        if record.status != ProductionRecord.ProductionStatus.PENDING:
            return Response(
                {
                    "error": f"Cannot delete a production record with status '{record.status}'. "
                    "Only PENDING records can be deleted."
                },
                status=status.HTTP_403_FORBIDDEN,
            )
        record.delete()
        return Response(status=204)

    if request.method in ["PUT", "PATCH"]:
        serializer = ProductionRecordSerializer(
            record,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=200)

    # GET
    serializer = ProductionRecordSerializer(record)
    return Response(serializer.data, status=200)


@api_view(["POST"])
def review_production_record(request, pk):
    """
    POST /production/records/<pk>/review/
    Official MAO verification action (APPROVE / REJECT)
    """
    record = get_object_or_404(ProductionRecord, pk=pk)
    new_status = request.data.get("status")
    remarks = request.data.get("remarks", "")

    if not new_status:
        return Response(
            {"error": "status is required (APPROVED or REJECTED)."},
            status=400,
        )

    record.status = new_status
    record.reviewed_by = request.user
    record.review_remarks = remarks
    record.reviewed_at = timezone.now()
    record.save()

    serializer = ProductionRecordSerializer(record)
    return Response(serializer.data, status=200)

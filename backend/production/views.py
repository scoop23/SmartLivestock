from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from .models import ProductionRecord,LiveAnimalSale,SlaughterRecord, WeightRecord, CalvingRecord,AnimalDisposition
from .serializer import ProductionRecordSerializer, LiveAnimalSaleSerializer, AnimalDispositionSerializer, WeightRecordSerializer, CalvingRecordSerializer


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


# ===========================================================================
# Live Animal Sales Endpoints
# ===========================================================================
@api_view(["GET", "POST"])
def live_animal_sales_list_create(request):
    """
    GET  /production/sales/ -> List live animal sales
    POST /production/sales/ -> Record a live cattle/animal sale
    """
    if request.method == "POST":
        serializer = LiveAnimalSaleSerializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=201)

    user = request.user
    role_name = getattr(getattr(user, "role", None), "role_name", None)

    if role_name == "FARMER":
        sales = LiveAnimalSale.objects.filter(created_by=user)
    else:
        sales = LiveAnimalSale.objects.all()

    sales = sales.select_related(
        "livestock__farmer__user",
        "livestock__livestock_type",
        "created_by",
        "reviewed_by",
    ).order_by("-sale_date", "-created_at")

    serializer = LiveAnimalSaleSerializer(sales, many=True)
    return Response(serializer.data, status=200)


@api_view(["DELETE"])
def live_animal_sale_delete(request, pk):
    """
    DELETE /production/sales/<pk>/ -> Delete pending sale record
    """
    user = request.user
    role_name = getattr(getattr(user, "role", None), "role_name", None)

    if role_name == "FARMER":
        sale = get_object_or_404(LiveAnimalSale, pk=pk, created_by=user)
    else:
        sale = get_object_or_404(LiveAnimalSale, pk=pk)

    if sale.status != LiveAnimalSale.StatusType.PENDING:
        return Response(
            {"error": "Only PENDING sale records can be deleted."},
            status=status.HTTP_403_FORBIDDEN,
        )
    sale.delete()
    return Response(status=204)


# ===========================================================================
# Weight & Growth Records Endpoints
# ===========================================================================
@api_view(["GET", "POST"])
def weight_records_list_create(request):
    """
    GET  /production/weights/ -> List weight logs
    POST /production/weights/ -> Log new weight for an animal
    """
    if request.method == "POST":
        serializer = WeightRecordSerializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=201)

    user = request.user
    role_name = getattr(getattr(user, "role", None), "role_name", None)

    if role_name == "FARMER":
        records = WeightRecord.objects.filter(created_by=user)
    else:
        records = WeightRecord.objects.all()

    records = records.select_related(
        "livestock__livestock_type",
        "created_by",
    ).order_by("-weighing_date", "-created_at")

    serializer = WeightRecordSerializer(records, many=True)
    return Response(serializer.data, status=200)


# ===========================================================================
# Calving & Birth Registry Endpoints
# ===========================================================================
@api_view(["GET", "POST"])
def calving_records_list_create(request):
    """
    GET  /production/calving/ -> List calving & birth records
    POST /production/calving/ -> Record a new calf birth
    """
    if request.method == "POST":
        serializer = CalvingRecordSerializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=201)

    user = request.user
    role_name = getattr(getattr(user, "role", None), "role_name", None)

    if role_name == "FARMER":
        records = CalvingRecord.objects.filter(created_by=user)
    else:
        records = CalvingRecord.objects.all()

    records = records.select_related(
        "dam__livestock_type",
        "created_by",
    ).order_by("-calving_date", "-created_at")

    serializer = CalvingRecordSerializer(records, many=True)
    return Response(serializer.data, status=200)


# ===========================================================================
# Animal Disposition Intent Endpoints
# ===========================================================================
@api_view(["GET", "POST"])
def animal_disposition_list_create(request):
    """
    GET  /production/dispositions/ -> List intent declarations
    POST /production/dispositions/ -> Declare intent (For Sale, For Slaughter, Movement)
    """
    if request.method == "POST":
        serializer = AnimalDispositionSerializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=201)

    user = request.user
    role_name = getattr(getattr(user, "role", None), "role_name", None)

    if role_name == "FARMER":
        records = AnimalDisposition.objects.filter(created_by=user)
    else:
        records = AnimalDisposition.objects.all()

    records = records.select_related(
        "livestock__livestock_type",
        "created_by",
    ).order_by("-created_at")

    serializer = AnimalDispositionSerializer(records, many=True)
    return Response(serializer.data, status=200)


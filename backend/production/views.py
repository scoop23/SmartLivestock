from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db.models import Q
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from users.models import User, Notification
from users.notification_views import create_notification
from .models import (
    ProductionRecord,
    LiveAnimalSale,
    SlaughterRecord,
    WeightRecord,
    CalvingRecord,
    AnimalDisposition,
)
from .serializer import (
    ProductionRecordSerializer,
    LiveAnimalSaleSerializer,
    AnimalDispositionSerializer,
    WeightRecordSerializer,
    CalvingRecordSerializer,
)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
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
        records = ProductionRecord.objects.filter(
            Q(created_by=user) | Q(livestock__farmer__user=user)
        ).distinct()
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
@permission_classes([IsAuthenticated])
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
        record = get_object_or_404(
            ProductionRecord,
            Q(created_by=user) | Q(livestock__farmer__user=user),
            pk=pk,
        )
    else:
        record = get_object_or_404(ProductionRecord, pk=pk)

    if request.method == "DELETE":
        if record.status != ProductionRecord.StatusType.PENDING:
            return Response(
                {"error": "Only PENDING production records can be deleted."},
                status=status.HTTP_403_FORBIDDEN,
            )
        record.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    if request.method in ["PUT", "PATCH"]:
        if record.status != ProductionRecord.StatusType.PENDING:
            return Response(
                {"error": "Only PENDING production records can be edited."},
                status=status.HTTP_403_FORBIDDEN,
            )
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
@permission_classes([IsAuthenticated])
def review_production_record(request, pk):
    """
    POST /production/records/<pk>/review/
    Review and verify production records:
    - SIBAT: Field verification (status = VERIFIED)
    - MAO: Official municipal certification (status = APPROVED or SUBJECT_TO_REVISION)
    """
    record = get_object_or_404(ProductionRecord, pk=pk)
    new_status = request.data.get("status")
    remarks = request.data.get("remarks", "")

    if not new_status:
        return Response(
            {"error": "status is required (VERIFIED, APPROVED, or SUBJECT_TO_REVISION)."},
            status=400,
        )

    user = request.user
    role_name = getattr(getattr(user, "role", None), "role_name", "")

    if role_name == "FARMER":
        return Response(
            {"error": "Farmers are not authorized to review production records."},
            status=403,
        )

    if role_name == "SIBAT":
        if new_status == ProductionRecord.ProductionStatus.APPROVED:
            return Response(
                {"error": "SIBAT officers can only verify (VERIFIED). Final approval is reserved for MAO."},
                status=403,
            )
        if new_status not in [ProductionRecord.ProductionStatus.VERIFIED, ProductionRecord.ProductionStatus.SUBJECT_TO_REVISION]:
            return Response(
                {"error": "Invalid status for SIBAT. Valid choices are VERIFIED or SUBJECT_TO_REVISION."},
                status=400,
            )
    elif role_name == "MAO":
        if new_status not in ProductionRecord.ProductionStatus.values:
            return Response(
                {"error": f"Invalid status '{new_status}'. Valid choices: {list(ProductionRecord.ProductionStatus.values)}"},
                status=400,
            )

    record.status = new_status
    record.reviewed_by = request.user
    record.review_remarks = remarks
    record.reviewed_at = timezone.now()
    record.save()

    target_farmer = getattr(record.farmer, "user", None)
    if target_farmer:
        prod_info = f"{record.quantity} {record.unit} of {record.get_production_type_display()}"
        if new_status == ProductionRecord.ProductionStatus.VERIFIED:
            create_notification(
                user=target_farmer,
                notification_type=Notification.NotificationType.PRODUCTION,
                priority=Notification.Priority.MEDIUM,
                title="Production Record Verified by SIBAT",
                message=f"Your production declaration for {prod_info} was verified on-farm by SIBAT.{f' Remarks: {remarks}' if remarks else ''}",
                link="/production-dashboard",
            )
        elif new_status == ProductionRecord.ProductionStatus.APPROVED:
            create_notification(
                user=target_farmer,
                notification_type=Notification.NotificationType.PRODUCTION,
                priority=Notification.Priority.MEDIUM,
                title="Production Record Approved by MAO",
                message=f"Official certification approved for your {prod_info}.{f' Directives: {remarks}' if remarks else ''}",
                link="/production-dashboard",
            )
        elif new_status == ProductionRecord.ProductionStatus.SUBJECT_TO_REVISION:
            create_notification(
                user=target_farmer,
                notification_type=Notification.NotificationType.PRODUCTION,
                priority=Notification.Priority.HIGH,
                title="Revision Required on Production Record",
                message=f"Your production declaration for {prod_info} requires revision.{f' Remarks: {remarks}' if remarks else ''}",
                link="/production-dashboard",
            )

    serializer = ProductionRecordSerializer(record)
    return Response(serializer.data, status=200)


# ===========================================================================
# Live Animal Sales Endpoints
# ===========================================================================
@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
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
        sales = LiveAnimalSale.objects.filter(
            Q(created_by=user) | Q(livestock__farmer__user=user)
        ).distinct()
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
@permission_classes([IsAuthenticated])
def live_animal_sale_delete(request, pk):
    """
    DELETE /production/sales/<pk>/ -> Delete pending sale record
    """
    user = request.user
    role_name = getattr(getattr(user, "role", None), "role_name", None)

    if role_name == "FARMER":
        sale = get_object_or_404(
            LiveAnimalSale,
            Q(created_by=user) | Q(livestock__farmer__user=user),
            pk=pk,
        )
    else:
        sale = get_object_or_404(LiveAnimalSale, pk=pk)

    if sale.status != LiveAnimalSale.StatusType.PENDING:
        return Response(
            {"error": "Only PENDING sale records can be deleted."},
            status=status.HTTP_403_FORBIDDEN,
        )
    sale.delete()
    return Response(status=204)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def review_live_animal_sale(request, pk):
    """
    POST /production/sales/<pk>/review/
    Official MAO / SIBAT verification action (VERIFIED / APPROVED / SUBJECT_TO_REVISION)
    """
    sale = get_object_or_404(LiveAnimalSale, pk=pk)
    new_status = request.data.get("status")
    remarks = request.data.get("remarks", "")

    if not new_status:
        return Response(
            {"error": "status is required (VERIFIED, APPROVED, or SUBJECT_TO_REVISION)."},
            status=400,
        )

    user = request.user
    role_name = getattr(getattr(user, "role", None), "role_name", "")

    if role_name == "FARMER":
        return Response(
            {"error": "Farmers are not authorized to review sales records."},
            status=403,
        )

    sale.status = new_status
    sale.reviewed_by = request.user
    sale.review_remarks = remarks
    sale.reviewed_at = timezone.now()
    sale.save()

    serializer = LiveAnimalSaleSerializer(sale)
    return Response(serializer.data, status=200)


# ===========================================================================
# Weight & Growth Records Endpoints
# ===========================================================================
@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
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
        records = WeightRecord.objects.filter(
            Q(created_by=user) | Q(livestock__farmer__user=user)
        ).distinct()
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
@permission_classes([IsAuthenticated])
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
        records = CalvingRecord.objects.filter(
            Q(created_by=user) | Q(dam__farmer__user=user)
        ).distinct()
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
@permission_classes([IsAuthenticated])
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
        records = AnimalDisposition.objects.filter(
            Q(created_by=user) | Q(livestock__farmer__user=user)
        ).distinct()
    else:
        records = AnimalDisposition.objects.all()

    records = records.select_related(
        "livestock__livestock_type",
        "created_by",
    ).order_by("-created_at")

    serializer = AnimalDispositionSerializer(records, many=True)
    return Response(serializer.data, status=200)

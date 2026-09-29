from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db.models import Q
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from users.models import User, Notification
from users.notification_views import create_notification, notify_role
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
from smartlivestock.workflows import require_action, role_name, validate_review_transition


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
        record = serializer.save()
        if role_name(request.user) == "FARMER":
            farmer_name = request.user.get_full_name() or request.user.username
            notify_role(
                role_name="SIBAT",
                notification_type=Notification.NotificationType.PRODUCTION,
                priority=Notification.Priority.MEDIUM,
                title="New Production Entry Awaiting Verification",
                message=f"{farmer_name} logged {record.quantity} {record.unit} of {record.get_production_type_display()}.",
                link="/sibat-validation",
            )
        return Response(serializer.data, status=201)

    # GET
    user = request.user
    user_role = role_name(user)

    if user_role == "FARMER":
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
        if record.status != ProductionRecord.ProductionStatus.PENDING:
            return Response(
                {"error": "Only PENDING production records can be deleted."},
                status=status.HTTP_403_FORBIDDEN,
            )
        record.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    if request.method in ["PUT", "PATCH"]:
        if record.status != ProductionRecord.ProductionStatus.PENDING:
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

    if role_name not in ["SIBAT", "MAO"]:
        return Response(
            {"error": "Only SIBAT and MAO may review production records."},
            status=status.HTTP_403_FORBIDDEN,
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

    owner = record.livestock.farmer if record.livestock else (record.batch.farmer if record.batch else None)
    target_farmer = owner.user if owner else None
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
        require_action(request.user, "sales", "create")
        serializer = LiveAnimalSaleSerializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        sale = serializer.save()
        farmer_name = request.user.get_full_name() or request.user.username
        sale_reference = (
            sale.livestock.tag_number
            if sale.livestock and sale.livestock.tag_number
            else sale.batch.batch_code
            if sale.batch
            else f"Sale #{sale.pk}"
        )
        notify_role(
            role_name="SIBAT",
            notification_type=Notification.NotificationType.SIBAT,
            priority=Notification.Priority.MEDIUM,
            title="New Livestock Sale Awaiting Verification",
            message=f"{farmer_name} recorded a sale for {sale_reference}.",
            link="/sibat-validation",
        )
        return Response(serializer.data, status=201)

    user = request.user
    user_role = role_name(user)

    if user_role == "FARMER":
        sales = LiveAnimalSale.objects.filter(
            Q(created_by=user) | Q(livestock__farmer__user=user)
        ).distinct()
    else:
        require_action(user, "sales", "read_all")
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
    require_action(user, "sales", "delete_own")
    sale = get_object_or_404(
        LiveAnimalSale,
        Q(created_by=user) | Q(livestock__farmer__user=user),
        pk=pk,
    )

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
    user_role = require_action(user, "sales", "review")
    validate_review_transition(
        domain="sales",
        role=user_role,
        current=sale.status,
        target=new_status,
        remarks=remarks,
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
        require_action(request.user, "calving", "create")
        serializer = CalvingRecordSerializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        calving = serializer.save()
        farmer_name = request.user.get_full_name() or request.user.username
        notify_role(
            role_name="SIBAT",
            notification_type=Notification.NotificationType.SIBAT,
            priority=Notification.Priority.MEDIUM,
            title="New Calving Entry Awaiting Verification",
            message=f"{farmer_name} recorded calf {calving.calf_tag or 'Newborn'} from dam {calving.dam.tag_number or calving.dam_id}.",
            link="/sibat-validation",
        )
        return Response(serializer.data, status=201)

    user = request.user
    user_role = role_name(user)

    if user_role == "FARMER":
        records = CalvingRecord.objects.filter(
            Q(created_by=user) | Q(dam__farmer__user=user)
        ).distinct()
    else:
        require_action(user, "calving", "read_all")
        records = CalvingRecord.objects.all()

    records = records.select_related(
        "dam__livestock_type",
        "dam__farmer__user",
        "dam__farmer__barangay",
        "reviewed_by",
        "created_by",
    ).order_by("-calving_date", "-created_at")

    serializer = CalvingRecordSerializer(records, many=True)
    return Response(serializer.data, status=200)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def review_calving_record(request, pk):
    """
    POST /production/calving/<pk>/review/
    Review and verify calving & birth registry records:
    - SIBAT: Field verification of calf on farm (status = VERIFIED)
    - MAO / Admin: Official municipal registration approval (status = APPROVED or SUBJECT_TO_REVISION)
    """
    calving = get_object_or_404(CalvingRecord, pk=pk)
    new_status = request.data.get("status")
    remarks = request.data.get("remarks", "")

    if not new_status:
        return Response(
            {"error": "status is required (VERIFIED, APPROVED, or SUBJECT_TO_REVISION)."},
            status=400,
        )

    user = request.user
    user_role = require_action(user, "calving", "review")
    validate_review_transition(
        domain="calving",
        role=user_role,
        current=calving.status,
        target=new_status,
        remarks=remarks,
    )

    calving.status = new_status
    calving.reviewed_by = request.user
    calving.review_remarks = remarks
    calving.reviewed_at = timezone.now()
    calving.save()

    target_farmer = getattr(getattr(calving.dam, "farmer", None), "user", None) or calving.created_by
    if target_farmer:
        calf_info = f"Calf Tag #{calving.calf_tag or 'Newborn'} (Dam: {getattr(calving.dam, 'tag_number', 'N/A')})"
        if new_status == CalvingRecord.StatusType.VERIFIED:
            create_notification(
                user=target_farmer,
                notification_type=Notification.NotificationType.PRODUCTION,
                priority=Notification.Priority.MEDIUM,
                title="Calving Record Verified by SIBAT",
                message=f"Your birth declaration for {calf_info} was verified on-farm by SIBAT.{f' Remarks: {remarks}' if remarks else ''}",
                link="/production-dashboard",
            )
        elif new_status == CalvingRecord.StatusType.APPROVED:
            create_notification(
                user=target_farmer,
                notification_type=Notification.NotificationType.PRODUCTION,
                priority=Notification.Priority.MEDIUM,
                title="Calving Record Approved by MAO",
                message=f"Official registration approved for {calf_info}.{f' Directives: {remarks}' if remarks else ''}",
                link="/production-dashboard",
            )
        elif new_status == CalvingRecord.StatusType.SUBJECT_TO_REVISION:
            create_notification(
                user=target_farmer,
                notification_type=Notification.NotificationType.PRODUCTION,
                priority=Notification.Priority.HIGH,
                title="Revision Required on Calving Record",
                message=f"Your birth declaration for {calf_info} requires revision.{f' Remarks: {remarks}' if remarks else ''}",
                link="/production-dashboard",
            )

    serializer = CalvingRecordSerializer(calving)
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

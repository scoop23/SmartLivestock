from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db import transaction
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
from livestock.reconciliation import reconcile_approved_calving, reconcile_approved_sale


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
        if role_name != "FARMER":
            return Response(
                {"error": "Only the farmer may delete their production record."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if record.status != ProductionRecord.ProductionStatus.PENDING:
            return Response(
                {"error": "Only PENDING production records can be deleted."},
                status=status.HTTP_403_FORBIDDEN,
            )
        record.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    if request.method in ["PUT", "PATCH"]:
        if role_name != "FARMER":
            return Response(
                {"error": "Only the farmer may edit their production record."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if record.status not in (
            ProductionRecord.ProductionStatus.PENDING,
            ProductionRecord.ProductionStatus.SUBJECT_TO_REVISION,
        ):
            return Response(
                {"error": "Only pending or returned production records can be edited."},
                status=status.HTTP_403_FORBIDDEN,
            )
        was_returned = record.status == ProductionRecord.ProductionStatus.SUBJECT_TO_REVISION
        serializer = ProductionRecordSerializer(
            record,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        if was_returned:
            record.status = ProductionRecord.ProductionStatus.PENDING
            record.reviewed_by = None
            record.reviewed_at = None
            record.save(update_fields=["status", "reviewed_by", "reviewed_at"])
            notify_role(
                role_name="SIBAT",
                notification_type=Notification.NotificationType.PRODUCTION,
                priority=Notification.Priority.MEDIUM,
                title="Production Record Resubmitted",
                message=(
                    f"{user.get_full_name() or user.username} corrected a "
                    f"{record.get_production_type_display()} production record."
                ),
                link="/sibat-validation",
            )
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

    validate_review_transition(
        domain="production",
        role=role_name,
        current=record.status,
        target=new_status,
        remarks=remarks,
    )

    record.status = new_status
    record.reviewed_by = request.user
    record.review_remarks = remarks
    record.reviewed_at = timezone.now()
    record.save()

    if new_status == ProductionRecord.ProductionStatus.VERIFIED:
        notify_role(
            role_name="MAO",
            notification_type=Notification.NotificationType.PRODUCTION,
            priority=Notification.Priority.MEDIUM,
            title="Production Record Awaiting MAO Approval",
            message=(
                f"SIBAT verified {record.quantity} {record.unit} of "
                f"{record.get_production_type_display()} from "
                f"{record.created_by.get_full_name() or record.created_by.username}."
            ),
            link="/data-validation?domain=production",
        )

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
@transaction.atomic
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
    if new_status == LiveAnimalSale.StatusType.APPROVED:
        sale = reconcile_approved_sale(sale)

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
@transaction.atomic
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
    if new_status == CalvingRecord.StatusType.APPROVED:
        calving = reconcile_approved_calving(calving)

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


@api_view(["GET", "PUT", "PATCH"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def calving_detail(request, pk):
    """
    GET   /production/calving/<pk>/ -> Retrieve a single calving/birth record
    PUT   /production/calving/<pk>/ -> Full update (farmer, PENDING / SUBJECT_TO_REVISION only)
    PATCH /production/calving/<pk>/ -> Partial update

    Revision cycle:
    When a birth declaration was returned for revision (SUBJECT_TO_REVISION),
    the farmer edits the record and resubmits; the status resets to PENDING and
    the reviewer audit trail is cleared so SIBAT can re-verify.
    """
    user = request.user
    role_name = getattr(getattr(user, "role", None), "role_name", None)

    if role_name == "FARMER":
        calving = get_object_or_404(
            CalvingRecord,
            Q(created_by=user) | Q(dam__farmer__user=user),
            pk=pk,
        )
    else:
        calving = get_object_or_404(CalvingRecord, pk=pk)

    if request.method in ["PUT", "PATCH"]:
        if role_name != "FARMER":
            return Response(
                {"error": "Only the farmer may edit their calving record."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if calving.status not in (
            CalvingRecord.StatusType.PENDING,
            CalvingRecord.StatusType.SUBJECT_TO_REVISION,
        ):
            return Response(
                {"error": "Only pending or returned calving records can be edited."},
                status=status.HTTP_403_FORBIDDEN,
            )
        was_returned = calving.status == CalvingRecord.StatusType.SUBJECT_TO_REVISION
        serializer = CalvingRecordSerializer(
            calving,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        if was_returned:
            calving.status = CalvingRecord.StatusType.PENDING
            calving.reviewed_by = None
            calving.reviewed_at = None
            calving.save(update_fields=["status", "reviewed_by", "reviewed_at"])
            notify_role(
                role_name="SIBAT",
                notification_type=Notification.NotificationType.PRODUCTION,
                priority=Notification.Priority.MEDIUM,
                title="Calving Record Resubmitted",
                message=(
                    f"{user.get_full_name() or user.username} corrected a birth "
                    f"declaration for calf {calving.calf_tag or 'Newborn'}."
                ),
                link="/sibat-validation",
            )
        return Response(serializer.data, status=200)

    # GET
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

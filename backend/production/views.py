from smartlivestock.workflows import scope_reviewer_queryset
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db import transaction
from django.db.models import Q
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from users.models import User, Notification
from users.notification_views import create_notification, notify_role, notify_review_revision
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
        require_action(request.user, "production", "create")
        serializer = ProductionRecordSerializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        record = serializer.save()
        if role_name(request.user) == "FARMER":
            farmer_name = request.user.get_full_name() or request.user.username
            notify_role(
                barangay_id=(record.livestock or record.batch).farmer.barangay_id,
                role_name="SIBAT",
                notification_type=Notification.NotificationType.PRODUCTION,
                priority=Notification.Priority.MEDIUM,
                title="New Production Entry Awaiting Verification",
                message=f"{farmer_name} logged {record.quantity} {record.unit} of {record.get_production_type_display()}.",
                link=f"/sibat?tab=production&reviewType=PRODUCTION&reviewId={record.pk}",
                related_entity_type="production_record",
                related_entity_id=record.pk,
            )
        return Response(serializer.data, status=201)

    # GET
    user = request.user
    user_role = role_name(user)

    if user_role == "FARMER":
        records = ProductionRecord.objects.filter(
            Q(farmer_at_record__user=user) | Q(created_by=user)
        ).distinct()
    else:
        require_action(user, "production", "read_all")
        records = scope_reviewer_queryset(ProductionRecord.objects.all(), request.user)

    records = records.select_related(
        "farmer_at_record__user",
        "farmer_at_record__barangay",
        "livestock__livestock_type",
        "batch__farmer__user",
        "batch__farmer__barangay",
        "batch__livestock_type",
        "created_by",
        "reviewed_by__role",
    ).order_by("-record_date", "-created_at")

    records = records.select_related("slaughter").prefetch_related("slaughter__selected_animals")
    serializer = ProductionRecordSerializer(records, many=True)
    return Response(serializer.data, status=200)


@api_view(["GET", "PUT", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def production_record_detail(request, pk):
    """
    GET    /production/records/<pk>/ -> Retrieve single production record
    PUT    /production/records/<pk>/ -> Full update
    PATCH  /production/records/<pk>/ -> Partial update
    DELETE /production/records/<pk>/ -> Delete record (only PENDING allowed)
    """
    user = request.user
    user_role = role_name(user)

    if user_role == "FARMER":
        record = get_object_or_404(
            ProductionRecord.objects.select_for_update(of=("self",)),
            Q(farmer_at_record__user=user) | Q(created_by=user),
            pk=pk,
        )
    else:
        require_action(user, "production", "read_all")
        record = get_object_or_404(scope_reviewer_queryset(ProductionRecord.objects.select_for_update(of=("self",)), request.user), pk=pk)

    if request.method == "DELETE":
        if user_role != "FARMER":
            return Response(
                {"error": "Only the farmer may delete their production record."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if record.status != ProductionRecord.ProductionStatus.PENDING:
            return Response(
                {"error": "Only PENDING production records can be deleted."},
                status=status.HTTP_403_FORBIDDEN,
            )
        slaughter = record.slaughter if record.slaughter_id else None
        record.delete()
        if slaughter:
            slaughter.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    if request.method in ["PUT", "PATCH"]:
        if user_role != "FARMER":
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
            if record.slaughter_id:
                SlaughterRecord.objects.filter(pk=record.slaughter_id).update(status="PENDING", reviewed_by=None, reviewed_at=None)
            notify_role(
                barangay_id=(record.livestock or record.batch).farmer.barangay_id,
                role_name="SIBAT",
                notification_type=Notification.NotificationType.PRODUCTION,
                priority=Notification.Priority.MEDIUM,
                title="Production Record Resubmitted",
                message=(
                    f"{user.get_full_name() or user.username} corrected a "
                    f"{record.get_production_type_display()} production record."
                ),
                link=f"/sibat?tab=production&reviewType=PRODUCTION&reviewId={record.pk}",
                related_entity_type="production_record",
                related_entity_id=record.pk,
            )
            notify_role(
                role_name="ADMIN",
                notification_type=Notification.NotificationType.GENERAL,
                priority=Notification.Priority.MEDIUM,
                title="Production Record Resubmitted",
                message=f"{user.get_full_name() or user.username} corrected a {record.get_production_type_display()} production record.",
                link=f"/data-validation?domain=production&recordType=PRODUCTION&recordId={record.pk}",
                related_entity_type="production_record",
                related_entity_id=record.pk,
            )
        return Response(serializer.data, status=200)

    # GET
    serializer = ProductionRecordSerializer(record)
    return Response(serializer.data, status=200)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def review_production_record(request, pk):
    """
    POST /production/records/<pk>/review/
    Review and verify production records:
    - SIBAT: Field verification (status = VERIFIED)
    - MAO: Official municipal certification (status = APPROVED or SUBJECT_TO_REVISION)
    """
    # Scope joins optional animal/herd sources; PostgreSQL must lock only the event row.
    record = get_object_or_404(scope_reviewer_queryset(ProductionRecord.objects.select_for_update(of=("self",)), request.user), pk=pk)
    new_status = request.data.get("status")
    remarks = request.data.get("remarks", "")

    if not new_status:
        return Response(
            {"error": "status is required (VERIFIED, APPROVED, or SUBJECT_TO_REVISION)."},
            status=400,
        )

    user = request.user
    role_name = getattr(getattr(user, "role", None), "role_name", "")

    if role_name not in ["SIBAT", "MAO", "ADMIN"]:
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
    if new_status == "SUBJECT_TO_REVISION":
        notify_review_revision((record.livestock or record.batch).farmer, request.user,
            title="Revision required: record #" + str(record.pk), message=remarks,
            link=f"/sibat?tab=production&reviewType=PRODUCTION&reviewId={record.pk}")

    if record.slaughter_id:
        slaughter = record.slaughter
        slaughter.status = new_status
        slaughter.reviewed_by = request.user
        slaughter.review_remarks = remarks
        slaughter.reviewed_at = record.reviewed_at
        slaughter.save(update_fields=["status", "reviewed_by", "review_remarks", "reviewed_at"])
        if new_status == "APPROVED":
            from .services.slaughter import reconcile_approved_slaughter
            reconcile_approved_slaughter(slaughter)

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
            link=f"/data-validation?domain=production&recordType=PRODUCTION&recordId={record.pk}",
            related_entity_type="production_record",
            related_entity_id=record.pk,
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
            barangay_id=(sale.livestock or sale.batch).farmer.barangay_id,
            role_name="SIBAT",
            notification_type=Notification.NotificationType.SIBAT,
            priority=Notification.Priority.MEDIUM,
            title="New Livestock Sale Awaiting Verification",
            message=f"{farmer_name} recorded a sale for {sale_reference}.",
            link=f"/sibat?tab=production&reviewType=SALE&reviewId={sale.pk}",
            related_entity_type="livestock_sale",
            related_entity_id=sale.pk,
        )
        return Response(serializer.data, status=201)

    user = request.user
    user_role = role_name(user)

    if user_role == "FARMER":
        sales = LiveAnimalSale.objects.filter(
            Q(livestock__farmer__user=user) | Q(batch__farmer__user=user)
        ).distinct()
    else:
        require_action(user, "sales", "read_all")
        sales = scope_reviewer_queryset(LiveAnimalSale.objects.all(), request.user)

    # Sale display follows either source; load its owner and barangay in this query.
    sales = sales.select_related(
        "livestock__farmer__user",
        "livestock__farmer__barangay",
        "batch__farmer__user",
        "batch__farmer__barangay",
        "batch__livestock_type",
        "livestock__livestock_type",
        "created_by",
        "reviewed_by__role",
    ).order_by("-sale_date", "-created_at")

    serializer = LiveAnimalSaleSerializer(sales, many=True)
    return Response(serializer.data, status=200)


@api_view(["GET", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def live_animal_sale_delete(request, pk):
    """Keep the existing sale URL; returned declarations can reenter field review."""
    user = request.user
    queryset = LiveAnimalSale.objects.select_for_update(of=("self",))
    if role_name(user) == "FARMER":
        queryset = queryset.filter(Q(livestock__farmer__user=user) | Q(batch__farmer__user=user))
    else:
        require_action(user, "sales", "read_all")
        queryset = scope_reviewer_queryset(queryset, user)
    sale = get_object_or_404(queryset, pk=pk)
    if request.method == "GET":
        return Response(LiveAnimalSaleSerializer(sale).data)
    require_action(user, "sales", "delete_own")
    if request.method == "PATCH":
        if sale.status not in {"PENDING", "SUBJECT_TO_REVISION"}:
            return Response({"error": "Verified or approved sales are locked."}, status=409)
        returned = sale.status == "SUBJECT_TO_REVISION"
        serializer = LiveAnimalSaleSerializer(sale, data=request.data, partial=True, context={"request": request})
        serializer.is_valid(raise_exception=True)
        sale = serializer.save()
        if returned:
            notify_role(role_name="SIBAT", barangay_id=(sale.livestock or sale.batch).farmer.barangay_id,
                notification_type=Notification.NotificationType.PRODUCTION,
                title="Sale Resubmitted for Verification", message=f"Sale #{sale.pk} was corrected by its farmer.",
                link=f"/sibat?tab=production&reviewType=SALE&reviewId={sale.pk}",
                related_entity_type="livestock_sale", related_entity_id=sale.pk)
            notify_role(role_name="ADMIN", notification_type=Notification.NotificationType.GENERAL,
                title="Sale Resubmitted for Verification", message=f"Sale #{sale.pk} was corrected by its farmer.",
                link=f"/data-validation?domain=incidents&recordType=SALE&recordId={sale.pk}",
                related_entity_type="livestock_sale", related_entity_id=sale.pk)
        return Response(serializer.data)
    if sale.status != "PENDING":
        return Response({"error": "Only PENDING sale records can be deleted."}, status=403)
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
    sale = get_object_or_404(scope_reviewer_queryset(LiveAnimalSale.objects.select_for_update(of=("self",)), request.user), pk=pk)
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
    if new_status == "SUBJECT_TO_REVISION":
        notify_review_revision((sale.livestock or sale.batch).farmer, request.user,
            title="Revision required: sale #" + str(sale.pk), message=remarks,
            link=f"/sibat?tab=production&reviewType=SALE&reviewId={sale.pk}")

    if new_status == LiveAnimalSale.StatusType.APPROVED:
        sale = reconcile_approved_sale(sale)

    owner = (sale.livestock or sale.batch).farmer.user
    create_notification(user=owner, notification_type=Notification.NotificationType.PRODUCTION,
        title=f"Livestock Sale: {new_status.replace('_', ' ').title()}",
        message=f"{user_role} reviewed your sale declaration.{(' Remarks: ' + remarks) if remarks else ''}",
        link="/production-dashboard")
    if new_status == "VERIFIED":
        notify_role(role_name="MAO", notification_type=Notification.NotificationType.PRODUCTION,
            title="Verified Sale Awaiting MAO Approval", message=f"Sale #{sale.pk} was verified by SIBAT.",
            link=f"/data-validation?domain=incidents&recordType=SALE&recordId={sale.pk}",
            related_entity_type="livestock_sale", related_entity_id=sale.pk)
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
        require_action(request.user, "inventory", "create")
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
            Q(livestock__farmer__user=user)
        ).distinct()
    else:
        require_action(user, "inventory", "read_all")
        records = scope_reviewer_queryset(WeightRecord.objects.all(), request.user)

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
            barangay_id=calving.dam.farmer.barangay_id,
            role_name="SIBAT",
            notification_type=Notification.NotificationType.SIBAT,
            priority=Notification.Priority.MEDIUM,
            title="New Calving Entry Awaiting Verification",
            message=f"{farmer_name} recorded calf {calving.calf_tag or 'Newborn'} from dam {calving.dam.tag_number or calving.dam_id}.",
            link=f"/sibat?tab=calving&reviewType=CALVING&reviewId={calving.pk}",
            related_entity_type="calving_record",
            related_entity_id=calving.pk,
        )
        return Response(serializer.data, status=201)

    user = request.user
    user_role = role_name(user)

    if user_role == "FARMER":
        records = CalvingRecord.objects.filter(
            Q(dam__farmer__user=user)
        ).distinct()
    else:
        require_action(user, "calving", "read_all")
        records = scope_reviewer_queryset(CalvingRecord.objects.all(), request.user)

    records = records.select_related(
        "dam__livestock_type",
        "dam__farmer__user",
        "dam__farmer__barangay",
        "reviewed_by__role",
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
    calving = get_object_or_404(scope_reviewer_queryset(CalvingRecord.objects.select_for_update(of=("self",)), request.user), pk=pk)
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
    if new_status == "SUBJECT_TO_REVISION":
        notify_review_revision(calving.dam.farmer, request.user,
            title="Revision required: calving #" + str(calving.pk), message=remarks,
            link=f"/sibat?tab=calving&reviewType=CALVING&reviewId={calving.pk}")

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

    if new_status == "VERIFIED":
        notify_role(role_name="MAO", notification_type=Notification.NotificationType.PRODUCTION,
            title="Verified Calving Awaiting MAO Approval", message=f"Calving #{calving.pk} was verified by SIBAT.",
            link=f"/data-validation?domain=incidents&recordType=CALVING&recordId={calving.pk}",
            related_entity_type="calving_record", related_entity_id=calving.pk)
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
            Q(dam__farmer__user=user),
            pk=pk,
        )
    else:
        require_action(user, "calving", "read_all")
        calving = get_object_or_404(scope_reviewer_queryset(CalvingRecord.objects.select_for_update(of=("self",)), request.user), pk=pk)

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
                barangay_id=calving.dam.farmer.barangay_id,
                role_name="SIBAT",
                notification_type=Notification.NotificationType.PRODUCTION,
                priority=Notification.Priority.MEDIUM,
                title="Calving Record Resubmitted",
                message=(
                    f"{user.get_full_name() or user.username} corrected a birth "
                    f"declaration for calf {calving.calf_tag or 'Newborn'}."
                ),
                link=f"/sibat?tab=calving&reviewType=CALVING&reviewId={calving.pk}",
                related_entity_type="calving_record",
                related_entity_id=calving.pk,
            )
            notify_role(
                role_name="ADMIN",
                notification_type=Notification.NotificationType.GENERAL,
                priority=Notification.Priority.MEDIUM,
                title="Calving Record Resubmitted",
                message=f"{user.get_full_name() or user.username} corrected a birth declaration for calf {calving.calf_tag or 'Newborn'}.",
                link=f"/data-validation?domain=incidents&recordType=CALVING&recordId={calving.pk}",
                related_entity_type="calving_record",
                related_entity_id=calving.pk,
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
        require_action(request.user, "inventory", "create")
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
            Q(livestock__farmer__user=user)
        ).distinct()
    else:
        require_action(user, "inventory", "read_all")
        records = scope_reviewer_queryset(AnimalDisposition.objects.all(), request.user)

    records = records.select_related(
        "livestock__livestock_type",
        "created_by",
    ).order_by("-created_at")

    serializer = AnimalDispositionSerializer(records, many=True)
    return Response(serializer.data, status=200)

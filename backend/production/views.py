import logging
import uuid

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
from smartlivestock.workflows import (
    FIELD_REVIEWERS,
    require_action,
    role_name,
    scope_reviewer_queryset,
    validate_production_review_transition,
    validate_review_transition,
)
from livestock.reconciliation import reconcile_approved_calving, reconcile_approved_sale


logger = logging.getLogger(__name__)


def _notify_production_route(record: ProductionRecord, actor: User, *, is_resubmission: bool = False) -> None:
    """Send notifications only to the review queue that owns the next action."""
    farmer_name = actor.get_full_name() or actor.username
    source_obj = record.livestock or record.batch
    barangay_id = source_obj.farmer.barangay_id if source_obj and source_obj.farmer_id else None
    action_word = "corrected and resubmitted" if is_resubmission else "logged"
    prod_display = record.get_production_type_display()

    if record.next_review_queue == ProductionRecord.ReviewQueue.MAO:
        notify_role(
            role_name="MAO",
            notification_type=Notification.NotificationType.PRODUCTION,
            priority=Notification.Priority.MEDIUM,
            title="Milk Production Ready for MAO Approval" if not is_resubmission else "Resubmitted Milk Record Ready for MAO Approval",
            message=(
                f"{farmer_name} {action_word} {record.quantity} {record.unit} of {prod_display} "
                f"(no anomaly detected against cow baseline; routed directly to MAO)."
            ),
            link=f"/data-validation?domain=production&recordType=PRODUCTION&recordId={record.pk}",
            related_entity_type="production_record",
            related_entity_id=record.pk,
        )
    elif record.next_review_queue == ProductionRecord.ReviewQueue.CBAT:
        notify_role(
            barangay_id=barangay_id,
            role_name="CBAT",
            notification_type=Notification.NotificationType.PRODUCTION,
            priority=Notification.Priority.HIGH,
            title="Milk Anomaly Flagged for Field Verification" if not is_resubmission else "Resubmitted Milk Record Flagged for Field Verification",
            message=(
                f"{farmer_name} {action_word} {record.quantity} {record.unit} of {prod_display}. "
                f"{record.anomaly_reason or 'Milk yield anomaly detected; field verification required.'}"
            ),
            link=f"/sibat/production-records?reviewType=PRODUCTION&reviewId={record.pk}",
            related_entity_type="production_record",
            related_entity_id=record.pk,
        )
    else:
        notify_role(
            barangay_id=barangay_id,
            role_name="SIBAT",
            notification_type=Notification.NotificationType.PRODUCTION,
            priority=Notification.Priority.MEDIUM,
            title="Production Record Resubmitted" if is_resubmission else "New Production Entry Awaiting Verification",
            message=(
                f"{farmer_name} corrected a {prod_display} production record."
                if is_resubmission
                else f"{farmer_name} logged {record.quantity} {record.unit} of {prod_display}."
            ),
            link=f"/sibat?tab=production&reviewType=PRODUCTION&reviewId={record.pk}",
            related_entity_type="production_record",
            related_entity_id=record.pk,
        )
        if is_resubmission:
            notify_role(
                role_name="ADMIN",
                notification_type=Notification.NotificationType.GENERAL,
                priority=Notification.Priority.MEDIUM,
                title="Production Record Resubmitted",
                message=f"{farmer_name} corrected a {prod_display} production record.",
                link=f"/data-validation?domain=production&recordType=PRODUCTION&recordId={record.pk}",
                related_entity_type="production_record",
                related_entity_id=record.pk,
            )


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
        try:
            record = serializer.save()
        except Exception:
            diagnostic_id = uuid.uuid4().hex[:12]
            logger.error(
                "Production record persistence failed (diagnostic_id=%s)",
                diagnostic_id,
            )
            return Response(
                {
                    "detail": "Production record could not be saved. Do not retry until the error is resolved.",
                    "diagnostic_id": diagnostic_id,
                    "stage": "save",
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        record_data = serializer.data
        if role_name(request.user) == "FARMER":
            try:
                _notify_production_route(record, request.user, is_resubmission=False)
            except Exception as error:
                diagnostic_id = uuid.uuid4().hex[:12]
                logger.error(
                    "Production record notification failed (diagnostic_id=%s, error_type=%s)",
                    diagnostic_id,
                    type(error).__name__,
                )
                record_data.update({
                    "notification_status": "failed",
                    "notification_detail": (
                        "Production record was saved, but its reviewer notification could not be created. "
                        "Do not resubmit; the record is already saved. Contact support with diagnostic ID "
                        f"{diagnostic_id}."
                    ),
                    "notification_diagnostic_id": diagnostic_id,
                })
        return Response(record_data, status=status.HTTP_201_CREATED)

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
        if user_role in FIELD_REVIEWERS:
            records = records.exclude(
                status=ProductionRecord.ProductionStatus.PENDING,
                next_review_queue=ProductionRecord.ReviewQueue.MAO,
            )

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
    serializer = ProductionRecordSerializer(records, many=True, context={"request": request})
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
        scoped_qs = scope_reviewer_queryset(ProductionRecord.objects.select_for_update(of=("self",)), request.user)
        if user_role in FIELD_REVIEWERS:
            scoped_qs = scoped_qs.exclude(
                status=ProductionRecord.ProductionStatus.PENDING,
                next_review_queue=ProductionRecord.ReviewQueue.MAO,
            )
        record = get_object_or_404(scoped_qs, pk=pk)

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
        previous_queue = record.next_review_queue
        serializer = ProductionRecordSerializer(
            record,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        record = serializer.save()
        if was_returned:
            if record.slaughter_id:
                SlaughterRecord.objects.filter(pk=record.slaughter_id).update(status="PENDING", reviewed_by=None, reviewed_at=None)
            _notify_production_route(record, user, is_resubmission=True)
        elif record.next_review_queue != previous_queue:
            _notify_production_route(record, user, is_resubmission=True)
        return Response(serializer.data, status=200)

    # GET
    serializer = ProductionRecordSerializer(record, context={"request": request})
    return Response(serializer.data, status=200)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def review_production_record(request, pk):
    """
    POST /production/records/<pk>/review/
    Review and verify production records:
    - SIBAT/CBAT: Field verification of standard and flagged records (status = VERIFIED or SUBJECT_TO_REVISION)
    - MAO/ADMIN: Official municipal certification (status = APPROVED or SUBJECT_TO_REVISION)
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
    reviewer_role = getattr(getattr(user, "role", None), "role_name", "")

    if reviewer_role not in ["SIBAT", "CBAT", "MAO", "ADMIN"]:
        return Response(
            {"error": "Only SIBAT, CBAT, and MAO may review production records."},
            status=status.HTTP_403_FORBIDDEN,
        )

    previous_status = record.status
    validate_production_review_transition(
        record=record,
        role=reviewer_role,
        target=new_status,
        remarks=remarks,
    )

    reviewed_at_now = timezone.now()
    reviewer_display = user.get_full_name().strip() or user.username

    if isinstance(record.anomaly_assessment, dict):
        assessment_copy = dict(record.anomaly_assessment)
        review_events = list(assessment_copy.get("review_events") or [])
        review_events.append({
            "reviewer_id": user.pk,
            "reviewer_name": reviewer_display,
            "reviewer_role": reviewer_role,
            "from_status": previous_status,
            "to_status": new_status,
            "remarks": remarks,
            "reviewed_at": reviewed_at_now.isoformat(),
        })
        assessment_copy["review_events"] = review_events
        if reviewer_role in FIELD_REVIEWERS and record.requires_cbat_verification:
            assessment_copy["cbat_verification"] = {
                "verified_by_id": user.pk,
                "verified_by_name": reviewer_display,
                "verified_by_role": reviewer_role,
                "status": new_status,
                "remarks": remarks,
                "verified_at": reviewed_at_now.isoformat(),
            }
        record.anomaly_assessment = assessment_copy

    record.status = new_status
    record.reviewed_by = request.user
    record.review_remarks = remarks
    record.reviewed_at = reviewed_at_now
    record.save()

    source_farmer = (record.livestock or record.batch).farmer
    if new_status == "SUBJECT_TO_REVISION":
        if record.requires_cbat_verification and reviewer_role in {"MAO", "ADMIN"}:
            notify_role(
                role_name="CBAT",
                barangay_id=source_farmer.barangay_id,
                notification_type=Notification.NotificationType.PRODUCTION,
                priority=Notification.Priority.HIGH,
                title=f"Revision required: record #{record.pk}",
                message=remarks,
                link=f"/sibat/production-records?reviewType=PRODUCTION&reviewId={record.pk}",
                related_entity_type="production_record",
                related_entity_id=record.pk,
            )
        else:
            notify_review_revision(
                source_farmer,
                request.user,
                title="Revision required: record #" + str(record.pk),
                message=remarks,
                link=f"/sibat?tab=production&reviewType=PRODUCTION&reviewId={record.pk}",
            )

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
        verifier_label = "CBAT" if reviewer_role == "CBAT" else "SIBAT"
        notify_role(
            role_name="MAO",
            notification_type=Notification.NotificationType.PRODUCTION,
            priority=Notification.Priority.MEDIUM,
            title="Production Record Awaiting MAO Approval",
            message=(
                f"{verifier_label} verified {record.quantity} {record.unit} of "
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
            verifier_label = "CBAT" if reviewer_role == "CBAT" else "SIBAT"
            create_notification(
                user=target_farmer,
                notification_type=Notification.NotificationType.PRODUCTION,
                priority=Notification.Priority.MEDIUM,
                title=f"Production Record Verified by {verifier_label}",
                message=f"Your production declaration for {prod_info} was verified on-farm by {verifier_label}.{f' Remarks: {remarks}' if remarks else ''}",
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

    serializer = ProductionRecordSerializer(record, context={"request": request})
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
            title="Verified Sale Awaiting MAO Approval", message=f"Sale #{sale.pk} was verified by {user_role}.",
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
                title=f"Calving Record Verified by {user_role}",
                message=f"Your birth declaration for {calf_info} was verified on-farm by {user_role}.{f' Remarks: {remarks}' if remarks else ''}",
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
            title="Verified Calving Awaiting MAO Approval", message=f"Calving #{calving.pk} was verified by {user_role}.",
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

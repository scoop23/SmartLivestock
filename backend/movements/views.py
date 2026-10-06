from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404
from django.db import transaction, IntegrityError
from django.utils import timezone
from django.db.models import Q

from movements.models import (
    LivestockInspection,
    LivestockInspectionItem,
    LivestockInspectionClearance,
    MeatMovementRecord,
)
from movements.serializer import (
    LivestockInspectionSerializer,
    LivestockInspectionItemSerializer,
    LivestockInspectionClearanceSerializer,
)
from users.models import Notification
from users.notification_views import create_notification, notify_role
from smartlivestock.workflows import (
    require_action,
    role_name,
    validate_review_transition,
    scope_reviewer_queryset,
    AUCTION,
    MAO,
    ADMIN,
    SIBAT,
    FARMER,
)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def inspection_list_create(request):
    """
    GET  /api/inspections/ -> List inspections scoped by user role
    POST /api/inspections/ -> Create new inspection with nested items & clearance
    """
    user = request.user
    user_role = role_name(user)

    if request.method == "POST":
        require_action(user, "inspections", "create")
        with transaction.atomic():
            serializer = LivestockInspectionSerializer(
                data=request.data,
                context={"request": request},
            )
            serializer.is_valid(raise_exception=True)
            inspection = serializer.save()

            # Trigger notification to MAO for municipal awareness
            notify_role(
                role_name="MAO",
                notification_type=Notification.NotificationType.INSPECTION,
                priority=Notification.Priority.MEDIUM,
                title="New Livestock Inspection Awaiting Validation",
                message=f"Inspection #{inspection.id} for {inspection.shipper_name} created by Auction Officer ({user.get_full_name() or user.username}).",
                link="/data-validation",
                related_entity_type="inspection",
                related_entity_id=inspection.id,
            )

            return Response(serializer.data, status=status.HTTP_201_CREATED)

    # GET: Apply role-based scoping
    queryset = LivestockInspection.objects.select_related(
        "shipper", "created_by", "clearance", "clearance__issued_by", "clearance__reviewed_by"
    ).prefetch_related("items", "items__livestock_type", "items__inventory").order_by("-created_at")

    if user_role == FARMER:
        farmer_profile = getattr(user, "farmer_profile", None)
        if farmer_profile:
            queryset = queryset.filter(shipper=farmer_profile)
        else:
            queryset = queryset.none()
    elif user_role == SIBAT:
        queryset = scope_reviewer_queryset(queryset, user)
    elif user_role in (AUCTION, MAO, ADMIN):
        # Full operational inspection visibility
        pass
    else:
        queryset = queryset.none()

    # Optional status filtering
    status_filter = request.query_params.get("status")
    if status_filter and status_filter.upper() != "ALL":
        queryset = queryset.filter(clearance__status=status_filter.upper())

    # Optional search filtering
    search = request.query_params.get("search", "").strip().lower()
    if search:
        queryset = queryset.filter(
            Q(shipper_name__icontains=search)
            | Q(destination__icontains=search)
            | Q(purpose__icontains=search)
            | Q(clearance__control_number__icontains=search)
            | Q(clearance__vehicle_plate_number__icontains=search)
        )

    serializer = LivestockInspectionSerializer(queryset, many=True, context={"request": request})
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(["GET", "PUT", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def inspection_detail(request, pk):
    """
    GET    /api/inspections/<pk>/ -> Retrieve inspection details
    PUT    /api/inspections/<pk>/ -> Update inspection (only if PENDING or SUBJECT_TO_REVISION)
    PATCH  /api/inspections/<pk>/ -> Partial update inspection
    DELETE /api/inspections/<pk>/ -> Delete inspection & clean up associated notifications
    """
    user = request.user
    user_role = role_name(user)

    inspection = get_object_or_404(
        LivestockInspection.objects.select_related(
            "shipper", "created_by", "clearance", "clearance__issued_by", "clearance__reviewed_by"
        ).prefetch_related("items", "items__livestock_type", "items__inventory"),
        pk=pk,
    )

    # Object-level authorization
    if user_role == FARMER:
        if not inspection.shipper or inspection.shipper.user_id != user.id:
            return Response({"detail": "Not authorized to access this inspection."}, status=status.HTTP_403_FORBIDDEN)
    elif user_role == SIBAT:
        if not user.access_scope == "ALL_BARANGAYS":
            if not inspection.shipper or inspection.shipper.barangay_id != user.assigned_barangay_id:
                return Response({"detail": "Not authorized to access inspections outside assigned barangay."}, status=status.HTTP_403_FORBIDDEN)

    clearance = getattr(inspection, "clearance", None)
    current_status = clearance.status if clearance else "PENDING"

    if request.method == "GET":
        serializer = LivestockInspectionSerializer(inspection, context={"request": request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    if request.method in ("PUT", "PATCH"):
        require_action(user, "inspections", "edit_own")
        if current_status == "APPROVED":
            return Response(
                {"error": "Cannot modify an officially approved inspection clearance."},
                status=status.HTTP_409_CONFLICT,
            )

        serializer = LivestockInspectionSerializer(
            inspection,
            data=request.data,
            partial=(request.method == "PATCH"),
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        updated_inspection = serializer.save()
        return Response(LivestockInspectionSerializer(updated_inspection, context={"request": request}).data)

    if request.method == "DELETE":
        require_action(user, "inspections", "delete_own")
        if current_status == "APPROVED":
            return Response(
                {"error": "Cannot delete an officially approved inspection certificate."},
                status=status.HTTP_409_CONFLICT,
            )

        with transaction.atomic():
            Notification.objects.filter(
                related_entity_type="inspection",
                related_entity_id=inspection.id,
            ).delete()
            inspection.delete()

        return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def inspection_verify(request, pk):
    """
    POST /api/inspections/<pk>/verify/
    Auction officer validates inspection findings and forwards to MAO (PENDING / SUBJECT_TO_REVISION -> VERIFIED).
    """
    user = request.user
    user_role = role_name(user)

    inspection = get_object_or_404(
        LivestockInspection.objects.select_related("clearance", "created_by"),
        pk=pk,
    )
    clearance = getattr(inspection, "clearance", None)
    if not clearance:
        return Response({"error": "Clearance record not initialized."}, status=status.HTTP_400_BAD_REQUEST)

    # Validate workflow transition
    validate_review_transition(
        domain="inspections",
        role=user_role,
        current=clearance.status,
        target="VERIFIED",
    )

    with transaction.atomic():
        clearance.status = LivestockInspectionClearance.StatusType.VERIFIED
        clearance.save(update_fields=["status"])

        # Notify MAO for final municipal approval
        notify_role(
            role_name="MAO",
            notification_type=Notification.NotificationType.INSPECTION,
            priority=Notification.Priority.HIGH,
            title="Livestock Inspection Verified by Auction",
            message=f"Livestock inspection #{inspection.id} ({inspection.shipper_name}) has been verified by Auction and is awaiting MAO approval.",
            link="/data-validation",
            related_entity_type="inspection",
            related_entity_id=inspection.id,
        )

    serializer = LivestockInspectionSerializer(inspection, context={"request": request})
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def inspection_review(request, pk):
    """
    POST /api/inspections/<pk>/review/
    MAO / Admin reviews verified inspection (VERIFIED -> APPROVED or SUBJECT_TO_REVISION).
    Requires 'remarks' if returning for revision.
    """
    user = request.user
    user_role = role_name(user)

    target_status = request.data.get("status")
    remarks = request.data.get("remarks", "").strip()

    inspection = get_object_or_404(
        LivestockInspection.objects.select_related("clearance", "created_by", "shipper", "shipper__user")
        .prefetch_related("items", "items__inventory"),
        pk=pk,
    )
    clearance = getattr(inspection, "clearance", None)
    if not clearance:
        return Response({"error": "Clearance record not initialized."}, status=status.HTTP_400_BAD_REQUEST)

    validate_review_transition(
        domain="inspections",
        role=user_role,
        current=clearance.status,
        target=target_status,
        remarks=remarks,
    )

    with transaction.atomic():
        if target_status == LivestockInspectionClearance.StatusType.APPROVED:
            # Backend sanity validation
            if not inspection.items.exists():
                return Response(
                    {"error": "Cannot approve an inspection with no animal line items."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Ensure any linked registered livestock remain valid and approved
            for item in inspection.items.all():
                if item.inventory:
                    if item.inventory.status != "APPROVED" or item.inventory.operational_status != "ACTIVE":
                        return Response(
                            {"error": f"Animal {item.inventory.tag_number or item.inventory.id} is no longer approved and active."},
                            status=status.HTTP_400_BAD_REQUEST,
                        )

            now = timezone.now()
            clearance.status = LivestockInspectionClearance.StatusType.APPROVED
            clearance.issued_by = user
            clearance.date_issued = now.date()
            clearance.time_issued = now.time()
            clearance.reviewed_by = user
            clearance.reviewed_at = now
            clearance.review_remarks = remarks
            clearance.save()

            # Notify creator (Auction Officer)
            create_notification(
                user=inspection.created_by,
                notification_type=Notification.NotificationType.INSPECTION,
                priority=Notification.Priority.HIGH,
                title=f"Livestock Inspection #{inspection.id} Approved",
                message=f"Livestock inspection #{inspection.id} has been officially approved by MAO. Clearance permit {clearance.control_number} is now issued.",
                link="/auction-inspections",
                related_entity_type="inspection",
                related_entity_id=inspection.id,
            )

            # Notify registered shipper farmer if applicable
            if inspection.shipper and hasattr(inspection.shipper, "user") and inspection.shipper.user:
                create_notification(
                    user=inspection.shipper.user,
                    notification_type=Notification.NotificationType.INSPECTION,
                    priority=Notification.Priority.MEDIUM,
                    title="Livestock Transport Clearance Approved",
                    message=f"Clearance permit {clearance.control_number} for transport to {inspection.destination} has been approved by MAO.",
                    link="/livestock-inventory",
                    related_entity_type="inspection",
                    related_entity_id=inspection.id,
                )

        elif target_status == LivestockInspectionClearance.StatusType.SUBJECT_TO_REVISION:
            now = timezone.now()
            clearance.status = LivestockInspectionClearance.StatusType.SUBJECT_TO_REVISION
            clearance.reviewed_by = user
            clearance.reviewed_at = now
            clearance.review_remarks = remarks
            clearance.save(update_fields=["status", "reviewed_by", "reviewed_at", "review_remarks"])

            # Notify creator (Auction Officer)
            create_notification(
                user=inspection.created_by,
                notification_type=Notification.NotificationType.INSPECTION,
                priority=Notification.Priority.HIGH,
                title=f"Livestock Inspection #{inspection.id} Requires Revision",
                message=f"MAO returned inspection #{inspection.id} for revision. Reason: {remarks}",
                link="/auction-inspections",
                related_entity_type="inspection",
                related_entity_id=inspection.id,
            )

    serializer = LivestockInspectionSerializer(inspection, context={"request": request})
    return Response(serializer.data, status=status.HTTP_200_OK)

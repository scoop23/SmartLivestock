from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from django.shortcuts import get_object_or_404
from django.db import transaction, IntegrityError
from django.utils import timezone
from django.db.models import Q, Prefetch
from urllib.parse import urlparse, parse_qs
from livestock.models import Farmer, LivestockInventory

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


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def inspection_shipper_options(request):
    """Search authorized shipper identities and their approved, active animals."""
    if role_name(request.user) not in (AUCTION, MAO, ADMIN):
        raise PermissionDenied("Only auction and MAO staff can search registered shippers.")
    query = request.query_params.get("search", "").strip()
    if len(query) < 2:
        return Response([])
    eligible_animals = LivestockInventory.objects.filter(
        status=LivestockInventory.StatusType.APPROVED,
        operational_status=LivestockInventory.OperationalStatus.ACTIVE,
        quantity=1,
    ).select_related("livestock_type")
    farmers = Farmer.objects.select_related("user").prefetch_related(
        Prefetch("inventories", queryset=eligible_animals, to_attr="eligible_animals")
    ).filter(
        Q(user__first_name__icontains=query) | Q(user__last_name__icontains=query)
        | Q(user__username__icontains=query)
    ).order_by("user__username")[:20]
    return Response([
        {
            "id": farmer.id,
            "name": farmer.user.get_full_name() or farmer.user.username,
            "address": farmer.address,
            "animals": [
                {
                    "id": animal.id,
                    "tag_number": animal.tag_number or str(animal.id),
                    "livestock_type": animal.livestock_type_id,
                    "livestock_type_name": animal.livestock_type.name,
                }
                for animal in farmer.eligible_animals
            ],
        }
        for farmer in farmers
    ])


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def inspection_livestock_lookup(request):
    """Resolve an animal identity without changing records or approval state."""
    user = request.user
    user_role = role_name(user)
    farmer_profile = getattr(user, "farmer_profile", None)

    # Lookup access follows existing inventory scopes; a QR is only an identifier,
    # so the same ownership and barangay rules still apply after it is decoded.
    if user_role == FARMER:
        if farmer_profile is None:
            raise PermissionDenied("A farmer profile is required to look up livestock.")
    elif user_role == AUCTION:
        require_action(user, "inspections", "read_all")
    else:
        require_action(user, "inventory", "read_all")

    code = request.query_params.get("code", "").strip()
    if len(code) > 255:
        return Response({"detail": "The livestock identifier is too long."}, status=status.HTTP_400_BAD_REQUEST)

    canonical_id = None
    if "://" in code:
        try:
            query = parse_qs(urlparse(code).query)
        except ValueError:
            return Response({"detail": "The livestock QR URL is invalid."}, status=status.HTTP_400_BAD_REQUEST)
        # Batch identity links intentionally stay separate from individual animal IDs.
        livestock_id = query.get("livestockId", [""])[0].strip()
        if livestock_id.isdigit():
            canonical_id = int(livestock_id)
            code = ""
        else:
            code = (livestock_id or query.get("tag", [""])[0]).strip()
    if code.upper().startswith("SL-LIVESTOCK:"):
        candidate = code.split(":", 1)[1].strip()
        if not candidate.isdigit():
            return Response({"detail": "The livestock QR payload is invalid."}, status=status.HTTP_400_BAD_REQUEST)
        canonical_id = int(candidate)
        code = ""
    if not code:
        if canonical_id is None:
            return Response({"detail": "A livestock tag or ID is required."}, status=status.HTTP_400_BAD_REQUEST)

    # Build the authorized queryset before looking up the key. Returning 404 for
    # out-of-scope records avoids revealing whether another barangay has that ID.
    inventory_queryset = LivestockInventory.objects.select_related(
        "livestock_type", "farmer", "farmer__user", "farmer__barangay"
    ).filter(
        entry_type=LivestockInventory.EntryType.INDIVIDUAL,
        quantity=1,
    )
    if user_role == FARMER:
        inventory_queryset = inventory_queryset.filter(farmer=farmer_profile)
    elif user_role == SIBAT:
        inventory_queryset = scope_reviewer_queryset(inventory_queryset, user)

    if canonical_id is not None:
        inventory = inventory_queryset.filter(pk=canonical_id).first()
    else:
        matches = inventory_queryset.filter(tag_number__iexact=code)
        if code.isdigit():
            # Old manual numeric IDs remain supported, but QR payloads always use
            # the explicit prefix so a numeric tag cannot shadow the canonical PK.
            matches = matches | inventory_queryset.filter(pk=int(code))
        possible_matches = list(matches.order_by("pk")[:2])
        if len(possible_matches) > 1:
            return Response(
                {"detail": "This tag is ambiguous. Scan the livestock QR or use its unique database ID."},
                status=status.HTTP_409_CONFLICT,
            )
        inventory = possible_matches[0] if possible_matches else None
    if not inventory:
        return Response({"detail": "Livestock record not found for that tag or ID."}, status=status.HTTP_404_NOT_FOUND)

    farmer = inventory.farmer
    # Identity can still be traced when inactive; action eligibility is checked
    # separately from existence using the current approval and lifecycle fields.
    eligible = (
        inventory.status == LivestockInventory.StatusType.APPROVED
        and inventory.operational_status == LivestockInventory.OperationalStatus.ACTIVE
    )
    ineligibility_reason = ""
    if not eligible:
        ineligibility_reason = (
            f"This livestock cannot be added as registered livestock "
            f"(registration: {inventory.status}; operational status: {inventory.operational_status}). "
            "Only approved, active individual livestock can be linked."
        )
    return Response({
        "id": inventory.id,
        "tag_number": inventory.tag_number or str(inventory.id),
        "livestock_type": inventory.livestock_type_id,
        "livestock_type_name": inventory.livestock_type.name,
        "breed": inventory.breed,
        "sex": inventory.sex,
        "birth_date": inventory.birth_date,
        "age": inventory.age_as_of(timezone.localdate()),
        "age_classification": inventory.age_classification_as_of(timezone.localdate()),
        "registration_status": inventory.status,
        "operational_status": inventory.operational_status,
        "eligible": eligible,
        "ineligibility_reason": ineligibility_reason,
        "owner_id": inventory.farmer_id,
        "owner_name": farmer.user.get_full_name() or farmer.user.username,
        "origin": farmer.address or "",
        "barangay": farmer.barangay.barangay_name if farmer.barangay else "",
    })


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def inspection_list_create(request):
    """
    GET  /api/inspections/ -> List inspections scoped by user role
    POST /api/inspections/ -> Create new inspection with nested items & clearance
    """
    user = request.user
    user_role = role_name(user)

    # POST validates and persists intake; GET returns records scoped to the caller's role.
    if request.method == "POST":
        require_action(user, "inspections", "create")

        data = request.data.copy() if hasattr(request.data, "copy") else dict(request.data)
        if user_role == FARMER:
            farmer_profile = getattr(user, "farmer_profile", None)
            if not farmer_profile:
                return Response(
                    {"detail": "Farmer profile does not exist for this account."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            data["shipper"] = farmer_profile.id
            if not data.get("shipper_name"):
                data["shipper_name"] = user.get_full_name() or user.username
            if not data.get("shipper_address"):
                data["shipper_address"] = farmer_profile.address or (farmer_profile.barangay.barangay_name if farmer_profile.barangay else "")
            if not data.get("origin"):
                data["origin"] = data.get("shipper_address", "")

        # Inspection, item lines and pending clearance are created as one unit:
        # a validation failure must not leave a partial movement record.
        with transaction.atomic():
            serializer = LivestockInspectionSerializer(
                data=data,
                context={"request": request},
            )
            serializer.is_valid(raise_exception=True)
            inspection = serializer.save()

            if user_role == FARMER:
                notify_role(
                    role_name="AUCTION",
                    notification_type=Notification.NotificationType.INSPECTION,
                    priority=Notification.Priority.MEDIUM,
                    title="New Livestock Inspection Request",
                    message=f"Inspection request #{inspection.id} submitted by {inspection.shipper_name} for transport to {inspection.destination}.",
                    link="/auction-inspections",
                    related_entity_type="inspection",
                    related_entity_id=inspection.id,
                )
            else:
                notify_role(
                    role_name="MAO",
                    notification_type=Notification.NotificationType.INSPECTION,
                    priority=Notification.Priority.MEDIUM,
                    title="New Livestock Inspection Awaiting Validation",
                    message=f"Inspection #{inspection.id} for {inspection.shipper_name} created by {user.get_full_name() or user.username}.",
                    link="/data-validation",
                    related_entity_type="inspection",
                    related_entity_id=inspection.id,
                )

            return Response(serializer.data, status=status.HTTP_201_CREATED)

    # GET: scope the database query before serialization, then apply optional UI filters.
    queryset = LivestockInspection.objects.select_related(
        "shipper", "created_by", "created_by__role", "clearance", "clearance__issued_by", "clearance__reviewed_by"
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
            "shipper", "created_by", "created_by__role", "clearance", "clearance__issued_by", "clearance__reviewed_by"
        ).prefetch_related("items", "items__livestock_type", "items__inventory"),
        pk=pk,
    )

    # Object-level authorization narrows access beyond login: a farmer can only read
    # their own shipment and SIBAT is limited to the assigned barangay scope.
    if user_role == FARMER:
        if not inspection.shipper or inspection.shipper.user_id != user.id:
            return Response({"detail": "Not authorized to access this inspection."}, status=status.HTTP_403_FORBIDDEN)
    elif user_role == SIBAT:
        if not user.access_scope == "ALL_BARANGAYS":
            if not inspection.shipper or inspection.shipper.barangay_id != user.assigned_barangay_id:
                return Response({"detail": "Not authorized to access inspections outside assigned barangay."}, status=status.HTTP_403_FORBIDDEN)
    elif user_role not in (AUCTION, MAO, ADMIN):
        raise PermissionDenied("This role cannot access auction movement records.")

    clearance = getattr(inspection, "clearance", None)
    current_status = clearance.status if clearance else "PENDING"

    if request.method == "GET":
        serializer = LivestockInspectionSerializer(inspection, context={"request": request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    if request.method in ("PUT", "PATCH"):
        require_action(user, "inspections", "edit_own")
        if inspection.created_by_id != user.id:
            raise PermissionDenied("Only the record creator can correct this record.")
        if current_status != "SUBJECT_TO_REVISION":
            return Response(
                {"error": "Records can be edited only after MAO requests revision."},
                status=status.HTTP_409_CONFLICT,
            )
        if user_role == FARMER and "shipper" in request.data:
            raise PermissionDenied("Farmers cannot change the registered shipper.")

        serializer = LivestockInspectionSerializer(
            inspection,
            data=request.data,
            partial=(request.method == "PATCH"),
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            updated_inspection = serializer.save()


        return Response(LivestockInspectionSerializer(updated_inspection, context={"request": request}).data)

    if request.method == "DELETE":
        require_action(user, "inspections", "delete_own")
        if inspection.created_by_id != user.id and user_role != ADMIN:
            raise PermissionDenied("Only the record creator can delete this record.")
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
            if hasattr(inspection, "clearance"):
                inspection.clearance.delete()
            inspection.delete()

        return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def inspection_resubmit(request, pk):
    """Return a corrected record to pending review; only its creator can resubmit."""
    require_action(request.user, "inspections", "edit_own")
    inspection = get_object_or_404(LivestockInspection.objects.select_related("clearance"), pk=pk)
    if inspection.created_by_id != request.user.id:
        raise PermissionDenied("Only the record creator can resubmit this record.")
    clearance = inspection.clearance
    if clearance.status != LivestockInspectionClearance.StatusType.SUBJECT_TO_REVISION:
        return Response({"error": "Only records returned by MAO can be resubmitted."}, status=status.HTTP_409_CONFLICT)
    if not inspection.items.exists():
        return Response({"items": "Add at least one livestock line."}, status=status.HTTP_400_BAD_REQUEST)
    with transaction.atomic():
        clearance.status = LivestockInspectionClearance.StatusType.PENDING
        clearance.save(update_fields=["status"])
        next_role = "AUCTION" if role_name(inspection.created_by) == FARMER else "MAO"
        notify_role(
            role_name=next_role,
            notification_type=Notification.NotificationType.INSPECTION,
            priority=Notification.Priority.HIGH,
            title=f"Auction Record #{inspection.id} Resubmitted",
            message=f"{inspection.shipper_name}'s movement record is awaiting review again.",
            link="/auction-inspections" if next_role == "AUCTION" else "/data-validation",
            related_entity_type="inspection",
            related_entity_id=inspection.id,
        )
    return Response(LivestockInspectionSerializer(inspection, context={"request": request}).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def inspection_verify(request, pk):
    """Auction forwards farmer-created intake; Auction-created logs bypass this step."""
    if role_name(request.user) != AUCTION:
        raise PermissionDenied("Only Auction staff can submit Farmer requests to MAO.")
    inspection = get_object_or_404(
        LivestockInspection.objects.select_related("clearance", "created_by__role"), pk=pk
    )
    if role_name(inspection.created_by) != FARMER:
        return Response({"error": "Auction-created records are already submitted to MAO."},
                        status=status.HTTP_409_CONFLICT)
    clearance = inspection.clearance
    validate_review_transition(domain="inspections", role=AUCTION,
                               current=clearance.status, target="VERIFIED")
    with transaction.atomic():
        clearance.status = LivestockInspectionClearance.StatusType.VERIFIED
        clearance.save(update_fields=["status"])
        notify_role(
            role_name="MAO",
            notification_type=Notification.NotificationType.INSPECTION,
            priority=Notification.Priority.HIGH,
            title=f"Auction Record #{inspection.id} Submitted",
            message=f"Auction submitted {inspection.shipper_name}'s movement record for MAO review.",
            link="/data-validation",
            related_entity_type="inspection",
            related_entity_id=inspection.id,
        )
    return Response(LivestockInspectionSerializer(inspection, context={"request": request}).data)

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def inspection_review(request, pk):
    """
    POST /api/inspections/<pk>/review/
    MAO / Admin reviews submitted inspection (PENDING or legacy VERIFIED).
    Requires 'remarks' if returning for revision.
    """
    # This is the final authority boundary: only MAO/Admin can approve or return.
    user = request.user
    user_role = require_action(user, "inspections", "review")
    if user_role not in [MAO, ADMIN]:
        raise PermissionDenied("Only MAO personnel or Administrators can review and approve livestock inspections.")

    target_status = request.data.get("status")
    remarks = request.data.get("remarks", "").strip()

    inspection = get_object_or_404(
        LivestockInspection.objects.select_related("clearance", "created_by", "created_by__role", "shipper", "shipper__user")
        .prefetch_related("items", "items__inventory"),
        pk=pk,
    )
    clearance = getattr(inspection, "clearance", None)
    if not clearance:
        return Response({"error": "Clearance record not initialized."}, status=status.HTTP_400_BAD_REQUEST)
    if role_name(inspection.created_by) == FARMER and clearance.status == "PENDING":
        return Response({"status": "Farmer requests must be submitted by Auction staff first."},
                        status=status.HTTP_409_CONFLICT)

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

            # Recheck linked inventory at approval time: lookup may have happened
            # earlier, so status, ownership and individual quantity must still match.
            for item in inspection.items.all():
                if item.inventory:
                    if (item.inventory.status != "APPROVED" or item.inventory.operational_status != "ACTIVE"
                            or item.inventory.farmer_id != inspection.shipper_id
                            or item.inventory.quantity != 1):
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

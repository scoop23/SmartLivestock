from django.shortcuts import get_object_or_404
from django.db import IntegrityError, transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.views.decorators.cache import cache_page

from livestock.models import Barangay, LivestockBatch, LivestockInventory, LivestockType, Farmer
from livestock.serializer import (
    FarmerOptionsSerializer,
    LivestockInventorySerializer,
    BarangaySerializer,
)
from users.models import Notification
from users.notification_views import create_notification, notify_role
from smartlivestock.workflows import require_action, role_name, validate_review_transition



@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def inventory_list_create(request):
    """
    GET  /api/livestock/inventory/ -> List livestock inventory for logged-in farmer (or all for MAO/SIBAT/Admin)
    POST /api/livestock/inventory/ -> Register a new livestock inventory entry
    """
    user = request.user
    user_role = role_name(user)

    if request.method == "POST":
        require_action(user, "inventory", "create")
        serializer = LivestockInventorySerializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        inventory = serializer.save()
        farmer_name = user.get_full_name() or user.username
        animal_name = inventory.tag_number or inventory.breed or inventory.livestock_type.name
        notify_role(
            role_name="SIBAT",
            notification_type=Notification.NotificationType.SIBAT,
            priority=Notification.Priority.MEDIUM,
            title="New Livestock Entry Awaiting Verification",
            message=f"{farmer_name} registered {animal_name}. Review the entry and schedule field verification.",
            link="/sibat-validation",
        )
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    # GET: Enforce strict farmer data isolation
    if user_role == "FARMER":
        farmer_profile = getattr(user, "farmer_profile", None)
        if farmer_profile:
            inventories = LivestockInventory.objects.filter(
                Q(farmer=farmer_profile) | Q(created_by=user)
            ).distinct()
        else:
            inventories = LivestockInventory.objects.filter(created_by=user)
    else:
        require_action(user, "inventory", "read_all")
        inventories = LivestockInventory.objects.all()

    requested_operational_status = request.query_params.get("operational_status")
    include_inactive = request.query_params.get("include_inactive", "").lower() == "true"
    if requested_operational_status:
        if requested_operational_status not in LivestockInventory.OperationalStatus.values:
            return Response(
                {
                    "error": (
                        f"Invalid operational_status. Valid choices are: "
                        f"{list(LivestockInventory.OperationalStatus.values)}"
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        inventories = inventories.filter(operational_status=requested_operational_status)
    elif not include_inactive:
        inventories = inventories.filter(
            operational_status=LivestockInventory.OperationalStatus.ACTIVE
        )

    inventories = inventories.select_related(
        "livestock_type",
        "farmer__user",
        "farmer__barangay",
        "batch",
        "reviewed_by",
        "created_by",
    ).order_by("-created_at")

    serializer = LivestockInventorySerializer(
        inventories, many=True, context={"request": request}
    )
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(["GET", "PUT", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def inventory_detail(request, pk):
    """
    GET    /api/livestock/inventory/<id>/ -> Retrieve single livestock inventory item
    PUT    /api/livestock/inventory/<id>/ -> Full update
    PATCH  /api/livestock/inventory/<id>/ -> Partial update
    DELETE /api/livestock/inventory/<id>/ -> Delete entry (only if unreferenced)
    """
    user = request.user
    user_role = role_name(user)

    if request.method != "GET":
        batch_id = LivestockInventory.objects.filter(pk=pk).values_list("batch_id", flat=True).first()
        if batch_id:
            get_object_or_404(LivestockBatch.objects.select_for_update(), pk=batch_id)

    base_qs = LivestockInventory.objects.select_related(
        "livestock_type",
        "farmer__user",
        "farmer__barangay",
        "batch",
        "reviewed_by",
        "created_by",
    )
    if request.method != "GET":
        base_qs = base_qs.select_for_update(of=("self",))

    if user_role == "FARMER":
        farmer_profile = getattr(user, "farmer_profile", None)
        if farmer_profile:
            inventory = get_object_or_404(
                base_qs, Q(farmer=farmer_profile) | Q(created_by=user), pk=pk
            )
        else:
            inventory = get_object_or_404(base_qs, created_by=user, pk=pk)
    else:
        require_action(user, "inventory", "read_all")
        inventory = get_object_or_404(base_qs, pk=pk)

    if request.method in ["PUT", "PATCH", "DELETE"]:
        require_action(user, "inventory", "edit_own")
        editable_statuses = {
            LivestockInventory.StatusType.PENDING,
            LivestockInventory.StatusType.SUBJECT_TO_REVISION,
        }
        if inventory.status not in editable_statuses:
            return Response(
                {"error": "Only PENDING or SUBJECT_TO_REVISION inventory records can be changed."},
                status=status.HTTP_409_CONFLICT,
            )

    if request.method == "DELETE":
        if inventory.batch_id:
            return Response(
                {"error": "Cohort animals must remain with their batch. Delete the pending batch instead."},
                status=status.HTTP_409_CONFLICT,
            )
        try:
            inventory.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except IntegrityError:
            return Response(
                {
                    "error": "Cannot delete: this livestock record is referenced by production or disease records."
                },
                status=status.HTTP_409_CONFLICT,
            )

    if request.method in ["PUT", "PATCH"]:
        serializer = LivestockInventorySerializer(
            inventory,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        was_returned = inventory.status == LivestockInventory.StatusType.SUBJECT_TO_REVISION
        inventory = serializer.save()
        if was_returned and not inventory.batch_id:
            inventory.status = LivestockInventory.StatusType.PENDING
            inventory.reviewed_by = None
            inventory.reviewed_at = None
            inventory.save(update_fields=["status", "reviewed_by", "reviewed_at"])
            farmer_name = user.get_full_name() or user.username
            animal_name = inventory.tag_number or inventory.breed or inventory.livestock_type.name
            notify_role(
                role_name="SIBAT",
                notification_type=Notification.NotificationType.SIBAT,
                priority=Notification.Priority.MEDIUM,
                title="Livestock Entry Resubmitted",
                message=f"{farmer_name} corrected and resubmitted {animal_name} for field verification.",
                link="/sibat-validation",
            )
        return Response(serializer.data, status=status.HTTP_200_OK)

    # GET
    serializer = LivestockInventorySerializer(inventory, context={"request": request})
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def review_inventory(request, pk):
    """
    POST /api/livestock/inventory/<id>/review/
    Review and verify livestock inventory:
    - SIBAT: Field tagging & verification (status = VERIFIED)
    - MAO: Official municipal certification (status = APPROVED or SUBJECT_TO_REVISION)
    """
    inventory = get_object_or_404(LivestockInventory, pk=pk)

    if inventory.batch_id:
        batch = inventory.batch
        return Response(
            {
                "error": (
                    f"This animal belongs to cohort {batch.batch_code}. Review the entire "
                    f"batch via livestock/batches/{inventory.batch_id}/review/ so all cohort "
                    "animals move through FARMER -> SIBAT -> MAO validation together."
                )
            },
            status=status.HTTP_409_CONFLICT,
        )

    new_status = request.data.get("status")
    remarks = request.data.get("remarks", "")

    if not new_status:
        return Response(
            {"error": "status is required (VERIFIED, APPROVED, or SUBJECT_TO_REVISION)."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user = request.user
    user_role = require_action(user, "inventory", "review")
    validate_review_transition(
        domain="inventory",
        role=user_role,
        current=inventory.status,
        target=new_status,
        remarks=remarks,
    )

    inventory.status = new_status
    inventory.reviewed_by = request.user
    inventory.review_remarks = remarks
    inventory.reviewed_at = timezone.now()
    inventory.save()

    if new_status == LivestockInventory.StatusType.VERIFIED:
        notify_role(
            role_name="MAO",
            notification_type=Notification.NotificationType.GENERAL,
            priority=Notification.Priority.MEDIUM,
            title="Livestock Entry Awaiting MAO Approval",
            message=(
                f"SIBAT verified {inventory.tag_number or inventory.livestock_type.name} "
                f"from {inventory.farmer.user.get_full_name() or inventory.farmer.user.username}."
            ),
            link="/data-validation?domain=inventory",
        )

    # Automatically notify the animal's owner/registrant
    target_user = None
    if inventory.farmer and getattr(inventory.farmer, "user", None):
        target_user = inventory.farmer.user
    elif inventory.created_by:
        target_user = inventory.created_by

    if target_user:
        species_name = inventory.livestock_type.name if inventory.livestock_type else "Livestock"
        tag_info = inventory.tag_number or f"Batch ({inventory.quantity} heads)"
        inventory_detail_link = f"/livestock-inventory/{inventory.pk}"

        if new_status == LivestockInventory.StatusType.VERIFIED:
            create_notification(
                user=target_user,
                notification_type=Notification.NotificationType.SIBAT,
                priority=Notification.Priority.MEDIUM,
                title="Verified by SIBAT Inspector",
                message=f"Your {species_name} [{tag_info}] has been verified on-farm by SIBAT.{f' Officer Remarks: {remarks}' if remarks else ''}",
                link=inventory_detail_link,
            )
        elif new_status == LivestockInventory.StatusType.APPROVED:
            create_notification(
                user=target_user,
                notification_type=Notification.NotificationType.GENERAL,
                priority=Notification.Priority.MEDIUM,
                title="Livestock Record Approved",
                message=f"Official certification approved for your {species_name} [{tag_info}].",
                link=inventory_detail_link,
            )
        elif new_status == LivestockInventory.StatusType.SUBJECT_TO_REVISION:
            create_notification(
                user=target_user,
                notification_type=Notification.NotificationType.GENERAL,
                priority=Notification.Priority.HIGH,
                title="Revision Required on Livestock Record",
                message=f"Your {species_name} [{tag_info}] requires revision.{f' Note: {remarks}' if remarks else ''}",
                link=inventory_detail_link,
            )

    serializer = LivestockInventorySerializer(inventory, context={"request": request})
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(["GET"])
def list_livestock_types(request):
    """
    GET /api/livestock/livestock_types/
    """
    return Response(LivestockType.objects.all().values("id", "name"), status=status.HTTP_200_OK)


@api_view(["GET"])
@cache_page(60 * 5)
def get_barangays(request):
    """
    GET /api/livestock/barangays/
    """
    barangays = Barangay.objects.all()
    serializer = BarangaySerializer(barangays, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(["GET"])
def get_farmer_by_barangays(request, barangay_id):
    """
    GET /api/livestock/farmers/<barangay_id>/
    """
    farmers = Farmer.objects.filter(barangay_id=barangay_id).select_related("user")
    serializer = FarmerOptionsSerializer(farmers, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)

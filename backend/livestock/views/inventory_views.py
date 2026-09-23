from django.shortcuts import get_object_or_404
from django.db import IntegrityError
from django.db.models import Q
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.views.decorators.cache import cache_page
from rest_framework.exceptions import PermissionDenied

from livestock.models import Barangay, LivestockInventory, LivestockType, Farmer
from livestock.serializer import (
    FarmerOptionsSerializer,
    LivestockInventorySerializer,
    BarangaySerializer,
)
from users.models import Notification
from users.notification_views import create_notification



@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def inventory_list_create(request):
    """
    GET  /api/livestock/inventory/ -> List livestock inventory for logged-in farmer (or all for MAO/SIBAT/Admin)
    POST /api/livestock/inventory/ -> Register a new livestock inventory entry
    """
    user = request.user
    role_name = getattr(getattr(user, "role", None), "role_name", "")

    if request.method == "POST":
        serializer = LivestockInventorySerializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    # GET: Enforce strict farmer data isolation
    if role_name == "FARMER":
        farmer_profile = getattr(user, "farmer_profile", None)
        if farmer_profile:
            inventories = LivestockInventory.objects.filter(
                Q(farmer=farmer_profile) | Q(created_by=user)
            ).distinct()
        else:
            inventories = LivestockInventory.objects.filter(created_by=user)
    else:
        # Admin / MAO / SIBAT / AUCTION: list all municipal inventories
        inventories = LivestockInventory.objects.all()

    inventories = inventories.select_related(
        "livestock_type", "farmer__user", "farmer__barangay"
    ).order_by("-created_at")

    serializer = LivestockInventorySerializer(inventories, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(["GET", "PUT", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def inventory_detail(request, pk):
    """
    GET    /api/livestock/inventory/<id>/ -> Retrieve single livestock inventory item
    PUT    /api/livestock/inventory/<id>/ -> Full update
    PATCH  /api/livestock/inventory/<id>/ -> Partial update
    DELETE /api/livestock/inventory/<id>/ -> Delete entry (only if unreferenced)
    """
    user = request.user
    role_name = getattr(getattr(user, "role", None), "role_name", "")

    if role_name == "FARMER":
        farmer_profile = getattr(user, "farmer_profile", None)
        if farmer_profile:
            inventory = get_object_or_404(
                LivestockInventory, Q(farmer=farmer_profile) | Q(created_by=user), pk=pk
            )
        else:
            inventory = get_object_or_404(LivestockInventory, created_by=user, pk=pk)
    else:
        inventory = get_object_or_404(LivestockInventory, pk=pk)

    if request.method == "DELETE":
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
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)

    # GET
    serializer = LivestockInventorySerializer(inventory)
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
    new_status = request.data.get("status")
    remarks = request.data.get("remarks", "")

    if not new_status:
        return Response(
            {"error": "status is required (VERIFIED, APPROVED, or SUBJECT_TO_REVISION)."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user = request.user
    role_name = getattr(getattr(user, "role", None), "role_name", "")

    if role_name == "FARMER":
        raise PermissionDenied("Farmers are not authorized to review livestock inventory.")

    if role_name == "SIBAT":
        if new_status == LivestockInventory.StatusType.APPROVED:
            raise PermissionDenied(
                "SIBAT cooperative officers can only verify (status=VERIFIED). Final approval is reserved for MAO."
            )
        if new_status not in [LivestockInventory.StatusType.VERIFIED, LivestockInventory.StatusType.SUBJECT_TO_REVISION]:
            return Response(
                {"error": "Invalid status for SIBAT review. Valid choices are VERIFIED or SUBJECT_TO_REVISION."},
                status=status.HTTP_400_BAD_REQUEST,
            )
    elif role_name == "MAO":
        if new_status not in LivestockInventory.StatusType.values:
            return Response(
                {"error": f"Invalid status '{new_status}'. Valid choices are: {list(LivestockInventory.StatusType.values)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )
    else:
        raise PermissionDenied("You do not have permission to review livestock inventory.")

    inventory.status = new_status
    inventory.reviewed_by = request.user
    inventory.review_remarks = remarks
    inventory.reviewed_at = timezone.now()
    inventory.save()

    # Automatically notify the animal's owner/registrant
    target_user = None
    if inventory.farmer and getattr(inventory.farmer, "user", None):
        target_user = inventory.farmer.user
    elif inventory.created_by:
        target_user = inventory.created_by

    if target_user:
        species_name = inventory.livestock_type.name if inventory.livestock_type else "Livestock"
        tag_info = inventory.tag_number or f"Batch ({inventory.quantity} heads)"

        if new_status == LivestockInventory.StatusType.VERIFIED:
            create_notification(
                user=target_user,
                notification_type=Notification.NotificationType.SIBAT,
                priority=Notification.Priority.MEDIUM,
                title="Verified by SIBAT Inspector",
                message=f"Your {species_name} [{tag_info}] has been verified on-farm by SIBAT.{f' Officer Remarks: {remarks}' if remarks else ''}",
                link="/livestock-inventory",
            )
        elif new_status == LivestockInventory.StatusType.APPROVED:
            create_notification(
                user=target_user,
                notification_type=Notification.NotificationType.GENERAL,
                priority=Notification.Priority.MEDIUM,
                title="Livestock Record Approved",
                message=f"Official certification approved for your {species_name} [{tag_info}].",
                link="/livestock-inventory",
            )
        elif new_status == LivestockInventory.StatusType.SUBJECT_TO_REVISION:
            create_notification(
                user=target_user,
                notification_type=Notification.NotificationType.GENERAL,
                priority=Notification.Priority.HIGH,
                title="Revision Required on Livestock Record",
                message=f"Your {species_name} [{tag_info}] requires revision.{f' Note: {remarks}' if remarks else ''}",
                link="/livestock-inventory",
            )

    serializer = LivestockInventorySerializer(inventory)
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

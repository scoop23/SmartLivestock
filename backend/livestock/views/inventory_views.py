from django.shortcuts import get_object_or_404
from django.db import IntegrityError
from django.utils import timezone
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from django.views.decorators.cache import cache_page

from livestock.models import Barangay, LivestockInventory, LivestockType, Farmer
from livestock.serializer import (
    FarmerOptionsSerializer,
    LivestockInventorySerializer,
    BarangaySerializer,
)


@api_view(["GET", "POST"])
def inventory_list_create(request):
    """
    GET  /api/livestock/inventory/ -> List livestock inventory for logged-in farmer
    POST /api/livestock/inventory/ -> Register a new livestock inventory entry
    """
    if request.method == "POST":
        serializer = LivestockInventorySerializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    # GET
    # Check if user has farmer_profile or is staff/admin
    if hasattr(request.user, "farmer_profile"):
        inventories = LivestockInventory.objects.filter(
            farmer=request.user.farmer_profile
        ).select_related("livestock_type", "farmer__user", "farmer__barangay")
    else:
        # Admin / MAO fallback: list all inventories
        inventories = LivestockInventory.objects.all().select_related(
            "livestock_type", "farmer__user", "farmer__barangay"
        )

    serializer = LivestockInventorySerializer(inventories, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(["GET", "PUT", "PATCH", "DELETE"])
def inventory_detail(request, pk):
    """
    GET    /api/livestock/inventory/<id>/ -> Retrieve single livestock inventory item
    PUT    /api/livestock/inventory/<id>/ -> Full update
    PATCH  /api/livestock/inventory/<id>/ -> Partial update
    DELETE /api/livestock/inventory/<id>/ -> Delete entry (only if unreferenced)
    """
    if hasattr(request.user, "farmer_profile"):
        inventory = get_object_or_404(
            LivestockInventory, pk=pk, farmer=request.user.farmer_profile
        )
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


from rest_framework.exceptions import PermissionDenied


@api_view(["POST"])
def review_inventory(request, pk):
    """
    POST /api/livestock/inventory/<id>/review/
    Review and verify livestock inventory:
    - SIBAT: Field tagging & verification (status = VERIFIED)
    - MAO: Official municipal certification (status = APPROVED or REJECTED)
    """
    inventory = get_object_or_404(LivestockInventory, pk=pk)
    new_status = request.data.get("status")
    remarks = request.data.get("remarks", "")

    if not new_status:
        return Response(
            {"error": "status is required (VERIFIED, APPROVED, or REJECTED)."},
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
        if new_status not in [LivestockInventory.StatusType.VERIFIED, LivestockInventory.StatusType.REJECTED]:
            return Response(
                {"error": "Invalid status for SIBAT review. Valid choices are VERIFIED or REJECTED."},
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

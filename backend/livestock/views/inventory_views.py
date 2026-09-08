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


@api_view(["POST"])
def review_inventory(request, pk):
    """
    POST /api/livestock/inventory/<id>/review/
    Official MAO verification action (APPROVE / REJECT)
    """
    inventory = get_object_or_404(LivestockInventory, pk=pk)
    new_status = request.data.get("status")
    remarks = request.data.get("remarks", "")

    if not new_status:
        return Response(
            {"error": "status is required (APPROVED or REJECTED)."},
            status=status.HTTP_400_BAD_REQUEST,
        )

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

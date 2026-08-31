from livestock.models import Barangay
from django.shortcuts import get_object_or_404
from django.db import IntegrityError
from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.views.decorators.cache import cache_page
from livestock.models import LivestockInventory, LivestockType, Farmer
from livestock.serializer import (
    FarmerOptionsSerializer,
    LivestockInventorySerializer,
    BarangaySerializer,
)
from production.models import ProductionRecord
from production.serializer import ProductionRecordSerializer


@api_view(["POST"])
def create_inventory(request):
    serializer = LivestockInventorySerializer(
        data=request.data,
        # gives the serializer context about the request so i can get it in the
        # serializer using `self.context['request'].user` and i can set validated_data["created_by"] to it.
        context={"request": request},
    )
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response(serializer.data, status=201)


@api_view(["GET"])
def list_livestock_types(request):
    return Response(LivestockType.objects.all().values("id", "name"))


@api_view(["GET"])
def get_user_inventory(request):
    inventories = LivestockInventory.objects.filter(farmer=request.user.farmer_profile)
    serializer = LivestockInventorySerializer(inventories, many=True)
    return Response(serializer.data)


@api_view(["GET"])
def get_single_record(request, pk):
    record = get_object_or_404(
        ProductionRecord,
        pk=pk,
        created_by=request.user,
    )
    serializer = ProductionRecordSerializer(record)
    return Response(serializer.data)


@api_view(["DELETE"])
def delete_user_inventory(request, pk):
    inventory = get_object_or_404(
        LivestockInventory, pk=pk, farmer=request.user.farmer_profile
    )
    try:
        inventory.delete()
        return Response(status=204)
    except IntegrityError:
        return Response(
            {
                "error": "Cannot delete: this livestock record is referenced by production or disease records."
            },
            status=409,
        )


@api_view(["PUT", "PATCH"])
def update_user_inventory(request, pk):
    inventory = get_object_or_404(
        LivestockInventory, pk=pk, farmer=request.user.farmer_profile
    )
    serializer = LivestockInventorySerializer(
        inventory, data=request.data, partial=True, context={"request": request}
    )
    serializer.is_valid(
        raise_exception=True
    )  # this is used because the frontend only send relevant data not ~ farmer, created_by, etc. ~
    serializer.save()  # calls update(self, instance, validated_data) in the serializer class
    # instead of create()
    return Response(serializer.data)


@api_view(["GET"])
@cache_page(60 * 5)
def get_barangays(request):
    barangays = Barangay.objects.all()
    serializer = BarangaySerializer(barangays, many=True)

    return Response(serializer.data, status=200)


@api_view(["GET"])
def get_farmer_by_barangays(request, barangay_id):
    farmers = Farmer.objects.filter(barangay_id=barangay_id).select_related("user")
    serializer = FarmerOptionsSerializer(farmers, many=True)

    return Response(serializer.data, status=200)

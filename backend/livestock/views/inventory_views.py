from django.shortcuts import get_object_or_404
from django.db import IntegrityError
from rest_framework.decorators import api_view
from rest_framework.response import Response

from livestock.models import LivestockInventory, LivestockType
from livestock.serializer import LivestockInventorySerializer
from production.models import ProductionRecord
from production.serializer import ProductionRecordSerializer


@api_view(["POST"])
def create_inventory(request):
    serializer = LivestockInventorySerializer(
        data=request.data,
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
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response(serializer.data)
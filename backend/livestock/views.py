from django.shortcuts import get_object_or_404, render
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework.utils import serializer_helpers
from livestock.models import LivestockInventory, LivestockType
from livestock.serializer import LivestockInventorySerializer
from users import serializer
from django.db import IntegrityError
# TODO: Build CRUD viewsets for:
#   - Barangay (list only — mostly static data)
#   - Farmer (list, retrieve — created by RegisterSerializer)
#   - LivestockType (list only — mostly static)
#   - LivestockInventory (create, list, retrieve, update, destroy — farmer submits, SIBAT/MAO reviews)
#   - CensusSubmission (create, list — SIBAT submits quarterly)
#
# Use DRF ModelViewSet + permission classes for role-based access.
# Example:
#   class LivestockInventoryViewSet(ModelViewSet):
#       queryset = LivestockInventory.objects.all()
#       serializer_class = LivestockInventorySerializer
#       permission_classes = [IsAuthenticated]


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

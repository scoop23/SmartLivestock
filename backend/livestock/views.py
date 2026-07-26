from django.shortcuts import render
from rest_framework.decorators import api_view
from rest_framework.response import Response
from livestock.models import LivestockInventory, LivestockType
from livestock.serializer import LivestockInventorySerializer
from users import serializer

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

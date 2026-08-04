from django.shortcuts import render
from django.shortcuts import get_object_or_404, render
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework.utils import serializer_helpers
from production.serializer import ProductionRecordSerializer
from rest_framework import status
from users import serializer
from .models import ProductionRecord

# TODO: Build CRUD viewsets for:
#   - ProductionRecord (create, list by farmer, review by SIBAT/MAO)
#   - SlaughterRecord (create, list, review — nullable livestock FK for batch slaughter)
#   - LiveAnimalSale (create, list, review)
#
# Consider nested routes: /api/livestock/{id}/production-records/


@api_view(["POST"])
def create_production_record(request):
    serializer = ProductionRecordSerializer(request.data, context={"request": request})
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["GET"])
def get_production_records(
    request,
):  # provides a list of production records for the logged-in user
    records = ProductionRecord.objects.filter(
        created_by=request.user
    )  # get the user using request as jwt binds it.
    serializer = ProductionRecordSerializer(records, many=True)
    return Response(serializer.data)

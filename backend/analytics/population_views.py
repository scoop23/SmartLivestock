"""Municipal population forecasting API."""

import logging

from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from livestock.models import Barangay, LivestockType
from livestock.permission import IsMAO
from smartlivestock.workflows import scope_reviewer_queryset
from .services.predictive.population import population_forecast

logger = logging.getLogger(__name__)


class PopulationForecastParameters(serializers.Serializer):
    barangay_id = serializers.IntegerField(min_value=1, required=False)
    species_id = serializers.IntegerField(min_value=1, required=False)
    horizon = serializers.IntegerField(min_value=1, max_value=12, default=6)
    expected_registrations = serializers.IntegerField(min_value=0, max_value=10000000, required=False)
    expected_births = serializers.IntegerField(min_value=0, max_value=10000000, required=False)
    expected_sales = serializers.IntegerField(min_value=0, max_value=10000000, required=False)
    expected_deaths = serializers.IntegerField(min_value=0, max_value=10000000, required=False)
    expected_removals = serializers.IntegerField(min_value=0, max_value=10000000, required=False)

    def validate(self, attrs):
        fields = [f"expected_{kind}" for kind in ("registrations", "births", "sales", "deaths", "removals")]
        if any(field in attrs for field in fields) and not all(field in attrs for field in fields):
            raise serializers.ValidationError("Supply all five monthly assumptions, including explicit zeros.")
        return attrs


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsMAO])
def population_forecast_view(request):
    parameters = PopulationForecastParameters(data=request.query_params)
    parameters.is_valid(raise_exception=True)
    filters = parameters.validated_data
    if "barangay_id" in filters:
        get_object_or_404(scope_reviewer_queryset(Barangay.objects.all(), request.user), pk=filters["barangay_id"])
    if "species_id" in filters:
        get_object_or_404(LivestockType, pk=filters["species_id"])
    try:
        return Response(population_forecast(user=request.user, **filters))
    except Exception:
        logger.exception("Population forecast failed")
        return Response({"detail": "Population forecasts are temporarily unavailable. Please try again."}, status=500)

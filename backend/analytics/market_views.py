"""Authenticated farmer price transparency with aggregate-only responses."""
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from livestock.permission import IsFarmer, IsMAO
from .services.farmer_market import market_prices


class MarketFilters(serializers.Serializer):
    breed = serializers.CharField(max_length=80, default="ALL")
    weight_band = serializers.ChoiceField(choices=["ALL", "UNDER_300", "300_TO_499", "500_PLUS"], default="ALL")
    data_mode = serializers.ChoiceField(choices=["AUTO", "REAL", "DEMO"], default="AUTO")
    include_forecast = serializers.BooleanField(default=True)


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsFarmer | IsMAO])
def farmer_market_prices(request):
    filters = MarketFilters(data=request.query_params)
    filters.is_valid(raise_exception=True)
    return Response(market_prices(**filters.validated_data))

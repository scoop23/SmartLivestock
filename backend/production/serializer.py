from rest_framework import serializers  # type: ignore
from .models import ProductionRecord


class ProductionRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductionRecord
        fields = "__all__"
        read_only_fields = (  # fields that wont get sent
            "created_by",
            "status",
            "reviewed_by",
            "reviewed_at",
            "review_remarks",
            "created_at",
        )

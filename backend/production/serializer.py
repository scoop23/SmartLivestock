from rest_framework import serializers  # type: ignore
from .models import ProductionRecord
from livestock.models import LivestockInventory
from rest_framework.exceptions import ValidationError


class ProductionRecordSerializer(serializers.ModelSerializer):
    livestock_type_name = serializers.CharField(
        source="livestock.livestock_type.name", read_only=True
    )

    class Meta:
        model = ProductionRecord
        fields = (
            "id",
            "livestock",
            "livestock_type_name",
            "production_type",
            "quantity",
            "unit",
            "record_date",
            "status",
            "review_remarks",
            "created_at",
        )
        read_only_fields = ("status", "review_remarks", "created_at")

    def validate_livestock(  # basically if validate_<fieldname> is created then it runs that before doing anything.
        self, value
    ):  # gets the livestock inventory object and checks if the logged in user is the owner of the livestock
        user = self.context["request"].user
        if value.farmer_id != user.farmer_profile.id:
            raise ValidationError(
                "You can only log production against your own livestock."
            )
        return value

    def create(self, validated_data):
        user = self.context["request"].user
        validated_data["created_by"] = user
        return ProductionRecord.objects.create(**validated_data)

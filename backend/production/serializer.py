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
            "notes",
            "status",
            "review_remarks",
            "created_at",
        )
        read_only_fields = ("status", "review_remarks", "created_at")

    def validate_livestock(  # basically if validate_<fieldname> is created then it runs that before doing anything.
        self,
        value,  # value is livestock <object>
    ):  # gets the livestock inventory object and checks if the logged in user is the owner of the livestock
        user = self.context["request"].user
        if value.farmer_id != user.farmer_profile.id:
            raise ValidationError(
                "You can only log production against your own livestock."
            )
        return value

    def validate(self, attrs):  # attrs is the whole table fields
        livestock = attrs["livestock"]
        production_type = attrs["production_type"]
        unit = attrs["unit"]

        if livestock.livestock_type.name == "CATTLE":
            if production_type != ProductionRecord.ProductionType.MILK:
                raise ValidationError("Cattle production records can only be for milk.")

            if unit != ProductionRecord.UnitType.LITERS:
                raise ValidationError("Milk production must be recorded in liters.")

        return attrs

    def create(self, validated_data):
        user = self.context["request"].user
        validated_data["created_by"] = user
        return ProductionRecord.objects.create(**validated_data)

    def update(self, instance, validated_data):
        allowed = [
            "livestock",
            "production_type",
            "quantity",
            "unit",
            "record_date",
            "notes",
        ]
        for field in allowed:
            if field in validated_data:
                setattr(instance, field, validated_data[field])
        instance.save()

        return instance

from rest_framework import serializers  # type: ignore
from .models import Farmer, LivestockInventory, LivestockType


class LivestockInventorySerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    farmer = serializers.PrimaryKeyRelatedField(read_only=True)
    livestock_type = serializers.PrimaryKeyRelatedField(
        queryset=LivestockType.objects.all()
    )
    livestock_type_name = serializers.CharField(
        source="livestock_type.name", read_only=True
    )
    entry_type = serializers.ChoiceField(choices=LivestockInventory.EntryType.choices)
    quantity = serializers.IntegerField(min_value=1)
    tag_number = serializers.CharField(max_length=50, required=False, allow_blank=True)
    breed = serializers.CharField(max_length=50)
    sex = serializers.CharField(max_length=10)
    weight = serializers.DecimalField(
        max_digits=6, decimal_places=2, required=False, allow_null=True
    )
    last_vaccination_date = serializers.DateField(required=False, allow_null=True)
    status = serializers.CharField(max_length=25, read_only=True)
    created_at = serializers.DateTimeField(read_only=True)

    def create(self, validated_data):
        user = self.context["request"].user
        validated_data["created_by"] = user
        validated_data["farmer"] = user.farmer_profile
        return LivestockInventory.objects.create(**validated_data)

    # def update(self, instance, validated_data):
    #     instance.farmer = validated_data.get("famer", instance.farmer)

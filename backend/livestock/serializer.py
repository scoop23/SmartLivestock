from rest_framework import serializers  # type: ignore
from .models import Farmer, LivestockInventory, LivestockType


class LivestockInventorySerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    farmer = serializers.PrimaryKeyRelatedField(queryset=Farmer.objects.all())
    livestock_type = serializers.PrimaryKeyRelatedField(
        queryset=LivestockType.objects.all()
    )
    quantity = serializers.IntegerField(min_value=1)
    breed = serializers.CharField(max_length=50)
    sex = serializers.CharField(max_length=10)
    status = serializers.CharField(max_length=10, read_only=True)
    created_at = serializers.DateTimeField(read_only=True)

    def create(self, validated_data):
        validated_data["created_by"] = self.context["request"].user
        return LivestockInventory.objects.create(**validated_data)

    # def update(self, instance, validated_data):
    #     instance.farmer = validated_data.get("famer", instance.farmer)

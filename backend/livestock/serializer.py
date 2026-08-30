from rest_framework import serializers
from rest_framework.fields import SerializerMethodField
from rest_framework.relations import PrimaryKeyRelatedField
from livestock.services import CensusService  # type: ignore
from .models import (
    Barangay,
    Farmer,
    LivestockInventory,
    LivestockType,
    CensusSubmission,
    CensusSubmissionItem,
)


class BarangaySerializer(serializers.ModelSerializer):
    class Meta:
        model = Barangay
        fields = [
            "id",
            "barangay_name",
        ]


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

    def update(self, instance, validated_data):
        allowed = [
            "livestock_type",
            "entry_type",
            "quantity",
            "tag_number",
            "breed",
            "sex",
            "weight",
            "last_vaccination_date",
        ]
        for field in allowed:
            if field in validated_data:
                setattr(instance, field, validated_data[field])
        instance.save()

        return instance


class CensusSubmissionItemSerializer(serializers.ModelSerializer):
    livestock_type_name = serializers.CharField(
        source="livestock_type.name", read_only=True
    )
    farmer_name = serializers.SerializerMethodField()

    class Meta:
        model = CensusSubmissionItem
        fields = [
            "id",
            "census_submission",
            "farmer",
            "farmer_name",
            "livestock_type",
            "livestock_type_name",
            "number_of_heads",
            "remarks",
        ]
        read_only_fields = ["census_submission"]

    def get_farmer_name(self, obj):
        user = obj.farmer.user
        full_name = user.get_full_name()
        return full_name if full_name else user.username


class CensusSubmissionSerializer(serializers.ModelSerializer):
    items = CensusSubmissionItemSerializer(many=True)
    # When CensusSubmission receives an "items" field,
    # use CensusSubmissionItemSerializer to validate each item.

    barangay_name = serializers.CharField(
        source="barangay.barangay_name", read_only=True
    )
    submitted_by_name = serializers.SerializerMethodField()

    class Meta:
        model = CensusSubmission
        fields = [
            "id",
            "barangay",
            "barangay_name",
            "report_year",
            "report_quarter",
            "status",
            "submission_date",
            "submitted_by_name",
            "review_remarks",
            "items",
        ]
        read_only_fields = [
            "id",
            "submitted_by",
            "submission_date",
            "status",
            "reviewed_by",
            "reviewed_at",
            "review_remarks",
            "created_at",
        ]

    def get_submitted_by_name(self, obj):
        user = obj.submitted_by
        full_name = user.get_full_name()
        return full_name if full_name else user.username


class FarmerOptionsSerializer(serializers.ModelSerializer):
    farmer_name = serializers.SerializerMethodField()

    class Meta:
        model = Farmer
        fields = [
            "barangay",
            "farm_size",
            "address",
            "registered_at",
        ]

    def get_farmer_name(self, obj):
        user = obj.user
        full_name = user.get_full_name().strip()
        if full_name:
            return full_name
        return user.username if user.username else user.email

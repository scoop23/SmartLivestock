from rest_framework import serializers
from rest_framework.relations import PrimaryKeyRelatedField  # type: ignore
from .models import Farmer, LivestockInventory, LivestockType, CensusSubmission, CensusSubmissionItem


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


class CensusSubmissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = CensusSubmission
        fields = [
            "id",
            "barangay",
            "report_year",
            "report_quarter",
            "status",
            "submission_date",
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
    
    def create(self, validated_data):
        user = self.context["request"].user
        validated_data["submitted_by"] = user
        return CensusSubmission.objects.create(**validated_data)


class CensusSubmissionItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = CensusSubmissionItem
        fields = [
            "census_submission",
            "farmer",
            "livestock_type",
            "number_of_heads",
        ] 
   





        

from rest_framework import serializers
from rest_framework.fields import SerializerMethodField
from rest_framework.relations import PrimaryKeyRelatedField
from livestock.services import CensusService  # type: ignore
from .models import (
    Barangay,
    Farmer,
    LivestockBatch,
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
    farmer_name = serializers.SerializerMethodField(read_only=True)
    barangay_name = serializers.CharField(
        source="farmer.barangay.barangay_name", read_only=True
    )
    barangay_id = serializers.IntegerField(
        source="farmer.barangay.id", read_only=True
    )
    batch = serializers.PrimaryKeyRelatedField(
        queryset=LivestockBatch.objects.all(), required=False, allow_null=True
    )
    batch_code = serializers.CharField(
        source="batch.batch_code", read_only=True, allow_null=True
    )
    batch_name = serializers.CharField(
        source="batch.batch_name", read_only=True, allow_null=True
    )
    livestock_type = serializers.PrimaryKeyRelatedField(
        queryset=LivestockType.objects.all()
    )
    livestock_type_name = serializers.CharField(
        source="livestock_type.name", read_only=True
    )
    entry_type = serializers.ChoiceField(choices=LivestockInventory.EntryType.choices)
    quantity = serializers.IntegerField(min_value=1, default=1)
    tag_number = serializers.CharField(max_length=50, required=False, allow_blank=True, default="")
    breed = serializers.CharField(max_length=50, required=False, allow_blank=True, default="")
    sex = serializers.CharField(max_length=10, required=False, allow_blank=True, default="")
    weight = serializers.DecimalField(
        max_digits=6, decimal_places=2, required=False, allow_null=True
    )
    photo = serializers.ImageField(required=False, allow_null=True)
    photo_url = serializers.SerializerMethodField(read_only=True)
    avatar_key = serializers.CharField(
        max_length=50, required=False, allow_blank=True, default=""
    )
    last_vaccination_date = serializers.DateField(required=False, allow_null=True)
    status = serializers.CharField(max_length=25, read_only=True)
    review_remarks = serializers.CharField(read_only=True, allow_null=True)
    reviewed_at = serializers.DateTimeField(read_only=True, allow_null=True)
    reviewed_by_name = serializers.SerializerMethodField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)

    def get_farmer_name(self, obj):
        try:
            user = obj.farmer.user
            full_name = user.get_full_name().strip()
            return full_name if full_name else user.username
        except Exception:
            return "Unknown Farmer"

    def get_reviewed_by_name(self, obj):
        try:
            if obj.reviewed_by:
                full_name = obj.reviewed_by.get_full_name().strip()
                return full_name if full_name else obj.reviewed_by.username
        except Exception:
            pass
        return None

    def get_photo_url(self, obj):
        if obj.photo:
            try:
                request = self.context.get("request")
                if request:
                    return request.build_absolute_uri(obj.photo.url)
                return obj.photo.url
            except Exception:
                return None
        return None

    def create(self, validated_data):
        user = self.context["request"].user
        validated_data["created_by"] = user
        validated_data["farmer"] = user.farmer_profile
        return LivestockInventory.objects.create(**validated_data)

    def update(self, instance, validated_data):
        allowed = [
            "batch",
            "livestock_type",
            "entry_type",
            "quantity",
            "tag_number",
            "breed",
            "sex",
            "weight",
            "photo",
            "avatar_key",
            "last_vaccination_date",
        ]
        for field in allowed:
            if field in validated_data:
                setattr(instance, field, validated_data[field])
        instance.save()

        return instance


class LivestockBatchSerializer(serializers.ModelSerializer):
    farmer = serializers.PrimaryKeyRelatedField(read_only=True)
    farmer_name = serializers.SerializerMethodField(read_only=True)
    barangay_name = serializers.CharField(
        source="farmer.barangay.barangay_name", read_only=True
    )
    barangay_id = serializers.IntegerField(
        source="farmer.barangay.id", read_only=True
    )
    livestock_type_name = serializers.CharField(
        source="livestock_type.name", read_only=True
    )
    total_animals = serializers.IntegerField(read_only=True)
    average_weight = serializers.DecimalField(
        max_digits=6, decimal_places=2, read_only=True
    )
    animals = serializers.SerializerMethodField(read_only=True)
    review_status = serializers.SerializerMethodField(read_only=True)
    review_remarks = serializers.SerializerMethodField(read_only=True)
    reviewed_by_name = serializers.SerializerMethodField(read_only=True)
    reviewed_at = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = LivestockBatch
        fields = [
            "id",
            "farmer",
            "farmer_name",
            "barangay_id",
            "barangay_name",
            "livestock_type",
            "livestock_type_name",
            "batch_name",
            "batch_code",
            "housing_pen",
            "feed_type",
            "target_weight",
            "target_harvest_date",
            "status",
            "notes",
            "total_animals",
            "average_weight",
            "animals",
            "review_status",
            "review_remarks",
            "reviewed_by_name",
            "reviewed_at",
            "created_at",
            "updated_at",
        ]

    def get_farmer_name(self, obj):
        try:
            user = obj.farmer.user
            full_name = user.get_full_name().strip()
            return full_name if full_name else user.username
        except Exception:
            return "Unknown Farmer"

    def get_animals(self, obj):
        animals = obj.animals.all().order_by("id")
        return LivestockInventorySerializer(animals, many=True, context=self.context).data

    def get_review_status(self, obj):
        statuses = list(obj.animals.values_list("status", flat=True))
        if not statuses:
            return "PENDING"
        if all(s == "APPROVED" for s in statuses):
            return "APPROVED"
        if any(s == "SUBJECT_TO_REVISION" for s in statuses):
            return "SUBJECT_TO_REVISION"
        if any(s == "VERIFIED" for s in statuses):
            return "VERIFIED"
        return "PENDING"

    def get_review_remarks(self, obj):
        latest = (
            obj.animals.filter(review_remarks__isnull=False)
            .exclude(review_remarks="")
            .order_by("-reviewed_at")
            .first()
        )
        return latest.review_remarks if latest else None

    def get_reviewed_by_name(self, obj):
        latest = (
            obj.animals.filter(reviewed_by__isnull=False)
            .order_by("-reviewed_at")
            .first()
        )
        if latest and latest.reviewed_by:
            full_name = latest.reviewed_by.get_full_name().strip()
            return full_name if full_name else latest.reviewed_by.username
        return None

    def get_reviewed_at(self, obj):
        latest = (
            obj.animals.filter(reviewed_at__isnull=False)
            .order_by("-reviewed_at")
            .first()
        )
        return latest.reviewed_at if latest else None


class CensusSubmissionItemSerializer(serializers.ModelSerializer):
    livestock_type_name = serializers.CharField(
        source="livestock_type.name", read_only=True
    )
    farmer_name = serializers.SerializerMethodField()
    farmer_address = serializers.CharField(
        source="farmer.address", read_only=True
    )

    class Meta:
        model = CensusSubmissionItem
        fields = [
            "id",
            "census_submission",
            "farmer",
            "farmer_name",
            "farmer_address",
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
            "remarks",
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
    barangay_name = serializers.CharField(
        source="barangay.barangay_name",
        read_only=True,
    )

    class Meta:
        model = Farmer
        fields = [
            "id",
            "barangay",
            "barangay_name",
            "farmer_name",
            "farm_size",
            "address",
            "registered_at",
        ]

        read_only_fields = ["id", "registered_at"]

    def get_farmer_name(self, obj):
        user = obj.user
        full_name = user.get_full_name().strip()
        if full_name:
            return full_name
        return user.username if user.username else user.email

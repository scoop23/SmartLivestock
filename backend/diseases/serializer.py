from rest_framework import serializers
from rest_framework.exceptions import ValidationError
from .models import DiseaseCase, MortalityRecord
from livestock.models import LivestockInventory


class DiseaseCaseSerializer(serializers.ModelSerializer):
    """
    Serializer for reporting and viewing Disease Cases.
    Supports Farmer submission, SIBAT field validation, and MAO official approval.
    """
    livestock_type_name = serializers.CharField(
        source="livestock.livestock_type.name", read_only=True
    )
    farmer_name = serializers.SerializerMethodField()
    barangay_name = serializers.CharField(
        source="livestock.farmer.barangay.barangay_name", read_only=True
    )
    tag_number = serializers.CharField(
        source="livestock.tag_number", read_only=True
    )
    breed = serializers.CharField(
        source="livestock.breed", read_only=True
    )
    reviewed_by_name = serializers.SerializerMethodField()
    photo_url = serializers.SerializerMethodField()
    inspector_photo_url = serializers.SerializerMethodField()

    class Meta:
        model = DiseaseCase
        fields = (
            "id",
            "livestock",
            "farmer_name",
            "barangay_name",
            "livestock_type_name",
            "tag_number",
            "breed",
            "name",
            "affected_count",
            "record_date",
            "status",
            "photo",
            "photo_url",
            "inspector_photo",
            "inspector_photo_url",
            "reviewed_by",
            "reviewed_by_name",
            "reviewed_at",
            "review_remarks",
            "created_by",
            "created_at",
        )
        read_only_fields = (
            "status",
            "photo_url",
            "inspector_photo_url",
            "reviewed_by",
            "reviewed_by_name",
            "reviewed_at",
            "review_remarks",
            "created_by",
            "created_at",
        )

    def get_photo_url(self, obj):
        if obj.photo:
            request = self.context.get("request")
            if request:
                return request.build_absolute_uri(obj.photo.url)
            return obj.photo.url
        return None

    def get_inspector_photo_url(self, obj):
        if obj.inspector_photo:
            request = self.context.get("request")
            if request:
                return request.build_absolute_uri(obj.inspector_photo.url)
            return obj.inspector_photo.url
        return None

    def get_farmer_name(self, obj):
        try:
            user = obj.livestock.farmer.user
            full_name = user.get_full_name().strip()
            return full_name if full_name else user.username
        except Exception:
            return "Unknown Farmer"

    def get_reviewed_by_name(self, obj):
        if obj.reviewed_by:
            full_name = obj.reviewed_by.get_full_name().strip()
            return full_name if full_name else obj.reviewed_by.username
        return None

    def validate_livestock(self, value):
        user = self.context["request"].user
        # If user has a farmer profile, enforce that they can only log for their own animals
        if hasattr(user, "farmer_profile"):
            if value.farmer_id != user.farmer_profile.id:
                raise ValidationError(
                    "You can only report disease cases against your own livestock inventory."
                )
        return value

    def validate(self, attrs):
        if self.instance is None:
            livestock = attrs.get("livestock")
            affected_count = attrs.get("affected_count", 1)
        else:
            livestock = attrs.get("livestock", self.instance.livestock)
            affected_count = attrs.get("affected_count", self.instance.affected_count)

        if affected_count is not None and affected_count <= 0:
            raise ValidationError({"affected_count": "Affected count must be a positive number."})

        if livestock and affected_count is not None:
            if affected_count > livestock.quantity:
                raise ValidationError(
                    {
                        "affected_count": f"Affected count ({affected_count}) cannot exceed available livestock quantity ({livestock.quantity})."
                    }
                )

        return attrs

    def create(self, validated_data):
        user = self.context["request"].user
        validated_data["created_by"] = user
        return DiseaseCase.objects.create(**validated_data)

    def update(self, instance, validated_data):
        allowed = [
            "livestock",
            "name",
            "affected_count",
            "record_date",
            "photo",
            "inspector_photo",
        ]
        for field in allowed:
            if field in validated_data:
                setattr(instance, field, validated_data[field])
        instance.save()
        return instance


class MortalityRecordSerializer(serializers.ModelSerializer):
    """
    Serializer for logging and reviewing Livestock Mortality Records.
    Optionally linked to a DiseaseCase via source_disease_case.
    """
    livestock_type_name = serializers.CharField(
        source="livestock.livestock_type.name", read_only=True
    )
    farmer_name = serializers.SerializerMethodField()
    barangay_name = serializers.CharField(
        source="livestock.farmer.barangay.barangay_name", read_only=True
    )
    tag_number = serializers.CharField(
        source="livestock.tag_number", read_only=True
    )
    breed = serializers.CharField(
        source="livestock.breed", read_only=True
    )
    source_disease_name = serializers.CharField(
        source="source_disease_case.name", read_only=True
    )
    reviewed_by_name = serializers.SerializerMethodField()
    photo_url = serializers.SerializerMethodField()
    inspector_photo_url = serializers.SerializerMethodField()

    class Meta:
        model = MortalityRecord
        fields = (
            "id",
            "livestock",
            "farmer_name",
            "barangay_name",
            "livestock_type_name",
            "tag_number",
            "breed",
            "death_count",
            "cause",
            "source_disease_case",
            "source_disease_name",
            "record_date",
            "status",
            "photo",
            "photo_url",
            "inspector_photo",
            "inspector_photo_url",
            "reviewed_by",
            "reviewed_by_name",
            "reviewed_at",
            "review_remarks",
            "created_by",
            "created_at",
        )
        read_only_fields = (
            "status",
            "photo_url",
            "inspector_photo_url",
            "reviewed_by",
            "reviewed_by_name",
            "reviewed_at",
            "review_remarks",
            "created_by",
            "created_at",
        )

    def get_photo_url(self, obj):
        if obj.photo:
            request = self.context.get("request")
            if request:
                return request.build_absolute_uri(obj.photo.url)
            return obj.photo.url
        return None

    def get_inspector_photo_url(self, obj):
        if obj.inspector_photo:
            request = self.context.get("request")
            if request:
                return request.build_absolute_uri(obj.inspector_photo.url)
            return obj.inspector_photo.url
        return None

    def get_farmer_name(self, obj):
        try:
            user = obj.livestock.farmer.user
            full_name = user.get_full_name().strip()
            return full_name if full_name else user.username
        except Exception:
            return "Unknown Farmer"

    def get_reviewed_by_name(self, obj):
        if obj.reviewed_by:
            full_name = obj.reviewed_by.get_full_name().strip()
            return full_name if full_name else obj.reviewed_by.username
        return None

    def validate_livestock(self, value):
        user = self.context["request"].user
        if hasattr(user, "farmer_profile"):
            if value.farmer_id != user.farmer_profile.id:
                raise ValidationError(
                    "You can only log mortality records against your own livestock inventory."
                )
        return value

    def validate(self, attrs):
        if self.instance is None:
            livestock = attrs.get("livestock")
            death_count = attrs.get("death_count", 1)
            source_disease = attrs.get("source_disease_case")
        else:
            livestock = attrs.get("livestock", self.instance.livestock)
            death_count = attrs.get("death_count", self.instance.death_count)
            source_disease = attrs.get("source_disease_case", self.instance.source_disease_case)

        if death_count is not None and death_count <= 0:
            raise ValidationError({"death_count": "Death count must be at least 1."})

        if livestock and death_count is not None:
            if death_count > livestock.quantity:
                raise ValidationError(
                    {
                        "death_count": f"Death count ({death_count}) cannot exceed livestock quantity ({livestock.quantity})."
                    }
                )

        if source_disease and livestock:
            if source_disease.livestock_id != livestock.id:
                raise ValidationError(
                    {
                        "source_disease_case": "The referenced disease case belongs to a different livestock item."
                    }
                )

        return attrs

    def create(self, validated_data):
        user = self.context["request"].user
        validated_data["created_by"] = user
        return MortalityRecord.objects.create(**validated_data)

    def update(self, instance, validated_data):
        allowed = [
            "livestock",
            "death_count",
            "cause",
            "source_disease_case",
            "record_date",
            "photo",
            "inspector_photo",
        ]
        for field in allowed:
            if field in validated_data:
                setattr(instance, field, validated_data[field])
        instance.save()
        return instance

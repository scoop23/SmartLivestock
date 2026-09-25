from rest_framework import serializers  # type: ignore
from .models import (
    ProductionRecord,
    LiveAnimalSale,
    SlaughterRecord,
    WeightRecord,
    CalvingRecord,
    AnimalDisposition,
)
from livestock.models import LivestockInventory, LivestockBatch
from rest_framework.exceptions import ValidationError


class ProductionRecordSerializer(serializers.ModelSerializer):
    livestock_type_name = serializers.SerializerMethodField()
    farmer_name = serializers.SerializerMethodField()
    barangay_name = serializers.SerializerMethodField()
    batch_code = serializers.CharField(
        source="batch.batch_code", read_only=True
    )
    reviewed_by_name = serializers.SerializerMethodField(read_only=True)

    def get_livestock_type_name(self, obj):
        if obj.livestock and obj.livestock.livestock_type:
            return obj.livestock.livestock_type.name
        if obj.batch and obj.batch.livestock_type:
            return obj.batch.livestock_type.name
        return "Livestock"

    def get_barangay_name(self, obj):
        if obj.livestock and obj.livestock.farmer and obj.livestock.farmer.barangay:
            return obj.livestock.farmer.barangay.barangay_name
        if obj.batch and obj.batch.farmer and obj.batch.farmer.barangay:
            return obj.batch.farmer.barangay.barangay_name
        return "Padre Garcia"

    def get_farmer_name(self, obj):
        try:
            if obj.livestock and obj.livestock.farmer:
                user = obj.livestock.farmer.user
            elif obj.batch and obj.batch.farmer:
                user = obj.batch.farmer.user
            else:
                user = None
            if user:
                full_name = user.get_full_name().strip()
                return full_name if full_name else user.username
            return "Unknown Farmer"
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

    class Meta:
        model = ProductionRecord
        fields = (
            "id",
            "barangay_name",
            "livestock",
            "batch",
            "batch_code",
            "farmer_name",
            "livestock_type_name",
            "production_type",
            "quantity",
            "unit",
            "record_date",
            "notes",
            "status",
            "review_remarks",
            "reviewed_at",
            "reviewed_by_name",
            "created_at",
        )
        read_only_fields = ("status", "review_remarks", "reviewed_at", "created_at")

    def validate_livestock(
        self,
        value,
    ):
        if not value:
            return value
        user = self.context["request"].user
        # If user has a farmer profile, enforce that they can only log for their own animals
        if hasattr(user, "farmer_profile"):
            if value.farmer_id != user.farmer_profile.id and value.created_by_id != user.id:
                raise ValidationError(
                    "You can only log production against your own livestock."
                )
        elif value.created_by_id != user.id:
            raise ValidationError(
                "You can only log production against your own livestock."
            )

        if value.status != "APPROVED":
            raise ValidationError(
                "Only approved livestock can be logged for production."
            )
        return value

    def validate(self, attrs):
        if self.instance is None:
            # for create
            livestock = attrs.get("livestock")
            batch = attrs.get("batch")
            production_type = attrs.get("production_type")
            unit = attrs.get("unit")
        else:
            # for patch
            livestock = attrs.get("livestock", self.instance.livestock)
            batch = attrs.get("batch", getattr(self.instance, "batch", None))
            production_type = attrs.get(
                "production_type",
                self.instance.production_type,
            )
            unit = attrs.get("unit", self.instance.unit)

        if not livestock and not batch:
            raise ValidationError("Either livestock or batch must be provided.")

        if livestock:
            livestock_type_name = getattr(getattr(livestock, "livestock_type", None), "name", "").upper()
        elif batch:
            livestock_type_name = getattr(getattr(batch, "livestock_type", None), "name", "").upper()
        else:
            livestock_type_name = ""
        if "CATTLE" in livestock_type_name or "BAKA" in livestock_type_name:
            if production_type not in [
                ProductionRecord.ProductionType.MILK,
                ProductionRecord.ProductionType.MEAT,
            ]:
                raise ValidationError("Cattle production records can be for milk or meat.")

            if production_type == ProductionRecord.ProductionType.MILK and unit != ProductionRecord.UnitType.LITERS:
                raise ValidationError("Milk production must be recorded in liters.")
            if production_type == ProductionRecord.ProductionType.MEAT and unit != ProductionRecord.UnitType.KILOGRAMS:
                raise ValidationError("Meat production must be recorded in kilograms.")

        return attrs

    def create(self, validated_data):
        user = self.context["request"].user
        validated_data["created_by"] = user
        return ProductionRecord.objects.create(**validated_data)

    def update(self, instance, validated_data):
        allowed = [
            "livestock",
            "batch",
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


class LiveAnimalSaleSerializer(serializers.ModelSerializer):
    farmer_name = serializers.SerializerMethodField()
    tag_number = serializers.CharField(source="livestock.tag_number", read_only=True)
    livestock_type_name = serializers.CharField(source="livestock.livestock_type.name", read_only=True)

    def get_farmer_name(self, obj):
        try:
            user = obj.livestock.farmer.user
            full = user.get_full_name().strip()
            return full if full else user.username
        except Exception:
            return "Unknown Farmer"

    class Meta:
        model = LiveAnimalSale
        fields = (
            "id",
            "livestock",
            "tag_number",
            "livestock_type_name",
            "farmer_name",
            "quantity",
            "sale_method",
            "total_live_weight",
            "price_per_head",
            "price_per_kg",
            "total_price",
            "destination",
            "sale_date",
            "purpose",
            "status",
            "review_remarks",
            "created_at",
        )
        read_only_fields = ("status", "review_remarks", "created_at")

    def create(self, validated_data):
        user = self.context["request"].user
        validated_data["created_by"] = user
        return LiveAnimalSale.objects.create(**validated_data)


class WeightRecordSerializer(serializers.ModelSerializer):
    tag_number = serializers.CharField(source="livestock.tag_number", read_only=True)
    livestock_type_name = serializers.CharField(source="livestock.livestock_type.name", read_only=True)
    breed = serializers.CharField(source="livestock.breed", read_only=True)

    class Meta:
        model = WeightRecord
        fields = (
            "id",
            "livestock",
            "tag_number",
            "livestock_type_name",
            "breed",
            "weight",
            "weighing_date",
            "notes",
            "created_at",
        )
        read_only_fields = ("created_at",)

    def create(self, validated_data):
        user = self.context["request"].user
        validated_data["created_by"] = user
        record = WeightRecord.objects.create(**validated_data)
        livestock = validated_data["livestock"]
        livestock.weight = validated_data["weight"]
        livestock.save(update_fields=["weight"])
        return record


class CalvingRecordSerializer(serializers.ModelSerializer):
    dam_tag = serializers.CharField(source="dam.tag_number", read_only=True)
    dam_breed = serializers.CharField(source="dam.breed", read_only=True)

    class Meta:
        model = CalvingRecord
        fields = (
            "id",
            "dam",
            "dam_tag",
            "dam_breed",
            "calf_tag",
            "calf_sex",
            "birth_weight",
            "sire_tag",
            "calving_date",
            "breed",
            "calving_ease",
            "notes",
            "created_at",
        )
        read_only_fields = ("created_at",)

    def create(self, validated_data):
        user = self.context["request"].user
        validated_data["created_by"] = user
        return CalvingRecord.objects.create(**validated_data)


class AnimalDispositionSerializer(serializers.ModelSerializer):
    tag_number = serializers.CharField(source="livestock.tag_number", read_only=True)
    livestock_type_name = serializers.CharField(source="livestock.livestock_type.name", read_only=True)

    class Meta:
        model = AnimalDisposition
        fields = (
            "id",
            "livestock",
            "tag_number",
            "livestock_type_name",
            "intent",
            "target_date",
            "target_destination",
            "notes",
            "created_at",
        )
        read_only_fields = ("created_at",)

    def create(self, validated_data):
        user = self.context["request"].user
        validated_data["created_by"] = user
        return AnimalDisposition.objects.create(**validated_data)

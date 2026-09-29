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
    """
    Returns:
        Periodic agricultural yield entry (milk, meat, eggs, or wool):
        - Source: livestock (individual animal ID) or batch (cohort ID), batch_code
        - Farmer & Location: farmer_name, barangay_name, livestock_type_name
        - Yield Metrics: production_type (e.g. MILK, MEAT, EGGS), quantity, unit (LITERS, KILOGRAMS),
          record_date, notes
        - Validation & Review: status (PENDING/APPROVED/SUBJECT_TO_REVISION),
          review_remarks, reviewed_at, reviewed_by_name, created_at
    Used in:
        Farmer production logging dashboard (/production-dashboard) and MAO municipal yield ledger.
    """
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

    def validate_batch(self, value):
        if not value:
            return value
        user = self.context["request"].user
        if value.farmer.user_id != user.id and value.created_by_id != user.id:
            raise ValidationError("You can only log production against your own batch.")
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
    """
    Returns:
        Commercial livestock sale transaction record:
        - Animal: livestock (ID), tag_number, livestock_type_name, farmer_name
        - Economics: quantity, sale_method (AUCTION, DIRECT_FARM_GATE, BROKER),
          total_live_weight, price_per_head, price_per_kg, total_price
        - Route & Destination: destination (e.g. abattoir, provincial buyer), sale_date, purpose
        - Review & Audit: status, review_remarks, created_at
    Used in:
        Padre Garcia cattle market tracking, farmer sale histories, and auction floor analytics.
    """
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

    def validate_livestock(self, value):
        if value is None:
            return value
        user = self.context["request"].user
        if value.farmer.user_id != user.id and value.created_by_id != user.id:
            raise ValidationError("You can only record a sale for your own livestock.")
        if value.status != LivestockInventory.StatusType.APPROVED:
            raise ValidationError("Only approved livestock can be recorded as sold.")
        return value

    def validate_batch(self, value):
        if value is None:
            return value
        user = self.context["request"].user
        if value.farmer.user_id != user.id and value.created_by_id != user.id:
            raise ValidationError("You can only record a sale for your own batch.")
        return value

    def validate(self, attrs):
        livestock = attrs.get("livestock")
        batch = attrs.get("batch")
        if bool(livestock) == bool(batch):
            raise ValidationError("Provide either livestock or batch, but not both.")
        return attrs

    def create(self, validated_data):
        user = self.context["request"].user
        validated_data["created_by"] = user
        return LiveAnimalSale.objects.create(**validated_data)


class WeightRecordSerializer(serializers.ModelSerializer):
    """
    Returns:
        Animal growth and weighing log entry:
        - Target Animal: livestock (ID), tag_number, livestock_type_name, breed
        - Growth Metrics: weight (recorded kg), weighing_date, notes, created_at
    Side-Effect:
        Automatically synchronizes and updates the target animal's `LivestockInventory.weight` on save.
    Used in:
        Herd weight progression curves, Average Daily Gain (ADG) calculations, and feeding evaluations.
    """
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
    """
    Returns:
        Reproductive breeding and parturition event record:
        - Maternal Line: dam (ID), dam_tag, dam_breed
        - Newborn: calf_tag, calf_sex (MALE/FEMALE), birth_weight, breed
        - Paternal Reference: sire_tag
        - Birth Context: calving_date, calving_ease (NORMAL, ASSISTED, CAESAREAN), notes, created_at
        - Review & Verification: status (PENDING, VERIFIED, APPROVED, SUBJECT_TO_REVISION), review_remarks, reviewed_by_name, reviewed_at
    Used in:
        Genealogy / pedigree tracking, reproductive health monitoring, and calf passport registration.
    """
    dam_tag = serializers.CharField(source="dam.tag_number", read_only=True)
    dam_breed = serializers.CharField(source="dam.breed", read_only=True)
    livestock_type_name = serializers.SerializerMethodField(read_only=True)
    barangay_name = serializers.SerializerMethodField(read_only=True)
    farmer_name = serializers.SerializerMethodField(read_only=True)
    reviewed_by_name = serializers.SerializerMethodField(read_only=True)

    def get_livestock_type_name(self, obj):
        if obj.dam and obj.dam.livestock_type:
            return obj.dam.livestock_type.name
        return "Livestock"

    def get_barangay_name(self, obj):
        if obj.dam and obj.dam.farmer and obj.dam.farmer.barangay:
            return obj.dam.farmer.barangay.barangay_name
        return "Padre Garcia"

    def get_farmer_name(self, obj):
        try:
            if obj.dam and obj.dam.farmer and obj.dam.farmer.user:
                u = obj.dam.farmer.user
                name = u.get_full_name().strip()
                return name if name else u.username
            if obj.created_by:
                name = obj.created_by.get_full_name().strip()
                return name if name else obj.created_by.username
        except Exception:
            pass
        return "Registered Farmer"

    def get_reviewed_by_name(self, obj):
        try:
            if obj.reviewed_by:
                name = obj.reviewed_by.get_full_name().strip()
                return name if name else obj.reviewed_by.username
        except Exception:
            pass
        return None

    class Meta:
        model = CalvingRecord
        fields = (
            "id",
            "dam",
            "dam_tag",
            "dam_breed",
            "livestock_type_name",
            "farmer_name",
            "barangay_name",
            "calf_tag",
            "calf_sex",
            "birth_weight",
            "sire_tag",
            "calving_date",
            "breed",
            "calving_ease",
            "notes",
            "status",
            "reviewed_by",
            "reviewed_by_name",
            "reviewed_at",
            "review_remarks",
            "created_at",
        )
        read_only_fields = ("status", "reviewed_by", "reviewed_by_name", "reviewed_at", "review_remarks", "created_at")

    def validate_dam(self, value):
        user = self.context["request"].user
        if value.farmer.user_id != user.id and value.created_by_id != user.id:
            raise ValidationError("You can only record calving for your own livestock.")
        if value.status != LivestockInventory.StatusType.APPROVED:
            raise ValidationError("Only approved livestock can be used as the dam.")
        if value.sex.upper() not in {"FEMALE", "F"}:
            raise ValidationError("The selected dam must be female.")
        return value

    def create(self, validated_data):
        user = self.context["request"].user
        validated_data["created_by"] = user
        return CalvingRecord.objects.create(**validated_data)


class AnimalDispositionSerializer(serializers.ModelSerializer):
    """
    Returns:
        Scheduled or executed herd exit / disposition declaration:
        - Target Animal: livestock (ID), tag_number, livestock_type_name
        - Action Plan: intent (SLAUGHTER, SALE, TRANSFER, CULL), target_date, target_destination,
          notes, created_at
    Used in:
        Farmer exit declarations, slaughterhouse origin permits, and herd movement audits.
    """
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

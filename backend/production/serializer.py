from django.db import transaction
from django.utils import timezone
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


PRODUCTION_RULES = (
    (("CATTLE", "BAKA", "BOVINE", "COW"), {"MILK", "MEAT"}),
    (("CARABAO", "KALABAW", "BUFFALO"), {"MILK", "MEAT"}),
    (("GOAT", "KAMBING", "CAPRINE"), {"MILK", "MEAT"}),
    (("SHEEP", "TUPA", "OVINE", "LAMB", "RAM"), {"MEAT", "WOOL"}),
    (("SWINE", "PIG", "BABOY", "HOG", "PORCINE"), {"MEAT"}),
    (("POULTRY", "CHICKEN", "MANOK", "DUCK", "ITIK", "HEN", "LAYER"), {"EGGS", "MEAT"}),
)

PRODUCTION_UNITS = {
    "MILK": "LITERS",
    "MEAT": "KILOGRAMS",
    "EGGS": "PIECES",
    "WOOL": "KILOGRAMS",
}


def allowed_production_types(livestock_type_name):
    normalized_name = (livestock_type_name or "").strip().upper()
    for aliases, production_types in PRODUCTION_RULES:
        if any(alias in normalized_name for alias in aliases):
            return production_types
    return set()


class ProductionRecordSerializer(serializers.ModelSerializer):
    """
    Returns:
        Periodic agricultural yield entry (milk, meat, eggs, or wool):
        - Source: livestock (individual animal ID) or batch (herd ID), batch_code
        - Farmer & Location: farmer_name, barangay_name, livestock_type_name
        - Yield Metrics: production_type (e.g. MILK, MEAT, EGGS), quantity, unit (LITERS, KILOGRAMS),
          record_date, notes
        - Validation & Review: status (PENDING/APPROVED/SUBJECT_TO_REVISION),
          review_remarks, reviewed_at, reviewed_by_name, created_at
    Used in:
        Farmer production logging dashboard (/production-dashboard) and MAO municipal yield ledger.
    """
    selected_animals = serializers.PrimaryKeyRelatedField(many=True, queryset=LivestockInventory.objects.all(), required=False, write_only=True)
    slaughter_details = serializers.SerializerMethodField()

    def get_slaughter_details(self, obj):
        if not obj.slaughter_id:
            return None
        return {"id": obj.slaughter_id, "quantity": obj.slaughter.quantity,
                "animals": [{"id": a.pk, "tag_number": a.tag_number} for a in obj.slaughter.selected_animals.all()],
                "inventory_reconciled_at": obj.slaughter.inventory_reconciled_at}

    livestock_type_name = serializers.SerializerMethodField()
    farmer_name = serializers.SerializerMethodField()
    barangay_name = serializers.SerializerMethodField()
    batch_code = serializers.CharField(
        source="batch.batch_code", read_only=True
    )
    reviewed_by_role = serializers.CharField(source="reviewed_by.role.role_name", read_only=True, allow_null=True)
    reviewed_by_name = serializers.SerializerMethodField(read_only=True)

    def get_livestock_type_name(self, obj):
        if obj.livestock and obj.livestock.livestock_type:
            return obj.livestock.livestock_type.name
        if obj.batch and obj.batch.livestock_type:
            return obj.batch.livestock_type.name
        return "Livestock"

    def get_barangay_name(self, obj):
        farmer = obj.farmer_at_record or (obj.livestock.farmer if obj.livestock_id else obj.batch.farmer if obj.batch_id else None)
        if farmer and farmer.barangay:
            return farmer.barangay.barangay_name
        return "Padre Garcia"

    def get_farmer_name(self, obj):
        try:
            farmer = obj.farmer_at_record or (obj.livestock.farmer if obj.livestock_id else obj.batch.farmer if obj.batch_id else None)
            user = farmer.user if farmer else None
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
            "farmer_at_record",
            "production_type",
            "quantity",
            "valuation_snapshot",
            "slaughter_details",
            "selected_animals",
            "unit",
            "record_date",
            "notes",
            "status",
            "review_remarks",
            "reviewed_at",
            "reviewed_by_name",
            "reviewed_by_role",
            "created_at",
        )
        read_only_fields = ("status", "review_remarks", "reviewed_at", "created_at", "valuation_snapshot", "farmer_at_record")

    def validate_quantity(self, value):
        # A submitted measurement needs a positive amount; no report is not zero output.
        if value <= 0:
            raise ValidationError("Recorded production quantity must be greater than zero.")
        return value

    def validate_livestock(
        self,
        value,
    ):
        if not value:
            return value
        user = self.context["request"].user
        # Ownership comes from the farmer relationship, not who encoded the inventory.
        farmer = getattr(user, "farmer_profile", None)
        if not farmer or value.farmer_id != farmer.id:
            raise ValidationError("You can only log production against your own livestock.")

        # Approval is administrative validation; operational status is current availability.
        if value.status != "APPROVED":
            raise ValidationError(
                "Only approved livestock can be logged for production."
            )
        if value.operational_status != LivestockInventory.OperationalStatus.ACTIVE:
            raise ValidationError(
                "This livestock is no longer active and cannot be used for this production record."
            )
        if value.quantity <= 0:
            raise ValidationError("Production requires livestock with a positive head count.")
        return value

    def validate_batch(self, value):
        if not value:
            return value
        user = self.context["request"].user
        farmer = getattr(user, "farmer_profile", None)
        if not farmer or value.farmer_id != farmer.id:
            raise ValidationError("You can only log production against your own herd.")
        if value.status != LivestockBatch.StatusType.ACTIVE:
            raise ValidationError("Production can only be logged for an active batch.")
        animal_statuses = set(value.animals.values_list("status", flat=True))
        if not animal_statuses or animal_statuses != {LivestockInventory.StatusType.APPROVED}:
            raise ValidationError(
                "Every animal in the batch must be MAO approved before production can be logged."
            )
        # Approved historical members may remain in the herd after death or sale.
        # At least one currently active animal must still be available for output reporting.
        if not value.animals.filter(operational_status=LivestockInventory.OperationalStatus.ACTIVE, quantity__gt=0).exists():
            raise ValidationError("This herd has no active livestock with a positive head count.")
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

        if bool(livestock) == bool(batch):
            raise ValidationError(
                "Choose exactly one production source: livestock or batch."
            )

        # PATCH may omit its source; revalidate the stored source before accepting edits.
        if livestock and "livestock" not in attrs:
            try:
                self.validate_livestock(livestock)
            except ValidationError as error:
                raise ValidationError({"livestock": error.detail})
        if batch and "batch" not in attrs:
            try:
                self.validate_batch(batch)
            except ValidationError as error:
                raise ValidationError({"batch": error.detail})

        # MEAT records kilograms of output, not deaths or heads removed from inventory.
        source = livestock or batch
        livestock_type_name = getattr(
            getattr(source, "livestock_type", None),
            "name",
            "",
        )
        allowed_types = allowed_production_types(livestock_type_name)
        if not allowed_types:
            raise ValidationError({
                "production_type": (
                    f"Production rules are not configured for livestock type "
                    f"'{livestock_type_name or 'Unknown'}'."
                )
            })
        if production_type not in allowed_types:
            allowed_labels = ", ".join(sorted(allowed_types))
            raise ValidationError({
                "production_type": (
                    f"{livestock_type_name} production can only be recorded as "
                    f"{allowed_labels}."
                )
            })

        expected_unit = PRODUCTION_UNITS.get(production_type)
        if unit != expected_unit:
            raise ValidationError({
                "unit": f"{production_type.title()} production must use {expected_unit}."
            })

        if production_type == "MEAT":
            event_date = attrs.get("record_date", self.instance.record_date if self.instance else None)
            if event_date and event_date > timezone.localdate():
                raise ValidationError({"record_date": "Slaughter date cannot be in the future."})
            animals = attrs.get("selected_animals")
            if "selected_animals" not in self.initial_data:
                animals = list(self.instance.slaughter.selected_animals.all()) if self.instance and self.instance.slaughter_id else ([livestock] if livestock else [])
            from .services.slaughter import validate_animals
            record = ProductionRecord(livestock=livestock, batch=batch)
            validate_animals(record, animals)
            attrs["selected_animals"] = animals
        elif attrs.get("selected_animals") or (self.instance and self.instance.slaughter_id):
            raise ValidationError({"production_type": "A slaughter entry must remain MEAT."})
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        user = self.context["request"].user
        validated_data["created_by"] = user
        source = validated_data.get("livestock") or validated_data.get("batch")
        validated_data["farmer_at_record"] = source.farmer
        from .services.valuation import snapshot_for
        animals = validated_data.pop("selected_animals", [])
        record = ProductionRecord(**validated_data)
        record.valuation_snapshot = snapshot_for(record)
        record.save()
        if record.production_type == "MEAT":
            from .services.slaughter import sync_slaughter
            sync_slaughter(record, animals)
        return record

    @transaction.atomic
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
        if "livestock" in validated_data or "batch" in validated_data:
            source = instance.livestock or instance.batch
            instance.farmer_at_record = source.farmer
        from .services.valuation import snapshot_for
        instance.valuation_snapshot = snapshot_for(instance, instance.valuation_snapshot)
        instance.save()
        if instance.production_type == "MEAT":
            from .services.slaughter import sync_slaughter
            sync_slaughter(instance, validated_data.get("selected_animals", []))
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
    livestock_type_name = serializers.SerializerMethodField()
    barangay_name = serializers.SerializerMethodField()

    def get_farmer_name(self, obj):
        try:
            user = (obj.livestock or obj.batch).farmer.user
            full = user.get_full_name().strip()
            return full if full else user.username
        except Exception:
            return "Unknown Farmer"

    def get_livestock_type_name(self, obj):
        source = obj.livestock or obj.batch
        return source.livestock_type.name if source else None

    def get_barangay_name(self, obj):
        source = obj.livestock or obj.batch
        return source.farmer.barangay.barangay_name if source else None

    reviewed_by_role = serializers.CharField(source="reviewed_by.role.role_name", read_only=True, allow_null=True)

    class Meta:
        model = LiveAnimalSale
        fields = (
            "id",
            "livestock",
            "batch",
            "barangay_name",
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
            "reviewed_by_role",
            "inventory_reconciled_at",
            "created_at",
        )
        read_only_fields = ("status", "review_remarks", "inventory_reconciled_at", "created_at")

    def validate_livestock(self, value):
        if value is None:
            return value
        user = self.context["request"].user
        if value.farmer.user_id != user.id:
            raise ValidationError("You can only record a sale for your own livestock.")
        if value.status != LivestockInventory.StatusType.APPROVED:
            raise ValidationError("Only approved livestock can be recorded as sold.")
        if value.operational_status != LivestockInventory.OperationalStatus.ACTIVE:
            raise ValidationError("Only active livestock can be recorded as sold.")
        return value

    def validate_batch(self, value):
        if value is None:
            return value
        user = self.context["request"].user
        if value.farmer.user_id != user.id:
            raise ValidationError("You can only record a sale for your own batch.")
        return value

    def validate(self, attrs):
        livestock = attrs.get("livestock", self.instance.livestock if self.instance else None)
        batch = attrs.get("batch", self.instance.batch if self.instance else None)
        if bool(livestock) == bool(batch):
            raise ValidationError("Provide either livestock or batch, but not both.")
        if livestock:
            self.validate_livestock(livestock)
        if batch:
            self.validate_batch(batch)
        if self.instance and (self.instance.livestock_id != getattr(livestock, "pk", None) or self.instance.batch_id != getattr(batch, "pk", None)):
            raise ValidationError({"inventory": "The original sale source cannot be replaced."})
        quantity = attrs.get("quantity", self.instance.quantity if self.instance else None)
        if livestock and quantity != 1:
            raise ValidationError({"quantity": "An individual livestock sale must have a quantity of 1."})
        if quantity is None or quantity <= 0:
            raise ValidationError({"quantity": "Sale head count must be positive."})
        if batch:
            if batch.status != "ACTIVE" or batch.animals.filter(operational_status="ACTIVE").exclude(status="APPROVED").exists():
                raise ValidationError({"batch": "A sale requires an active herd with approved active animals."})
            active_count = batch.animals.filter(
                status=LivestockInventory.StatusType.APPROVED,
                operational_status=LivestockInventory.OperationalStatus.ACTIVE,
            ).count()
            if quantity != active_count:
                raise ValidationError(
                    {
                        "quantity": (
                            "Partial batch sales require selecting the exact animals. "
                            "For now, only the full active batch can be sold."
                        )
                    }
                )
        # Missing prices stay unknown; a recorded zero is valid, but negative prices are not.
        for field in ("price_per_head", "price_per_kg", "total_price"):
            value = attrs.get(field, getattr(self.instance, field, None))
            if value is not None and value < 0:
                raise ValidationError({field: "Sale prices cannot be negative."})
        return attrs

    def update(self, instance, validated_data):
        for field, value in validated_data.items():
            setattr(instance, field, value)
        if instance.status == "SUBJECT_TO_REVISION":
            instance.status = "PENDING"
            instance.reviewed_by = None
            instance.reviewed_at = None
        instance.save()
        return instance

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

    def validate_livestock(self, value):
        if value.farmer.user_id != self.context["request"].user.pk:
            raise ValidationError("Select your own livestock.")
        if value.operational_status != "ACTIVE":
            raise ValidationError("Select active livestock.")
        return value

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
    reviewed_by_role = serializers.CharField(source="reviewed_by.role.role_name", read_only=True, allow_null=True)
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
            "reviewed_by_role",
            "reviewed_at",
            "review_remarks",
            "offspring_inventory",
            "inventory_reconciled_at",
            "created_at",
        )
        read_only_fields = ("status", "reviewed_by", "reviewed_by_name", "reviewed_at", "review_remarks", "offspring_inventory", "inventory_reconciled_at", "created_at")

    def validate_dam(self, value):
        user = self.context["request"].user
        if value.farmer.user_id != user.id:
            raise ValidationError("You can only record calving for your own livestock.")
        if value.status != LivestockInventory.StatusType.APPROVED:
            raise ValidationError("Only approved livestock can be used as the dam.")
        if value.operational_status != LivestockInventory.OperationalStatus.ACTIVE:
            raise ValidationError("Only active livestock can be used as the dam.")
        if value.sex.upper() not in {"FEMALE", "F"}:
            raise ValidationError("The selected dam must be female.")
        return value

    def validate(self, attrs):
        if self.instance and "dam" in attrs and attrs["dam"].pk != self.instance.dam_id:
            raise ValidationError({"dam": "The dam cannot be changed on an existing birth declaration."})
        self.validate_dam(attrs.get("dam", self.instance.dam if self.instance else None))
        return attrs

    def create(self, validated_data):
        user = self.context["request"].user
        validated_data["created_by"] = user
        return CalvingRecord.objects.create(**validated_data)

    def update(self, instance, validated_data):
        allowed = [
            "calf_tag",
            "calving_date",
            "calf_sex",
            "breed",
            "birth_weight",
            "sire_tag",
            "calving_ease",
            "notes",
        ]
        for field in allowed:
            if field in validated_data:
                setattr(instance, field, validated_data[field])
        instance.save()

        return instance


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

    def validate_livestock(self, value):
        if value.farmer.user_id != self.context["request"].user.pk:
            raise ValidationError("Select your own livestock.")
        if value.operational_status != "ACTIVE":
            raise ValidationError("Select active livestock.")
        return value

    def create(self, validated_data):
        user = self.context["request"].user
        validated_data["created_by"] = user
        return AnimalDisposition.objects.create(**validated_data)

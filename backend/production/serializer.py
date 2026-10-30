import re
import unicodedata

from django.db import transaction
from django.utils import timezone
from rest_framework import serializers  # type: ignore
from .models import (
    ProductionRecord,
    ProductionRecordWorkflowEvent,
    LiveAnimalSale,
    SlaughterRecord,
    WeightRecord,
    CalvingRecord,
    AnimalDisposition,
    BreedingRecord,
    FeedingRecord,
    LivestockTreatmentRecord,
)
from livestock.models import Farmer, LivestockInventory, LivestockBatch
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
        - Validation & Review: status (new farmer logs are RECORDED; legacy linked slaughter reports retain their review status),
          review_remarks, reviewed_at, reviewed_by_name, created_at
    Used in:
        Farmer production logging dashboard (/production-dashboard) and municipal yield analytics.
        A MEAT yield log for an individual animal immediately reconciles its
        operational status to SLAUGHTERED when the farmer submits the record.
        New farmer meat-yield entries never create reviewer-based slaughter reports.
    """
    selected_animals = serializers.PrimaryKeyRelatedField(many=True, queryset=LivestockInventory.objects.all(), required=False, write_only=True)
    submit_slaughter_report = serializers.BooleanField(write_only=True, required=False, default=False)
    slaughter_details = serializers.SerializerMethodField()
    submitted_at = serializers.DateTimeField(source="created_at", read_only=True)
    workflow_history = serializers.SerializerMethodField(read_only=True)

    def get_workflow_history(self, obj):
        return [
            {"event_type": event.event_type, "from_status": event.from_status,
             "to_status": event.to_status, "remarks": event.remarks,
             "occurred_at": event.occurred_at}
            for event in obj.workflow_events.all()
        ]

    def get_slaughter_details(self, obj):
        if not obj.slaughter_id:
            return None
        return {"id": obj.slaughter_id, "quantity": obj.slaughter.quantity,
                "status": obj.slaughter.status, "review_remarks": obj.slaughter.review_remarks,
                "animals": [{"id": a.pk, "tag_number": a.tag_number} for a in obj.slaughter.selected_animals.all()],
                "inventory_reconciled_at": obj.slaughter.inventory_reconciled_at}

    livestock_type_name = serializers.SerializerMethodField()
    livestock_tag_number = serializers.CharField(source="livestock.tag_number", read_only=True, allow_null=True)
    farmer_name = serializers.SerializerMethodField()
    barangay_name = serializers.SerializerMethodField()
    batch_code = serializers.CharField(
        source="batch.batch_code", read_only=True
    )
    reviewed_by_role = serializers.CharField(source="reviewed_by.role.role_name", read_only=True, allow_null=True)
    reviewed_by_name = serializers.SerializerMethodField(read_only=True)
    anomaly_assessment = serializers.SerializerMethodField(read_only=True)

    def get_anomaly_assessment(self, obj):
        assessment = obj.anomaly_assessment
        if not isinstance(assessment, dict):
            return None
        request = self.context.get("request")
        role = getattr(getattr(getattr(request, "user", None), "role", None), "role_name", "").upper()
        if role == "FARMER":
            # Farmers see their routing state and user-facing status without internal reviewer thresholds/audit history.
            return {
                "assessment_status": assessment.get("assessment_status"),
                "anomaly_detected": assessment.get("anomaly_detected"),
                "requires_cbat_verification": False if obj.status == ProductionRecord.ProductionStatus.RECORDED else assessment.get("requires_cbat_verification"),
                "next_review_queue": obj.next_review_queue,
            }
        return assessment

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
            "livestock_tag_number",
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
            "submit_slaughter_report",
            "unit",
            "record_date",
            "milking_session",
            "session_conflict",
            "notes",
            "status",
            "anomaly_assessment_status",
            "anomaly_detected",
            "requires_cbat_verification",
            "next_review_queue",
            "anomaly_reason",
            "anomaly_assessment",
            "review_remarks",
            "reviewed_at",
            "approved_at",
            "submitted_at",
            "workflow_history",
            "reviewed_by_name",
            "reviewed_by_role",
            "created_at",
        )
        read_only_fields = (
            "status",
            "anomaly_assessment_status",
            "anomaly_detected",
            "requires_cbat_verification",
            "next_review_queue",
            "anomaly_reason",
            "anomaly_assessment",
            "review_remarks",
            "reviewed_at",
            "approved_at",
            "session_conflict",
            "submitted_at",
            "workflow_history",
            "created_at",
            "valuation_snapshot",
            "farmer_at_record",
            "livestock_tag_number",
        )

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
        editing_same_slaughtered_meat_source = bool(
            self.instance
            and self.instance.production_type == ProductionRecord.ProductionType.MEAT
            and self.instance.livestock_id == value.pk
            and value.operational_status == LivestockInventory.OperationalStatus.SLAUGHTERED
        )
        if (
            value.operational_status != LivestockInventory.OperationalStatus.ACTIVE
            and not editing_same_slaughtered_meat_source
        ):
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
            milking_session = attrs.get("milking_session")
        else:
            # for patch
            livestock = attrs.get("livestock", self.instance.livestock)
            batch = attrs.get("batch", getattr(self.instance, "batch", None))
            production_type = attrs.get(
                "production_type",
                self.instance.production_type,
            )
            unit = attrs.get("unit", self.instance.unit)
            milking_session = attrs.get("milking_session", self.instance.milking_session)

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

        # Meat output is measured in kilograms; individual inventory reconciliation
        # runs only after the farmer successfully saves the complete record.
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

        if (
            self.instance
            and self.instance.production_type == ProductionRecord.ProductionType.MEAT
            and self.instance.livestock_id
            and self.instance.livestock.operational_status == LivestockInventory.OperationalStatus.SLAUGHTERED
            and (
                production_type != ProductionRecord.ProductionType.MEAT
                or not livestock
                or livestock.pk != self.instance.livestock_id
            )
        ):
            raise ValidationError({
                "livestock": "A meat-yield record that marked its animal slaughtered cannot be reassigned or changed to another production type."
            })

        if (
            production_type == ProductionRecord.ProductionType.MILK
            and livestock
            and (livestock.sex or "").strip().upper() not in {"FEMALE", "F"}
        ):
            raise ValidationError({
                "livestock": "Milk production can only be logged for an individual female animal."
            })

        if production_type == ProductionRecord.ProductionType.MILK:
            if milking_session not in ProductionRecord.MilkingSession.values:
                raise ValidationError({"milking_session": "Choose the morning, afternoon, or evening milking session."})
            record_date = attrs.get("record_date", self.instance.record_date if self.instance else None)
            duplicate_qs = ProductionRecord.objects.filter(
                production_type=ProductionRecord.ProductionType.MILK,
                record_date=record_date,
                milking_session=milking_session,
                session_conflict=False,
            )
            duplicate_qs = duplicate_qs.filter(livestock=livestock) if livestock else duplicate_qs.filter(batch=batch)
            if self.instance:
                duplicate_qs = duplicate_qs.exclude(pk=self.instance.pk)
            if duplicate_qs.exists():
                raise ValidationError({"milking_session": "A milk record already exists for this animal, date, and session."})
        elif milking_session:
            raise ValidationError({"milking_session": "Milking sessions apply only to milk production records."})

        expected_unit = PRODUCTION_UNITS.get(production_type)
        if unit != expected_unit:
            raise ValidationError({
                "unit": f"{production_type.title()} production must use {expected_unit}."
            })

        event_date = attrs.get("record_date", self.instance.record_date if self.instance else None)
        if event_date and event_date > timezone.localdate():
            raise ValidationError({"record_date": "Production record date cannot be in the future."})

        submit_slaughter_report = attrs.get("submit_slaughter_report", False)
        has_existing_slaughter = bool(self.instance and self.instance.slaughter_id)
        if (
            (submit_slaughter_report or "selected_animals" in attrs)
            and not has_existing_slaughter
            and production_type == ProductionRecord.ProductionType.MEAT
        ):
            raise ValidationError({
                "submit_slaughter_report": (
                    "Farmer meat-yield records no longer use a separate MAO-reviewed slaughter report. "
                    "An individual meat-yield record marks its selected animal SLAUGHTERED immediately."
                )
            })
        if production_type == "MEAT" and has_existing_slaughter:
            animals = attrs.get("selected_animals")
            if "selected_animals" not in self.initial_data:
                animals = list(self.instance.slaughter.selected_animals.all())
            from .services.slaughter import validate_animals
            record = ProductionRecord(livestock=livestock, batch=batch)
            if self.instance:
                record.slaughter_id = self.instance.slaughter_id
            validate_animals(record, animals)
            attrs["selected_animals"] = animals
        elif production_type != "MEAT" and (submit_slaughter_report or attrs.get("selected_animals") or has_existing_slaughter):
            raise ValidationError({"production_type": "A slaughter entry must remain MEAT."})
        else:
            attrs.pop("selected_animals", None)
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        user = self.context["request"].user
        validated_data["created_by"] = user
        source = validated_data.get("livestock") or validated_data.get("batch")
        validated_data["farmer_at_record"] = source.farmer
        from .services.milk_anomaly import apply_milk_anomaly_assessment
        from .services.valuation import snapshot_for
        validated_data.pop("selected_animals", None)
        validated_data.pop("submit_slaughter_report", None)
        record = ProductionRecord(**validated_data)
        record.status = ProductionRecord.ProductionStatus.RECORDED
        record.valuation_snapshot = snapshot_for(record)
        apply_milk_anomaly_assessment(record)
        record.save()
        ProductionRecordWorkflowEvent.objects.create(
            production_record=record,
            event_type=ProductionRecordWorkflowEvent.EventType.SUBMITTED,
            actor=user,
            to_status=record.status,
            snapshot={"record_date": record.record_date.isoformat(), "production_type": record.production_type,
                      "quantity": str(record.quantity), "unit": record.unit,
                      "milking_session": record.milking_session,
                      "livestock_id": record.livestock_id, "batch_id": record.batch_id},
        )
        if record.production_type == ProductionRecord.ProductionType.MEAT:
            from livestock.reconciliation import reconcile_recorded_meat_yield
            reconcile_recorded_meat_yield(record)
        return record

    @transaction.atomic
    def update(self, instance, validated_data):
        was_returned = instance.status == ProductionRecord.ProductionStatus.SUBJECT_TO_REVISION
        previous_status = instance.status
        allowed = [
            "livestock",
            "batch",
            "production_type",
            "quantity",
            "unit",
            "record_date",
            "milking_session",
            "notes",
        ]
        animals = validated_data.pop("selected_animals", [])
        submit_slaughter_report = validated_data.pop("submit_slaughter_report", False)
        for field in allowed:
            if field in validated_data:
                setattr(instance, field, validated_data[field])
        if "livestock" in validated_data or "batch" in validated_data:
            source = instance.livestock or instance.batch
            instance.farmer_at_record = source.farmer
        if was_returned:
            instance.status = ProductionRecord.ProductionStatus.RECORDED
            instance.reviewed_by = None
            instance.reviewed_at = None
        from .services.milk_anomaly import apply_milk_anomaly_assessment
        from .services.valuation import snapshot_for
        instance.valuation_snapshot = snapshot_for(instance, instance.valuation_snapshot)
        apply_milk_anomaly_assessment(instance, previous_assessment=instance.anomaly_assessment)
        instance.save()
        if was_returned:
            ProductionRecordWorkflowEvent.objects.create(
                production_record=instance,
                event_type=ProductionRecordWorkflowEvent.EventType.RESUBMITTED,
                actor=self.context["request"].user,
                from_status=previous_status,
                to_status=instance.status,
                snapshot={"record_date": instance.record_date.isoformat(), "production_type": instance.production_type,
                          "quantity": str(instance.quantity), "unit": instance.unit,
                          "milking_session": instance.milking_session,
                          "livestock_id": instance.livestock_id, "batch_id": instance.batch_id},
            )
        if instance.production_type == "MEAT" and (instance.slaughter_id or submit_slaughter_report):
            from .services.slaughter import sync_slaughter
            sync_slaughter(instance, animals)
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

    def validate_weight(self, value):
        if value <= 0:
            raise ValidationError("Recorded weight must be greater than zero.")
        if value > 3500:
            raise ValidationError("Recorded weight exceeds realistic biological limits (max 3,500 kg). Check your units.")
        return value

    def validate_weighing_date(self, value):
        if value > timezone.localdate():
            raise ValidationError("Weighing date cannot be in the future.")
        return value

    def validate(self, attrs):
        livestock = attrs.get("livestock", self.instance.livestock if self.instance else None)
        weighing_date = attrs.get("weighing_date", self.instance.weighing_date if self.instance else None)
        weight = attrs.get("weight", self.instance.weight if self.instance else None)
        if not self.instance and livestock and weighing_date and weight:
            if WeightRecord.objects.filter(livestock=livestock, weighing_date=weighing_date, weight=weight).exists():
                raise ValidationError("A weight entry with this exact measurement on this date already exists for this animal.")
        return attrs

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
        user = self.context["request"].user
        if not value or not value.farmer or value.farmer.user_id != user.pk:
            raise ValidationError("Select your own livestock.")
        if value.status not in (
            LivestockInventory.StatusType.APPROVED,
            LivestockInventory.StatusType.VERIFIED,
        ):
            raise ValidationError("Only verified or approved livestock can be logged for weight.")
        if value.operational_status != LivestockInventory.OperationalStatus.ACTIVE:
            raise ValidationError("Select active livestock.")
        return value

    def create(self, validated_data):
        user = self.context["request"].user
        with transaction.atomic():
            livestock = LivestockInventory.objects.select_for_update().get(
                pk=validated_data["livestock"].pk
            )
            # Recheck availability after acquiring the same lock used by inventory changes.
            self.validate_livestock(livestock)

            # Inventory weight is the registration baseline until a measured
            # weigh-in is logged. Preserve it before syncing the latest weight.
            if (
                livestock.weight is not None
                and livestock.weight > 0
                and not WeightRecord.objects.filter(livestock=livestock).exists()
            ):
                WeightRecord.objects.create(
                    livestock=livestock,
                    weight=livestock.weight,
                    weighing_date=timezone.localtime(livestock.created_at).date(),
                    notes="Initial registration weight baseline",
                    created_by=livestock.created_by,
                )

            validated_data["livestock"] = livestock
            validated_data["created_by"] = user
            record = WeightRecord.objects.create(**validated_data)
            latest = WeightRecord.objects.filter(livestock=livestock).order_by(
                "-weighing_date", "-created_at", "-pk"
            ).first()
            livestock.weight = latest.weight
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

    def validate_calving_date(self, value):
        if value > timezone.localdate():
            raise ValidationError("Calving / birth date cannot be in the future.")
        return value

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
        if not value or not value.farmer or value.farmer.user_id != user.id:
            raise ValidationError("You can only record calving for your own livestock.")
        if value.status not in (
            LivestockInventory.StatusType.APPROVED,
            LivestockInventory.StatusType.VERIFIED,
        ):
            raise ValidationError("Only verified or approved livestock can be used as the dam.")
        if value.operational_status != LivestockInventory.OperationalStatus.ACTIVE:
            raise ValidationError("Only active livestock can be used as the dam.")
        if value.entry_type != LivestockInventory.EntryType.INDIVIDUAL:
            raise ValidationError("The dam must be an individual animal, not a batch.")
        if (value.sex or "").strip().upper() not in {"FEMALE", "F"}:
            raise ValidationError("The selected dam must be female. Male animals cannot give birth.")
        if value.age_classification_as_of() == "CALF":
            raise ValidationError("Calves are not eligible for birthing. The dam must be a mature female.")
        return value

    def validate(self, attrs):
        if self.instance and "dam" in attrs and attrs["dam"].pk != self.instance.dam_id:
            raise ValidationError({"dam": "The dam cannot be changed on an existing birth declaration."})
        dam = attrs.get("dam", self.instance.dam if self.instance else None)
        self.validate_dam(dam)
        calving_date = attrs.get("calving_date", self.instance.calving_date if self.instance else None)
        if dam and calving_date:
            if dam.birth_date and dam.birth_date >= calving_date:
                raise ValidationError({"calving_date": "Calving date cannot be on or before the dam's own birth date."})
            if dam.age_classification_as_of(calving_date) == "CALF":
                raise ValidationError({"dam": "The dam was classified as a calf on the recorded calving date."})
        calf_tag = (attrs.get("calf_tag") or (self.instance.calf_tag if self.instance else "")).strip()
        if not self.instance and dam and calving_date:
            qs = CalvingRecord.objects.filter(dam=dam, calving_date=calving_date)
            if calf_tag:
                qs = qs.filter(calf_tag__iexact=calf_tag)
            if qs.exclude(status=CalvingRecord.StatusType.SUBJECT_TO_REVISION).exists():
                raise ValidationError("A calving record for this dam on this date already exists.")
        return attrs

    def create(self, validated_data):
        user = self.context["request"].user
        validated_data["created_by"] = user
        dam = validated_data["dam"]

        with transaction.atomic():
            if not (validated_data.get("calf_tag") or "").strip():
                # Match the livestock registration convention: FARMER-NAME-001.
                # Locking the farmer row keeps simultaneous calving submissions
                # from receiving the same next number.
                farmer = Farmer.objects.select_for_update().select_related("user").get(pk=dam.farmer_id)
                owner_name = farmer.user.get_full_name().strip() or farmer.user.username
                owner_name = "".join(
                    character
                    for character in unicodedata.normalize("NFKD", owner_name)
                    if not unicodedata.combining(character)
                )
                tag_prefix = re.sub(r"[^A-Z0-9]+", "-", owner_name.upper()).strip("-") or "FARMER"
                tag_pattern = re.compile(rf"^{re.escape(tag_prefix)}-(\d{{3,}})$", re.IGNORECASE)
                used_tags = list(
                    LivestockInventory.objects.filter(farmer=farmer)
                    .exclude(tag_number="")
                    .values_list("tag_number", flat=True)
                )
                used_tags.extend(
                    CalvingRecord.objects.filter(dam__farmer=farmer)
                    .exclude(calf_tag="")
                    .values_list("calf_tag", flat=True)
                )
                highest_number = max(
                    (int(match.group(1)) for tag in used_tags if (match := tag_pattern.match(tag.strip()))),
                    default=0,
                )
                next_number = highest_number + 1
                while True:
                    generated_tag = f"{tag_prefix}-{next_number:03d}"
                    if not LivestockInventory.objects.filter(tag_number__iexact=generated_tag).exists() and not CalvingRecord.objects.filter(calf_tag__iexact=generated_tag).exists():
                        validated_data["calf_tag"] = generated_tag
                        break
                    next_number += 1

            calving = CalvingRecord.objects.create(**validated_data)

            # Automatically link the dam's active breeding event to this birth to complete the cycle
            active_breeding = (
                BreedingRecord.objects.filter(
                    dam=calving.dam,
                    breeding_date__lte=calving.calving_date,
                    status__in=[
                        BreedingRecord.BreedingStatus.PREGNANT,
                        BreedingRecord.BreedingStatus.PENDING_CHECK,
                    ],
                    calving_record__isnull=True,
                )
                .order_by("-breeding_date")
                .first()
            )
            if active_breeding:
                active_breeding.calving_record = calving
                active_breeding.status = BreedingRecord.BreedingStatus.CALVED
                active_breeding.save(update_fields=["calving_record", "status"])

        return calving

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
        user = self.context["request"].user
        if not value or not value.farmer or value.farmer.user_id != user.pk:
            raise ValidationError("Select your own livestock.")
        if value.status != "APPROVED":
            raise ValidationError("Only approved livestock can be declared for sale or movement.")
        if value.operational_status != "ACTIVE":
            raise ValidationError("Select active livestock.")
        return value

    def create(self, validated_data):
        user = self.context["request"].user
        validated_data["created_by"] = user
        return AnimalDisposition.objects.create(**validated_data)


class BreedingRecordSerializer(serializers.ModelSerializer):
    dam_tag = serializers.CharField(source="dam.tag_number", read_only=True)
    dam_breed = serializers.CharField(source="dam.breed", read_only=True)
    livestock_type_name = serializers.CharField(source="dam.livestock_type.name", read_only=True)
    farmer_name = serializers.CharField(source="dam.farmer.user.get_full_name", read_only=True)
    sire_livestock_tag = serializers.CharField(source="sire_livestock.tag_number", read_only=True)
    pregnancy_confirmed_by_name = serializers.CharField(source="pregnancy_confirmed_by.get_full_name", read_only=True)
    days_until_due = serializers.SerializerMethodField()
    gestation_progress_pct = serializers.SerializerMethodField()

    class Meta:
        model = BreedingRecord
        fields = (
            "id",
            "dam",
            "dam_tag",
            "dam_breed",
            "livestock_type_name",
            "farmer_name",
            "breeding_date",
            "breeding_type",
            "sire_livestock",
            "sire_livestock_tag",
            "sire_tag_or_code",
            "sire_breed",
            "technician_or_inseminator",
            "gestation_days",
            "expected_due_date",
            "days_until_due",
            "gestation_progress_pct",
            "pregnancy_confirmed_date",
            "pregnancy_confirmed_by",
            "pregnancy_confirmed_by_name",
            "confirmation_method",
            "calving_record",
            "status",
            "notes",
            "created_at",
        )
        read_only_fields = ("created_at", "pregnancy_confirmed_by_name")

    def get_days_until_due(self, obj):
        if not obj.expected_due_date:
            return None
        today = timezone.localdate()
        return (obj.expected_due_date - today).days

    def get_gestation_progress_pct(self, obj):
        if not obj.breeding_date or not obj.gestation_days:
            return 0
        today = timezone.localdate()
        elapsed = (today - obj.breeding_date).days
        if elapsed <= 0:
            return 0
        return min(100, max(0, round((elapsed / obj.gestation_days) * 100)))

    def validate_dam(self, value):
        user = self.context["request"].user
        role = getattr(getattr(user, "role", None), "role_name", None)
        if role == "FARMER":
            if not value or not value.farmer or value.farmer.user_id != user.pk:
                raise ValidationError("You may only record breeding for your own livestock.")
        if value.status not in (
            LivestockInventory.StatusType.APPROVED,
            LivestockInventory.StatusType.VERIFIED,
        ):
            raise ValidationError("Selected female animal must be verified or approved first.")
        if value.operational_status != LivestockInventory.OperationalStatus.ACTIVE:
            raise ValidationError("Selected female animal must be currently active.")
        sex = (value.sex or "").upper()
        if not (sex.startswith("F") or sex == "FEMALE" or value.entry_type == "BATCH"):
            raise ValidationError("Breeding records can only be registered for female livestock (dam).")
        return value

    def validate_breeding_date(self, value):
        if value > timezone.localdate():
            raise ValidationError("Breeding date cannot be in the future.")
        return value

    def validate(self, attrs):
        dam = attrs.get("dam") or (self.instance.dam if self.instance else None)
        sire_livestock = attrs.get("sire_livestock") or (self.instance.sire_livestock if self.instance else None)
        breeding_date = attrs.get("breeding_date") or (self.instance.breeding_date if self.instance else None)
        confirmed_date = attrs.get("pregnancy_confirmed_date") or (self.instance.pregnancy_confirmed_date if self.instance else None)

        if sire_livestock:
            if dam and sire_livestock.id == dam.id:
                raise ValidationError({"sire_livestock": "Dam and sire cannot be the same animal."})
            sire_sex = (sire_livestock.sex or "").upper()
            if not (sire_sex.startswith("M") or sire_sex == "MALE"):
                raise ValidationError({"sire_livestock": "Selected sire animal must be male."})
            if dam and sire_livestock.livestock_type_id != dam.livestock_type_id:
                raise ValidationError({"sire_livestock": "Sire must be of the same species as the dam."})

        if confirmed_date:
            if confirmed_date > timezone.localdate():
                raise ValidationError({"pregnancy_confirmed_date": "Pregnancy confirmation date cannot be in the future."})
            if breeding_date and confirmed_date < breeding_date:
                raise ValidationError({"pregnancy_confirmed_date": "Pregnancy confirmation date cannot precede the breeding date."})

        return attrs

    def create(self, validated_data):
        user = self.context["request"].user
        validated_data["created_by"] = user
        if validated_data.get("status") == BreedingRecord.BreedingStatus.PREGNANT and not validated_data.get("pregnancy_confirmed_by"):
            validated_data["pregnancy_confirmed_by"] = user
            if not validated_data.get("pregnancy_confirmed_date"):
                validated_data["pregnancy_confirmed_date"] = timezone.localdate()
        return super().create(validated_data)

    def update(self, instance, validated_data):
        user = self.context["request"].user
        if validated_data.get("status") == BreedingRecord.BreedingStatus.PREGNANT and not instance.pregnancy_confirmed_by:
            validated_data["pregnancy_confirmed_by"] = user
            if not validated_data.get("pregnancy_confirmed_date") and not instance.pregnancy_confirmed_date:
                validated_data["pregnancy_confirmed_date"] = timezone.localdate()
        return super().update(instance, validated_data)


class LivestockTreatmentRecordSerializer(serializers.ModelSerializer):
    livestock_tag = serializers.CharField(source="livestock.tag_number", read_only=True)
    livestock_type_name = serializers.CharField(source="livestock.livestock_type.name", read_only=True)
    farmer_name = serializers.CharField(source="livestock.farmer.user.get_full_name", read_only=True)
    created_by_name = serializers.CharField(source="created_by.get_full_name", read_only=True)

    class Meta:
        model = LivestockTreatmentRecord
        fields = (
            "id",
            "livestock",
            "livestock_tag",
            "livestock_type_name",
            "farmer_name",
            "treatment_date",
            "treatment_type",
            "medication_name",
            "reason",
            "dosage",
            "route_of_administration",
            "administered_by",
            "related_disease_case",
            "related_breeding_record",
            "notes",
            "follow_up_date",
            "created_by",
            "created_by_name",
            "created_at",
        )
        read_only_fields = ("created_by", "created_at")

    def validate_livestock(self, value):
        user = self.context["request"].user
        role = getattr(getattr(user, "role", None), "role_name", None)
        if role == "FARMER":
            if not value or not value.farmer or value.farmer.user_id != user.pk:
                raise ValidationError("You may only record treatments for your own livestock.")
        return value

    TREATMENT_TYPE_ALIASES = {
        "VACCINE": LivestockTreatmentRecord.TreatmentType.VACCINATION,
        "DEWORMER": LivestockTreatmentRecord.TreatmentType.DEWORMING,
        "VITAMIN_MINERAL": LivestockTreatmentRecord.TreatmentType.VITAMIN_SUPPLEMENT,
        "VITAMINS": LivestockTreatmentRecord.TreatmentType.VITAMIN_SUPPLEMENT,
        "HORMONAL": LivestockTreatmentRecord.TreatmentType.REPRODUCTIVE_THERAPY,
        "TOPICAL_WOUND": LivestockTreatmentRecord.TreatmentType.WOUND_CARE,
        "ANTI_INFLAMMATORY": LivestockTreatmentRecord.TreatmentType.WOUND_CARE,
        "NEUTERING": LivestockTreatmentRecord.TreatmentType.CASTRATION,
    }

    def to_internal_value(self, data):
        if hasattr(data, "copy"):
            mutable_data = data.copy()
        else:
            mutable_data = dict(data)
        raw_type = str(mutable_data.get("treatment_type", "")).strip().upper()
        if raw_type in self.TREATMENT_TYPE_ALIASES:
            mutable_data["treatment_type"] = self.TREATMENT_TYPE_ALIASES[raw_type]
        return super().to_internal_value(mutable_data)

    def validate_treatment_date(self, value):
        if value > timezone.localdate():
            raise ValidationError("Treatment date cannot be in the future.")
        return value

    def validate(self, attrs):
        treatment_date = attrs.get("treatment_date")
        follow_up_date = attrs.get("follow_up_date")
        treatment_type = attrs.get("treatment_type")
        livestock = attrs.get("livestock") or (self.instance.livestock if self.instance else None)
        if follow_up_date and treatment_date and follow_up_date < treatment_date:
            raise ValidationError({"follow_up_date": "Follow-up date cannot be earlier than the treatment date."})
        if treatment_type == LivestockTreatmentRecord.TreatmentType.CASTRATION and livestock:
            if livestock.operational_status != LivestockInventory.OperationalStatus.ACTIVE:
                raise ValidationError({"livestock": "Only active livestock can undergo castration."})
            raw_sex = (livestock.sex or "").strip().upper()
            if raw_sex.startswith("CASTRAT") or raw_sex == "STEER":
                raise ValidationError({"treatment_type": "This animal is already recorded as castrated."})
            if not (raw_sex == "MALE" or raw_sex == "M"):
                raise ValidationError({"treatment_type": "Castration can only be recorded for male livestock."})
        return attrs

    def create(self, validated_data):
        from django.db import transaction

        validated_data["created_by"] = self.context["request"].user
        with transaction.atomic():
            instance = super().create(validated_data)
            livestock = instance.livestock
            if (
                livestock
                and instance.treatment_type == LivestockTreatmentRecord.TreatmentType.VACCINATION
                and instance.treatment_date
            ):
                if not livestock.last_vaccination_date or instance.treatment_date >= livestock.last_vaccination_date:
                    livestock.last_vaccination_date = instance.treatment_date
                    livestock.save(update_fields=["last_vaccination_date"])
            elif (
                livestock
                and instance.treatment_type == LivestockTreatmentRecord.TreatmentType.CASTRATION
            ):
                livestock.sex = "Castrated"
                livestock.save(update_fields=["sex"])
        return instance


class FeedingRecordSerializer(serializers.ModelSerializer):
    livestock_tag = serializers.CharField(source="livestock.tag_number", read_only=True)
    batch_code = serializers.CharField(source="batch.batch_code", read_only=True)
    livestock_type_name = serializers.SerializerMethodField()

    class Meta:
        model = FeedingRecord
        fields = (
            "id",
            "livestock",
            "livestock_tag",
            "batch",
            "batch_code",
            "livestock_type_name",
            "feeding_date",
            "feed_type",
            "feed_name",
            "quantity_kg",
            "cost",
            "feeding_time",
            "notes",
            "created_at",
        )
        read_only_fields = ("created_at",)

    def get_livestock_type_name(self, obj):
        if obj.livestock and obj.livestock.livestock_type:
            return obj.livestock.livestock_type.name
        if obj.batch and obj.batch.livestock_type:
            return obj.batch.livestock_type.name
        return None

    def validate(self, attrs):
        user = self.context["request"].user
        livestock = attrs.get("livestock")
        batch = attrs.get("batch")

        if not livestock and not batch:
            raise ValidationError("Choose an animal or herd batch for this feeding log.")

        if livestock:
            if not livestock.farmer or livestock.farmer.user_id != user.pk:
                raise ValidationError({"livestock": "You can only log feeding for your own livestock."})
            if livestock.operational_status != LivestockInventory.OperationalStatus.ACTIVE:
                raise ValidationError({"livestock": "Cannot log feeding for inactive or culled livestock."})

        if batch:
            if not batch.farmer or batch.farmer.user_id != user.pk:
                raise ValidationError({"batch": "You can only log feeding for your own herd batch."})

        feeding_date = attrs.get("feeding_date")
        if feeding_date and feeding_date > timezone.localdate():
            raise ValidationError({"feeding_date": "Feeding date cannot be in the future."})

        quantity = attrs.get("quantity_kg")
        if quantity is not None and quantity <= 0:
            raise ValidationError({"quantity_kg": "Feed quantity must be greater than 0 kg."})

        cost = attrs.get("cost")
        if cost is not None and cost < 0:
            raise ValidationError({"cost": "Feed cost cannot be negative."})

        return attrs

    def create(self, validated_data):
        validated_data["created_by"] = self.context["request"].user
        return super().create(validated_data)

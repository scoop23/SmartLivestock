from rest_framework import serializers
from django.db import transaction
from django.utils import timezone
from livestock.models import Farmer, LivestockType, LivestockInventory
from movements.models import (
    LivestockInspection,
    LivestockInspectionItem,
    LivestockInspectionClearance,
)


class LivestockInspectionItemSerializer(serializers.ModelSerializer):
    livestock_type_name = serializers.CharField(source="livestock_type.name", read_only=True)
    inventory_tag = serializers.SerializerMethodField()

    class Meta:
        model = LivestockInspectionItem
        fields = (
            "id",
            "livestock_type",
            "livestock_type_name",
            "inventory",
            "inventory_tag",
            "quantity",
            "sex",
            "classification",
            "remarks",
        )

    def get_inventory_tag(self, obj):
        if obj.inventory:
            return obj.inventory.tag_number or f"#{obj.inventory.id}"
        return None

    def validate(self, attrs):
        quantity = attrs.get("quantity")
        if quantity is not None and quantity <= 0:
            raise serializers.ValidationError({"quantity": "Head count must be at least 1."})

        inventory = attrs.get("inventory")
        livestock_type = attrs.get("livestock_type")
        if inventory:
            if livestock_type and inventory.livestock_type_id != livestock_type.id:
                raise serializers.ValidationError(
                    {"inventory": "Registered animal species does not match the selected livestock type."}
                )
            if quantity != 1:
                raise serializers.ValidationError(
                    {"quantity": "Individual registered livestock must represent exactly 1 head."}
                )
            if inventory.status != "APPROVED":
                raise serializers.ValidationError(
                    {"inventory": "Only officially approved livestock can be included in transport inspection."}
                )
            if inventory.operational_status != "ACTIVE":
                raise serializers.ValidationError(
                    {"inventory": "Selected animal is no longer active (may be sold, deceased, or moved out)."}
                )
        return attrs


class LivestockInspectionClearanceSerializer(serializers.ModelSerializer):
    issued_by_name = serializers.SerializerMethodField()
    reviewed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = LivestockInspectionClearance
        fields = (
            "id",
            "control_number",
            "date_issued",
            "time_issued",
            "shipper_address",
            "origin",
            "vehicle_plate_number",
            "livestock_handler_license_no",
            "status",
            "issued_by",
            "issued_by_name",
            "reviewed_by",
            "reviewed_by_name",
            "reviewed_at",
            "review_remarks",
            "created_at",
        )
        read_only_fields = (
            "id",
            "date_issued",
            "time_issued",
            "issued_by",
            "issued_by_name",
            "reviewed_by",
            "reviewed_by_name",
            "reviewed_at",
            "created_at",
        )

    def get_issued_by_name(self, obj):
        if obj.issued_by:
            return obj.issued_by.get_full_name() or obj.issued_by.username
        return None

    def get_reviewed_by_name(self, obj):
        if obj.reviewed_by:
            return obj.reviewed_by.get_full_name() or obj.reviewed_by.username
        return None


class LivestockInspectionSerializer(serializers.ModelSerializer):
    items = LivestockInspectionItemSerializer(many=True, required=False)
    clearance = LivestockInspectionClearanceSerializer(read_only=True)
    created_by_name = serializers.SerializerMethodField()

    # Flat convenience fields matching frontend InspectionRecord interface
    control_number = serializers.SerializerMethodField()
    shipper_address = serializers.CharField(write_only=True, required=False, allow_blank=True)
    origin = serializers.CharField(write_only=True, required=False, allow_blank=True)
    vehicle_plate_number = serializers.CharField(write_only=True, required=False, allow_blank=True)
    livestock_handler_license_no = serializers.CharField(write_only=True, required=False, allow_blank=True)

    status = serializers.SerializerMethodField()
    date_issued = serializers.SerializerMethodField()
    time_issued = serializers.SerializerMethodField()
    review_remarks = serializers.SerializerMethodField()

    class Meta:
        model = LivestockInspection
        fields = (
            "id",
            "control_number",
            "shipper",
            "shipper_name",
            "shipper_address",
            "origin",
            "destination",
            "purpose",
            "inspection_date",
            "vehicle_plate_number",
            "livestock_handler_license_no",
            "status",
            "date_issued",
            "time_issued",
            "review_remarks",
            "created_by",
            "created_by_name",
            "created_at",
            "items",
            "clearance",
        )
        read_only_fields = ("id", "created_by", "created_by_name", "created_at", "clearance")

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return None

    def get_control_number(self, obj):
        if hasattr(obj, "clearance") and obj.clearance:
            return obj.clearance.control_number
        return f"INS-{obj.id}"

    def get_status(self, obj):
        if hasattr(obj, "clearance") and obj.clearance:
            return obj.clearance.status
        return "PENDING"

    def get_date_issued(self, obj):
        if hasattr(obj, "clearance") and obj.clearance and obj.clearance.date_issued:
            return str(obj.clearance.date_issued)
        return None

    def get_time_issued(self, obj):
        if hasattr(obj, "clearance") and obj.clearance and obj.clearance.time_issued:
            return str(obj.clearance.time_issued)
        return None

    def get_review_remarks(self, obj):
        if hasattr(obj, "clearance") and obj.clearance:
            return obj.clearance.review_remarks
        return ""

    def validate(self, attrs):
        shipper = attrs.get("shipper", self.instance.shipper if self.instance else None)
        shipper_name = attrs.get("shipper_name", self.instance.shipper_name if self.instance else None)
        if not shipper and not (shipper_name and shipper_name.strip()):
            raise serializers.ValidationError({"shipper_name": "Shipper name is required."})

        destination = attrs.get("destination", self.instance.destination if self.instance else None)
        if not destination or not destination.strip():
            raise serializers.ValidationError({"destination": "Destination is required."})

        return attrs

    def create(self, validated_data):
        items_data = validated_data.pop("items", [])
        shipper_address = validated_data.pop("shipper_address", "")
        origin = validated_data.pop("origin", "")
        vehicle_plate_number = validated_data.pop("vehicle_plate_number", "")
        livestock_handler_license_no = validated_data.pop("livestock_handler_license_no", "")

        user = self.context["request"].user
        validated_data["created_by"] = user

        with transaction.atomic():
            inspection = LivestockInspection.objects.create(**validated_data)

            # Create line items
            for item_data in items_data:
                LivestockInspectionItem.objects.create(inspection=inspection, **item_data)

            # Auto-generate unique control number
            year = timezone.now().year
            control_no = f"CLR-{year}-{inspection.id:04d}"

            # Auto-determine shipper address if registered
            if not shipper_address and inspection.shipper:
                shipper_address = inspection.shipper.address or "Padre Garcia, Batangas"
            if not origin:
                origin = shipper_address or "Padre Garcia, Batangas"

            LivestockInspectionClearance.objects.create(
                inspection=inspection,
                control_number=control_no,
                shipper_address=shipper_address or "Padre Garcia, Batangas",
                origin=origin,
                vehicle_plate_number=vehicle_plate_number or "N/A",
                livestock_handler_license_no=livestock_handler_license_no or "N/A",
                status=LivestockInspectionClearance.StatusType.PENDING,
            )

        return inspection

    def update(self, instance, validated_data):
        items_data = validated_data.pop("items", None)
        shipper_address = validated_data.pop("shipper_address", None)
        origin = validated_data.pop("origin", None)
        vehicle_plate_number = validated_data.pop("vehicle_plate_number", None)
        livestock_handler_license_no = validated_data.pop("livestock_handler_license_no", None)

        with transaction.atomic():
            for attr, val in validated_data.items():
                setattr(instance, attr, val)
            instance.save()

            if items_data is not None:
                instance.items.all().delete()
                for item_data in items_data:
                    LivestockInspectionItem.objects.create(inspection=instance, **item_data)

            if hasattr(instance, "clearance") and instance.clearance:
                clearance = instance.clearance
                if shipper_address is not None:
                    clearance.shipper_address = shipper_address
                if origin is not None:
                    clearance.origin = origin
                if vehicle_plate_number is not None:
                    clearance.vehicle_plate_number = vehicle_plate_number
                if livestock_handler_license_no is not None:
                    clearance.livestock_handler_license_no = livestock_handler_license_no
                clearance.save()

        return instance

import json
import re
from datetime import date
from decimal import Decimal

from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from livestock.models import LivestockType
from smartlivestock.workflows import require_action, role_name, scope_reviewer_queryset, validate_review_transition
from .models import SlaughterRecord


class SlaughterRecordInputSerializer(serializers.ModelSerializer):
    """Validate aggregate fields and condemnation inspection telemetry for slaughterhouse operations."""

    livestock_type_name = serializers.CharField(source="livestock_type.name", read_only=True)
    barangay_name = serializers.CharField(source="barangay.barangay_name", read_only=True, allow_null=True)
    created_by_name = serializers.SerializerMethodField()
    can_edit = serializers.SerializerMethodField()
    farmer_reported = serializers.SerializerMethodField()
    production_record_id = serializers.SerializerMethodField()
    selected_animal_tags = serializers.SerializerMethodField()

    condemned_heads = serializers.IntegerField(required=False, default=0, min_value=0)
    condemned_weight_kg = serializers.DecimalField(
        max_digits=8, decimal_places=2, required=False, default=Decimal("0.00"), min_value=Decimal("0.00")
    )
    condemnation_reason = serializers.CharField(required=False, allow_blank=True, default="")
    condemnation_type = serializers.CharField(required=False, allow_blank=True, default="NONE")

    class Meta:
        model = SlaughterRecord
        fields = (
            "id", "livestock_type", "livestock_type_name", "barangay_name", "quantity", "carcass_weight",
            "record_date", "barangay", "status", "review_remarks", "created_by_name",
            "created_at", "can_edit", "farmer_reported", "production_record_id", "selected_animal_tags", "condemned_heads", "condemned_weight_kg",
            "condemnation_reason", "condemnation_type",
        )
        read_only_fields = ("id", "status", "created_by_name", "created_at", "can_edit")

    def validate_quantity(self, value):
        if value < 1:
            raise serializers.ValidationError("Heads must be a positive whole number.")
        return value

    def validate_carcass_weight(self, value):
        if value is not None and value <= Decimal("0"):
            raise serializers.ValidationError("Kilograms must be greater than zero when provided.")
        return value

    def validate_record_date(self, value):
        if value > timezone.localdate():
            raise serializers.ValidationError("Record date cannot be in the future.")
        return value

    def get_created_by_name(self, obj):
        return obj.created_by.get_full_name() or obj.created_by.username

    def get_farmer_reported(self, obj):
        return hasattr(obj, "production_output")

    def get_production_record_id(self, obj):
        output = getattr(obj, "production_output", None)
        return output.pk if output else None

    def get_selected_animal_tags(self, obj):
        return [animal.tag_number or str(animal.pk) for animal in obj.selected_animals.all()]

    def get_can_edit(self, obj):
        user = self.context["request"].user
        return role_name(user) == "SLAUGHTERHOUSESTAFF" and obj.created_by_id == user.id and obj.status in {
            SlaughterRecord.StatusType.PENDING,
            SlaughterRecord.StatusType.SUBJECT_TO_REVISION,
        }

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        remarks = instance.review_remarks or ""
        match = re.search(r"<!--CONDEMNATION:(.*?)-->", remarks)
        clean_remarks = remarks
        condemned_heads = 0
        condemned_weight_kg = "0.00"
        condemnation_reason = ""
        condemnation_type = "NONE"

        if match:
            clean_remarks = re.sub(r"<!--CONDEMNATION:.*?-->", "", remarks).strip()
            try:
                data = json.loads(match.group(1))
                condemned_heads = int(data.get("heads", 0))
                condemned_weight_kg = str(data.get("weight_kg", "0.00"))
                condemnation_reason = str(data.get("reason", ""))
                condemnation_type = str(data.get("type", "NONE"))
            except Exception:
                pass

        ret["review_remarks"] = clean_remarks
        ret["condemned_heads"] = condemned_heads
        ret["condemned_weight_kg"] = condemned_weight_kg
        ret["condemnation_reason"] = condemnation_reason
        ret["condemnation_type"] = condemnation_type
        return ret

    def _pack_remarks(self, validated_data, existing_remarks=""):
        condemned_heads = validated_data.pop("condemned_heads", 0)
        condemned_weight_kg = validated_data.pop("condemned_weight_kg", Decimal("0.00"))
        condemnation_reason = validated_data.pop("condemnation_reason", "").strip()
        condemnation_type = validated_data.pop("condemnation_type", "NONE")
        base_remarks = validated_data.get("review_remarks", existing_remarks) or ""
        base_remarks = re.sub(r"<!--CONDEMNATION:.*?-->", "", base_remarks).strip()

        if condemned_heads > 0 or condemnation_reason or Decimal(str(condemned_weight_kg or 0)) > 0:
            payload = {
                "heads": condemned_heads,
                "weight_kg": str(condemned_weight_kg),
                "reason": condemnation_reason,
                "type": condemnation_type or ("TOTAL" if condemned_heads > 0 else "PARTIAL"),
            }
            tag = f"<!--CONDEMNATION:{json.dumps(payload)}-->"
            validated_data["review_remarks"] = f"{base_remarks} {tag}".strip()
        else:
            validated_data["review_remarks"] = base_remarks
        return validated_data

    def create(self, validated_data):
        self._pack_remarks(validated_data)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        self._pack_remarks(validated_data, instance.review_remarks)
        return super().update(instance, validated_data)


def _aggregate_slaughter_records():
    # Existing farmer slaughter events can be linked to a livestock, herd, or
    # ProductionRecord. Keep this staff workflow limited to standalone daily
    # totals so its review action cannot bypass inventory reconciliation.
    return SlaughterRecord.objects.filter(
        livestock__isnull=True,
        batch__isnull=True,
        production_output__isnull=True,
        selected_animals__isnull=True,
    ).select_related("livestock_type", "barangay", "created_by").distinct()


def _visible_slaughter_records(user):
    role = role_name(user)
    records = _aggregate_slaughter_records()
    if role == "SLAUGHTERHOUSESTAFF":
        # With no facility field in this schema, staff can see municipal approved
        # totals plus their own submissions; another operator's pending records
        # remain private until MAO makes them official.
        records = records.filter(status=SlaughterRecord.StatusType.APPROVED) | records.filter(created_by=user)
    elif role in {"SIBAT", "CBAT"}:
        # Field officers see only farmer reports in their assigned barangays.
        records = scope_reviewer_queryset(SlaughterRecord.objects.filter(
            production_output__status="RECORDED"
        ), user)
    else:
        require_action(user, "slaughter_records", "read_all")
        records = records | SlaughterRecord.objects.filter(production_output__status="RECORDED")
    return records.order_by("-record_date", "-id").distinct()


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def slaughterhouse_records(request):
    """List visible aggregate records or create a pending facility submission."""
    user_role = role_name(request.user)
    if request.method == "POST":
        require_action(request.user, "slaughter_records", "create")
        serializer = SlaughterRecordInputSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        values = serializer.validated_data
        with transaction.atomic():
            # Lock the species row even when no matching records exist yet.
            # Concurrent equal submissions then recheck after the first commits.
            LivestockType.objects.select_for_update().get(pk=values["livestock_type"].pk)
            duplicate = _aggregate_slaughter_records().filter(
                record_date=values["record_date"],
                livestock_type=values["livestock_type"],
                quantity=values["quantity"],
                carcass_weight=values.get("carcass_weight"),
                barangay=values.get("barangay"),
            ).exists()
            if duplicate:
                return Response({"detail": "An identical slaughter record already exists."}, status=status.HTTP_409_CONFLICT)
            record = serializer.save(created_by=request.user, status=SlaughterRecord.StatusType.PENDING)
        return Response(SlaughterRecordInputSerializer(record, context={"request": request}).data, status=status.HTTP_201_CREATED)

    records = _visible_slaughter_records(request.user)
    start = request.query_params.get("start_date")
    end = request.query_params.get("end_date")
    livestock_type = request.query_params.get("livestock_type")
    try:
        parsed_start = date.fromisoformat(start) if start else None
        parsed_end = date.fromisoformat(end) if end else None
    except ValueError:
        return Response({"detail": "Dates must use YYYY-MM-DD format."}, status=400)
    if parsed_start and parsed_end and parsed_start > parsed_end:
        return Response({"detail": "Start date must be on or before end date."}, status=400)
    if start:
        records = records.filter(record_date__gte=parsed_start)
    if end:
        records = records.filter(record_date__lte=parsed_end)
    if livestock_type:
        if not livestock_type.isdigit() or not LivestockType.objects.filter(pk=int(livestock_type)).exists():
            return Response({"detail": "Select a valid livestock type."}, status=400)
        records = records.filter(livestock_type_id=livestock_type)
    records = records.distinct()
    records = records.select_related("livestock_type", "created_by").prefetch_related("selected_animals")
    data = SlaughterRecordInputSerializer(records, many=True, context={"request": request}).data
    return Response(data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def slaughterhouse_livestock_types(request):
    """Expose the existing livestock-type lookup for the record form."""
    if role_name(request.user) not in {"SLAUGHTERHOUSESTAFF", "MAO", "ADMIN"}:
        return Response({"detail": "You do not have permission to view livestock types."}, status=403)
    return Response(list(LivestockType.objects.order_by("name").values("id", "name")))


@api_view(["PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def slaughterhouse_record_detail(request, pk):
    """Allow staff to correct only their own unapproved aggregate submission."""
    require_action(request.user, "slaughter_records", "edit_own")
    record = get_object_or_404(_visible_slaughter_records(request.user), pk=pk, created_by=request.user)
    if record.status not in {SlaughterRecord.StatusType.PENDING, SlaughterRecord.StatusType.SUBJECT_TO_REVISION}:
        return Response({"detail": "Only pending or returned records can be changed."}, status=403)
    if request.method == "DELETE":
        record.delete()
        return Response(status=204)
    serializer = SlaughterRecordInputSerializer(record, data=request.data, partial=True, context={"request": request})
    serializer.is_valid(raise_exception=True)
    record = serializer.save(status=SlaughterRecord.StatusType.PENDING, reviewed_by=None, reviewed_at=None, review_remarks="")
    return Response(SlaughterRecordInputSerializer(record, context={"request": request}).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def review_slaughterhouse_record(request, pk):
    """Review facility totals or farmer-linked slaughter through separate official states."""
    require_action(request.user, "slaughter_records", "review")
    # Lock by primary key before checking eligibility. Joining selected_animals
    # here duplicates a batch report once per animal and breaks get().
    record = get_object_or_404(SlaughterRecord.objects.select_for_update(), pk=pk)
    production_output = getattr(record, "production_output", None)
    is_farmer_report = production_output is not None and production_output.status == "RECORDED"
    is_facility_total = (
        record.livestock_id is None and record.batch_id is None and production_output is None
        and not record.selected_animals.exists()
    )
    if not (is_farmer_report or is_facility_total):
        from django.http import Http404
        raise Http404
    target = request.data.get("status", "")
    remarks = str(request.data.get("remarks", ""))
    validate_review_transition(domain="slaughter_records", role=role_name(request.user), current=record.status, target=target, remarks=remarks)
    if is_farmer_report and record.status == SlaughterRecord.StatusType.SUBJECT_TO_REVISION and target == SlaughterRecord.StatusType.APPROVED:
        raise serializers.ValidationError({"status": "The farmer must correct the returned slaughter report before approval."})
    record.status = target
    record.reviewed_by = request.user
    record.reviewed_at = timezone.now()

    # Preserve any condemnation metadata when updating review remarks
    match = re.search(r"<!--CONDEMNATION:.*?-->", record.review_remarks or "")
    condemnation_tag = match.group(0) if match else ""
    final_remarks = f"{remarks} {condemnation_tag}".strip()
    record.review_remarks = final_remarks
    record.save(update_fields=["status", "reviewed_by", "reviewed_at", "review_remarks"])
    if is_farmer_report:
        if target == SlaughterRecord.StatusType.APPROVED:
            from .services.slaughter import reconcile_approved_slaughter
            reconcile_approved_slaughter(record)
        from users.models import Notification
        from users.notification_views import create_notification
        create_notification(
            user=record.created_by,
            notification_type=Notification.NotificationType.PRODUCTION,
            priority=Notification.Priority.MEDIUM,
            title="Official slaughter report approved" if target == SlaughterRecord.StatusType.APPROVED else "Slaughter report returned for correction",
            message=("The official slaughter report was approved and the selected livestock inventory was updated."
                     if target == SlaughterRecord.StatusType.APPROVED else f"Correct your linked meat-yield entry and resubmit the slaughter report. {remarks}"),
            link="/production-dashboard",
        )
    return Response(SlaughterRecordInputSerializer(record, context={"request": request}).data)

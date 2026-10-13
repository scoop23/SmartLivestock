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
from smartlivestock.workflows import require_action, role_name, validate_review_transition
from .models import SlaughterRecord


class SlaughterRecordInputSerializer(serializers.ModelSerializer):
    """Validate only aggregate fields supported by the current slaughter model."""

    livestock_type_name = serializers.CharField(source="livestock_type.name", read_only=True)
    created_by_name = serializers.SerializerMethodField()
    can_edit = serializers.SerializerMethodField()

    class Meta:
        model = SlaughterRecord
        fields = (
            "id", "livestock_type", "livestock_type_name", "quantity", "carcass_weight",
            "record_date", "barangay", "status", "review_remarks", "created_by_name",
            "created_at", "can_edit",
        )
        read_only_fields = ("id", "status", "review_remarks", "created_by_name", "created_at", "can_edit")

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

    def get_can_edit(self, obj):
        user = self.context["request"].user
        return role_name(user) == "SLAUGHTERHOUSESTAFF" and obj.created_by_id == user.id and obj.status in {
            SlaughterRecord.StatusType.PENDING,
            SlaughterRecord.StatusType.SUBJECT_TO_REVISION,
        }


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
    records = _aggregate_slaughter_records()
    if role_name(user) == "SLAUGHTERHOUSESTAFF":
        # With no facility field in this schema, staff can see municipal approved
        # totals plus their own submissions; another operator's pending records
        # remain private until MAO makes them official.
        records = records.filter(status=SlaughterRecord.StatusType.APPROVED) | records.filter(created_by=user)
    else:
        require_action(user, "slaughter_records", "read_all")
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
    """MAO/Admin approve or return facility totals without touching animal inventory."""
    require_action(request.user, "slaughter_records", "review")
    record = get_object_or_404(
        _visible_slaughter_records(request.user).select_for_update(),
        pk=pk,
    )
    target = request.data.get("status", "")
    remarks = str(request.data.get("remarks", ""))
    validate_review_transition(domain="slaughter_records", role=role_name(request.user), current=record.status, target=target, remarks=remarks)
    record.status = target
    record.reviewed_by = request.user
    record.reviewed_at = timezone.now()
    record.review_remarks = remarks
    record.save(update_fields=["status", "reviewed_by", "reviewed_at", "review_remarks"])
    return Response(SlaughterRecordInputSerializer(record, context={"request": request}).data)

"""Append-only farmer observations and authorized disease-case resolutions."""
from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from smartlivestock.workflows import require_action, role_name, scope_reviewer_queryset
from users.models import Notification
from users.notification_views import create_notification, health_notification_recipients
from .models import DiseaseCase, DiseaseCaseFollowUp


class FollowUpInputSerializer(serializers.Serializer):
    event_type = serializers.ChoiceField(choices=DiseaseCaseFollowUp.EventType.choices)
    observed_on = serializers.DateField()
    notes = serializers.CharField(max_length=2000, allow_blank=False, trim_whitespace=True)

    def validate_observed_on(self, value):
        case = self.context["case"]
        earliest = case.record_date or timezone.localtime(case.created_at).date()
        if value < earliest or value > timezone.localdate():
            raise serializers.ValidationError("Choose a date from the report date through today.")
        return value


class FollowUpSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()
    created_by_role = serializers.CharField(source="created_by.role.role_name", read_only=True)

    class Meta:
        model = DiseaseCaseFollowUp
        fields = ("id", "event_type", "observed_on", "notes", "created_at",
                  "created_by_name", "created_by_role")

    def get_created_by_name(self, event):
        return event.created_by.get_full_name().strip() or event.created_by.username


def _case_payload(case, user):
    available = case.status == DiseaseCase.DiseaseStatus.APPROVED and case.clinical_status not in {
        DiseaseCase.ClinicalStatus.RECOVERED, DiseaseCase.ClinicalStatus.CLOSED,
    }
    return {
        "case_id": case.pk,
        "report_status": case.status,
        "report_date": case.record_date,
        "clinical_status": case.clinical_status,
        "can_submit_update": available and role_name(user) == "FARMER",
        "can_resolve": available and role_name(user) in {"CBAT", "MAO", "ADMIN"},
        "events": FollowUpSerializer(case.follow_ups.select_related("created_by__role"), many=True).data,
    }


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def disease_case_follow_ups(request, pk):
    role = role_name(request.user)
    cases = DiseaseCase.objects.select_related("livestock__farmer", "batch__farmer", "created_by")
    if role == "FARMER":
        cases = cases.filter(Q(livestock__farmer__user=request.user) | Q(batch__farmer__user=request.user))
    else:
        require_action(request.user, "disease", "read_all")
        cases = scope_reviewer_queryset(cases, request.user)
    if request.method == "POST":
        cases = cases.select_for_update(of=("self",))
    case = get_object_or_404(cases, pk=pk)
    if request.method == "GET":
        return Response(_case_payload(case, request.user))

    serializer = FollowUpInputSerializer(data=request.data, context={"case": case})
    serializer.is_valid(raise_exception=True)
    event_type = serializer.validated_data["event_type"]
    farmer_update = event_type == DiseaseCaseFollowUp.EventType.FARMER_UPDATE
    if farmer_update and role != "FARMER":
        raise PermissionDenied("Only the Farmer can submit a farmer observation.")
    if not farmer_update and role not in {"CBAT", "MAO", "ADMIN"}:
        raise PermissionDenied("Only scoped field reviewers or MAO/Admin can record official resolution.")
    if case.status != DiseaseCase.DiseaseStatus.APPROVED:
        return Response({"detail": "Follow-up and resolution are available after MAO approval."}, status=409)
    if case.clinical_status in {DiseaseCase.ClinicalStatus.RECOVERED, DiseaseCase.ClinicalStatus.CLOSED}:
        return Response({"detail": "This case already has an official resolution. Submit a new report for a new concern."}, status=409)

    # A farmer observation never changes official resolution or review approval.
    event = DiseaseCaseFollowUp.objects.create(case=case, created_by=request.user, **serializer.validated_data)
    if not farmer_update:
        case.clinical_status = event_type
        case.save(update_fields=["clinical_status"])

    farmer = (case.livestock or case.batch).farmer
    recipients = {person.pk: person for person in health_notification_recipients(farmer)}
    if not farmer_update:
        recipients[case.created_by_id] = case.created_by
    for person in recipients.values():
        if person.pk == request.user.pk:
            continue
        recipient_role = role_name(person)
        link = (
            f"/report-observation?reportId=DIS-{case.pk}" if recipient_role == "FARMER"
            else f"/sibat-alerts?recordType=DISEASE&recordId={case.pk}" if recipient_role in {"SIBAT", "CBAT"}
            else f"/data-validation?domain=incidents&recordType=DISEASE&recordId={case.pk}"
        )
        create_notification(
            person, notification_type=Notification.NotificationType.DISEASE,
            title=f"Disease report DIS-{case.pk}: {event.get_event_type_display()}",
            message="A follow-up observation is ready for review." if farmer_update else "An authorized officer recorded an official case resolution. Open the report for the date and remarks.",
            link=link, related_entity_type="disease_case", related_entity_id=case.pk,
        )
    return Response(_case_payload(case, request.user), status=201)

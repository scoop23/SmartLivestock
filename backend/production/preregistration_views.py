"""Advance paperwork only; arrival does not replace livestock inspection."""
from io import BytesIO
from xml.sax.saxutils import escape

from django.db import transaction
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import AnimalDisposition
from .serializer import AnimalDispositionSerializer
from smartlivestock.workflows import role_name
from users.models import Notification
from users.notification_views import create_notification, notify_role


def scoped(request):
    qs = AnimalDisposition.objects.select_related("livestock__farmer__user", "sale_transfer__reviewed_by")
    role = role_name(request.user)
    if role == "FARMER":
        return qs.filter(livestock__farmer__user=request.user)
    if role in {"AUCTION", "MAO", "ADMIN"}:
        return qs.filter(intent="FOR_SALE")
    raise PermissionDenied("You cannot access auction preregistrations.")


@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def preregistration_detail(request, pk):
    record = get_object_or_404(scoped(request).select_for_update(of=("self",)), pk=pk, intent="FOR_SALE")
    if request.method == "GET":
        return Response(AnimalDispositionSerializer(record, context={"request": request}).data)
    role = role_name(request.user)
    old = record.registration_status
    notes = str(request.data.get("review_notes", "")).strip()
    if role == "FARMER":
        if old != "NEEDS_CORRECTION":
            raise ValidationError("Only returned preregistrations can be corrected.")
        # The animal and declaration type stay fixed during corrections.
        if "livestock" in request.data and str(request.data["livestock"]) != str(record.livestock_id):
            raise ValidationError("The preregistered animal cannot be changed.")
        corrections = {key: request.data[key] for key in ("target_date", "target_destination", "notes", "original_certificate_number", "supporting_document") if key in request.data}
        if corrections.get("target_date") == "":
            corrections["target_date"] = None
        serializer = AnimalDispositionSerializer(record, data=corrections, partial=True, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        target = "SUBMITTED"
    elif role == "AUCTION":
        target = request.data.get("registration_status")
        allowed = {"SUBMITTED": {"READY", "NEEDS_CORRECTION"}, "READY": {"ARRIVED", "NEEDS_CORRECTION"}, "ARRIVED": {"CHECKED"}}
        if target not in allowed.get(old, set()):
            raise ValidationError("This preregistration has changed or this action is not available.")
        if target == "NEEDS_CORRECTION" and not notes:
            raise ValidationError({"review_notes": "Explain what the farmer needs to correct."})
        if target == "CHECKED" and not notes:
            raise ValidationError({"review_notes": "Record the inspection reference and physical checks completed."})
        if target in {"READY", "ARRIVED", "CHECKED"}:
            animal = record.livestock
            if animal.status != "APPROVED" or animal.operational_status != "ACTIVE":
                raise ValidationError("The animal must still be approved and active.")
        record.review_notes = notes
    else:
        raise PermissionDenied("Only auction staff can review preregistrations.")
    record.registration_status = target
    record.workflow_history = [*(record.workflow_history or []), {"from": old, "to": target, "by": request.user.get_full_name() or request.user.username, "at": timezone.now().isoformat(), "notes": notes}]
    record.save(update_fields=["registration_status", "review_notes", "workflow_history"])
    if role == "AUCTION":
        create_notification(user=record.livestock.farmer.user, notification_type=Notification.NotificationType.GENERAL,
            title=f"AP-{record.pk:06d}: {record.get_registration_status_display()}", message=notes or record.get_registration_status_display(), link="/production-dashboard/Cattle?activity=sales&mode=history&eligibleSpecies=Cattle")
    else:
        notify_role(role_name="AUCTION", notification_type=Notification.NotificationType.GENERAL, title="Preregistration resubmitted", message=f"AP-{record.pk:06d} has been corrected.", link="/auction-preregistrations")
    return Response(AnimalDispositionSerializer(record, context={"request": request}).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def preregistration_document(request, pk):
    record = get_object_or_404(scoped(request), pk=pk)
    if not record.supporting_document:
        raise ValidationError("No document was attached.")
    return FileResponse(record.supporting_document.open("rb"), as_attachment=True)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def preregistration_certificate(request, pk):
    record = get_object_or_404(scoped(request), pk=pk)
    sale = record.sale_transfer
    if not sale or sale.status != "APPROVED":
        raise ValidationError("The approved transfer record is not available yet.")
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
    buffer = BytesIO()
    styles = getSampleStyleSheet()
    story = [Paragraph("SmartLivestock — Approved Ownership Transfer", styles["Title"]), Spacer(1, 18)]
    fields = [("Preregistration", f"AP-{record.pk:06d}"), ("Certificate number", sale.transfer_certificate_number), ("Animal", record.livestock.tag_number), ("Seller", record.livestock.farmer.user.get_full_name()), ("Buyer", sale.new_owner.user.get_full_name() if sale.new_owner_id else sale.external_owner_name), ("Transfer date", sale.transfer_date), ("Approved by", sale.reviewed_by.get_full_name() if sale.reviewed_by else "Not recorded"), ("Approved at", sale.reviewed_at)]
    for label, value in fields:
        story.append(Paragraph(f"<b>{label}:</b> {escape(str(value or 'Not recorded'))}", styles["BodyText"]))
        story.append(Spacer(1, 10))
    story.append(Paragraph("Electronic copy of the approved system record. Refer to the issued original certificate for signatures and seals.", styles["BodyText"]))
    SimpleDocTemplate(buffer).build(story)
    buffer.seek(0)
    return FileResponse(buffer, as_attachment=True, filename=f"AP-{record.pk:06d}-approved-transfer.pdf")

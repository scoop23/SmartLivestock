from django.db import IntegrityError, transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from livestock.models import LivestockInventory, LivestockOwnershipTransfer
from livestock.serializer import LivestockOwnershipTransferSerializer
from smartlivestock.workflows import require_action, role_name, scope_reviewer_queryset, validate_review_transition
from users.models import Notification
from users.notification_views import create_notification, notify_role, notify_review_revision


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def ownership_transfer_list_create(request):
    """Farmers submit certificate-backed requests; reviewers see only their jurisdiction."""
    if request.method == "POST":
        require_action(request.user, "ownership_transfers", "create")
        serializer = LivestockOwnershipTransferSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        farmer = request.user.farmer_profile
        try:
            transfer = serializer.save(previous_owner=farmer, created_by=request.user)
        except IntegrityError as exc:
            raise ValidationError({"detail": "This animal already has a pending transfer or the certificate number is already recorded."}) from exc
        notify_role(
            role_name="SIBAT", barangay_id=farmer.barangay_id,
            notification_type=Notification.NotificationType.SIBAT,
            title="Ownership Transfer Awaiting Verification",
            message=f"Transfer certificate {transfer.transfer_certificate_number} is ready for review.",
            link="/sibat/ownership-transfers",
        )
        return Response(LivestockOwnershipTransferSerializer(transfer).data, status=status.HTTP_201_CREATED)

    user = request.user
    if role_name(user) == "FARMER":
        farmer = getattr(user, "farmer_profile", None)
        records = LivestockOwnershipTransfer.objects.none() if farmer is None else LivestockOwnershipTransfer.objects.filter(
            Q(previous_owner=farmer) | Q(new_owner=farmer)
        )
    else:
        require_action(user, "ownership_transfers", "read_all")
        records = scope_reviewer_queryset(LivestockOwnershipTransfer.objects.all(), user)
    records = records.select_related(
        "livestock__livestock_type", "previous_owner__user", "new_owner__user", "reviewed_by"
    )
    return Response(LivestockOwnershipTransferSerializer(records, many=True).data)


@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def ownership_transfer_detail(request, pk):
    user = request.user
    qs = LivestockOwnershipTransfer.objects.select_for_update().select_related(
        "livestock__livestock_type", "previous_owner__user", "new_owner__user"
    )
    if role_name(user) == "FARMER":
        farmer = getattr(user, "farmer_profile", None)
        qs = qs.filter(Q(previous_owner=farmer) | Q(new_owner=farmer)) if farmer else qs.none()
    else:
        require_action(user, "ownership_transfers", "read_all")
        qs = scope_reviewer_queryset(qs, user)
    transfer = get_object_or_404(qs, pk=pk)
    if request.method == "GET":
        return Response(LivestockOwnershipTransferSerializer(transfer).data)
    if role_name(user) != "FARMER" or transfer.created_by_id != user.pk or transfer.status != LivestockOwnershipTransfer.Status.SUBJECT_TO_REVISION:
        return Response({"detail": "Only the submitting farmer can correct a returned transfer request."}, status=status.HTTP_403_FORBIDDEN)
    serializer = LivestockOwnershipTransferSerializer(transfer, data=request.data, partial=True, context={"request": request})
    serializer.is_valid(raise_exception=True)
    try:
        # Use a savepoint so a duplicate certificate can be reported as validation
        # feedback without leaving the outer detail transaction unusable.
        with transaction.atomic():
            transfer = serializer.save(status=LivestockOwnershipTransfer.Status.PENDING, reviewed_by=None, reviewed_at=None, review_remarks="")
    except IntegrityError as exc:
        raise ValidationError({"detail": "This transfer certificate number is already recorded."}) from exc
    notify_role(role_name="SIBAT", barangay_id=transfer.previous_owner.barangay_id,
        notification_type=Notification.NotificationType.SIBAT, title="Ownership Transfer Resubmitted",
        message=f"Transfer certificate {transfer.transfer_certificate_number} was corrected and resubmitted.",
        link="/sibat/ownership-transfers")
    return Response(LivestockOwnershipTransferSerializer(transfer).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def review_ownership_transfer(request, pk):
    transfer = get_object_or_404(
        scope_reviewer_queryset(LivestockOwnershipTransfer.objects.select_for_update().select_related(
            "livestock", "previous_owner__user", "new_owner__user"
        ), request.user), pk=pk,
    )
    target = request.data.get("status")
    remarks = request.data.get("remarks", "")
    reviewer_role = require_action(request.user, "ownership_transfers", "review")
    validate_review_transition(domain="ownership_transfers", role=reviewer_role,
        current=transfer.status, target=target, remarks=remarks)
    if target == LivestockOwnershipTransfer.Status.APPROVED:
        animal = LivestockInventory.objects.select_for_update().get(pk=transfer.livestock_id)
        if animal.farmer_id != transfer.previous_owner_id:
            raise ValidationError({"livestock": "The recorded previous owner no longer owns this animal."})
        # Keep checking eligibility at approval in case ownership or animal state changed after submission.
        if (animal.entry_type != LivestockInventory.EntryType.INDIVIDUAL or animal.quantity != 1
                or animal.status != LivestockInventory.StatusType.APPROVED
                or animal.operational_status != LivestockInventory.OperationalStatus.ACTIVE):
            raise ValidationError({"livestock": "The animal is no longer eligible for an ownership transfer."})
        if transfer.owner_type == LivestockOwnershipTransfer.OwnerType.REGISTERED_FARMER:
            if transfer.new_owner is None or transfer.new_owner.user.role.role_name != "FARMER" or transfer.new_owner.user.account_status != "APPROVED":
                raise ValidationError({"new_owner": "The selected owner is no longer an approved Farmer account."})
            # Reassign the same canonical animal; detach the seller's herd because its farmer is unchanged.
            animal.farmer = transfer.new_owner
            animal.batch = None
            animal.save(update_fields=["farmer", "batch"])
        else:
            # External buyers have no platform Farmer row: retain the canonical animal as SOLD history.
            if transfer.new_owner_id is not None or not transfer.external_owner_name or not transfer.external_owner_address:
                raise ValidationError({"new_owner": "External buyer details are incomplete or conflict with a Farmer account."})
            animal.operational_status = LivestockInventory.OperationalStatus.SOLD
            animal.operational_status_changed_at = timezone.now()
            animal.batch = None
            animal.save(update_fields=["operational_status", "operational_status_changed_at", "batch"])

    transfer.status = target
    transfer.reviewed_by = request.user
    transfer.reviewed_at = timezone.now()
    transfer.review_remarks = remarks
    transfer.save(update_fields=["status", "reviewed_by", "reviewed_at", "review_remarks"])

    if target == LivestockOwnershipTransfer.Status.VERIFIED:
        notify_role(role_name="MAO", notification_type=Notification.NotificationType.GENERAL,
            title="Ownership Transfer Awaiting MAO Approval",
            message=f"Transfer certificate {transfer.transfer_certificate_number} was verified by SIBAT.",
            link="/ownership-transfers")
    elif target == LivestockOwnershipTransfer.Status.SUBJECT_TO_REVISION:
        notify_review_revision(transfer.previous_owner, request.user,
            title=f"Revision required: transfer {transfer.transfer_certificate_number}",
            message=remarks, link=f"/livestock-inventory/{transfer.livestock_id}")
    elif target == LivestockOwnershipTransfer.Status.APPROVED:
        # Former ownership remains in the transfer record; current inventory uses animal.farmer.
        notified_farmers = [transfer.previous_owner]
        if transfer.new_owner_id:
            notified_farmers.append(transfer.new_owner)
        for farmer in notified_farmers:
            create_notification(user=farmer.user, notification_type=Notification.NotificationType.GENERAL,
                title="Livestock Ownership Transfer Approved",
                message=f"Ownership transfer for {transfer.livestock.tag_number or 'livestock'} was approved.",
                link=f"/livestock-inventory/{transfer.livestock_id}")

    return Response(LivestockOwnershipTransferSerializer(transfer).data)

from django.db import IntegrityError, transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from livestock.models import Farmer, LivestockInventory, LivestockOwnershipTransfer
from livestock.serializer import LivestockOwnershipTransferSerializer
from smartlivestock.workflows import require_action, role_name, scope_reviewer_queryset, validate_review_transition
from users.models import Notification, User
from users.notification_views import create_notification, notify_role, notify_review_revision


def _auction_farmer_queryset():
    return Farmer.objects.select_related("user", "barangay").filter(
        user__account_status=User.AccountStatus.APPROVED,
        user__role__role_name="FARMER",
    )


def _farmer_lookup_data(farmer):
    return {
        "id": farmer.pk,
        "name": farmer.user.get_full_name().strip() or farmer.user.username,
        "username": farmer.user.username,
        "email": farmer.user.email,
        "rsbsa_number": farmer.rsbsa_number,
        "address": farmer.address,
        "barangay": farmer.barangay.barangay_name,
    }


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def ownership_transfer_farmer_list(request):
    """Auction staff can find approved Farmers by profile ID, name, username, email, or RSBSA number."""
    if role_name(request.user) != "AUCTION":
        return Response({"detail": "Only Auction staff can look up transfer sellers."}, status=status.HTTP_403_FORBIDDEN)
    search = request.query_params.get("search", "").strip()
    if len(search) < 2 and not search.isdigit():
        return Response([])
    filters = (
        Q(user__first_name__icontains=search)
        | Q(user__last_name__icontains=search)
        | Q(user__username__icontains=search)
        | Q(user__email__icontains=search)
        | Q(rsbsa_number__icontains=search)
    )
    if search.isdigit():
        filters |= Q(pk=int(search))
    farmers = _auction_farmer_queryset().filter(filters).order_by("user__last_name", "user__first_name")[:20]
    return Response([_farmer_lookup_data(farmer) for farmer in farmers])


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def ownership_transfer_farmer_detail(request, farmer_id):
    """Resolve a scanned SL-FARMER profile QR to an approved Farmer account."""
    if role_name(request.user) != "AUCTION":
        return Response({"detail": "Only Auction staff can look up transfer sellers."}, status=status.HTTP_403_FORBIDDEN)
    farmer = _auction_farmer_queryset().filter(pk=farmer_id).first()
    if farmer is None:
        return Response({"detail": "No approved Farmer profile matches this QR code."}, status=status.HTTP_404_NOT_FOUND)
    return Response(_farmer_lookup_data(farmer))


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def ownership_transfer_farmer_livestock(request, farmer_id):
    """Return only that approved Farmer's eligible individual animals for sale selection."""
    if role_name(request.user) != "AUCTION":
        return Response({"detail": "Only Auction staff can view seller livestock for transfer."}, status=status.HTTP_403_FORBIDDEN)
    farmer = _auction_farmer_queryset().filter(pk=farmer_id).first()
    if farmer is None:
        return Response({"detail": "No approved Farmer profile matches this ID."}, status=status.HTTP_404_NOT_FOUND)
    animals = LivestockInventory.objects.filter(
        farmer=farmer,
        entry_type=LivestockInventory.EntryType.INDIVIDUAL,
        quantity=1,
        status=LivestockInventory.StatusType.APPROVED,
        operational_status=LivestockInventory.OperationalStatus.ACTIVE,
    ).exclude(
        ownership_transfers__status__in=[
            LivestockOwnershipTransfer.Status.PENDING,
            LivestockOwnershipTransfer.Status.VERIFIED,
        ]
    ).select_related("livestock_type").order_by("livestock_type__name", "tag_number", "pk")
    return Response([{
        "id": animal.pk,
        "tag_number": animal.tag_number,
        "livestock_type_name": animal.livestock_type.name,
        "sex": animal.sex,
        "breed": animal.breed,
        "ownership_certificate_number": animal.ownership_certificate_number,
    } for animal in animals])


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def ownership_transfer_list_create(request):
    """Auction staff encode certificates; farmers and reviewers read their own or scoped history."""
    if request.method == "POST":
        actor_role = require_action(request.user, "ownership_transfers", "create")
        livestock_ids = request.data.get("livestock_ids")
        if livestock_ids is not None:
            if actor_role != "AUCTION":
                raise ValidationError({"detail": "Only Auction staff can record multi-animal transfer certificates."})
            if not isinstance(livestock_ids, list) or not livestock_ids:
                raise ValidationError({"livestock_ids": "Add at least one animal to this certificate."})
            if len(livestock_ids) != len(set(map(str, livestock_ids))):
                raise ValidationError({"livestock_ids": "An animal can only appear once on a certificate submission."})

            shared_fields = {
                key: value for key, value in request.data.items()
                if key not in {"livestock_ids", "original_certificate_numbers"}
            }
            original_certificates = request.data.get("original_certificate_numbers", {})
            prepared = []
            # Validate every animal before saving any rows, so one invalid seller cannot leave a partial certificate.
            with transaction.atomic():
                for livestock_id in livestock_ids:
                    animal_data = {**shared_fields, "livestock": livestock_id}
                    if isinstance(original_certificates, dict):
                        animal_data["original_certificate_number"] = original_certificates.get(str(livestock_id), "")
                    serializer = LivestockOwnershipTransferSerializer(data=animal_data, context={"request": request})
                    serializer.is_valid(raise_exception=True)
                    prepared.append(serializer)

                seller_ids = {serializer.validated_data["livestock"].farmer_id for serializer in prepared}
                if len(seller_ids) != 1:
                    raise ValidationError({"livestock_ids": "A transfer certificate can include animals from only one registered seller."})

                transfers = [
                    serializer.save(
                        previous_owner=serializer.validated_data["livestock"].farmer,
                        created_by=request.user,
                    )
                    for serializer in prepared
                ]
                for transfer in transfers:
                    notify_role(
                        role_name="MAO",
                        notification_type=Notification.NotificationType.GENERAL,
                        title="Ownership Transfer Awaiting Review",
                        message=f"Transfer certificate {transfer.transfer_certificate_number} includes {transfer.livestock.tag_number or 'a livestock animal'} and is ready for MAO review.",
                        link=f"/ownership-transfers?transferId={transfer.pk}",
                        related_entity_type="ownership_transfer",
                        related_entity_id=transfer.pk,
                    )
            return Response(LivestockOwnershipTransferSerializer(transfers, many=True).data, status=status.HTTP_201_CREATED)

        serializer = LivestockOwnershipTransferSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        # Auction is the recorder, not a party to the sale: the selected animal identifies its seller.
        farmer = serializer.validated_data["livestock"].farmer if actor_role == "AUCTION" else request.user.farmer_profile
        try:
            transfer = serializer.save(previous_owner=farmer, created_by=request.user)
        except IntegrityError as exc:
            raise ValidationError({"detail": "This animal already has a pending transfer."}) from exc
        notify_role(
            role_name="MAO",
            notification_type=Notification.NotificationType.GENERAL,
            title="Ownership Transfer Awaiting Review",
            message=f"Transfer certificate {transfer.transfer_certificate_number} is ready for MAO review.",
            link=f"/ownership-transfers?transferId={transfer.pk}",
            related_entity_type="ownership_transfer",
            related_entity_id=transfer.pk,
        )
        return Response(LivestockOwnershipTransferSerializer(transfer).data, status=status.HTTP_201_CREATED)

    user = request.user
    if role_name(user) == "FARMER":
        farmer = getattr(user, "farmer_profile", None)
        records = LivestockOwnershipTransfer.objects.none() if farmer is None else LivestockOwnershipTransfer.objects.filter(
            Q(previous_owner=farmer) | Q(new_owner=farmer)
        )
    elif role_name(user) == "AUCTION":
        require_action(user, "ownership_transfers", "read_own")
        records = LivestockOwnershipTransfer.objects.filter(created_by=user)
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
    elif role_name(user) == "AUCTION":
        require_action(user, "ownership_transfers", "read_own")
        qs = qs.filter(created_by=user)
    else:
        require_action(user, "ownership_transfers", "read_all")
        qs = scope_reviewer_queryset(qs, user)
    transfer = get_object_or_404(qs, pk=pk)
    if request.method == "GET":
        return Response(LivestockOwnershipTransferSerializer(transfer).data)
    if role_name(user) not in {"FARMER", "AUCTION"} or transfer.created_by_id != user.pk or transfer.status != LivestockOwnershipTransfer.Status.SUBJECT_TO_REVISION:
        return Response({"detail": "Only the submitting Farmer or Auction Officer can correct a returned transfer request."}, status=status.HTTP_403_FORBIDDEN)
    serializer = LivestockOwnershipTransferSerializer(transfer, data=request.data, partial=True, context={"request": request})
    serializer.is_valid(raise_exception=True)
    try:
        # Use a savepoint so a duplicate certificate can be reported as validation
        # feedback without leaving the outer detail transaction unusable.
        with transaction.atomic():
            transfer = serializer.save(status=LivestockOwnershipTransfer.Status.PENDING, reviewed_by=None, reviewed_at=None, review_remarks="")
    except IntegrityError as exc:
        raise ValidationError({"detail": "This animal already has a pending transfer."}) from exc
    notify_role(role_name="MAO", notification_type=Notification.NotificationType.GENERAL, title="Ownership Transfer Resubmitted",
        message=f"Transfer certificate {transfer.transfer_certificate_number} was corrected and resubmitted.",
        link=f"/ownership-transfers?transferId={transfer.pk}",
        related_entity_type="ownership_transfer", related_entity_id=transfer.pk)
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
        elif transfer.new_owner_id is not None or not transfer.external_owner_name or not transfer.external_owner_address:
            raise ValidationError({"new_owner": "External buyer details are incomplete or conflict with a Farmer account."})

        # Keep this certificate's animal row in the seller's inventory history as SOLD.
        # A registered buyer records their acquired animal as a new inventory submission.
        animal.operational_status = LivestockInventory.OperationalStatus.SOLD
        animal.operational_status_changed_at = timezone.now()
        animal.batch = None
        animal.save(update_fields=["operational_status", "operational_status_changed_at", "batch"])

    transfer.status = target
    transfer.reviewed_by = request.user
    transfer.reviewed_at = timezone.now()
    transfer.review_remarks = remarks
    transfer.save(update_fields=["status", "reviewed_by", "reviewed_at", "review_remarks"])

    if target == LivestockOwnershipTransfer.Status.SUBJECT_TO_REVISION:
        if role_name(transfer.created_by) == "AUCTION":
            create_notification(user=transfer.created_by, notification_type=Notification.NotificationType.GENERAL,
                title=f"Revision required: transfer {transfer.transfer_certificate_number}",
                message=remarks, link="/auction-ownership-transfers",
                related_entity_type="ownership_transfer", related_entity_id=transfer.pk)
        else:
            notify_review_revision(transfer.previous_owner, request.user,
                title=f"Revision required: transfer {transfer.transfer_certificate_number}",
                message=remarks, link=f"/sibat/ownership-transfers?transferId={transfer.pk}")
    elif target == LivestockOwnershipTransfer.Status.APPROVED:
        # The seller's historical animal row remains linked to them; the transfer event names the buyer.
        buyer_name = (
            transfer.new_owner.user.get_full_name().strip() or transfer.new_owner.user.username
            if transfer.new_owner_id else transfer.external_owner_name
        )
        notified_farmers = [transfer.previous_owner]
        if transfer.new_owner_id:
            notified_farmers.append(transfer.new_owner)
        for farmer in notified_farmers:
            is_buyer = farmer.pk == transfer.new_owner_id
            create_notification(user=farmer.user, notification_type=Notification.NotificationType.GENERAL,
                title="Livestock Ownership Transfer Approved",
                message=(
                    f"You are recorded as the new owner of {transfer.livestock.tag_number or 'livestock'}. Register it in your inventory to track it in SmartLivestock."
                    if is_buyer else
                    f"Ownership transfer for {transfer.livestock.tag_number or 'livestock'} was approved and marked SOLD in your inventory history. Buyer: {buyer_name}."
                ),
                link="/livestock-inventory" if is_buyer else f"/livestock-inventory/{transfer.livestock_id}")

    return Response(LivestockOwnershipTransferSerializer(transfer).data)

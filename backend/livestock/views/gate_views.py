from django.db import IntegrityError, transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from livestock.models import Farmer, LivestockGateVerification, LivestockInventory, LivestockType
from smartlivestock.workflows import AUCTION, role_name
from users.models import User
from users.models import Notification
from users.notification_views import notify_role


class GateRegistrationSerializer(serializers.Serializer):
    farmer = serializers.PrimaryKeyRelatedField(queryset=Farmer.objects.all())
    livestock_type = serializers.PrimaryKeyRelatedField(queryset=LivestockType.objects.all())
    tag_number = serializers.CharField(max_length=50, required=False, allow_blank=True)
    breed = serializers.CharField(max_length=50, required=False, allow_blank=True)
    sex = serializers.ChoiceField(choices=[("MALE", "Male"), ("FEMALE", "Female"), ("UNKNOWN", "Unknown")])
    ownership_certificate_number = serializers.CharField(max_length=100)

    def validate_farmer(self, farmer):
        if farmer.user.role.role_name != "FARMER" or farmer.user.account_status != User.AccountStatus.APPROVED:
            raise serializers.ValidationError("Choose an approved Farmer account.")
        return farmer

    def validate_ownership_certificate_number(self, value):
        number = value.strip()
        if not number:
            raise serializers.ValidationError("Enter the number printed on the paper ownership certificate.")
        if LivestockInventory.objects.filter(ownership_certificate_number__iexact=number).exists():
            raise serializers.ValidationError("This ownership certificate number is already registered.")
        return number

    def create(self, validated_data):
        request = self.context["request"]
        now = timezone.now()
        return LivestockInventory.objects.create(
            **validated_data,
            entry_type=LivestockInventory.EntryType.INDIVIDUAL,
            quantity=1,
            status=LivestockInventory.StatusType.APPROVED,
            operational_status=LivestockInventory.OperationalStatus.ACTIVE,
            created_by=request.user,
            ownership_certificate_recorded_by=request.user,
            ownership_certificate_recorded_at=now,
        )


class GateVerificationRequestSerializer(serializers.Serializer):
    livestock = serializers.IntegerField(min_value=1)
    gate_session_id = serializers.UUIDField()
    certificate_number_checked = serializers.CharField(required=False, allow_blank=True, max_length=100)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def gate_registration_list_create(request):
    """Find registered Farmer owners or record cattle certified at the auction gate."""
    if role_name(request.user) != AUCTION:
        raise PermissionDenied("Only Auction Office staff can record gate cattle.")
    if request.method == "GET":
        search = request.query_params.get("search", "").strip()
        if len(search) < 2:
            return Response([])
        farmers = Farmer.objects.select_related("user", "barangay").filter(
            user__account_status=User.AccountStatus.APPROVED,
            user__role__role_name="FARMER",
        ).filter(
            Q(user__first_name__icontains=search)
            | Q(user__last_name__icontains=search)
            | Q(user__username__icontains=search)
            | Q(rsbsa_number__icontains=search)
        ).order_by("user__last_name", "user__first_name")[:20]
        return Response([{
            "id": farmer.id,
            "name": farmer.user.get_full_name().strip() or farmer.user.username,
            "username": farmer.user.username,
            "address": farmer.address,
            "barangay": farmer.barangay.barangay_name,
        } for farmer in farmers])

    # Older approved animal rows may predate certificate-number capture. Staff
    # can record the paper number against that same identity after inspecting it.
    existing_id = request.data.get("livestock")
    if existing_id:
        certificate_number = str(request.data.get("ownership_certificate_number", "")).strip()
        session_raw = request.data.get("gate_session_id")
        session_id = serializers.UUIDField().run_validation(session_raw) if session_raw else None
        if not certificate_number:
            raise serializers.ValidationError({"ownership_certificate_number": "Enter the paper certificate number."})
        if LivestockInventory.objects.filter(ownership_certificate_number__iexact=certificate_number).exclude(pk=existing_id).exists():
            raise serializers.ValidationError({"ownership_certificate_number": "This ownership certificate number is already registered."})
        certificate_was_added = False
        with transaction.atomic():
            animal = LivestockInventory.objects.select_for_update().filter(pk=existing_id).first()
            if not animal:
                return Response({"detail": "Livestock record not found."}, status=status.HTTP_404_NOT_FOUND)
            if (animal.status != LivestockInventory.StatusType.APPROVED
                    or animal.operational_status != LivestockInventory.OperationalStatus.ACTIVE
                    or animal.entry_type != LivestockInventory.EntryType.INDIVIDUAL or animal.quantity != 1):
                raise serializers.ValidationError({"livestock": "Only approved, active individual animals can be verified at the gate."})
            if animal.ownership_certificate_number and animal.ownership_certificate_number.casefold() != certificate_number.casefold():
                raise serializers.ValidationError({"ownership_certificate_number": "The paper number differs from the certificate already on file. Resolve the mismatch before counting this animal."})
            if not animal.ownership_certificate_number:
                animal.ownership_certificate_number = certificate_number
                animal.ownership_certificate_recorded_by = request.user
                animal.ownership_certificate_recorded_at = timezone.now()
                animal.save(update_fields=("ownership_certificate_number", "ownership_certificate_recorded_by", "ownership_certificate_recorded_at"))
                certificate_was_added = True
        if certificate_was_added:
            notify_role(
                role_name="MAO",
                notification_type=Notification.NotificationType.GENERAL,
                title="Gate ownership certificate recorded",
                message=f"Ownership certificate {animal.ownership_certificate_number} was recorded for livestock #{animal.pk}.",
                link="/livestock-inventory",
                related_entity_type="livestock_inventory",
                related_entity_id=animal.pk,
            )
        if session_id:
            LivestockGateVerification.objects.filter(
                livestock=animal, gate_session_id=session_id
            ).update(certificate_number_checked=certificate_number)
        return Response({"id": animal.pk, "ownership_certificate_number": animal.ownership_certificate_number})

    serializer = GateRegistrationSerializer(data=request.data, context={"request": request})
    serializer.is_valid(raise_exception=True)
    try:
        with transaction.atomic():
            livestock = serializer.save()
    except IntegrityError as exc:
        raise serializers.ValidationError({"ownership_certificate_number": "This certificate number has already been recorded."}) from exc
    notify_role(
        role_name="MAO",
        notification_type=Notification.NotificationType.GENERAL,
        title="Gate livestock certificate recorded",
        message=f"Ownership certificate {livestock.ownership_certificate_number} was recorded at the auction gate.",
        link="/livestock-inventory",
        related_entity_type="livestock_inventory",
        related_entity_id=livestock.pk,
    )
    return Response({
        "id": livestock.id,
        "tag_number": livestock.tag_number or str(livestock.id),
        "livestock_type": livestock.livestock_type.name,
        "farmer": livestock.farmer.user.get_full_name().strip() or livestock.farmer.user.username,
        "ownership_certificate_number": livestock.ownership_certificate_number,
        "status": livestock.status,
        "operational_status": livestock.operational_status,
    }, status=status.HTTP_201_CREATED)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def gate_verification_list_create(request):
    """Persist a distinct-animal gate count; repeated scans in one session are idempotent."""
    if role_name(request.user) != AUCTION:
        raise PermissionDenied("Only Auction Office staff can verify gate entries.")
    if request.method == "GET":
        session_id = serializers.UUIDField().run_validation(request.query_params.get("session"))
        records = LivestockGateVerification.objects.filter(gate_session_id=session_id).select_related(
            "livestock__farmer__user", "livestock__livestock_type"
        )
        return Response([{
            "id": row.livestock_id,
            "tag": row.livestock.tag_number or str(row.livestock_id),
            "species": row.livestock.livestock_type.name,
            "owner": row.livestock.farmer.user.get_full_name().strip() or row.livestock.farmer.user.username,
            "certificate": row.certificate_number_checked or "Not recorded",
        } for row in records])

    data = GateVerificationRequestSerializer(data=request.data)
    data.is_valid(raise_exception=True)
    with transaction.atomic():
        animal = LivestockInventory.objects.select_for_update().select_related("livestock_type", "farmer__user").filter(
            pk=data.validated_data["livestock"]
        ).first()
        if not animal:
            return Response({"detail": "Livestock record not found."}, status=status.HTTP_404_NOT_FOUND)
        if (animal.status != LivestockInventory.StatusType.APPROVED
                or animal.operational_status != LivestockInventory.OperationalStatus.ACTIVE
                or animal.entry_type != LivestockInventory.EntryType.INDIVIDUAL or animal.quantity != 1):
            raise serializers.ValidationError({"livestock": "Only approved, active individual animals can be counted at this gate."})
        checked_number = data.validated_data.get("certificate_number_checked", "").strip()
        if animal.ownership_certificate_number and checked_number and animal.ownership_certificate_number.casefold() != checked_number.casefold():
            raise serializers.ValidationError({"certificate_number_checked": "The paper certificate does not match the certificate number on file."})
        record, created = LivestockGateVerification.objects.get_or_create(
            livestock=animal,
            gate_session_id=data.validated_data["gate_session_id"],
            defaults={"certificate_number_checked": checked_number or animal.ownership_certificate_number, "verified_by": request.user},
        )
    return Response({
        "id": animal.pk,
        "tag": animal.tag_number or str(animal.pk),
        "species": animal.livestock_type.name,
        "owner": animal.farmer.user.get_full_name().strip() or animal.farmer.user.username,
        "certificate": record.certificate_number_checked or "Not recorded",
    }, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

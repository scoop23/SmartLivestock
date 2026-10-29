from livestock.list_queries import LivestockListPagination, filter_livestock_list, inventory_management_page
from smartlivestock.workflows import scope_reviewer_queryset
from django.shortcuts import get_object_or_404
from django.db import IntegrityError, transaction
from django.db.models import Count, Q
from datetime import timedelta
from django.utils import timezone
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from livestock.models import (
    Barangay,
    Farmer,
    LivestockBatch,
    LivestockHerdMembershipHistory,
    LivestockInventory,
    LivestockInventoryReviewHistory,
    LivestockType,
)
from livestock.serializer import (
    FarmerOptionsSerializer,
    LivestockInventorySerializer,
    LivestockPhotoUpdateSerializer,
    BarangaySerializer,
)
from users.models import Notification
from users.authentication import ApprovedJWTAuthentication
from users.notification_views import create_notification, notify_role, notify_review_revision
from smartlivestock.workflows import require_action, role_name, validate_review_transition


class OptionalApprovedJWTAuthentication(ApprovedJWTAuthentication):
    """Use valid approved-user identity for scoping, but allow this public list without it."""

    def authenticate(self, request):
        try:
            return super().authenticate(request)
        except AuthenticationFailed:
            return None



@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def inventory_list_create(request):
    """
    GET  /api/livestock/inventory/ -> List livestock inventory for logged-in farmer (or all for MAO/SIBAT/Admin)
    POST /api/livestock/inventory/ -> Register a new livestock inventory entry
    """
    user = request.user
    user_role = role_name(user)

    if request.method == "POST":
        require_action(user, "inventory", "create")
        with transaction.atomic():
            serializer = LivestockInventorySerializer(
                data=request.data,
                context={"request": request},
            )
            serializer.is_valid(raise_exception=True)
            inventory = serializer.save()
            farmer_name = user.get_full_name() or user.username
            animal_name = inventory.tag_number or inventory.breed or inventory.livestock_type.name #type: ignore
            notify_role(
                barangay_id=inventory.farmer.barangay_id,
                role_name="SIBAT",
                include_cbat=True,
                notification_type=Notification.NotificationType.SIBAT,
                priority=Notification.Priority.MEDIUM,
                title="New Livestock Entry Awaiting Verification",
                message=f"{farmer_name} registered {animal_name}. Review the entry and schedule field verification.",
                link=f"/sibat?tab=inventory&reviewType=INVENTORY&reviewId={inventory.pk}",
                related_entity_type="livestock_inventory",
                related_entity_id=inventory.id,
            )
            return Response(serializer.data, status=status.HTTP_201_CREATED)

    # GET: Enforce strict farmer data isolation
    if user_role == "FARMER":
        farmer_profile = getattr(user, "farmer_profile", None)
        if farmer_profile:
            # Current inventory follows the livestock's current farmer; historical ownership stays in transfer events.
            inventories = LivestockInventory.objects.filter(
                Q(farmer=farmer_profile)
            ).distinct()
        else:
            inventories = LivestockInventory.objects.none()
    else:
        require_action(user, "inventory", "read_all")
        inventories = scope_reviewer_queryset(LivestockInventory.objects.all(), request.user)

    requested_operational_status = request.query_params.get("operational_status")
    include_inactive = request.query_params.get("include_inactive", "").lower() == "true"
    if requested_operational_status:
        if requested_operational_status not in LivestockInventory.OperationalStatus.values:
            return Response(
                {
                    "error": (
                        f"Invalid operational_status. Valid choices are: "
                        f"{list(LivestockInventory.OperationalStatus.values)}"
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        inventories = inventories.filter(operational_status=requested_operational_status)
    elif not include_inactive:
        inventories = inventories.filter(
            operational_status=LivestockInventory.OperationalStatus.ACTIVE
        )

    inventories = filter_livestock_list(inventories, request.query_params)
    inventories = inventories.select_related(
        "livestock_type",
        "farmer__user",
        "farmer__barangay",
        "batch",
        "reviewed_by__role",
        "created_by",
    ).prefetch_related(
        "review_history__reviewer",
        "herd_membership_history__previous_batch",
        "herd_membership_history__new_batch",
        "herd_membership_history__acted_by",
    ).only(
        "id", "tag_number", "ownership_certificate_number", "breed", "sex", "birth_date", "weight", "entry_type", "quantity",
        "is_post_approval_addition",
        "last_vaccination_date", "status", "operational_status", "operational_status_changed_at",
        "review_remarks", "reviewed_at", "created_at", "photo", "avatar_key",
        "livestock_type__id", "livestock_type__name",
        "farmer__id", "farmer__user__id", "farmer__user__first_name", "farmer__user__last_name", "farmer__user__username",
        "farmer__barangay__id", "farmer__barangay__barangay_name",
        "batch__id", "batch__batch_code", "batch__batch_name",
        "reviewed_by__id", "reviewed_by__first_name", "reviewed_by__last_name", "reviewed_by__username",
        "reviewed_by__role__id", "reviewed_by__role__role_name",
        "created_by__id", "created_by__first_name", "created_by__last_name", "created_by__username",
    ).order_by("-created_at")

    if "page" in request.query_params and request.query_params.get("include_batches") == "true":
        if role_name(user) == "FARMER":
            batches = LivestockBatch.objects.filter(farmer__user=user)
        else:
            require_action(user, "batches", "read_all")
            batches = scope_reviewer_queryset(LivestockBatch.objects.all(), user)
        return inventory_management_page(inventories, batches, request)
    if "page" in request.query_params:
        pager = LivestockListPagination()
        records = pager.paginate_queryset(inventories.order_by("-created_at", "-pk"), request)
        return pager.get_paginated_response(LivestockInventorySerializer(records, many=True, context={"request": request}).data)
    serializer = LivestockInventorySerializer(
        inventories, many=True, context={"request": request}
    )
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(["GET", "PUT", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def inventory_detail(request, pk):
    """
    GET    /api/livestock/inventory/<id>/ -> Retrieve single livestock inventory item
    PUT    /api/livestock/inventory/<id>/ -> Full update
    PATCH  /api/livestock/inventory/<id>/ -> Partial update
    DELETE /api/livestock/inventory/<id>/ -> Delete entry (only if unreferenced)
    """
    user = request.user
    user_role = role_name(user)

    if request.method != "GET":
        batch_id = LivestockInventory.objects.filter(pk=pk).values_list("batch_id", flat=True).first()
        if batch_id:
            get_object_or_404(LivestockBatch.objects.select_for_update(of=("self",)), pk=batch_id)

    base_qs = LivestockInventory.objects.select_related(
        "livestock_type",
        "farmer__user",
        "farmer__barangay",
        "batch",
        "reviewed_by__role",
        "created_by",
    ).prefetch_related(
        "review_history__reviewer",
        "herd_membership_history__previous_batch",
        "herd_membership_history__new_batch",
        "herd_membership_history__acted_by",
    )

    if request.method != "GET":
        base_qs = base_qs.select_for_update(of=("self",))

    if user_role == "FARMER":
        farmer_profile = getattr(user, "farmer_profile", None)
        if farmer_profile:
            inventory = get_object_or_404(
                base_qs, Q(farmer=farmer_profile), pk=pk
            )
        else:
            inventory = get_object_or_404(base_qs.none(), pk=pk)
    else:
        require_action(user, "inventory", "read_all")
        inventory = get_object_or_404(scope_reviewer_queryset(base_qs, request.user), pk=pk)

    if request.method in ["PUT", "PATCH", "DELETE"]:
        require_action(user, "inventory", "edit_own")

        # Approved/Verified identity data is locked, but the owning farmer may update
        # photo/avatar, routine profile maintenance fields (birth date, last vaccination date),
        # or herd membership (`batch`).
        media_fields = {"photo", "left_side_photo", "right_side_photo", "avatar_key"}
        profile_maintenance_fields = media_fields | {"birth_date", "last_vaccination_date", "batch"}

        if (
            request.method == "PATCH"
            and request.data
            and set(request.data.keys()).issubset(profile_maintenance_fields)
            and inventory.operational_status == LivestockInventory.OperationalStatus.ACTIVE
        ):
            if set(request.data.keys()).issubset(media_fields):
                media_serializer = LivestockPhotoUpdateSerializer(
                    inventory, data=request.data, partial=True, context={"request": request}
                )
                media_serializer.is_valid(raise_exception=True)
                inventory = media_serializer.save()
                return Response(LivestockInventorySerializer(inventory, context={"request": request}).data)

            serializer = LivestockInventorySerializer(
                inventory,
                data=request.data,
                partial=True,
                context={"request": request},
            )
            serializer.is_valid(raise_exception=True)
            inventory = serializer.save()
            return Response(LivestockInventorySerializer(inventory, context={"request": request}).data)

        editable_statuses = {
            LivestockInventory.StatusType.PENDING,
            LivestockInventory.StatusType.SUBJECT_TO_REVISION,
        }
        if inventory.status not in editable_statuses:
            return Response(
                {"error": "Only PENDING or SUBJECT_TO_REVISION inventory records can be changed."},
                status=status.HTTP_409_CONFLICT,
            )

    if request.method == "DELETE":
        if inventory.batch_id: #type: ignore
            return Response(
                {"error": "Herd animals must remain together. Delete the pending herd instead."},
                status=status.HTTP_409_CONFLICT,
            )
        try:
            with transaction.atomic():
                Notification.objects.filter(
                    related_entity_type="livestock_inventory",
                    related_entity_id=inventory.id,
                ).delete()
                inventory.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except IntegrityError:
            return Response(
                {
                    "error": "Cannot delete: this livestock record is referenced by production or disease records."
                },
                status=status.HTTP_409_CONFLICT,
            )

    if request.method in ["PUT", "PATCH"]:
        serializer = LivestockInventorySerializer(
            inventory,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        was_returned = inventory.status == LivestockInventory.StatusType.SUBJECT_TO_REVISION
        inventory = serializer.save()
        if was_returned:
            inventory.status = LivestockInventory.StatusType.PENDING #type: ignore
            inventory.reviewed_by = None #type: ignore
            inventory.reviewed_at = None #type: ignore
            inventory.save(update_fields=["status", "reviewed_by", "reviewed_at"]) 
            farmer_name = user.get_full_name() or user.username
            animal_name = inventory.tag_number or inventory.breed or inventory.livestock_type.name #type: ignore
            notify_role(
                barangay_id=inventory.farmer.barangay_id,
                role_name="SIBAT",
                include_cbat=True,
                notification_type=Notification.NotificationType.SIBAT,
                priority=Notification.Priority.MEDIUM,
                title="Livestock Entry Resubmitted",
                message=f"{farmer_name} corrected and resubmitted {animal_name} for field verification.",
                link=f"/sibat?tab=inventory&reviewType=INVENTORY&reviewId={inventory.pk}",
                related_entity_type="livestock_inventory",
                related_entity_id=inventory.pk,
            )
            notify_role(
                role_name="ADMIN",
                notification_type=Notification.NotificationType.GENERAL,
                priority=Notification.Priority.MEDIUM,
                title="Livestock Entry Resubmitted",
                message=f"{farmer_name} corrected and resubmitted {animal_name} for field verification.",
                link=f"/data-validation?domain=inventory&recordType=INVENTORY&recordId={inventory.pk}",
                related_entity_type="livestock_inventory",
                related_entity_id=inventory.pk,
            )
        return Response(serializer.data, status=status.HTTP_200_OK)

    # GET
    serializer = LivestockInventorySerializer(inventory, context={"request": request})
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def review_inventory(request, pk):
    """
    POST /api/livestock/inventory/<id>/review/
    Review and verify livestock inventory:
    - SIBAT: Field tagging & verification (status = VERIFIED)
    - MAO: Official municipal certification (status = APPROVED or SUBJECT_TO_REVISION)
    """
    inventory = get_object_or_404(scope_reviewer_queryset(LivestockInventory.objects.select_for_update(of=("self",)), request.user), pk=pk)

    if inventory.entry_type != LivestockInventory.EntryType.INDIVIDUAL:
        return Response(
            {"error": "Only individual animal records can be reviewed. This legacy aggregate entry must be reconciled into individual records first."},
            status=status.HTTP_409_CONFLICT,
        )

    new_status = request.data.get("status")
    remarks = request.data.get("remarks", "")

    if not new_status:
        return Response(
            {"error": "status is required (VERIFIED, APPROVED, or SUBJECT_TO_REVISION)."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user = request.user
    user_role = require_action(user, "inventory", "review")
    validate_review_transition(
        domain="inventory",
        role=user_role,
        current=inventory.status,
        target=new_status,
        remarks=remarks,
    )

    reviewed_at = timezone.now()
    inventory.status = new_status
    inventory.reviewed_by = request.user
    inventory.review_remarks = remarks
    inventory.reviewed_at = reviewed_at
    inventory.save()
    LivestockInventoryReviewHistory.objects.create(
        inventory=inventory,
        reviewer=request.user,
        reviewer_role=user_role,
        status=new_status,
        remarks=remarks,
        reviewed_at=reviewed_at,
    )
    if new_status == "SUBJECT_TO_REVISION":
        notify_review_revision(inventory.farmer, request.user,
            title="Revision required: inventory #" + str(inventory.pk),
            message=remarks,
            link=f"/sibat?tab=inventory&reviewType=INVENTORY&reviewId={inventory.pk}")

    if new_status == LivestockInventory.StatusType.VERIFIED:
        notify_role(
            role_name="MAO",
            notification_type=Notification.NotificationType.GENERAL,
            priority=Notification.Priority.MEDIUM,
            title="Livestock Entry Awaiting MAO Approval",
            message=(
                f"{user_role} verified {inventory.tag_number or inventory.livestock_type.name} "
                f"from {inventory.farmer.user.get_full_name() or inventory.farmer.user.username}."
            ),
            link=f"/data-validation?domain=inventory&recordType=INVENTORY&recordId={inventory.pk}",
            related_entity_type="livestock_inventory",
            related_entity_id=inventory.pk,
        )

    # Automatically notify the animal's owner/registrant
    target_user = None
    if inventory.farmer and getattr(inventory.farmer, "user", None):
        target_user = inventory.farmer.user
    elif inventory.created_by:
        target_user = inventory.created_by

    if target_user:
        species_name = inventory.livestock_type.name if inventory.livestock_type else "Livestock"
        tag_info = inventory.tag_number or f"Batch ({inventory.quantity} heads)"
        inventory_detail_link = f"/livestock-inventory/{inventory.pk}"

        if new_status == LivestockInventory.StatusType.VERIFIED:
            create_notification(
                user=target_user,
                notification_type=Notification.NotificationType.SIBAT,
                priority=Notification.Priority.MEDIUM,
                title=f"Verified by {user_role} Inspector",
                message=f"Your {species_name} [{tag_info}] has been verified on-farm by {user_role}.{f' Officer Remarks: {remarks}' if remarks else ''}",
                link=inventory_detail_link,
            )
        elif new_status == LivestockInventory.StatusType.APPROVED:
            create_notification(
                user=target_user,
                notification_type=Notification.NotificationType.GENERAL,
                priority=Notification.Priority.MEDIUM,
                title="Livestock Record Approved",
                message=f"Official certification approved for your {species_name} [{tag_info}].",
                link=inventory_detail_link,
            )
        elif new_status == LivestockInventory.StatusType.SUBJECT_TO_REVISION:
            create_notification(
                user=target_user,
                notification_type=Notification.NotificationType.GENERAL,
                priority=Notification.Priority.HIGH,
                title="Revision Required on Livestock Record",
                message=f"Your {species_name} [{tag_info}] requires revision.{f' Note: {remarks}' if remarks else ''}",
                link=inventory_detail_link,
                related_entity_type="livestock_inventory",
                related_entity_id=inventory.pk,
            )

    serializer = LivestockInventorySerializer(inventory, context={"request": request})
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(["GET"])
def list_livestock_types(request):
    """
    GET /api/livestock/livestock_types/
    """
    return Response(LivestockType.objects.all().values("id", "name"), status=status.HTTP_200_OK)


@api_view(["GET"])
@authentication_classes([OptionalApprovedJWTAuthentication])
@permission_classes([AllowAny])
def get_barangays(request):
    """
    GET /api/livestock/barangays/
    """
    barangays = Barangay.objects.all()
    if request.user.is_authenticated:
        # Reuse the same reviewer scope as census and farmer queries so a
        # SIBAT only receives barangays their account is allowed to manage.
        # This response is user-scoped, so it must not use the shared page cache.
        barangays = scope_reviewer_queryset(barangays, request.user)
    serializer = BarangaySerializer(barangays, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_farmer_by_barangays(request, barangay_id):
    """
    GET /api/livestock/farmers/<barangay_id>/
    Supports lookup by integer barangay_id and optional ?barangay_name=...
    """
    require_action(request.user, "census", "read_all")
    qs = Farmer.objects.all()
    barangay_name = request.query_params.get("barangay_name") or request.query_params.get("name")
    if barangay_id and int(barangay_id) > 0:
        qs = qs.filter(barangay_id=barangay_id)
    elif barangay_name:
        qs = qs.filter(barangay__barangay_name__iexact=barangay_name.strip())

    farmers = (
        scope_reviewer_queryset(qs.select_related("user", "barangay"), request.user)
        .annotate(
            active_herds_count=Count("batches", filter=Q(batches__status="ACTIVE"), distinct=True),
            animals_count=Count("inventories", filter=Q(inventories__operational_status="ACTIVE"), distinct=True),
        )
        .order_by("user__last_name", "user__first_name")
    )
    serializer = FarmerOptionsSerializer(farmers, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def public_telemetry_summary(request):
    """
    GET /livestock/public-telemetry/
    Public read-only aggregate counts for the login page telemetry HUD.
    """
    week_ago = timezone.now() - timedelta(days=7)
    active_inv = LivestockInventory.objects.filter(
        operational_status=LivestockInventory.OperationalStatus.ACTIVE
    )
    tagged_qs = active_inv.exclude(tag_number__isnull=True).exclude(tag_number="")
    tagged_heads = tagged_qs.count()
    added_this_week = tagged_qs.filter(created_at__gte=week_ago).count()
    total_barangays = Barangay.objects.count()
    active_barangays = (
        Barangay.objects.filter(
            farmers__inventories__operational_status=LivestockInventory.OperationalStatus.ACTIVE
        )
        .distinct()
        .count()
    )
    return Response(
        {
            "tagged_heads": tagged_heads,
            "added_this_week": added_this_week,
            "active_barangays": active_barangays,
            "total_barangays": total_barangays,
        },
        status=status.HTTP_200_OK,
    )


@api_view(["POST", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def manage_inventory_herd(request, pk):
    """
    POST / PATCH / DELETE /livestock/inventory/<int:pk>/herd/
    Allows an authenticated Farmer to add an individual animal to a herd,
    move an animal between eligible herds, or remove an animal from its current herd
    without deleting the animal or altering its operational/review status.
    """
    user = request.user
    require_action(user, "inventory", "edit_own")

    user_role = role_name(user)
    if user_role != "FARMER":
        return Response(
            {"error": "Only farmers can manage herd assignments for their livestock."},
            status=status.HTTP_403_FORBIDDEN,
        )

    farmer_profile = getattr(user, "farmer_profile", None)
    if not farmer_profile:
        return Response(
            {"error": "Farmer profile not found for current user."},
            status=status.HTTP_403_FORBIDDEN,
        )

    with transaction.atomic():
        inventory = (
            LivestockInventory.objects.select_for_update(of=("self",))
            .select_related(
                "livestock_type",
                "farmer__user",
                "farmer__barangay",
                "batch",
                "reviewed_by__role",
                "created_by",
            )
            .filter(pk=pk)
            .first()
        )
        if inventory is None:
            return Response(
                {"error": "Livestock record not found.", "livestock": ["Livestock record not found."]},
                status=status.HTTP_404_NOT_FOUND,
            )

        if inventory.farmer_id != farmer_profile.pk:
            return Response(
                {
                    "error": "You are not authorized to manage another farmer's livestock.",
                    "livestock": ["You do not own this livestock record."],
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        if inventory.entry_type != LivestockInventory.EntryType.INDIVIDUAL or inventory.quantity != 1:
            return Response(
                {
                    "error": "Only individual livestock records (1 head) can be assigned to or managed in a herd.",
                    "livestock": ["Only individual livestock records can be managed in a herd."],
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if inventory.operational_status != LivestockInventory.OperationalStatus.ACTIVE:
            return Response(
                {
                    "error": (
                        f"Cannot change herd membership for an animal with operational status "
                        f"'{inventory.operational_status}'. Only ACTIVE livestock can be added, moved, or removed."
                    ),
                    "livestock": ["Only active livestock can be assigned to, moved between, or removed from a herd."],
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        data = request.data if hasattr(request, "data") and isinstance(request.data, dict) else {}
        notes = str(data.get("notes") or data.get("reason") or "").strip()[:500]

        if request.method == "DELETE":
            requested_action = "REMOVE"
            has_batch_key = True
            raw_batch_id = None
        else:
            requested_action = str(data.get("action") or "").strip().upper()
            has_batch_key = any(k in data for k in ("batch", "batch_id", "destination_batch_id"))
            if "batch" in data:
                raw_batch_id = data.get("batch")
            elif "batch_id" in data:
                raw_batch_id = data.get("batch_id")
            else:
                raw_batch_id = data.get("destination_batch_id")

            if raw_batch_id in ("", None):
                raw_batch_id = None

        is_remove_operation = requested_action in {"REMOVE", "REMOVED", "DETACH"} or (
            not requested_action and has_batch_key and raw_batch_id is None
        )

        if is_remove_operation:
            if raw_batch_id is not None:
                return Response(
                    {
                        "error": "Remove operation must not specify a destination herd.",
                        "batch": ["Do not specify a destination herd when removing an animal from its herd."],
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if inventory.batch_id is None:
                return Response(
                    {
                        "error": "This animal is not currently assigned to any herd.",
                        "batch": ["This animal is not currently assigned to any herd."],
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            previous_batch = LivestockBatch.objects.select_for_update(of=("self",)).get(pk=inventory.batch_id)
            inventory.batch = None
            inventory.save(update_fields=["batch"])

            LivestockHerdMembershipHistory.objects.create(
                livestock=inventory,
                previous_batch=previous_batch,
                new_batch=None,
                action=LivestockHerdMembershipHistory.ActionType.REMOVED,
                acted_by=user,
                notes=notes,
            )
        else:
            if raw_batch_id is None:
                return Response(
                    {
                        "error": "Please select a destination herd.",
                        "batch": ["A valid destination herd ID is required."],
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            try:
                target_batch_id = int(raw_batch_id)
                if target_batch_id <= 0:
                    raise ValueError
            except (TypeError, ValueError):
                return Response(
                    {
                        "error": "Invalid herd ID.",
                        "batch": ["Enter a valid herd ID."],
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            batch_pks_to_lock = sorted(
                {pk_val for pk_val in (inventory.batch_id, target_batch_id) if pk_val is not None}
            )
            locked_batches = {
                b.pk: b
                for b in LivestockBatch.objects.select_for_update(of=("self",))
                .select_related("livestock_type")
                .filter(pk__in=batch_pks_to_lock)
            }

            new_batch = locked_batches.get(target_batch_id)
            previous_batch = locked_batches.get(inventory.batch_id) if inventory.batch_id else None

            if new_batch is None:
                return Response(
                    {
                        "error": "Selected herd does not exist.",
                        "batch": ["Selected herd does not exist."],
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if new_batch.farmer_id != farmer_profile.pk:
                return Response(
                    {
                        "error": "You cannot assign or move livestock to a herd owned by another farmer.",
                        "batch": ["This herd belongs to another farmer."],
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )

            if new_batch.status != LivestockBatch.StatusType.ACTIVE:
                return Response(
                    {
                        "error": "Livestock can only be assigned or moved to an active herd.",
                        "batch": ["This herd is no longer active."],
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if new_batch.livestock_type_id != inventory.livestock_type_id:
                return Response(
                    {
                        "error": (
                            f"Species mismatch: {inventory.livestock_type.name} cannot be assigned "
                            f"to a {new_batch.livestock_type.name} herd."
                        ),
                        "batch": ["The animal species must match its herd."],
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if inventory.batch_id == new_batch.pk:
                return Response(
                    {
                        "error": (
                            f"{inventory.tag_number or 'This animal'} is already assigned to "
                            f"{new_batch.batch_name or new_batch.batch_code}."
                        ),
                        "batch": ["This animal is already a member of the selected herd."],
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if requested_action in {"ADD", "ADDED"} and inventory.batch_id is not None:
                return Response(
                    {
                        "error": "This animal already belongs to a herd. Use Move to transfer it to another herd.",
                        "batch": ["This animal already belongs to a herd. Use Move to transfer it to another herd."],
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if requested_action in {"MOVE", "MOVED"} and inventory.batch_id is None:
                return Response(
                    {
                        "error": "This animal does not currently belong to a herd. Use Add to Herd to assign it.",
                        "batch": ["This animal does not currently belong to a herd."],
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            history_action = (
                LivestockHerdMembershipHistory.ActionType.MOVED
                if previous_batch is not None
                else LivestockHerdMembershipHistory.ActionType.ADDED
            )

            inventory.batch = new_batch
            inventory.save(update_fields=["batch"])

            LivestockHerdMembershipHistory.objects.create(
                livestock=inventory,
                previous_batch=previous_batch,
                new_batch=new_batch,
                action=history_action,
                acted_by=user,
                notes=notes,
            )

        refreshed = (
            LivestockInventory.objects.select_related(
                "livestock_type",
                "farmer__user",
                "farmer__barangay",
                "batch",
                "reviewed_by__role",
                "created_by",
            )
            .prefetch_related(
                "review_history__reviewer",
                "herd_membership_history__previous_batch",
                "herd_membership_history__new_batch",
                "herd_membership_history__acted_by",
            )
            .get(pk=inventory.pk)
        )
        serializer = LivestockInventorySerializer(refreshed, context={"request": request})
        return Response(serializer.data, status=status.HTTP_200_OK)


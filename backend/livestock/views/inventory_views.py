from livestock.list_queries import LivestockListPagination, filter_livestock_list, inventory_management_page
from smartlivestock.workflows import scope_reviewer_queryset
from django.shortcuts import get_object_or_404
from django.db import IntegrityError, transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from livestock.models import Barangay, LivestockBatch, LivestockInventory, LivestockType, Farmer
from livestock.serializer import (
    FarmerOptionsSerializer,
    LivestockInventorySerializer,
    LivestockPhotoUpdateSerializer,
    BarangaySerializer,
)
from users.models import Notification
from users.notification_views import create_notification, notify_role, notify_review_revision
from smartlivestock.workflows import require_action, role_name, validate_review_transition



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
    ).only(
        "id", "tag_number", "breed", "sex", "birth_date", "weight", "entry_type", "quantity",
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

        # Approved identity data is locked, but the owning farmer may update only
        # the photo/avatar. Keep that media operation separate from registry edits.
        media_fields = {"photo", "avatar_key"}
        if request.method == "PATCH" and request.data and set(request.data.keys()).issubset(media_fields):
            media_serializer = LivestockPhotoUpdateSerializer(
                inventory, data=request.data, partial=True, context={"request": request}
            )
            media_serializer.is_valid(raise_exception=True)
            inventory = media_serializer.save()
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
        if was_returned and not inventory.batch_id: #type: ignore
            inventory.status = LivestockInventory.StatusType.PENDING #type: ignore
            inventory.reviewed_by = None #type: ignore
            inventory.reviewed_at = None #type: ignore
            inventory.save(update_fields=["status", "reviewed_by", "reviewed_at"]) 
            farmer_name = user.get_full_name() or user.username
            animal_name = inventory.tag_number or inventory.breed or inventory.livestock_type.name #type: ignore
            notify_role(
                barangay_id=inventory.farmer.barangay_id,
                role_name="SIBAT",
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

    if inventory.batch_id: # type: ignore
        batch = inventory.batch
        return Response(
            {
                "error": (
                    f"This animal belongs to herd {batch.batch_code}. Review the herd at " # type: ignore
                        f"livestock/batches/{inventory.batch_id}/review/ so every animal "# type: ignore
                    "animals move through FARMER -> SIBAT -> MAO validation together."
                )
            },
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

    inventory.status = new_status
    inventory.reviewed_by = request.user
    inventory.review_remarks = remarks
    inventory.reviewed_at = timezone.now()
    inventory.save()
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
                f"SIBAT verified {inventory.tag_number or inventory.livestock_type.name} "
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
                title="Verified by SIBAT Inspector",
                message=f"Your {species_name} [{tag_info}] has been verified on-farm by SIBAT.{f' Officer Remarks: {remarks}' if remarks else ''}",
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
    """
    require_action(request.user, "census", "read_all")
    farmers = scope_reviewer_queryset(Farmer.objects.filter(barangay_id=barangay_id).select_related("user"), request.user)
    serializer = FarmerOptionsSerializer(farmers, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)

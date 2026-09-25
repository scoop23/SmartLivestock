from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from livestock.models import LivestockBatch, LivestockInventory, LivestockType
from livestock.serializer import LivestockBatchSerializer, LivestockInventorySerializer
from users.models import Notification
from users.notification_views import create_notification


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def batch_list_create(request):
    """
    GET  /api/livestock/batches/ -> List batches for farmer (or all for MAO/SIBAT/Admin)
    POST /api/livestock/batches/ -> Create a new batch, optionally with a list of child animals
    """
    user = request.user
    role_name = getattr(getattr(user, "role", None), "role_name", "")

    if request.method == "POST":
        data = request.data.copy()
        animals_data = data.pop("animals", None)

        farmer_profile = getattr(user, "farmer_profile", None)
        if not farmer_profile and role_name == "FARMER":
            return Response(
                {"error": "Farmer profile not found for current user."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Batch code auto-generation if omitted
        if not data.get("batch_code"):
            import time
            data["batch_code"] = f"BATCH-{int(time.time())}"

        livestock_type_id = data.get("livestock_type")
        if not livestock_type_id:
            return Response(
                {"error": "livestock_type is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        livestock_type = get_object_or_404(LivestockType, pk=livestock_type_id)

        default_animal_status = (
            LivestockInventory.StatusType.APPROVED
            if role_name in ["MAO", "ADMIN"]
            else LivestockInventory.StatusType.PENDING
        )

        with transaction.atomic():
            batch = LivestockBatch.objects.create(
                farmer=farmer_profile if farmer_profile else None,
                livestock_type=livestock_type,
                batch_name=data.get("batch_name", f"{livestock_type.name} Batch"),
                batch_code=data.get("batch_code"),
                housing_pen=data.get("housing_pen", ""),
                feed_type=data.get("feed_type", ""),
                target_weight=data.get("target_weight") or None,
                target_harvest_date=data.get("target_harvest_date") or None,
                status=data.get("status", LivestockBatch.StatusType.ACTIVE),
                notes=data.get("notes", ""),
                created_by=user,
            )

            # If animals roster is supplied, create individual LivestockInventory items
            if animals_data and isinstance(animals_data, list):
                for animal in animals_data:
                    LivestockInventory.objects.create(
                        batch=batch,
                        farmer=batch.farmer,
                        livestock_type=batch.livestock_type,
                        entry_type=LivestockInventory.EntryType.INDIVIDUAL,
                        quantity=1,
                        tag_number=animal.get("tag_number", ""),
                        breed=animal.get("breed", ""),
                        sex=animal.get("sex", "UNKNOWN"),
                        weight=animal.get("weight") or None,
                        avatar_key=animal.get("avatar_key", ""),
                        last_vaccination_date=animal.get("last_vaccination_date") or None,
                        status=default_animal_status,
                        created_by=user,
                    )

        serializer = LivestockBatchSerializer(batch, context={"request": request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    # GET List
    if role_name == "FARMER":
        farmer_profile = getattr(user, "farmer_profile", None)
        if farmer_profile:
            batches = LivestockBatch.objects.filter(
                Q(farmer=farmer_profile) | Q(created_by=user)
            ).distinct()
        else:
            batches = LivestockBatch.objects.filter(created_by=user)
    else:
        batches = LivestockBatch.objects.all()

    # Optional query filters
    livestock_type_param = request.query_params.get("livestock_type")
    if livestock_type_param:
        batches = batches.filter(livestock_type_id=livestock_type_param)

    status_param = request.query_params.get("status")
    if status_param:
        batches = batches.filter(status=status_param)

    batches = batches.select_related("livestock_type", "farmer__user", "farmer__barangay").prefetch_related("animals")
    serializer = LivestockBatchSerializer(batches, many=True, context={"request": request})
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(["GET", "PUT", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def batch_detail(request, pk):
    """
    GET    /api/livestock/batches/<id>/ -> Retrieve single batch and its animal roster
    PUT    /api/livestock/batches/<id>/ -> Update batch metadata
    PATCH  /api/livestock/batches/<id>/ -> Partial update batch metadata
    DELETE /api/livestock/batches/<id>/ -> Delete batch
    """
    user = request.user
    role_name = getattr(getattr(user, "role", None), "role_name", "")

    if role_name == "FARMER":
        farmer_profile = getattr(user, "farmer_profile", None)
        if farmer_profile:
            batch = get_object_or_404(
                LivestockBatch, Q(farmer=farmer_profile) | Q(created_by=user), pk=pk
            )
        else:
            batch = get_object_or_404(LivestockBatch, created_by=user, pk=pk)
    else:
        batch = get_object_or_404(LivestockBatch, pk=pk)

    if request.method == "GET":
        serializer = LivestockBatchSerializer(batch, context={"request": request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    if request.method in ["PUT", "PATCH"]:
        data = request.data
        updatable = [
            "batch_name",
            "housing_pen",
            "feed_type",
            "target_weight",
            "target_harvest_date",
            "status",
            "notes",
        ]
        for field in updatable:
            if field in data:
                val = data[field]
                if field in ["target_weight", "target_harvest_date"] and val == "":
                    val = None
                setattr(batch, field, val)
        batch.save()
        serializer = LivestockBatchSerializer(batch, context={"request": request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    if request.method == "DELETE":
        # Disassociate child animals or delete them
        with transaction.atomic():
            batch.animals.all().delete()
            batch.delete()
        return Response(
            {"message": f"Batch '{batch.batch_code}' and linked records deleted."},
            status=status.HTTP_200_OK,
        )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def batch_add_animals(request, pk):
    """
    POST /api/livestock/batches/<id>/animals/ -> Add one or more animals to this batch
    Payload: { "animals": [ { tag_number, breed, sex, weight, avatar_key, last_vaccination_date }, ... ] }
    """
    user = request.user
    role_name = getattr(getattr(user, "role", None), "role_name", "")

    if role_name == "FARMER":
        farmer_profile = getattr(user, "farmer_profile", None)
        if farmer_profile:
            batch = get_object_or_404(
                LivestockBatch, Q(farmer=farmer_profile) | Q(created_by=user), pk=pk
            )
        else:
            batch = get_object_or_404(LivestockBatch, created_by=user, pk=pk)
    else:
        batch = get_object_or_404(LivestockBatch, pk=pk)

    animals_data = request.data.get("animals", [])
    if isinstance(animals_data, dict):
        animals_data = [animals_data]

    if not animals_data:
        return Response(
            {"error": "No animal data provided in 'animals' list."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    default_animal_status = (
        LivestockInventory.StatusType.APPROVED
        if role_name in ["MAO", "ADMIN"]
        else LivestockInventory.StatusType.PENDING
    )

    created_animals = []
    with transaction.atomic():
        for animal in animals_data:
            created = LivestockInventory.objects.create(
                batch=batch,
                farmer=batch.farmer,
                livestock_type=batch.livestock_type,
                entry_type=LivestockInventory.EntryType.INDIVIDUAL,
                quantity=1,
                tag_number=animal.get("tag_number", ""),
                breed=animal.get("breed", ""),
                sex=animal.get("sex", "UNKNOWN"),
                weight=animal.get("weight") or None,
                avatar_key=animal.get("avatar_key", ""),
                last_vaccination_date=animal.get("last_vaccination_date") or None,
                status=default_animal_status,
                created_by=user,
            )
            created_animals.append(created)

    serializer = LivestockInventorySerializer(
        created_animals, many=True, context={"request": request}
    )
    return Response(
        {
            "message": f"Successfully added {len(created_animals)} animals to batch {batch.batch_code}.",
            "animals": serializer.data,
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def batch_review(request, pk):
    """
    POST /api/livestock/batches/<id>/review/
    Review and verify an entire batch and its animal roster:
    - SIBAT: Field inspection of the pen/herd (status = VERIFIED or SUBJECT_TO_REVISION)
    - MAO: Official municipal approval (status = APPROVED or SUBJECT_TO_REVISION)
    """
    batch = get_object_or_404(LivestockBatch, pk=pk)
    new_status = request.data.get("status")
    remarks = request.data.get("remarks", "")

    if not new_status:
        return Response(
            {"error": "status is required (VERIFIED, APPROVED, or SUBJECT_TO_REVISION)."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user = request.user
    role_name = getattr(getattr(user, "role", None), "role_name", "")

    if role_name == "FARMER":
        raise PermissionDenied("Farmers are not authorized to review livestock batches.")

    if role_name == "SIBAT":
        if new_status == LivestockInventory.StatusType.APPROVED:
            raise PermissionDenied(
                "SIBAT cooperative officers can only verify (status=VERIFIED). Final approval is reserved for MAO."
            )
        if new_status not in [LivestockInventory.StatusType.VERIFIED, LivestockInventory.StatusType.SUBJECT_TO_REVISION]:
            return Response(
                {"error": "Invalid status for SIBAT review. Valid choices are VERIFIED or SUBJECT_TO_REVISION."},
                status=status.HTTP_400_BAD_REQUEST,
            )
    elif role_name in ["MAO", "ADMIN"]:
        if new_status not in LivestockInventory.StatusType.values:
            return Response(
                {"error": f"Invalid status '{new_status}'. Valid choices are: {list(LivestockInventory.StatusType.values)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )
    else:
        raise PermissionDenied("You do not have permission to review livestock batches.")

    with transaction.atomic():
        batch.animals.all().update(
            status=new_status,
            reviewed_by=user,
            reviewed_at=timezone.now(),
            review_remarks=remarks,
        )
        if remarks:
            timestamp_str = timezone.now().strftime("%Y-%m-%d %H:%M")
            reviewer_title = (
                f"SIBAT Verification ({user.get_full_name() or user.username})"
                if role_name == "SIBAT"
                else f"MAO Approval ({user.get_full_name() or user.username})"
            )
            audit_entry = f"\n[{timestamp_str}] {reviewer_title} - {new_status}: {remarks}"
            batch.notes = (batch.notes + audit_entry).strip()
            batch.save(update_fields=["notes", "updated_at"])

    # Notify the farmer
    target_user = None
    if batch.farmer and getattr(batch.farmer, "user", None):
        target_user = batch.farmer.user
    elif batch.created_by:
        target_user = batch.created_by

    if target_user:
        count = batch.animals.count()
        species_name = batch.livestock_type.name if batch.livestock_type else "Livestock"
        batch_info = f"{batch.batch_code} ({count} heads)"

        if new_status == LivestockInventory.StatusType.VERIFIED:
            create_notification(
                user=target_user,
                notification_type=Notification.NotificationType.SIBAT,
                priority=Notification.Priority.MEDIUM,
                title="Cohort Batch Verified by SIBAT",
                message=f"Your {species_name} batch [{batch_info}] has been verified on-farm by SIBAT.{f' Remarks: {remarks}' if remarks else ''}",
                link="/livestock-inventory/batches",
            )
        elif new_status == LivestockInventory.StatusType.APPROVED:
            create_notification(
                user=target_user,
                notification_type=Notification.NotificationType.GENERAL,
                priority=Notification.Priority.MEDIUM,
                title="Cohort Batch Approved by MAO",
                message=f"Official certification approved for your {species_name} batch [{batch_info}].",
                link="/livestock-inventory/batches",
            )
        elif new_status == LivestockInventory.StatusType.SUBJECT_TO_REVISION:
            create_notification(
                user=target_user,
                notification_type=Notification.NotificationType.GENERAL,
                priority=Notification.Priority.HIGH,
                title="Revision Required on Cohort Batch",
                message=f"Your {species_name} batch [{batch_info}] requires revision.{f' Note: {remarks}' if remarks else ''}",
                link="/livestock-inventory/batches",
            )

    serializer = LivestockBatchSerializer(batch, context={"request": request})
    return Response(
        {
            "message": f"Batch {batch.batch_code} and all {batch.animals.count()} animals updated to {new_status}.",
            "batch": serializer.data,
        },
        status=status.HTTP_200_OK,
    )


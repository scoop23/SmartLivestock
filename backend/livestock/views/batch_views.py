from smartlivestock.workflows import scope_reviewer_queryset
from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_date
from django.db.models.deletion import ProtectedError
from django.db.models import Q, Prefetch, Count, Sum
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from livestock.models import LivestockBatch, LivestockInventory, LivestockType
from livestock.list_queries import LivestockListPagination, batch_list_annotations, filter_livestock_list
from livestock.serializer import (
    LivestockBatchListSerializer,
    LivestockBatchPhotoUpdateSerializer,
    LivestockBatchSerializer,
    LivestockInventorySerializer,
)
from users.models import Notification
from users.notification_views import create_notification, notify_role, notify_review_revision
from smartlivestock.workflows import (
    require_action,
    role_name,
    validate_batch_lifecycle,
    validate_review_transition,
)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def batch_list_create(request):
    """
    GET  /api/livestock/batches/ -> List batches for farmer (or all for MAO/SIBAT/Admin)
    POST /api/livestock/batches/ -> Create a new batch, optionally with a list of child animals
    """
    user = request.user
    user_role = role_name(user)

    if request.method == "POST":
        require_action(user, "batches", "create")
        data = request.data.copy()
        animals_data = data.pop("animals", None)
        if isinstance(animals_data, dict):
            animals_data = [animals_data]
        if isinstance(animals_data, list):
            for animal in animals_data:
                raw_birth_date = animal.get("birth_date")
                if raw_birth_date:
                    parsed_birth_date = parse_date(raw_birth_date) if isinstance(raw_birth_date, str) else raw_birth_date
                    if parsed_birth_date is None:
                        return Response({"birth_date": "Use a valid YYYY-MM-DD date."}, status=status.HTTP_400_BAD_REQUEST)
                    if parsed_birth_date > timezone.localdate():
                        return Response({"birth_date": "Birth date cannot be in the future."}, status=status.HTTP_400_BAD_REQUEST)
                    animal["birth_date"] = parsed_birth_date

        farmer_profile = getattr(user, "farmer_profile", None)
        if not farmer_profile:
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

        default_animal_status = LivestockInventory.StatusType.PENDING

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
                status=LivestockBatch.StatusType.ACTIVE,
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
                        birth_date=animal.get("birth_date") or None,
                        weight=animal.get("weight") or None,
                        avatar_key=animal.get("avatar_key", ""),
                        last_vaccination_date=animal.get("last_vaccination_date") or None,
                        status=default_animal_status,
                        created_by=user,
                    )

        serializer = LivestockBatchSerializer(batch, context={"request": request})
        farmer_name = user.get_full_name() or user.username
        notify_role(
            barangay_id=batch.farmer.barangay_id,
            role_name="SIBAT",
            notification_type=Notification.NotificationType.SIBAT,
            priority=Notification.Priority.MEDIUM,
            title="New Livestock Batch Awaiting Verification",
            message=f"{farmer_name} registered batch {batch.batch_code} with {batch.animals.count()} animal(s).",
            link="/sibat-validation",
        )
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    # GET List
    if user_role == "FARMER":
        farmer_profile = getattr(user, "farmer_profile", None)
        if farmer_profile:
            batches = LivestockBatch.objects.filter(
                Q(farmer=farmer_profile)
            ).distinct()
        else:
            batches = LivestockBatch.objects.none()
    else:
        require_action(user, "batches", "read_all")
        batches = scope_reviewer_queryset(LivestockBatch.objects.all(), request.user)

    # Optional query filters
    livestock_type_param = request.query_params.get("livestock_type")
    if livestock_type_param:
        batches = batches.filter(livestock_type_id=livestock_type_param)

    status_param = request.query_params.get("status")
    if status_param:
        batches = batches.filter(status=status_param)

    batches = batches.select_related("livestock_type", "farmer__user", "farmer__barangay")
    include_roster = request.query_params.get("include_roster") == "true" or request.query_params.get("full") == "true"

    if request.query_params.get("summary") == "true":
        batches = batch_list_annotations(batches)
        batches = filter_livestock_list(batches, request.query_params, batch=True)
        pager = LivestockListPagination()
        records = pager.paginate_queryset(batches.order_by("-created_at", "-pk"), request)
        response = pager.get_paginated_response(LivestockBatchListSerializer(records, many=True, context={"request": request}).data)
        # These counts describe the filtered set, not just the current page.
        response.data["summary"] = batches.aggregate(
            totalAnimals=Sum("active_animal_count"), approvedBatches=Count("id", filter=Q(list_review_status="APPROVED")),
            pendingBatches=Count("id", filter=Q(list_review_status="PENDING")), verifiedBatches=Count("id", filter=Q(list_review_status="VERIFIED")),
            revisionBatches=Count("id", filter=Q(list_review_status="SUBJECT_TO_REVISION")),
        )
        return response

    if include_roster:
        batches = filter_livestock_list(batches, request.query_params, batch=True).prefetch_related(
            "animals__reviewed_by__role", "animals__livestock_type"
        )
        if "page" in request.query_params:
            pager = LivestockListPagination()
            records = pager.paginate_queryset(batches.order_by("-created_at", "-pk"), request)
            return pager.get_paginated_response(LivestockBatchSerializer(records, many=True, context={"request": request}).data)
        serializer = LivestockBatchSerializer(batches.order_by("-created_at", "-pk"), many=True, context={"request": request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    # High-performance SQL annotated list (1 query instead of hundreds)
    batches = batch_list_annotations(batches)
    batches = filter_livestock_list(batches, request.query_params, batch=True)
    if "page" in request.query_params:
        pager = LivestockListPagination()
        records = pager.paginate_queryset(batches.order_by("-created_at", "-pk"), request)
        return pager.get_paginated_response(LivestockBatchListSerializer(records, many=True, context={"request": request}).data)

    serializer = LivestockBatchListSerializer(batches.order_by("-created_at", "-pk"), many=True, context={"request": request})
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(["GET", "PUT", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def batch_detail(request, pk):
    """
    GET    /api/livestock/batches/<id>/ -> Retrieve single batch and its animal roster
    PUT    /api/livestock/batches/<id>/ -> Update batch metadata
    PATCH  /api/livestock/batches/<id>/ -> Partial update batch metadata
    DELETE /api/livestock/batches/<id>/ -> Delete batch
    """
    user = request.user
    user_role = role_name(user)

    if user_role == "FARMER":
        farmer_profile = getattr(user, "farmer_profile", None)
        if farmer_profile:
            batch = get_object_or_404(
                LivestockBatch.objects.select_for_update(of=("self",)), Q(farmer=farmer_profile), pk=pk
            )
        else:
            batch = get_object_or_404(LivestockBatch.objects.none(), pk=pk)
    else:
        require_action(user, "batches", "read_all")
        batch = get_object_or_404(scope_reviewer_queryset(LivestockBatch.objects.select_for_update(of=("self",)), request.user), pk=pk)

    if request.method == "GET":
        # Detail loads one roster and its reviewers in fixed queries, after permission checks.
        batch = LivestockBatch.objects.select_related("livestock_type", "farmer__user", "farmer__barangay").prefetch_related("animals__reviewed_by__role").get(pk=batch.pk)
        serializer = LivestockBatchSerializer(batch, context={"request": request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    if request.method in ["PUT", "PATCH"]:
        require_action(user, "batches", "edit_own")
        data = request.data
        if request.method == "PATCH" and data and set(data.keys()) == {"photo"}:
            photo_serializer = LivestockBatchPhotoUpdateSerializer(
                batch, data=data, partial=True, context={"request": request}
            )
            photo_serializer.is_valid(raise_exception=True)
            batch = photo_serializer.save()
            return Response(LivestockBatchSerializer(batch, context={"request": request}).data)
        states = set(batch.animals.values_list("status", flat=True))
        resubmit = str(data.get("resubmit", "")).lower() in {"true", "1"}
        if resubmit and states != {LivestockInventory.StatusType.SUBJECT_TO_REVISION}:
            return Response(
                {"error": "Only a fully returned herd can be resubmitted."},
                status=status.HTTP_409_CONFLICT,
            )
        if (set(data) - {"status", "resubmit"} or resubmit) and (
            batch.status != LivestockBatch.StatusType.ACTIVE
            or not states.issubset({
                LivestockInventory.StatusType.PENDING,
                LivestockInventory.StatusType.SUBJECT_TO_REVISION,
            })
        ):
            return Response(
                {"error": "Verified or approved herd details are locked."},
                status=status.HTTP_409_CONFLICT,
            )
        updatable = [
            "batch_name",
            "housing_pen",
            "feed_type",
            "target_weight",
            "target_harvest_date",
            "status",
            "notes",
        ]
        if "status" in data:
            # Selling/harvesting is the result of an approved event, never a farmer toggle.
            if data["status"] != batch.status and data["status"] != "ARCHIVED":
                return Response({"error": "Herd operational transitions require an approved sale or slaughter."}, status=409)
            if data["status"] == "ARCHIVED" and batch.animals.filter(operational_status="ACTIVE").exists():
                return Response({"error": "A herd with active animals cannot be archived."}, status=409)
            validate_batch_lifecycle(batch.status, data["status"])
        for field in updatable:
            if field in data:
                val = data[field]
                if field in ["target_weight", "target_harvest_date"] and val == "":
                    val = None
                setattr(batch, field, val)
        batch.save()
        if resubmit:
            batch.animals.all().update(
                status=LivestockInventory.StatusType.PENDING,
                reviewed_by=None,
                reviewed_at=None,
            )
            notify_role(
                barangay_id=batch.farmer.barangay_id,
                role_name="SIBAT",
                notification_type=Notification.NotificationType.SIBAT,
                title="Herd Resubmitted for Verification",
                message=f"{user.get_full_name() or user.username} resubmitted herd {batch.batch_code} for field review.",
                link="/sibat/batches?batchId=" + str(batch.pk),
            )
        serializer = LivestockBatchSerializer(batch, context={"request": request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    if request.method == "DELETE":
        require_action(user, "batches", "edit_own")
        if batch.animals.exclude(
            status__in=[
                LivestockInventory.StatusType.PENDING,
                LivestockInventory.StatusType.SUBJECT_TO_REVISION,
            ]
        ).exists():
            return Response(
                {"error": "A batch with verified or approved animals cannot be deleted."},
                status=status.HTTP_409_CONFLICT,
            )
        # Batch-only events use SET_NULL in the schema; deleting their source would
        # hide farmer history and remove its authoritative barangay relationship.
        if any(getattr(batch, relation).exists() for relation in (
            "production_records", "slaughter_records", "live_animal_sales", "disease_cases", "mortality_records"
        )):
            return Response(
                {"error": "Cannot delete a herd with linked event history. Keep the herd for historical records."},
                status=status.HTTP_409_CONFLICT,
            )
        # Protected event history must survive an attempted herd deletion.
        try:
            with transaction.atomic():
                batch.animals.all().delete()
                batch.delete()
        except ProtectedError:
            return Response(
                {"error": "Cannot delete this herd because its animals have linked production, disease, inspection or other protected history."},
                status=status.HTTP_409_CONFLICT,
            )
        return Response(
            {"message": f"Batch '{batch.batch_code}' and linked records deleted."},
            status=status.HTTP_200_OK,
        )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def batch_add_animals(request, pk):
    """
    POST /api/livestock/batches/<id>/animals/ -> Add one or more animals to this batch
    Payload: { "animals": [ { tag_number, breed, sex, weight, avatar_key, last_vaccination_date }, ... ] }
    """
    user = request.user
    user_role = role_name(user)

    if user_role == "FARMER":
        farmer_profile = getattr(user, "farmer_profile", None)
        if farmer_profile:
            batch = get_object_or_404(
                LivestockBatch.objects.select_for_update(of=("self",)), Q(farmer=farmer_profile), pk=pk
            )
        else:
            batch = get_object_or_404(LivestockBatch.objects.none(), pk=pk)
    else:
        require_action(user, "batches", "edit_own")
        batch = get_object_or_404(scope_reviewer_queryset(LivestockBatch.objects.select_for_update(of=("self",)), request.user), pk=pk)

    if batch.status != LivestockBatch.StatusType.ACTIVE:
        return Response(
            {"error": "Animals can only be added to an ACTIVE batch."},
            status=status.HTTP_409_CONFLICT,
        )
    if batch.animals.exclude(status=LivestockInventory.StatusType.PENDING).exists():
        return Response(
            {"error": "Animals can only be added before herd verification begins."},
            status=status.HTTP_409_CONFLICT,
        )

    animals_data = request.data.get("animals", [])
    if isinstance(animals_data, dict):
        animals_data = [animals_data]

    for animal in animals_data if isinstance(animals_data, list) else []:
        raw_birth_date = animal.get("birth_date")
        if raw_birth_date:
            birth_date = parse_date(raw_birth_date) if isinstance(raw_birth_date, str) else raw_birth_date
            if birth_date is None:
                return Response({"birth_date": "Use a valid YYYY-MM-DD date."}, status=status.HTTP_400_BAD_REQUEST)
            if birth_date > timezone.localdate():
                return Response({"birth_date": "Birth date cannot be in the future."}, status=status.HTTP_400_BAD_REQUEST)
            animal["birth_date"] = birth_date

    if not animals_data:
        return Response(
            {"error": "No animal data provided in 'animals' list."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    default_animal_status = LivestockInventory.StatusType.PENDING

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
                birth_date=animal.get("birth_date") or None,
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
@transaction.atomic
def batch_review(request, pk):
    """
    POST /api/livestock/batches/<id>/review/
    Review and verify an entire batch and its animal roster:
    - SIBAT: Field inspection of the pen/herd (status = VERIFIED or SUBJECT_TO_REVISION)
    - MAO: Official municipal approval (status = APPROVED or SUBJECT_TO_REVISION)
    """
    batch = get_object_or_404(scope_reviewer_queryset(LivestockBatch.objects.select_for_update(of=("self",)), request.user), pk=pk)
    if batch.status != LivestockBatch.StatusType.ACTIVE:
        return Response(
            {"error": "Only active herds can enter validation."},
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
    user_role = require_action(user, "batches", "review")
    current_statuses = set(batch.animals.values_list("status", flat=True))
    if not current_statuses:
        return Response(
            {"error": "An empty batch cannot be reviewed."},
            status=status.HTTP_409_CONFLICT,
        )
    if len(current_statuses) != 1:
        return Response(
            {"error": "All animals in a batch must have the same review status before batch review."},
            status=status.HTTP_409_CONFLICT,
        )
    current_status = current_statuses.pop()
    validate_review_transition(
        domain="batches",
        role=user_role,
        current=current_status,
        target=new_status,
        remarks=remarks,
    )

    with transaction.atomic():
        batch.animals.all().update(
            status=new_status,
            reviewed_by=user,
            reviewed_at=timezone.now(),
            review_remarks=remarks,
        )
        if remarks:
            timestamp_str = timezone.localtime().strftime("%Y-%m-%d %H:%M")
            reviewer_title = (
                f"SIBAT Verification ({user.get_full_name() or user.username})"
                if user_role == "SIBAT"
                else f"MAO Approval ({user.get_full_name() or user.username})"
            )
            audit_entry = f"\n[{timestamp_str}] {reviewer_title} - {new_status}: {remarks}"
            batch.notes = (batch.notes + audit_entry).strip() # append the previous note
            batch.save(update_fields=["notes", "updated_at"]) # saves only this 2


    if new_status == "SUBJECT_TO_REVISION":
        notify_review_revision(batch.farmer, request.user,
            title="Revision required: batch #" + str(batch.pk), message=remarks, link="/sibat")
    if new_status == LivestockInventory.StatusType.VERIFIED:
        notify_role(
            role_name="MAO",
            notification_type=Notification.NotificationType.GENERAL,
            priority=Notification.Priority.MEDIUM,
            title="Livestock Herd Awaiting MAO Approval",
            message=(
                f"SIBAT verified herd {batch.batch_code} with "
                f"{batch.animals.count()} animal(s)."
            ),
            link=f"/data-validation/batches?batchId={batch.pk}",
        )

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
                title="Herd Verified by SIBAT",
                message=f"Your {species_name} batch [{batch_info}] has been verified on-farm by SIBAT.{f' Remarks: {remarks}' if remarks else ''}",
                link="/livestock-inventory/batches",
            )
        elif new_status == LivestockInventory.StatusType.APPROVED:
            create_notification(
                user=target_user,
                notification_type=Notification.NotificationType.GENERAL,
                priority=Notification.Priority.MEDIUM,
                title="Herd Approved by MAO",
                message=f"Official certification approved for your {species_name} batch [{batch_info}].",
                link="/livestock-inventory/batches",
            )
        elif new_status == LivestockInventory.StatusType.SUBJECT_TO_REVISION:
            create_notification(
                user=target_user,
                notification_type=Notification.NotificationType.GENERAL,
                priority=Notification.Priority.HIGH,
                title="Revision Required on Herd",
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


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def batch_add_notes(request, pk):
    """
    POST /api/livestock/batches/<id>/notes/
    Append a timestamped reviewer note to the batch audit trail.
    Allowed for SIBAT / MAO / ADMIN reviewers only.
    """
    user = request.user
    user_role = role_name(user)
    if user_role != "ADMIN":
        require_action(user, "batches", "review")

    batch = get_object_or_404(scope_reviewer_queryset(LivestockBatch.objects.select_for_update(of=("self",)), request.user), pk=pk)

    text = request.data.get("text", "").strip()
    if not text:
        return Response(
            {"error": "Note text is required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    timestamp_str = timezone.localtime().strftime("%Y-%m-%d %H:%M")
    reviewer_title = (
        f"SIBAT Verification ({user.get_full_name() or user.username})"
        if user_role == "SIBAT"
        else f"MAO Approval ({user.get_full_name() or user.username})"
    )
    audit_entry = f"\n[{timestamp_str}] {reviewer_title} - Note: {text}"
    batch.notes = (batch.notes + audit_entry).strip()
    batch.save(update_fields=["notes", "updated_at"])
    create_notification(batch.farmer.user, title="New herd review note",
                        message=text, link="/livestock-inventory/batches")

    serializer = LivestockBatchSerializer(batch, context={"request": request})
    return Response(
        {
            "message": "Note added to batch audit trail.",
            "batch": serializer.data,
        },
        status=status.HTTP_200_OK,
    )

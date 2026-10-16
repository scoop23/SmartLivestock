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
from rest_framework.exceptions import ValidationError

from livestock.models import LivestockBatch, LivestockInventory, LivestockType, LivestockBatchPhoto
from livestock.list_queries import LivestockListPagination, batch_list_annotations, filter_livestock_list
from livestock.serializer import (
    LivestockBatchListSerializer,
    LivestockBatchPhotoUpdateSerializer,
    LivestockBatchSerializer,
    LivestockInventorySerializer,
    validate_livestock_tag,
)
from users.models import Notification
from users.notification_views import create_notification, notify_role, notify_review_revision
from smartlivestock.workflows import (
    require_action,
    role_name,
    validate_batch_lifecycle,
    validate_review_transition,
)


def _validate_roster_tags(animals_data, user):
    """Validate existing and within-request ear tags before creating any roster rows."""
    seen_tags = set()
    for index, animal in enumerate(animals_data):
        if not isinstance(animal, dict):
            raise ValidationError({"animals": f"Animal row {index + 1} must be an object."})
        tag = str(animal.get("tag_number") or "").strip()
        animal["tag_number"] = tag
        if not tag:
            raise ValidationError({"animals": f"Ear tag is required for animal row {index + 1}."})
        normalized_tag = tag.casefold()
        if normalized_tag in seen_tags:
            raise ValidationError({"animals": f"Ear tag {tag} appears more than once in this submission."})
        seen_tags.add(normalized_tag)
        try:
            validate_livestock_tag(tag, user)
        except ValidationError as error:
            raise ValidationError({"animals": f"Row {index + 1}: {error.detail['tag_number'][0]}"}) from error


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

        if isinstance(animals_data, list):
            try:
                _validate_roster_tags(animals_data, farmer_profile.user)
            except ValidationError as error:
                return Response(error.detail, status=status.HTTP_400_BAD_REQUEST)

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
        created_animals = []

        uploaded_photos = request.FILES.getlist("photos") or request.FILES.getlist("photo")
        batch_photo = uploaded_photos[0] if uploaded_photos else request.FILES.get("photo")
        if not batch_photo and data.get("photo") and hasattr(data.get("photo"), "read"):
            batch_photo = data.get("photo")

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
                photo=None,
                status=LivestockBatch.StatusType.ACTIVE,
                notes=data.get("notes", ""),
                created_by=user,
            )

            if uploaded_photos:
                for idx, p_file in enumerate(uploaded_photos):
                    photo_obj = LivestockBatchPhoto.objects.create(batch=batch, photo=p_file)
                    if idx == 0:
                        batch.photo.name = photo_obj.photo.name
                batch.save(update_fields=["photo"])
            elif batch_photo:
                batch.photo = batch_photo
                batch.save(update_fields=["photo"])

            # If animals roster is supplied, create individual LivestockInventory items
            if animals_data and isinstance(animals_data, list):
                for animal in animals_data:
                    created_animals.append(LivestockInventory.objects.create(
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
                    ))

        serializer = LivestockBatchSerializer(batch, context={"request": request})
        farmer_name = user.get_full_name() or user.username
        for animal in created_animals:
            animal_name = animal.tag_number or animal.livestock_type.name
            notify_role(
                barangay_id=batch.farmer.barangay_id,
                role_name="SIBAT",
                notification_type=Notification.NotificationType.SIBAT,
                priority=Notification.Priority.MEDIUM,
                title="Livestock Awaiting Verification",
                message=f"{farmer_name} registered {animal_name} in herd {batch.batch_code}.",
                link=f"/sibat?tab=inventory&reviewType=INVENTORY&reviewId={animal.pk}",
                related_entity_type="livestock_inventory",
                related_entity_id=animal.pk,
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

    batches = batches.select_related("livestock_type", "farmer__user", "farmer__barangay").prefetch_related("gallery_photos")
    include_roster = request.query_params.get("include_roster") == "true" or request.query_params.get("full") == "true"

    if request.query_params.get("summary") == "true":
        batches = batch_list_annotations(batches)
        batches = filter_livestock_list(batches, request.query_params, batch=True)
        pager = LivestockListPagination()
        records = pager.paginate_queryset(batches.order_by("-created_at", "-pk"), request)
        response = pager.get_paginated_response(LivestockBatchListSerializer(records, many=True, context={"request": request}).data)
        # These counts describe the filtered set, not just the current page.
        response.data["summary"] = batches.aggregate(
            totalAnimals=Sum("active_animal_count"), totalHerds=Count("id"),
            pendingAnimals=Sum("pending_animal_count"), verifiedAnimals=Sum("verified_animal_count"),
            approvedAnimals=Sum("approved_animal_count"), revisionAnimals=Sum("revision_animal_count"),
            rejectedAnimals=Sum("rejected_animal_count"),
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


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def batch_lookup(request):
    """Resolve a batch QR identifier inside the caller's existing batch scope."""
    user = request.user
    user_role = role_name(user)
    code = request.query_params.get("code", "").strip()
    if code.upper().startswith("SL-BATCH:"):
        code = code.split(":", 1)[1].strip()
    if not code or len(code) > 255:
        return Response({"detail": "A valid batch code or ID is required."}, status=status.HTTP_400_BAD_REQUEST)

    batches = LivestockBatch.objects.select_related(
        "livestock_type", "farmer__user", "farmer__barangay"
    ).prefetch_related("animals__reviewed_by__role")
    if user_role == "FARMER":
        farmer_profile = getattr(user, "farmer_profile", None)
        batches = batches.filter(farmer=farmer_profile) if farmer_profile else batches.none()
    else:
        require_action(user, "batches", "read_all")
        batches = scope_reviewer_queryset(batches, user)

    # Query the authorized queryset first, so an out-of-scope code is indistinguishable
    # from an unknown code and cannot reveal another barangay's herd.
    if code.isdigit():
        batch = batches.filter(pk=int(code)).first()
    else:
        matches = list(batches.filter(batch_code__iexact=code)[:2])
        if len(matches) > 1:
            return Response({"detail": "This batch code is ambiguous."}, status=status.HTTP_409_CONFLICT)
        batch = matches[0] if matches else None
    if batch is None:
        return Response({"detail": "No batch with that code or ID is available in your authorized scope."}, status=status.HTTP_404_NOT_FOUND)

    return Response(
        LivestockBatchSerializer(batch, context={"request": request}).data,
        status=status.HTTP_200_OK,
    )


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
        batch = LivestockBatch.objects.select_related("livestock_type", "farmer__user", "farmer__barangay").prefetch_related("animals__reviewed_by__role", "gallery_photos").get(pk=batch.pk)
        serializer = LivestockBatchSerializer(batch, context={"request": request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    if request.method in ["PUT", "PATCH"]:
        require_action(user, "batches", "edit_own")
        data = request.data
        action = data.get("action")
        if request.method == "PATCH" and action == "replace_photo":
            new_file = request.FILES.get("photo") or request.FILES.get("file")
            if not new_file:
                return Response({"error": "No replacement photo file was provided."}, status=status.HTTP_400_BAD_REQUEST)
            try:
                replace_idx = int(data.get("replace_index", 0))
            except (ValueError, TypeError):
                replace_idx = 0

            gallery = list(batch.gallery_photos.all())
            if gallery and 0 <= replace_idx < len(gallery):
                target_obj = gallery[replace_idx]
                target_obj.photo = new_file
                target_obj.save(update_fields=["photo"])
                if replace_idx == 0:
                    batch.photo.name = target_obj.photo.name
                    batch.save(update_fields=["photo", "updated_at"])
            else:
                if not gallery and batch.photo:
                    first_p = LivestockBatchPhoto.objects.create(batch=batch, photo=new_file)
                    batch.photo.name = first_p.photo.name
                    batch.save(update_fields=["photo", "updated_at"])
                else:
                    new_p = LivestockBatchPhoto.objects.create(batch=batch, photo=new_file)
                    if not batch.photo or replace_idx == 0:
                        batch.photo.name = new_p.photo.name
                        batch.save(update_fields=["photo", "updated_at"])
            return Response(LivestockBatchSerializer(batch, context={"request": request}).data)

        if request.method == "PATCH" and action == "add_photo":
            files = request.FILES.getlist("photos") or request.FILES.getlist("photo")
            if not files and request.FILES.get("photo"):
                files = [request.FILES.get("photo")]
            if not files:
                return Response({"error": "No photo file provided to add."}, status=status.HTTP_400_BAD_REQUEST)
            if not batch.gallery_photos.exists() and batch.photo:
                LivestockBatchPhoto.objects.create(batch=batch, photo=batch.photo.name)
            for p_file in files:
                photo_obj = LivestockBatchPhoto.objects.create(batch=batch, photo=p_file)
                if not batch.photo:
                    batch.photo.name = photo_obj.photo.name
                    batch.save(update_fields=["photo", "updated_at"])
            return Response(LivestockBatchSerializer(batch, context={"request": request}).data)

        if request.method == "PATCH" and action == "delete_photo":
            try:
                delete_idx = int(data.get("delete_index", 0))
            except (ValueError, TypeError):
                delete_idx = 0
            gallery = list(batch.gallery_photos.all())
            if gallery and 0 <= delete_idx < len(gallery):
                target_obj = gallery[delete_idx]
                target_obj.delete()
            elif not gallery and batch.photo and delete_idx == 0:
                batch.photo = None
                batch.save(update_fields=["photo", "updated_at"])
            remaining = batch.gallery_photos.first()
            if remaining:
                batch.photo.name = remaining.photo.name
            else:
                batch.photo = None
            batch.save(update_fields=["photo", "updated_at"])
            return Response(LivestockBatchSerializer(batch, context={"request": request}).data)

        if request.method == "PATCH" and uploaded_photos:
            for idx, p_file in enumerate(uploaded_photos):
                photo_obj = LivestockBatchPhoto.objects.create(batch=batch, photo=p_file)
                if not batch.photo and idx == 0:
                    batch.photo.name = photo_obj.photo.name
                    batch.save(update_fields=["photo", "updated_at"])
            return Response(LivestockBatchSerializer(batch, context={"request": request}).data)
        if request.method == "PATCH" and data and set(data.keys()) == {"photo"}:
            photo_serializer = LivestockBatchPhotoUpdateSerializer(
                batch, data=data, partial=True, context={"request": request}
            )
            photo_serializer.is_valid(raise_exception=True)
            batch = photo_serializer.save()
            return Response(LivestockBatchSerializer(batch, context={"request": request}).data)
        resubmit = str(data.get("resubmit", "")).lower() in {"true", "1"}
        if resubmit:
            return Response(
                {"error": "Herds are grouping containers. Correct and resubmit each returned animal from its individual record."},
                status=status.HTTP_410_GONE,
            )
        if set(data) - {"status"} and batch.status != LivestockBatch.StatusType.ACTIVE:
            return Response(
                {"error": "Only active herd grouping details can be changed."},
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
    # The marker is retained as historical metadata for older reports. It no
    # longer changes review rules: every animal starts pending and is reviewed
    # individually, regardless of the statuses of its herd-mates.
    is_post_approval_addition = batch.animals.filter(
        status=LivestockInventory.StatusType.APPROVED
    ).exists()

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

    try:
        _validate_roster_tags(animals_data, batch.farmer.user)
    except ValidationError as error:
        return Response(error.detail, status=status.HTTP_400_BAD_REQUEST)

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
                is_post_approval_addition=is_post_approval_addition,
            )
            created_animals.append(created)

            animal_label = created.tag_number or created.livestock_type.name
            notify_role(
                barangay_id=batch.farmer.barangay_id,
                role_name="SIBAT",
                notification_type=Notification.NotificationType.SIBAT,
                priority=Notification.Priority.MEDIUM,
                title="New Herd Animal Awaiting Verification",
                message=(
                    f"{animal_label} was added to {batch.batch_code} and needs individual SIBAT verification."
                    if is_post_approval_addition
                    else f"{animal_label} was added to {batch.batch_code} before herd verification."
                ),
                link=f"/sibat?tab=inventory&reviewType=INVENTORY&reviewId={created.pk}",
                related_entity_type="livestock_inventory",
                related_entity_id=created.pk,
            )

    serializer = LivestockInventorySerializer(
        created_animals, many=True, context={"request": request}
    )
    return Response(
        {
            "message": (
                f"Added {len(created_animals)} animal(s) to {batch.batch_code}. Each starts pending its own SIBAT and MAO review."
            ),
            "animals": serializer.data,
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def batch_review(request, pk):
    """Deprecated endpoint: herd containers cannot be reviewed or approved."""
    return Response(
        {"error": "Herds are grouping containers. Review each animal at livestock/inventory/<id>/review/."},
        status=status.HTTP_410_GONE,
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

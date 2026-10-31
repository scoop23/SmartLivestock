import re
import unicodedata

from rest_framework import serializers
from rest_framework.fields import SerializerMethodField
from rest_framework.relations import PrimaryKeyRelatedField
from django.utils import timezone
from livestock.services import CensusService  # type: ignore
from .models import (
    Barangay,
    Farmer,
    LivestockBatch,
    LivestockBatchPhoto,
    LivestockHerdMembershipHistory,
    LivestockInventory,
    LivestockInventoryReviewHistory,
    LivestockOwnershipTransfer,
    LivestockType,
    CensusSubmission,
    CensusSubmissionItem,
)
from smartlivestock.workflows import role_name


MAX_LIVESTOCK_PHOTO_BYTES = 5 * 1024 * 1024
ALLOWED_LIVESTOCK_PHOTO_TYPES = {"image/jpeg", "image/png", "image/webp"}


def livestock_tag_prefix_for_user(user):
    """Build the stable name prefix used by that user's registered animal tags."""
    display_name = f"{user.first_name or ''} {user.last_name or ''}".strip() or user.username
    ascii_name = unicodedata.normalize("NFKD", display_name).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^A-Z0-9]+", "-", ascii_name.upper()).strip("-")


def validate_livestock_tag(tag_number, user, *, exclude_pk=None):
    """Enforce the owner's NAME-001 tag pattern or a valid custom tag, and reject reused identities."""
    normalized_tag = (tag_number or "").strip()
    if not normalized_tag:
        return

    expected_prefix = livestock_tag_prefix_for_user(user)
    is_standard = bool(expected_prefix and re.fullmatch(rf"{re.escape(expected_prefix)}-\d{{3,}}", normalized_tag, re.IGNORECASE))
    is_valid_custom = bool(re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9\-_]{1,49}", normalized_tag))

    if not (is_standard or is_valid_custom):
        raise serializers.ValidationError({
            "tag_number": f"Enter a valid ear tag (e.g., {expected_prefix or 'NAME'}-001 or a custom name like BESSIE-001)."
        })

    existing_animals = LivestockInventory.objects.filter(tag_number__iexact=normalized_tag)
    if exclude_pk is not None:
        existing_animals = existing_animals.exclude(pk=exclude_pk)
    if existing_animals.exists():
        raise serializers.ValidationError(
            {"tag_number": "This ear tag is already in use. Please enter a different ear tag."}
        )


class LivestockPhotoField(serializers.ImageField):
    """Reject oversized or unsupported uploads before Pillow decodes them."""

    def to_internal_value(self, data):
        if data is not None:
            if getattr(data, "size", 0) <= 0:
                raise serializers.ValidationError("Choose a non-empty image file.")
            if data.size > MAX_LIVESTOCK_PHOTO_BYTES:
                raise serializers.ValidationError("Livestock photos must be 5 MB or smaller.")
            if getattr(data, "content_type", "").lower() not in ALLOWED_LIVESTOCK_PHOTO_TYPES:
                raise serializers.ValidationError("Use a JPEG, PNG, or WebP image.")
        return super().to_internal_value(data)

    def to_representation(self, value):
        # R2 signs private media URLs during serialization. A storage outage or
        # bad R2 configuration should hide that image, not break the animal or
        # herd API response that contains it.
        try:
            return super().to_representation(value)
        except Exception:
            return None


def validate_livestock_photo_upload(photo):
    if photo is None:
        return photo
    if photo.size <= 0:
        raise serializers.ValidationError("Choose a non-empty image file.")
    if photo.size > MAX_LIVESTOCK_PHOTO_BYTES:
        raise serializers.ValidationError("Livestock photos must be 5 MB or smaller.")
    if getattr(photo, "content_type", "").lower() not in ALLOWED_LIVESTOCK_PHOTO_TYPES:
        raise serializers.ValidationError("Use a JPEG, PNG, or WebP image.")
    # DRF ImageField decodes the image with Pillow, so a spoofed MIME type or
    # malformed image is rejected before it reaches the configured media storage.
    return photo


class LivestockPhotoUpdateSerializer(serializers.Serializer):
    """Restrict approved-record photo changes to the media fields only."""

    photo = LivestockPhotoField(required=False, allow_null=True)
    left_side_photo = LivestockPhotoField(required=False, allow_null=True)
    right_side_photo = LivestockPhotoField(required=False, allow_null=True)
    avatar_key = serializers.CharField(required=False, allow_blank=True, max_length=50)

    def validate_photo(self, value):
        return validate_livestock_photo_upload(value)

    def validate_left_side_photo(self, value):
        return validate_livestock_photo_upload(value)

    def validate_right_side_photo(self, value):
        return validate_livestock_photo_upload(value)

    def update(self, instance, validated_data):
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save(update_fields=list(validated_data.keys()))
        return instance


class LivestockBatchPhotoUpdateSerializer(serializers.Serializer):
    """Validate and update a batch's single group photo without editing herd data."""

    photo = LivestockPhotoField(required=False, allow_null=True)

    def validate_photo(self, value):
        return validate_livestock_photo_upload(value)

    def update(self, instance, validated_data):
        instance.photo = validated_data["photo"]
        instance.save(update_fields=["photo", "updated_at"])
        return instance


class BarangaySerializer(serializers.ModelSerializer):
    """
    Returns:
        Basic barangay geographic metadata:
        - id: Unique barangay database identifier
        - barangay_name: Official name of the barangay in Padre Garcia
    Used in:
        Barangay dropdown selectors for registration, census reporting, and admin filters.
    """
    class Meta:
        model = Barangay
        fields = [
            "id",
            "barangay_name",
        ]


class LivestockInventoryReviewHistorySerializer(serializers.ModelSerializer):
    reviewer_name = serializers.SerializerMethodField()

    class Meta:
        model = LivestockInventoryReviewHistory
        fields = ("id", "reviewer_name", "reviewer_role", "status", "remarks", "reviewed_at", "is_backfilled")
        read_only_fields = fields

    def get_reviewer_name(self, obj):
        name = obj.reviewer.get_full_name().strip()
        return name or obj.reviewer.username


class LivestockHerdMembershipHistorySerializer(serializers.ModelSerializer):
    action_label = serializers.CharField(source="get_action_display", read_only=True)
    previous_batch_code = serializers.CharField(
        source="previous_batch.batch_code", read_only=True, allow_null=True
    )
    previous_batch_name = serializers.CharField(
        source="previous_batch.batch_name", read_only=True, allow_null=True
    )
    new_batch_code = serializers.CharField(
        source="new_batch.batch_code", read_only=True, allow_null=True
    )
    new_batch_name = serializers.CharField(
        source="new_batch.batch_name", read_only=True, allow_null=True
    )
    acted_by_name = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = LivestockHerdMembershipHistory
        fields = (
            "id",
            "action",
            "action_label",
            "previous_batch",
            "previous_batch_code",
            "previous_batch_name",
            "new_batch",
            "new_batch_code",
            "new_batch_name",
            "acted_by",
            "acted_by_name",
            "notes",
            "created_at",
        )
        read_only_fields = fields

    def get_acted_by_name(self, obj):
        try:
            name = obj.acted_by.get_full_name().strip()
            return name or obj.acted_by.username
        except Exception:
            return "Farmer"


class LivestockInventorySerializer(serializers.Serializer):
    """
    Returns:
        Complete individual animal passport or herd entry with resolved relationships:
        - Identity: id, tag_number, breed, sex, weight, portrait and left/right side photos, avatar_key
        - Farmer & Barangay: farmer (ID), farmer_name (full name/username), barangay_name, barangay_id
        - Herd Group: batch (ID), batch_code, batch_name (null if independent animal)
        - Classification: livestock_type (ID), livestock_type_name, entry_type (INDIVIDUAL/BATCH), quantity
        - Lifecycle: last_vaccination_date, created_at
        - Review & Audit: status (PENDING/VERIFIED/APPROVED/SUBJECT_TO_REVISION),
          review_remarks, reviewed_at, reviewed_by_name (full name of MAO/SIBAT officer)
    Used in:
        Farmer livestock inventory list & detail, MAO/SIBAT validation ledger, and animal registration.
    """
    id = serializers.IntegerField(read_only=True)
    farmer = serializers.PrimaryKeyRelatedField(read_only=True)
    farmer_name = serializers.SerializerMethodField(read_only=True)
    barangay_name = serializers.CharField(
        source="farmer.barangay.barangay_name", read_only=True
    )
    barangay_id = serializers.IntegerField(
        source="farmer.barangay.id", read_only=True
    )
    batch = serializers.PrimaryKeyRelatedField(
        queryset=LivestockBatch.objects.all(), required=False, allow_null=True
    )
    batch_code = serializers.CharField(
        source="batch.batch_code", read_only=True, allow_null=True
    )
    batch_name = serializers.CharField(
        source="batch.batch_name", read_only=True, allow_null=True
    )
    batch_target_weight = serializers.DecimalField(
        source="batch.target_weight",
        max_digits=6,
        decimal_places=2,
        read_only=True,
        allow_null=True,
    )
    livestock_type = serializers.PrimaryKeyRelatedField(
        queryset=LivestockType.objects.all()
    )
    livestock_type_name = serializers.CharField(
        source="livestock_type.name", read_only=True
    )
    entry_type = serializers.ChoiceField(choices=LivestockInventory.EntryType.choices)
    quantity = serializers.IntegerField(min_value=1, default=1)
    birth_date = serializers.DateField(required=False, allow_null=True)
    age = serializers.SerializerMethodField(read_only=True)
    age_classification = serializers.SerializerMethodField(read_only=True)
    tag_number = serializers.CharField(max_length=50, required=False, allow_blank=True, default="")
    ownership_certificate_number = serializers.CharField(read_only=True)
    breed = serializers.CharField(max_length=50, required=False, allow_blank=True, default="")
    sex = serializers.CharField(max_length=10, required=False, allow_blank=True, default="")
    weight = serializers.DecimalField(
        max_digits=6, decimal_places=2, required=False, allow_null=True
    )
    photo = LivestockPhotoField(required=False, allow_null=True)
    left_side_photo = LivestockPhotoField(required=False, allow_null=True)
    right_side_photo = LivestockPhotoField(required=False, allow_null=True)
    photo_url = serializers.SerializerMethodField(read_only=True)
    left_side_photo_url = serializers.SerializerMethodField(read_only=True)
    right_side_photo_url = serializers.SerializerMethodField(read_only=True)
    avatar_key = serializers.CharField(
        max_length=50, required=False, allow_blank=True, default=""
    )
    last_vaccination_date = serializers.DateField(required=False, allow_null=True)
    status = serializers.CharField(max_length=25, read_only=True)
    operational_status = serializers.CharField(max_length=20, read_only=True)
    operational_status_changed_at = serializers.DateTimeField(read_only=True, allow_null=True)
    is_post_approval_addition = serializers.BooleanField(read_only=True)
    review_remarks = serializers.CharField(read_only=True, allow_null=True)
    reviewed_at = serializers.DateTimeField(read_only=True, allow_null=True)
    reviewed_by_role = serializers.CharField(source="reviewed_by.role.role_name", read_only=True, allow_null=True)
    reviewed_by_name = serializers.SerializerMethodField(read_only=True)
    review_history = LivestockInventoryReviewHistorySerializer(many=True, read_only=True)
    herd_membership_history = LivestockHerdMembershipHistorySerializer(many=True, read_only=True)
    created_at = serializers.DateTimeField(read_only=True)

    def get_farmer_name(self, obj):
        try:
            user = obj.farmer.user
            full_name = user.get_full_name().strip()
            return full_name if full_name else user.username
        except Exception:
            return "Unknown Farmer"

    def get_age(self, obj):
        return obj.age_as_of(timezone.localdate())

    def get_age_classification(self, obj):
        return obj.age_classification_as_of(timezone.localdate())

    def validate_birth_date(self, value):
        if value and value > timezone.localdate():
            raise serializers.ValidationError("Birth date cannot be in the future.")
        return value

    def get_reviewed_by_name(self, obj):
        try:
            if obj.reviewed_by:
                full_name = obj.reviewed_by.get_full_name().strip()
                return full_name if full_name else obj.reviewed_by.username
        except Exception:
            pass
        return None

    def get_photo_url(self, obj):
        return self._get_image_url(obj.photo)

    def get_left_side_photo_url(self, obj):
        return self._get_image_url(obj.left_side_photo)

    def get_right_side_photo_url(self, obj):
        return self._get_image_url(obj.right_side_photo)

    def _get_image_url(self, image):
        if image:
            try:
                request = self.context.get("request")
                if request:
                    return request.build_absolute_uri(image.url)
                return image.url
            except Exception:
                return None
        return None

    def validate_photo(self, value):
        return validate_livestock_photo_upload(value)

    def validate_left_side_photo(self, value):
        return validate_livestock_photo_upload(value)

    def validate_right_side_photo(self, value):
        return validate_livestock_photo_upload(value)

    def validate(self, attrs):
        user = self.context["request"].user
        farmer = getattr(user, "farmer_profile", None) or (self.instance and self.instance.farmer)
        if farmer is None:
            raise serializers.ValidationError("A farmer profile is required.")

        # Ear tags identify animals across review states, so pending and approved
        # records both reserve the tag instead of allowing a duplicate identity.
        entry_type = attrs.get("entry_type", self.instance.entry_type if self.instance else "INDIVIDUAL")
        if not self.instance or "tag_number" in attrs:
            tag_number = attrs.get("tag_number", "").strip()
            attrs["tag_number"] = tag_number
            if entry_type == "INDIVIDUAL" and not tag_number:
                raise serializers.ValidationError({"tag_number": "An ear tag is required for each individual animal."})
            validate_livestock_tag(
                tag_number,
                user,
                exclude_pk=self.instance.pk if self.instance else None,
            )

        quantity = attrs.get("quantity", self.instance.quantity if self.instance else 1)
        if entry_type == "INDIVIDUAL" and quantity != 1:
            raise serializers.ValidationError({"quantity": "An individual animal must represent exactly one head."})

        batch = attrs.get("batch", self.instance.batch if self.instance else None)
        if batch and (entry_type != "INDIVIDUAL" or quantity != 1):
            raise serializers.ValidationError({"quantity": "Herd members must be individual animals with one head each."})
        if self.instance and "batch" in attrs and self.instance.operational_status != LivestockInventory.OperationalStatus.ACTIVE:
            raise serializers.ValidationError({"batch": "Only active livestock can be assigned to, moved between, or removed from a herd."})
        if batch:
            batch = LivestockBatch.objects.select_for_update().get(pk=batch.pk)
            if batch.farmer_id != farmer.pk:  # type: ignore[attr-defined]
                raise serializers.ValidationError({"batch": "This herd belongs to another farmer."})
            if batch.status != LivestockBatch.StatusType.ACTIVE:
                raise serializers.ValidationError({"batch": "This herd is no longer active."})
            livestock_type = attrs.get(
                "livestock_type", self.instance.livestock_type if self.instance else None
            )
            if livestock_type and livestock_type.pk != batch.livestock_type.pk:
                raise serializers.ValidationError(
                    {"livestock_type": "The animal species must match its herd."}
                )
            # Review belongs to each animal row. Any animal may join an active
            # herd; its own status remains PENDING until SIBAT reviews it.
        return attrs

    def create(self, validated_data):
        user = self.context["request"].user
        validated_data["created_by"] = user
        validated_data["farmer"] = user.farmer_profile
        instance = LivestockInventory.objects.create(**validated_data)
        if instance.batch_id:
            LivestockHerdMembershipHistory.objects.create(
                livestock=instance,
                previous_batch=None,
                new_batch=instance.batch,
                action=LivestockHerdMembershipHistory.ActionType.ADDED,
                acted_by=user,
                notes="Assigned to herd upon registration.",
            )
        return instance

    def update(self, instance, validated_data):
        previous_batch = instance.batch if instance.batch_id else None
        allowed = [
            "batch",
            "livestock_type",
            "entry_type",
            "quantity",
            "birth_date",
            "tag_number",
            "breed",
            "sex",
            "weight",
            "photo",
            "left_side_photo",
            "right_side_photo",
            "avatar_key",
            "last_vaccination_date",
        ]
        for field in allowed:
            if field in validated_data:
                setattr(instance, field, validated_data[field])
        instance.save()

        new_batch = instance.batch if instance.batch_id else None
        prev_id = previous_batch.pk if previous_batch else None
        new_id = new_batch.pk if new_batch else None
        if prev_id != new_id:
            user = self.context["request"].user
            if prev_id is None and new_id is not None:
                action = LivestockHerdMembershipHistory.ActionType.ADDED
            elif prev_id is not None and new_id is not None:
                action = LivestockHerdMembershipHistory.ActionType.MOVED
            else:
                action = LivestockHerdMembershipHistory.ActionType.REMOVED
            LivestockHerdMembershipHistory.objects.create(
                livestock=instance,
                previous_batch=previous_batch,
                new_batch=new_batch,
                action=action,
                acted_by=user,
            )

        return instance


class BatchChildAnimalSerializer(serializers.ModelSerializer):
    """
    Returns:
        Lightweight child animal roster entry nested inside a parent batch:
        - Identification: id, tag_number, breed, sex, weight, avatar_key
        - Media: photo, photo_url (resolved full media URI)
        - Medical & Status: last_vaccination_date, status (PENDING/VERIFIED/APPROVED/SUBJECT_TO_REVISION)
        - Audit trail: review_remarks, reviewed_by_name (resolved reviewer string), reviewed_at, created_at
    Used in:
        Nested `animals` array of LivestockBatchSerializer for batch rosters and individual inspection.
    """
    photo = LivestockPhotoField(read_only=True)
    photo_url = serializers.SerializerMethodField(read_only=True)
    reviewed_by_role = serializers.CharField(source="reviewed_by.role.role_name", read_only=True, allow_null=True)
    reviewed_by_name = serializers.SerializerMethodField(read_only=True)
    age = serializers.SerializerMethodField(read_only=True)
    age_classification = serializers.SerializerMethodField(read_only=True)

    def get_age(self, obj):
        return obj.age_as_of(timezone.localdate())

    def get_age_classification(self, obj):
        return obj.age_classification_as_of(timezone.localdate())

    class Meta:
        model = LivestockInventory
        fields = [
            "id",
            "tag_number",
            "breed",
            "sex",
            "birth_date",
            "age",
            "age_classification",
            "weight",
            "photo",
            "photo_url",
            "avatar_key",
            "last_vaccination_date",
            "status",
            "operational_status",
            "operational_status_changed_at",
            "is_post_approval_addition",
            "review_remarks",
            "reviewed_by_name",
            "reviewed_by_role",
            "reviewed_at",
            "created_at",
        ]

    def get_reviewed_by_name(self, obj):
        try:
            if obj.reviewed_by:
                full_name = obj.reviewed_by.get_full_name().strip()
                return full_name if full_name else obj.reviewed_by.username
        except Exception:
            pass
        return None

    def get_photo_url(self, obj):
        if obj.photo:
            try:
                request = self.context.get("request")
                if request:
                    return request.build_absolute_uri(obj.photo.url)
                return obj.photo.url
            except Exception:
                return None
        return None


class LivestockBatchSerializer(serializers.ModelSerializer):
    """
    Returns:
        Full herd record with aggregated statistics and child animal roster:
        - Batch Identifiers: id, batch_name, batch_code, housing_pen, feed_type
        - Production Targets: target_weight, target_harvest_date, status, notes
        - Farmer & Barangay: farmer (ID), farmer_name, barangay_id, barangay_name
        - Computed Aggregates: total_animals (head count), average_weight (mean kg of herd)
        - Nested Roster: animals (list of BatchChildAnimalSerializer)
        - Calculated per-animal review counts; the batch itself has no review status.
    Used in:
        Herd grouping views. Individual animal review uses LivestockInventorySerializer.
    """
    photo = LivestockPhotoField(required=False, allow_null=True)
    farmer = serializers.PrimaryKeyRelatedField(read_only=True)
    farmer_name = serializers.SerializerMethodField(read_only=True)
    barangay_name = serializers.SerializerMethodField(read_only=True)
    barangay_id = serializers.SerializerMethodField(read_only=True)
    livestock_type_name = serializers.CharField(
        source="livestock_type.name", read_only=True
    )
    total_animals = serializers.IntegerField(read_only=True)
    average_weight = serializers.DecimalField(
        max_digits=6, decimal_places=2, read_only=True
    )
    animals = serializers.SerializerMethodField(read_only=True)
    review_status = serializers.SerializerMethodField(read_only=True)
    pending_animals = serializers.SerializerMethodField(read_only=True)
    verified_animals = serializers.SerializerMethodField(read_only=True)
    approved_animals = serializers.SerializerMethodField(read_only=True)
    revision_animals = serializers.SerializerMethodField(read_only=True)
    rejected_animals = serializers.SerializerMethodField(read_only=True)
    review_remarks = serializers.SerializerMethodField(read_only=True)
    reviewed_by_role = serializers.SerializerMethodField()
    reviewed_by_name = serializers.SerializerMethodField(read_only=True)
    reviewed_at = serializers.SerializerMethodField(read_only=True)
    photo_url = serializers.SerializerMethodField(read_only=True)
    photos = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = LivestockBatch
        fields = [
            "id",
            "farmer",
            "farmer_name",
            "barangay_id",
            "barangay_name",
            "livestock_type",
            "livestock_type_name",
            "batch_name",
            "batch_code",
            "housing_pen",
            "feed_type",
            "target_weight",
            "target_harvest_date",
            "photo",
            "photo_url",
            "photos",
            "status",
            "notes",
            "total_animals",
            "average_weight",
            "animals",
            "review_status",
            "pending_animals",
            "verified_animals",
            "approved_animals",
            "revision_animals",
            "rejected_animals",
            "review_remarks",
            "reviewed_by_name",
            "reviewed_by_role",
            "reviewed_at",
            "created_at",
            "updated_at",
        ]

    def validate_photo(self, value):
        return validate_livestock_photo_upload(value)

    def get_photo_url(self, obj):
        if not obj.photo:
            return None
        try:
            request = self.context.get("request")
            url = obj.photo.url
            return request.build_absolute_uri(url) if request else url
        except Exception:
            return None

    def get_photos(self, obj):
        request = self.context.get("request")
        urls = []
        gallery = list(obj.gallery_photos.all())
        if gallery:
            for item in gallery:
                if item.photo:
                    try:
                        url = item.photo.url
                        full_url = request.build_absolute_uri(url) if request else url
                        if full_url not in urls:
                            urls.append(full_url)
                    except Exception:
                        pass
        elif obj.photo:
            try:
                url = obj.photo.url
                urls.append(request.build_absolute_uri(url) if request else url)
            except Exception:
                pass
        return urls

    def get_farmer_name(self, obj):
        try:
            user = obj.farmer.user
            full_name = user.get_full_name().strip()
            return full_name if full_name else user.username
        except Exception:
            return "Unknown Farmer"

    def get_barangay_name(self, obj):
        try:
            return obj.farmer.barangay.barangay_name
        except Exception:
            return "Padre Garcia"

    def get_barangay_id(self, obj):
        try:
            return obj.farmer.barangay.id
        except Exception:
            return None

    def get_animals(self, obj):
        # Use prefetched in-memory animals without breaking prefetch cache via .order_by()
        animals = sorted(
            (animal for animal in obj.animals.all() if animal.entry_type == LivestockInventory.EntryType.INDIVIDUAL),
            key=lambda animal: animal.id,
        )
        return BatchChildAnimalSerializer(animals, many=True, context=self.context).data

    def get_review_status(self, obj):
        # Backward-compatible summary only. No endpoint may use this value to
        # approve the herd or change any animal's review state.
        animals = [animal for animal in obj.animals.all() if animal.entry_type == LivestockInventory.EntryType.INDIVIDUAL]
        if not animals:
            return "NO_ANIMALS"
        statuses = [a.status for a in animals]
        return statuses[0] if len(set(statuses)) == 1 else "MIXED"

    def _count_animals_with_status(self, obj, statuses):
        # Detail responses already prefetch the roster, so this does not issue
        # one query per status. List responses use SQL annotations below.
        return sum(
            animal.entry_type == LivestockInventory.EntryType.INDIVIDUAL and animal.status in statuses
            for animal in obj.animals.all()
        )

    def get_pending_animals(self, obj):
        return self._count_animals_with_status(obj, {"PENDING"})

    def get_verified_animals(self, obj):
        return self._count_animals_with_status(obj, {"VERIFIED"})

    def get_approved_animals(self, obj):
        return self._count_animals_with_status(obj, {"APPROVED"})

    def get_revision_animals(self, obj):
        return self._count_animals_with_status(obj, {"SUBJECT_TO_REVISION", "SUBJECT_FOR_REVISION"})

    def get_rejected_animals(self, obj):
        return self._count_animals_with_status(obj, {"REJECTED"})

    def get_review_remarks(self, obj):
        # A herd has no review decision. Only return a shared note when every
        # reviewed animal has the same remark; mixed individual feedback stays on
        # each animal and is not presented as a herd-level decision.
        reviewed = [
            a.review_remarks.strip()
            for a in obj.animals.all()
            if a.entry_type == LivestockInventory.EntryType.INDIVIDUAL
            and a.review_remarks and a.reviewed_at and a.review_remarks.strip()
        ]
        if reviewed and len(set(reviewed)) == 1:
            return reviewed[0]
        return None

    def get_reviewed_by_role(self, obj):
        # Match the latest reviewed animal used for the herd's reviewer name.
        reviewed = [a for a in obj.animals.all() if a.entry_type == LivestockInventory.EntryType.INDIVIDUAL and a.reviewed_by and a.reviewed_at]
        if not reviewed:
            return None
        reviewer = max(reviewed, key=lambda a: a.reviewed_at).reviewed_by
        return reviewer.role.role_name if reviewer.role else None

    def get_reviewed_by_name(self, obj):
        # In-memory computation
        reviewed = [a for a in obj.animals.all() if a.entry_type == LivestockInventory.EntryType.INDIVIDUAL and a.reviewed_by and a.reviewed_at]
        if reviewed:
            latest = max(reviewed, key=lambda a: a.reviewed_at)
            user = latest.reviewed_by
            full_name = user.get_full_name().strip()
            return full_name if full_name else user.username
        return None

    def get_reviewed_at(self, obj):
        # In-memory computation
        reviewed = [a for a in obj.animals.all() if a.entry_type == LivestockInventory.EntryType.INDIVIDUAL and a.reviewed_at]
        if reviewed:
            latest = max(reviewed, key=lambda a: a.reviewed_at)
            return latest.reviewed_at
        return None


class LivestockBatchListSerializer(LivestockBatchSerializer):
    enrolled_animals = serializers.IntegerField(source="child_count", read_only=True)
    pending_animals = serializers.IntegerField(source="pending_animal_count", read_only=True)
    verified_animals = serializers.IntegerField(source="verified_animal_count", read_only=True)
    approved_animals = serializers.IntegerField(source="approved_animal_count", read_only=True)
    revision_animals = serializers.IntegerField(source="revision_animal_count", read_only=True)
    rejected_animals = serializers.IntegerField(source="rejected_animal_count", read_only=True)

    total_animals = serializers.IntegerField(source="active_animal_count", read_only=True)
    average_weight = serializers.DecimalField(source="active_average_weight", max_digits=6, decimal_places=2, read_only=True, allow_null=True)
    review_status = serializers.CharField(source="list_review_status", read_only=True)

    class Meta(LivestockBatchSerializer.Meta):
        # Roster and review history are fetched only when a detail is opened.
        fields = ("enrolled_animals", "verified_animals") + tuple(f for f in LivestockBatchSerializer.Meta.fields if f not in {
            "animals", "notes", "review_remarks", "reviewed_by_name", "reviewed_by_role", "reviewed_at",
        })


class CensusSubmissionItemSerializer(serializers.ModelSerializer):
    """
    Returns:
        Individual survey line item within a quarterly census report:
        - id: Survey item ID
        - census_submission: Parent census submission ID
        - Farmer Info: farmer (ID), farmer_name, farmer_address
        - Livestock: livestock_type (ID), livestock_type_name, number_of_heads, remarks
    Used in:
        Nested `items` array inside CensusSubmissionSerializer.
    """
    livestock_type_name = serializers.CharField(
        source="livestock_type.name", read_only=True
    )
    farmer_name = serializers.SerializerMethodField()
    farmer_address = serializers.CharField(
        source="farmer.address", read_only=True
    )

    class Meta:
        model = CensusSubmissionItem
        fields = [
            "id",
            "census_submission",
            "farmer",
            "farmer_name",
            "farmer_address",
            "livestock_type",
            "livestock_type_name",
            "number_of_heads",
            "remarks",
        ]
        read_only_fields = ["census_submission"]

    def get_farmer_name(self, obj):
        user = obj.farmer.user
        full_name = user.get_full_name()
        return full_name if full_name else user.username


class CensusSubmissionSerializer(serializers.ModelSerializer):
    """
    Returns:
        Quarterly barangay census submission package:
        - Report Header: id, barangay (ID), barangay_name, report_year, report_quarter
        - Submission & Review: status (PENDING/APPROVED/SUBJECT_TO_REVISION),
          submission_date, submitted_by_name, remarks, review_remarks
        - Census Data: items (array of CensusSubmissionItemSerializer with per-farmer livestock counts)
    Used in:
        SIBAT census reporting workflow and MAO municipal census validation.
    """
    items = CensusSubmissionItemSerializer(many=True)
    # When CensusSubmission receives an "items" field,
    # use CensusSubmissionItemSerializer to validate each item.

    barangay_name = serializers.CharField(
        source="barangay.barangay_name", read_only=True
    )
    submitted_by_name = serializers.SerializerMethodField()

    class Meta:
        model = CensusSubmission
        # Use the period-aware message below instead of DRF's generic
        # UniqueConstraint error; the database constraint remains authoritative.
        validators = []
        fields = [
            "id",
            "barangay",
            "barangay_name",
            "report_year",
            "report_quarter",
            "status",
            "submission_date",
            "submitted_by_name",
            "remarks",
            "review_remarks",
            "items",
        ]
        read_only_fields = [
            "id",
            "submitted_by",
            "submission_date",
            "status",
            "reviewed_by",
            "reviewed_at",
            "review_remarks",
            "created_at",
        ]

    def validate(self, attrs):
        instance = self.instance
        barangay = attrs.get("barangay", getattr(instance, "barangay", None))
        report_year = attrs.get("report_year", getattr(instance, "report_year", None))
        report_quarter = attrs.get("report_quarter", getattr(instance, "report_quarter", None))
        if barangay is not None and report_year is not None and report_quarter is not None:
            matching_period = CensusSubmission.objects.filter(
                barangay=barangay,
                report_year=report_year,
                report_quarter=report_quarter,
            )
            if instance is not None:
                matching_period = matching_period.exclude(pk=instance.pk)
            if matching_period.exists():
                raise serializers.ValidationError({
                    "error": (
                        f"A census for {barangay.barangay_name} Q{report_quarter} "
                        f"{report_year} already exists for this census period."
                    )
                })
        return attrs

    def get_submitted_by_name(self, obj):
        user = obj.submitted_by
        full_name = user.get_full_name()
        return full_name if full_name else user.username


class FarmerOptionsSerializer(serializers.ModelSerializer):
    """
    Returns:
        Farmer profile summary for dropdown select inputs and lookup modals:
        - id: Farmer profile ID
        - Location: barangay (ID), barangay_name, address
        - Identity: farmer_name (resolved full name or username)
        - Profile: farm_size, registered_at, rsbsa_number, contact_number, active_herds_count, animals_count
    Used in:
        Census farmer pickers, livestock registration farmer selectors, GIS barangay details, and SIBAT assignment tools.
    """
    farmer_name = serializers.SerializerMethodField()
    barangay_name = serializers.CharField(
        source="barangay.barangay_name",
        read_only=True,
    )
    rsbsa_number = serializers.CharField(read_only=True)
    contact_number = serializers.SerializerMethodField()
    active_herds_count = serializers.SerializerMethodField()
    animals_count = serializers.SerializerMethodField()

    class Meta:
        model = Farmer
        fields = [
            "id",
            "barangay",
            "barangay_name",
            "farmer_name",
            "farm_size",
            "address",
            "registered_at",
            "rsbsa_number",
            "contact_number",
            "active_herds_count",
            "animals_count",
        ]

        read_only_fields = ["id", "registered_at"]

    def get_farmer_name(self, obj):
        user = obj.user
        full_name = user.get_full_name().strip()
        if full_name:
            return full_name
        return user.username if user.username else user.email

    def get_contact_number(self, obj):
        user = getattr(obj, "user", None)
        phone = getattr(user, "phone_number", None)
        return str(phone) if phone else ""

    def get_active_herds_count(self, obj):
        annotated = getattr(obj, "active_herds_count", None)
        if annotated is not None:
            return annotated
        return obj.batches.filter(status="ACTIVE").count()

    def get_animals_count(self, obj):
        annotated = getattr(obj, "animals_count", None)
        if annotated is not None:
            return annotated
        return obj.inventories.filter(operational_status="ACTIVE").count()


class LivestockOwnershipTransferSerializer(serializers.ModelSerializer):
    livestock = serializers.PrimaryKeyRelatedField(queryset=LivestockInventory.objects.all(), required=False, allow_null=True)
    livestock_tag = serializers.SerializerMethodField()
    livestock_type_name = serializers.SerializerMethodField()
    livestock_operational_status = serializers.SerializerMethodField()
    previous_owner_name = serializers.SerializerMethodField()
    new_owner = serializers.PrimaryKeyRelatedField(read_only=True)
    new_owner_name = serializers.SerializerMethodField(read_only=True)
    new_owner_identifier = serializers.CharField(write_only=True, required=False)
    can_edit = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = LivestockOwnershipTransfer
        fields = (
            "id", "livestock", "livestock_tag", "livestock_type_name", "livestock_operational_status",
            "previous_owner", "previous_owner_name", "owner_type", "new_owner", "new_owner_name",
            "new_owner_identifier", "external_owner_name", "external_owner_address", "can_edit",
            "external_seller_name", "external_seller_address", "external_livestock_type", "external_livestock_tag_number",
            "origin_municipality", "origin_province",
            "transfer_certificate_number", "original_certificate_number", "transfer_date",
            "municipality", "province", "animal_description", "sex_at_transfer",
            "age_at_transfer", "municipality_brand", "owner_brand", "purchase_price",
            "status", "reviewed_by", "reviewed_at", "review_remarks", "created_at",
        )
        read_only_fields = (
            "previous_owner", "previous_owner_name", "new_owner_name", "status",
            "reviewed_by", "reviewed_at", "review_remarks", "created_at",
        )

    def get_new_owner_name(self, obj):
        if obj.new_owner_id:
            user = obj.new_owner.user
            return user.get_full_name().strip() or user.username or user.email
        return obj.external_owner_name

    def get_livestock_tag(self, obj):
        return obj.livestock.tag_number if obj.livestock_id else obj.external_livestock_tag_number

    def get_livestock_type_name(self, obj):
        return obj.livestock.livestock_type.name if obj.livestock_id else obj.external_livestock_type

    def get_livestock_operational_status(self, obj):
        return obj.livestock.operational_status if obj.livestock_id else "EXTERNAL"

    def get_previous_owner_name(self, obj):
        if not obj.previous_owner_id:
            return obj.external_seller_name
        user = obj.previous_owner.user
        return user.get_full_name().strip() or user.username

    def get_can_edit(self, obj):
        request = self.context.get("request")
        return bool(
            request
            and role_name(request.user) in {"FARMER", "AUCTION"}
            and obj.created_by_id == request.user.pk
            and obj.status == LivestockOwnershipTransfer.Status.SUBJECT_TO_REVISION
        )

    def validate(self, attrs):
        from django.utils import timezone
        from users.models import User

        request = self.context["request"]
        livestock = attrs.get("livestock", self.instance.livestock if self.instance else None)
        owner_type = attrs.get(
            "owner_type",
            self.instance.owner_type if self.instance else LivestockOwnershipTransfer.OwnerType.REGISTERED_FARMER,
        )
        owner_identifier = attrs.pop("new_owner_identifier", None)
        # Auction staff encode the seller's certificate from the selected animal row.
        # Deriving the seller here prevents the client from naming another Farmer.
        is_auction = role_name(request.user) == "AUCTION"
        current_owner = (
            livestock.farmer
            if is_auction and livestock
            else getattr(request.user, "farmer_profile", None)
        )
        if self.initial_data.get("new_owner") not in (None, ""):
            raise serializers.ValidationError({"new_owner": "Use the registered owner identifier field; owner records are resolved by the server."})

        if owner_type == LivestockOwnershipTransfer.OwnerType.REGISTERED_FARMER:
            external_name = attrs.get("external_owner_name", "")
            external_address = attrs.get("external_owner_address", "")
            if external_name or external_address:
                raise serializers.ValidationError({"external_owner_name": "External buyer details apply only to an external owner type."})
            attrs["external_owner_name"] = ""
            attrs["external_owner_address"] = ""

            new_owner = self.instance.new_owner if self.instance else None
            if owner_identifier:
                from django.db.models import Q
                candidates = Farmer.objects.filter(
                    Q(rsbsa_number=owner_identifier.strip()) | Q(user__username=owner_identifier.strip()),
                    user__role__role_name="FARMER", user__account_status="APPROVED",
                ).distinct()
                if candidates.count() != 1:
                    raise serializers.ValidationError({"new_owner_identifier": "No unique approved Farmer registration matches that identifier."})
                new_owner = candidates.get()
            elif new_owner is None:
                raise serializers.ValidationError({"new_owner_identifier": "Enter the new owner’s exact account username or RSBSA registration number."})
            attrs["new_owner"] = new_owner

            if current_owner:
                if new_owner.pk == current_owner.pk:
                    raise serializers.ValidationError({"new_owner": "The new owner must be a different registered farmer."})
            if new_owner.user.role.role_name != "FARMER" or new_owner.user.account_status != User.AccountStatus.APPROVED:
                raise serializers.ValidationError({"new_owner": "Choose an approved Farmer account."})
        else:
            if owner_identifier:
                raise serializers.ValidationError({"new_owner_identifier": "A registered Farmer identifier cannot be used for an external owner."})
            external_name = str(attrs.get("external_owner_name", self.instance.external_owner_name if self.instance else "")).strip()
            external_address = str(attrs.get("external_owner_address", self.instance.external_owner_address if self.instance else "")).strip()
            if not external_name:
                raise serializers.ValidationError({"external_owner_name": "Enter the external buyer or organization name."})
            if not external_address:
                raise serializers.ValidationError({"external_owner_address": "Enter the external buyer’s address for the transfer record."})
            attrs["external_owner_name"] = external_name
            attrs["external_owner_address"] = external_address
            attrs["new_owner"] = None

        if livestock is None:
            if not is_auction:
                raise serializers.ValidationError({"livestock": "Only Auction staff can record an outside livestock sale."})
            external_seller_name = str(attrs.get("external_seller_name", self.instance.external_seller_name if self.instance else "")).strip()
            external_seller_address = str(attrs.get("external_seller_address", self.instance.external_seller_address if self.instance else "")).strip()
            external_type = str(attrs.get("external_livestock_type", self.instance.external_livestock_type if self.instance else "")).strip()
            origin_municipality = str(attrs.get("origin_municipality", self.instance.origin_municipality if self.instance else "")).strip()
            origin_province = str(attrs.get("origin_province", self.instance.origin_province if self.instance else "")).strip()
            if not all([external_seller_name, external_seller_address, external_type, origin_municipality, origin_province]):
                raise serializers.ValidationError({"external_seller_name": "For outside livestock, enter the seller, animal type, and origin municipality and province."})
            attrs.update({
                "external_seller_name": external_seller_name,
                "external_seller_address": external_seller_address,
                "external_livestock_type": external_type,
                "origin_municipality": origin_municipality,
                "origin_province": origin_province,
                "previous_owner": None,
            })
            attrs["external_seller_address"] = external_seller_address
        elif current_owner is None:
            raise serializers.ValidationError({"livestock": "The transfer must belong to a registered current owner."})
        elif livestock.farmer_id != current_owner.pk:
            raise serializers.ValidationError({"livestock": "You can request a transfer only for your own livestock."})
        if self.instance and (livestock.pk if livestock else None) != self.instance.livestock_id:
            raise serializers.ValidationError({"livestock": "A transfer request must remain attached to its original livestock identity."})

        transfer_date = attrs.get("transfer_date", self.instance.transfer_date if self.instance else None)
        if transfer_date is None:
            raise serializers.ValidationError({"transfer_date": "Transfer date is required."})
        if livestock and (livestock.entry_type != LivestockInventory.EntryType.INDIVIDUAL or livestock.quantity != 1):
            raise serializers.ValidationError({"livestock": "Transfers currently require one individually registered animal."})
        if livestock and (livestock.status != LivestockInventory.StatusType.APPROVED or livestock.operational_status != LivestockInventory.OperationalStatus.ACTIVE):
            raise serializers.ValidationError({"livestock": "Only approved, active livestock can be transferred."})
        if transfer_date > timezone.localdate():
            raise serializers.ValidationError({"transfer_date": "Transfer date cannot be in the future."})
        previous_transfer = LivestockOwnershipTransfer.objects.filter(
            livestock=livestock,
            status=LivestockOwnershipTransfer.Status.APPROVED,
        ).order_by("-transfer_date", "-pk").first()
        if livestock and previous_transfer and transfer_date < previous_transfer.transfer_date:
            raise serializers.ValidationError({
                "transfer_date": "Transfer date cannot precede the animal's latest approved ownership transfer."
            })
        return attrs

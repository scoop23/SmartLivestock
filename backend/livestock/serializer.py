from rest_framework import serializers
from rest_framework.fields import SerializerMethodField
from rest_framework.relations import PrimaryKeyRelatedField
from livestock.services import CensusService  # type: ignore
from .models import (
    Barangay,
    Farmer,
    LivestockBatch,
    LivestockInventory,
    LivestockOwnershipTransfer,
    LivestockType,
    CensusSubmission,
    CensusSubmissionItem,
)


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


class LivestockInventorySerializer(serializers.Serializer):
    """
    Returns:
        Complete individual animal passport or herd entry with resolved relationships:
        - Identity: id, tag_number, breed, sex, weight, photo, photo_url (absolute URI), avatar_key
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
    livestock_type = serializers.PrimaryKeyRelatedField(
        queryset=LivestockType.objects.all()
    )
    livestock_type_name = serializers.CharField(
        source="livestock_type.name", read_only=True
    )
    entry_type = serializers.ChoiceField(choices=LivestockInventory.EntryType.choices)
    quantity = serializers.IntegerField(min_value=1, default=1)
    tag_number = serializers.CharField(max_length=50, required=False, allow_blank=True, default="")
    breed = serializers.CharField(max_length=50, required=False, allow_blank=True, default="")
    sex = serializers.CharField(max_length=10, required=False, allow_blank=True, default="")
    weight = serializers.DecimalField(
        max_digits=6, decimal_places=2, required=False, allow_null=True
    )
    photo = serializers.ImageField(required=False, allow_null=True)
    photo_url = serializers.SerializerMethodField(read_only=True)
    avatar_key = serializers.CharField(
        max_length=50, required=False, allow_blank=True, default=""
    )
    last_vaccination_date = serializers.DateField(required=False, allow_null=True)
    status = serializers.CharField(max_length=25, read_only=True)
    operational_status = serializers.CharField(max_length=20, read_only=True)
    operational_status_changed_at = serializers.DateTimeField(read_only=True, allow_null=True)
    review_remarks = serializers.CharField(read_only=True, allow_null=True)
    reviewed_at = serializers.DateTimeField(read_only=True, allow_null=True)
    reviewed_by_role = serializers.CharField(source="reviewed_by.role.role_name", read_only=True, allow_null=True)
    reviewed_by_name = serializers.SerializerMethodField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)

    def get_farmer_name(self, obj):
        try:
            user = obj.farmer.user
            full_name = user.get_full_name().strip()
            return full_name if full_name else user.username
        except Exception:
            return "Unknown Farmer"

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

    def validate(self, attrs):
        user = self.context["request"].user
        farmer = getattr(user, "farmer_profile", None)
        if farmer is None:
            raise serializers.ValidationError("A farmer profile is required.")

        entry_type = attrs.get("entry_type", self.instance.entry_type if self.instance else "INDIVIDUAL")
        quantity = attrs.get("quantity", self.instance.quantity if self.instance else 1)
        if entry_type == "INDIVIDUAL" and quantity != 1:
            raise serializers.ValidationError({"quantity": "An individual animal must represent exactly one head."})

        current_batch_id = self.instance.batch_id if self.instance else None
        batch = attrs.get("batch", self.instance.batch if self.instance else None)
        if current_batch_id and (batch is None or batch.pk != current_batch_id):
            raise serializers.ValidationError(
                {"batch": "A herd member cannot be moved to another herd or detached."}
            )
        if batch and (entry_type != "INDIVIDUAL" or quantity != 1):
            raise serializers.ValidationError({"quantity": "Herd members must be individual animals with one head each."})
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
            if batch.animals.exclude(
                status__in=["PENDING", "SUBJECT_TO_REVISION"]
            ).exists():
                raise serializers.ValidationError(
                    {"batch": "This herd is already verified or approved."}
                )
            if not current_batch_id and batch.animals.exclude(status="PENDING").exists():
                raise serializers.ValidationError(
                    {"batch": "New animals can only join a pending herd."}
                )
        return attrs

    def create(self, validated_data):
        user = self.context["request"].user
        validated_data["created_by"] = user
        validated_data["farmer"] = user.farmer_profile
        return LivestockInventory.objects.create(**validated_data)

    def update(self, instance, validated_data):
        allowed = [
            "batch",
            "livestock_type",
            "entry_type",
            "quantity",
            "tag_number",
            "breed",
            "sex",
            "weight",
            "photo",
            "avatar_key",
            "last_vaccination_date",
        ]
        for field in allowed:
            if field in validated_data:
                setattr(instance, field, validated_data[field])
        instance.save()

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
    photo_url = serializers.SerializerMethodField(read_only=True)
    reviewed_by_role = serializers.CharField(source="reviewed_by.role.role_name", read_only=True, allow_null=True)
    reviewed_by_name = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = LivestockInventory
        fields = [
            "id",
            "tag_number",
            "breed",
            "sex",
            "weight",
            "photo",
            "photo_url",
            "avatar_key",
            "last_vaccination_date",
            "status",
            "operational_status",
            "operational_status_changed_at",
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
        - In-Memory Rollup Status: review_status (APPROVED if all animals approved,
          SUBJECT_TO_REVISION if any need revision, VERIFIED only if all are verified,
          else PENDING),
          review_remarks, reviewed_by_name, and reviewed_at
    Used in:
        Admin batch drilldown (/data-validation/batches), farmer herd management, and MAO approvals.
    """
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
    review_remarks = serializers.SerializerMethodField(read_only=True)
    reviewed_by_role = serializers.SerializerMethodField()
    reviewed_by_name = serializers.SerializerMethodField(read_only=True)
    reviewed_at = serializers.SerializerMethodField(read_only=True)

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
            "status",
            "notes",
            "total_animals",
            "average_weight",
            "animals",
            "review_status",
            "review_remarks",
            "reviewed_by_name",
            "reviewed_by_role",
            "reviewed_at",
            "created_at",
            "updated_at",
        ]

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
        animals = sorted(obj.animals.all(), key=lambda a: a.id)
        return BatchChildAnimalSerializer(animals, many=True, context=self.context).data

    def get_review_status(self, obj):
        # In-memory computation
        animals = obj.animals.all()
        if not animals:
            return "PENDING"
        statuses = [a.status for a in animals]
        if all(s == "APPROVED" for s in statuses):
            return "APPROVED"
        if any(s == "SUBJECT_TO_REVISION" for s in statuses):
            return "SUBJECT_TO_REVISION"
        if all(s == "VERIFIED" for s in statuses):
            return "VERIFIED"
        return "PENDING"

    def get_review_remarks(self, obj):
        # In-memory computation: only a remark shared by every reviewed animal is a
        # genuine batch-level remark (a whole-batch review stamps all animals with
        # the same text). Individually reviewed animals keep their own remarks and
        # must not surface as the herd's official note.
        reviewed = [
            a.review_remarks.strip()
            for a in obj.animals.all()
            if a.review_remarks and a.reviewed_at and a.review_remarks.strip()
        ]
        if reviewed and len(set(reviewed)) == 1:
            return reviewed[0]
        return None

    def get_reviewed_by_role(self, obj):
        # Match the latest reviewed animal used for the herd's reviewer name.
        reviewed = [a for a in obj.animals.all() if a.reviewed_by and a.reviewed_at]
        if not reviewed:
            return None
        reviewer = max(reviewed, key=lambda a: a.reviewed_at).reviewed_by
        return reviewer.role.role_name if reviewer.role else None

    def get_reviewed_by_name(self, obj):
        # In-memory computation
        reviewed = [a for a in obj.animals.all() if a.reviewed_by and a.reviewed_at]
        if reviewed:
            latest = max(reviewed, key=lambda a: a.reviewed_at)
            user = latest.reviewed_by
            full_name = user.get_full_name().strip()
            return full_name if full_name else user.username
        return None

    def get_reviewed_at(self, obj):
        # In-memory computation
        reviewed = [a for a in obj.animals.all() if a.reviewed_at]
        if reviewed:
            latest = max(reviewed, key=lambda a: a.reviewed_at)
            return latest.reviewed_at
        return None


class LivestockBatchListSerializer(LivestockBatchSerializer):
    enrolled_animals = serializers.IntegerField(source="child_count", read_only=True)
    verified_animals = serializers.SerializerMethodField()

    def get_verified_animals(self, obj):
        return obj.verified_children + obj.approved_children

    total_animals = serializers.IntegerField(source="active_animal_count", read_only=True)
    average_weight = serializers.DecimalField(source="active_average_weight", max_digits=6, decimal_places=2, read_only=True, allow_null=True)
    review_status = serializers.CharField(source="list_review_status", read_only=True)

    class Meta(LivestockBatchSerializer.Meta):
        # Rosters, review history and photos are fetched only when a detail is opened.
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
        - Profile: farm_size, registered_at
    Used in:
        Census farmer pickers, livestock registration farmer selectors, and SIBAT assignment tools.
    """
    farmer_name = serializers.SerializerMethodField()
    barangay_name = serializers.CharField(
        source="barangay.barangay_name",
        read_only=True,
    )

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
        ]

        read_only_fields = ["id", "registered_at"]

    def get_farmer_name(self, obj):
        user = obj.user
        full_name = user.get_full_name().strip()
        if full_name:
            return full_name
        return user.username if user.username else user.email


class LivestockOwnershipTransferSerializer(serializers.ModelSerializer):
    livestock_tag = serializers.CharField(source="livestock.tag_number", read_only=True)
    livestock_type_name = serializers.CharField(source="livestock.livestock_type.name", read_only=True)
    previous_owner_name = serializers.CharField(source="previous_owner.user.get_full_name", read_only=True)
    new_owner = serializers.PrimaryKeyRelatedField(read_only=True)
    new_owner_name = serializers.CharField(source="new_owner.user.get_full_name", read_only=True)
    new_owner_identifier = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = LivestockOwnershipTransfer
        fields = (
            "id", "livestock", "livestock_tag", "livestock_type_name",
            "previous_owner", "previous_owner_name", "new_owner", "new_owner_name", "new_owner_identifier",
            "transfer_certificate_number", "original_certificate_number", "transfer_date",
            "municipality", "province", "animal_description", "sex_at_transfer",
            "age_at_transfer", "municipality_brand", "owner_brand", "purchase_price",
            "status", "reviewed_by", "reviewed_at", "review_remarks", "created_at",
        )
        read_only_fields = (
            "previous_owner", "previous_owner_name", "new_owner_name", "status",
            "reviewed_by", "reviewed_at", "review_remarks", "created_at",
        )

    def validate(self, attrs):
        from django.utils import timezone
        from users.models import User

        request = self.context["request"]
        livestock = attrs.get("livestock", self.instance.livestock if self.instance else None)
        new_owner = attrs.get("new_owner", self.instance.new_owner if self.instance else None)
        owner_identifier = attrs.pop("new_owner_identifier", None)
        if owner_identifier:
            from django.db.models import Q
            candidates = Farmer.objects.filter(
                Q(rsbsa_number=owner_identifier.strip()) | Q(user__username=owner_identifier.strip()),
                user__role__role_name="FARMER", user__account_status="APPROVED",
            ).distinct()
            if candidates.count() != 1:
                raise serializers.ValidationError({"new_owner_identifier": "No unique approved Farmer registration matches that identifier."})
            new_owner = candidates.get()
            attrs["new_owner"] = new_owner
        elif new_owner is None:
            raise serializers.ValidationError({"new_owner_identifier": "Enter the new owner’s exact account username or RSBSA registration number."})
        transfer_date = attrs.get("transfer_date", self.instance.transfer_date if self.instance else None)
        current_owner = getattr(request.user, "farmer_profile", None)
        if current_owner is None or livestock.farmer_id != current_owner.pk:
            raise serializers.ValidationError({"livestock": "You can request a transfer only for your own livestock."})
        if self.instance and livestock.pk != self.instance.livestock_id:
            raise serializers.ValidationError({"livestock": "A transfer request must remain attached to its original livestock identity."})
        if new_owner.pk == current_owner.pk:
            raise serializers.ValidationError({"new_owner": "The new owner must be a different registered farmer."})
        if new_owner.user.role.role_name != "FARMER" or new_owner.user.account_status != User.AccountStatus.APPROVED:
            raise serializers.ValidationError({"new_owner": "Choose an approved Farmer account."})
        if livestock.entry_type != LivestockInventory.EntryType.INDIVIDUAL or livestock.batch_id or livestock.quantity != 1:
            raise serializers.ValidationError({"livestock": "Transfers currently require one individually registered animal that is not attached to a herd."})
        if livestock.status != LivestockInventory.StatusType.APPROVED or livestock.operational_status != LivestockInventory.OperationalStatus.ACTIVE:
            raise serializers.ValidationError({"livestock": "Only approved, active livestock can be transferred."})
        if transfer_date > timezone.localdate():
            raise serializers.ValidationError({"transfer_date": "Transfer date cannot be in the future."})
        previous_transfer = LivestockOwnershipTransfer.objects.filter(
            livestock=livestock,
            status=LivestockOwnershipTransfer.Status.APPROVED,
        ).order_by("-transfer_date", "-pk").first()
        if previous_transfer and transfer_date < previous_transfer.transfer_date:
            raise serializers.ValidationError({
                "transfer_date": "Transfer date cannot precede the animal's latest approved ownership transfer."
            })
        return attrs

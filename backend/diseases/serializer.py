from django.db.models import Sum
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import ValidationError
from .models import DiseaseCase, MortalityRecord
from livestock.models import LivestockInventory, LivestockBatch


class DiseaseCaseSerializer(serializers.ModelSerializer):
    """
    Returns:
        Epidemiological illness / outbreak report:
        - Target Animal/Pen: livestock (individual animal ID), batch (herd pen ID),
          tag_number, breed, batch_code, livestock_type_name
        - Demographics: farmer_name, barangay_name
        - Clinical Details: name (illness name/symptoms), affected_count (head count), record_date
        - Photographic Evidence: photo, photo_url (farmer photo), inspector_photo, inspector_photo_url (SIBAT/MAO photo)
        - Multi-tier Review: status (PENDING/VERIFIED/APPROVED/SUBJECT_TO_REVISION),
          reviewed_by, reviewed_by_name, reviewed_at, review_remarks, created_by, created_at
    Used in:
        Farmer outbreak reporting, SIBAT on-farm biosecurity inspections, and MAO disease surveillance.
    """
    livestock_type_name = serializers.SerializerMethodField()
    farmer_name = serializers.SerializerMethodField()
    barangay_name = serializers.SerializerMethodField()
    tag_number = serializers.CharField(
        source="livestock.tag_number", read_only=True
    )
    breed = serializers.CharField(
        source="livestock.breed", read_only=True
    )
    batch_code = serializers.CharField(
        source="batch.batch_code", read_only=True
    )
    reviewed_by_name = serializers.SerializerMethodField()
    photo_url = serializers.SerializerMethodField()
    inspector_photo_url = serializers.SerializerMethodField()

    class Meta:
        model = DiseaseCase
        fields = (
            "id",
            "livestock",
            "batch",
            "batch_code",
            "farmer_name",
            "barangay_name",
            "livestock_type_name",
            "tag_number",
            "breed",
            "name",
            "affected_count",
            "record_date",
            "status",
            "clinical_status",
            "photo",
            "photo_url",
            "inspector_photo",
            "inspector_photo_url",
            "reviewed_by",
            "reviewed_by_name",
            "reviewed_at",
            "review_remarks",
            "inspection_details",
            "previous_remarks",
            "created_by",
            "created_at",
        )
        read_only_fields = (
            "status",
            "clinical_status",
            "photo_url",
            "inspector_photo_url",
            "reviewed_by",
            "reviewed_by_name",
            "reviewed_at",
            "review_remarks",
            "inspection_details",
            "previous_remarks",
            "created_by",
            "created_at",
        )

    def get_livestock_type_name(self, obj):
        if obj.livestock and obj.livestock.livestock_type:
            return obj.livestock.livestock_type.name
        if obj.batch and obj.batch.livestock_type:
            return obj.batch.livestock_type.name
        return "Livestock"

    def get_barangay_name(self, obj):
        if obj.livestock and obj.livestock.farmer and obj.livestock.farmer.barangay:
            return obj.livestock.farmer.barangay.barangay_name
        if obj.batch and obj.batch.farmer and obj.batch.farmer.barangay:
            return obj.batch.farmer.barangay.barangay_name
        return "Padre Garcia"

    def get_photo_url(self, obj):
        if obj.photo:
            request = self.context.get("request")
            if request:
                return request.build_absolute_uri(obj.photo.url)
            return obj.photo.url
        return None

    def get_inspector_photo_url(self, obj):
        if obj.inspector_photo:
            request = self.context.get("request")
            if request:
                return request.build_absolute_uri(obj.inspector_photo.url)
            return obj.inspector_photo.url
        return None

    def get_farmer_name(self, obj):
        try:
            if obj.livestock and obj.livestock.farmer:
                user = obj.livestock.farmer.user
            elif obj.batch and obj.batch.farmer:
                user = obj.batch.farmer.user
            else:
                user = obj.created_by
            full_name = user.get_full_name().strip()
            return full_name if full_name else user.username
        except Exception:
            return "Unknown Farmer"

    def get_reviewed_by_name(self, obj):
        if obj.reviewed_by:
            full_name = obj.reviewed_by.get_full_name().strip()
            return full_name if full_name else obj.reviewed_by.username
        return None

    def validate_livestock(self, value):
        if not value:
            return value
        user = self.context["request"].user
        # Ownership is authoritative even if the submitting user has no farmer profile.
        if value.farmer.user_id != user.pk:
            raise ValidationError(
                "You can only report disease cases against your own livestock inventory."
            )
        if value.status not in (
            LivestockInventory.StatusType.VERIFIED,
            LivestockInventory.StatusType.APPROVED,
        ):
            raise ValidationError(
                "Disease can only be reported for verified or approved livestock."
            )
        if value.operational_status != value.OperationalStatus.ACTIVE:
            raise ValidationError("Disease can only be reported for active livestock.")
        return value

    def validate_batch(self, value):
        if not value:
            return value
        user = self.context["request"].user
        if value.farmer.user_id != user.pk:
            raise ValidationError(
                "You can only report disease cases against your own livestock batches."
            )
        return value

    def validate_record_date(self, value):
        if value > timezone.localdate():
            raise ValidationError("Date noticed / occurred cannot be in the future.")
        return value

    def validate_name(self, value):
        name = value.strip()
        if not name:
            raise ValidationError("Enter an illness name or select an observed sign.")
        if name.casefold() == "general health concern":
            raise ValidationError("Describe the illness or select an observed sign.")
        return name

    def validate(self, attrs):
        if self.instance is None:
            livestock = attrs.get("livestock")
            batch = attrs.get("batch")
            affected_count = attrs.get("affected_count", 1)
        else:
            livestock = attrs.get("livestock", self.instance.livestock)
            batch = attrs.get("batch", self.instance.batch)
            affected_count = attrs.get("affected_count", self.instance.affected_count)

        if bool(livestock) == bool(batch):
            raise ValidationError("Specify exactly one individual animal or herd.")
        if livestock and "livestock" not in attrs:
            self.validate_livestock(livestock)
        if batch and "batch" not in attrs:
            self.validate_batch(batch)

        if affected_count is not None and affected_count <= 0:
            raise ValidationError({"affected_count": "Affected count must be a positive number."})

        if livestock and affected_count is not None:
            if affected_count > livestock.quantity:
                raise ValidationError(
                    {
                        "affected_count": f"Affected count ({affected_count}) cannot exceed available livestock quantity ({livestock.quantity})."
                    }
                )

        if batch:
            available = batch.animals.filter(operational_status="ACTIVE").aggregate(heads=Sum("quantity"))["heads"] or 0
            if batch.status != "ACTIVE" or affected_count > available:
                raise ValidationError({"affected_count": "Affected heads cannot exceed the active herd population."})
        return attrs

    def create(self, validated_data):
        user = self.context["request"].user
        validated_data["created_by"] = user
        validated_data["clinical_status"] = DiseaseCase.ClinicalStatus.OPEN
        return DiseaseCase.objects.create(**validated_data)

    def update(self, instance, validated_data):
        was_revision = (instance.status == DiseaseCase.DiseaseStatus.SUBJECT_TO_REVISION)
        allowed = [
            "livestock",
            "batch",
            "name",
            "affected_count",
            "record_date",
            "photo",
        ]
        request = self.context.get("request")
        user = getattr(request, "user", None)
        role_name = getattr(getattr(user, "role", None), "role_name", "")
        if role_name != "FARMER":
            allowed.append("inspector_photo")

        for field in allowed:
            if field in validated_data:
                setattr(instance, field, validated_data[field])

        # Automatic status transition on resubmission:
        # If the declaration was SUBJECT_TO_REVISION, return it to review queue as PENDING
        # while preserving the original MAO revision note as history.
        if was_revision:
            instance.status = DiseaseCase.DiseaseStatus.PENDING
            if instance.review_remarks:
                previous = (instance.previous_remarks or "").strip()
                current = instance.review_remarks.strip()
                if current:
                    if previous:
                        instance.previous_remarks = f"{previous}\n\n{current}"
                    else:
                        instance.previous_remarks = current
            instance.review_remarks = None
            instance.reviewed_by = None
            instance.reviewed_at = None

        instance.save()
        return instance


class MortalityRecordSerializer(serializers.ModelSerializer):
    """
    Returns:
        Livestock casualty and death declaration:
        - Target Animal/Pen: livestock (ID), batch (ID), tag_number, breed, batch_code,
          livestock_type_name
        - Demographics: farmer_name, barangay_name
        - Mortality Data: death_count (head count), cause, record_date
        - Disease Linkage: source_disease_case (ID), source_disease_name (linked illness name)
        - Photographic Evidence: photo, photo_url (farmer photo), inspector_photo,
          inspector_photo_url (SIBAT/MAO inspection photo)
        - Multi-tier Review: status (PENDING/VERIFIED/APPROVED/SUBJECT_TO_REVISION),
          reviewed_by, reviewed_by_name, reviewed_at, review_remarks, created_by, created_at
    Used in:
        Mortality notifications, carcass disposal verification, and municipal indemnification reviews.
    """
    livestock_type_name = serializers.SerializerMethodField()
    farmer_name = serializers.SerializerMethodField()
    barangay_name = serializers.SerializerMethodField()
    tag_number = serializers.CharField(
        source="livestock.tag_number", read_only=True
    )
    breed = serializers.CharField(
        source="livestock.breed", read_only=True
    )
    batch_code = serializers.CharField(
        source="batch.batch_code", read_only=True
    )
    source_disease_name = serializers.CharField(
        source="source_disease_case.name", read_only=True
    )
    reviewed_by_name = serializers.SerializerMethodField()
    photo_url = serializers.SerializerMethodField()
    inspector_photo_url = serializers.SerializerMethodField()
    # `livestocks` is the write format for a shared death event. The legacy
    # `livestock` FK remains the first animal so older screens and scoping
    # code continue to understand existing records.
    livestocks = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=LivestockInventory.objects.all(),
        write_only=True,
        required=False,
    )
    affected_animals = serializers.SerializerMethodField()

    class Meta:
        model = MortalityRecord
        fields = (
            "id",
            "livestock",
            "batch",
            "batch_code",
            "farmer_name",
            "barangay_name",
            "livestock_type_name",
            "tag_number",
            "breed",
            "livestocks",
            "affected_animals",
            "death_count",
            "cause",
            "source_disease_case",
            "source_disease_name",
            "record_date",
            "status",
            "photo",
            "photo_url",
            "inspector_photo",
            "inspector_photo_url",
            "reviewed_by",
            "reviewed_by_name",
            "reviewed_at",
            "review_remarks",
            "inspection_details",
            "previous_remarks",
            "created_by",
            "created_at",
        )
        read_only_fields = (
            "status",
            "photo_url",
            "inspector_photo_url",
            "reviewed_by",
            "reviewed_by_name",
            "reviewed_at",
            "review_remarks",
            "inspection_details",
            "previous_remarks",
            "created_by",
            "created_at",
        )

    def get_livestock_type_name(self, obj):
        if obj.livestock and obj.livestock.livestock_type:
            return obj.livestock.livestock_type.name
        if obj.batch and obj.batch.livestock_type:
            return obj.batch.livestock_type.name
        return "Livestock"

    def get_affected_animals(self, obj):
        # Older single-animal records predate the M2M relation, so fall back
        # to their original FK and expose one consistent response shape.
        animals = list(obj.affected_livestock.all())
        if not animals and obj.livestock_id:
            animals = [obj.livestock]
        return [
            {
                "id": animal.pk,
                "tag_number": animal.tag_number,
                "breed": animal.breed,
                "livestock_type_name": animal.livestock_type.name if animal.livestock_type else "Livestock",
            }
            for animal in animals
        ]

    def get_barangay_name(self, obj):
        if obj.livestock and obj.livestock.farmer and obj.livestock.farmer.barangay:
            return obj.livestock.farmer.barangay.barangay_name
        if obj.batch and obj.batch.farmer and obj.batch.farmer.barangay:
            return obj.batch.farmer.barangay.barangay_name
        return "Padre Garcia"

    def get_photo_url(self, obj):
        if obj.photo:
            request = self.context.get("request")
            if request:
                return request.build_absolute_uri(obj.photo.url)
            return obj.photo.url
        return None

    def get_inspector_photo_url(self, obj):
        if obj.inspector_photo:
            request = self.context.get("request")
            if request:
                return request.build_absolute_uri(obj.inspector_photo.url)
            return obj.inspector_photo.url
        return None

    def get_farmer_name(self, obj):
        try:
            if obj.livestock and obj.livestock.farmer:
                user = obj.livestock.farmer.user
            elif obj.batch and obj.batch.farmer:
                user = obj.batch.farmer.user
            else:
                user = obj.created_by
            full_name = user.get_full_name().strip()
            return full_name if full_name else user.username
        except Exception:
            return "Unknown Farmer"

    def get_reviewed_by_name(self, obj):
        if obj.reviewed_by:
            full_name = obj.reviewed_by.get_full_name().strip()
            return full_name if full_name else obj.reviewed_by.username
        return None

    def _validate_animal(self, value, user):
        if value.farmer.user_id != user.pk:
            raise ValidationError(
                "You can only log mortality records against your own livestock inventory."
            )
        if value.status != "APPROVED" or value.operational_status != "ACTIVE" or value.quantity != 1:
            raise ValidationError("Mortality requires an approved, active animal representing one head.")
        return value

    def validate_batch(self, value):
        if not value:
            return value
        user = self.context["request"].user
        if value.farmer.user_id != user.pk:
            raise ValidationError(
                "You can only log mortality records against your own livestock batches."
            )
        return value

    def validate_record_date(self, value):
        if value > timezone.localdate():
            raise ValidationError("Date noticed / occurred cannot be in the future.")
        return value

    def validate(self, attrs):
        explicit_animals = "livestocks" in attrs
        if explicit_animals:
            animals = attrs["livestocks"]
        elif self.instance:
            animals = list(self.instance.affected_livestock.all())
            if not animals and self.instance.livestock_id:
                animals = [self.instance.livestock]
        else:
            animals = [attrs["livestock"]] if attrs.get("livestock") else []

        # A report is one incident shared by animals under the same farmer
        # and livestock type. This keeps reviewer scoping and type aggregates
        # accurate while still allowing several ear tags in one submission.
        if not animals:
            raise ValidationError({"livestocks": "Select at least one individual animal."})
        if len({animal.pk for animal in animals}) != len(animals):
            raise ValidationError({"livestocks": "An animal can only appear once in this report."})

        user = self.context["request"].user
        for animal in animals:
            self._validate_animal(animal, user)
        if len({animal.farmer_id for animal in animals}) != 1:
            raise ValidationError({"livestocks": "All animals in one mortality report must belong to the same farmer."})
        if len({animal.livestock_type_id for animal in animals}) != 1:
            raise ValidationError({"livestocks": "All animals in one mortality report must have the same livestock type."})

        batch = attrs.get("batch", self.instance.batch if self.instance else None)
        if batch:
            raise ValidationError({"batch": "Select the exact individual deceased animals; herd-only mortality cannot reconcile inventory."})
        if "livestock" in attrs and explicit_animals:
            raise ValidationError({"livestock": "Submit either livestock or livestocks, not both."})

        death_count = attrs.get("death_count", len(animals))
        source_disease = attrs.get(
            "source_disease_case",
            self.instance.source_disease_case if self.instance else None,
        )

        if death_count is not None and death_count <= 0:
            raise ValidationError({"death_count": "Death count must be at least 1."})

        if death_count != len(animals):
            raise ValidationError({"death_count": "Death count must match the number of selected animals."})
        if source_disease and any(
            source_disease.livestock_id != animal.pk
            and not (source_disease.livestock_id is None and source_disease.batch_id and source_disease.batch_id == animal.batch_id_id)
            for animal in animals
        ):
            raise ValidationError({"source_disease_case": "Disease must refer to each selected animal or its herd."})

        attrs["livestocks"] = animals
        attrs.pop("livestock", None)
        attrs["death_count"] = len(animals)
        attrs["batch"] = None

        return attrs

    def create(self, validated_data):
        user = self.context["request"].user
        validated_data["created_by"] = user
        animals = validated_data.pop("livestocks")
        # Keep the first-animal FK as a compatibility anchor; the M2M relation
        # is the complete list and is what approval reconciliation processes.
        record = MortalityRecord.objects.create(livestock=animals[0], **validated_data)
        record.affected_livestock.set(animals)
        return record

    def update(self, instance, validated_data):
        was_revision = (instance.status == MortalityRecord.MortalityRecordStatus.SUBJECT_TO_REVISION)
        animals = validated_data.pop("livestocks", None)
        allowed = [
            "batch",
            "death_count",
            "cause",
            "source_disease_case",
            "record_date",
            "photo",
        ]
        request = self.context.get("request")
        user = getattr(request, "user", None)
        role_name = getattr(getattr(user, "role", None), "role_name", "")
        if role_name != "FARMER":
            allowed.append("inspector_photo")

        for field in allowed:
            if field in validated_data:
                setattr(instance, field, validated_data[field])

        if animals is not None:
            instance.livestock = animals[0]
            instance.death_count = len(animals)
            instance.affected_livestock.set(animals)

        # Automatic status transition on resubmission:
        # If the declaration was SUBJECT_TO_REVISION, return it to review queue as PENDING
        # while preserving the original MAO revision note as history.
        if was_revision:
            instance.status = MortalityRecord.MortalityRecordStatus.PENDING
            if instance.review_remarks:
                previous = (instance.previous_remarks or "").strip()
                current = instance.review_remarks.strip()
                if current:
                    if previous:
                        instance.previous_remarks = f"{previous}\n\n{current}"
                    else:
                        instance.previous_remarks = current
            instance.review_remarks = None
            instance.reviewed_by = None
            instance.reviewed_at = None

        instance.save()
        return instance

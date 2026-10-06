from django.core.exceptions import ObjectDoesNotExist
from django.utils import timezone
from smartlivestock.workflows import scope_reviewer_queryset, role_name
from rest_framework import serializers

from livestock.models import Barangay
from .models import (
    Announcement,
    AnnouncementPhoto,
    ProgramBooking,
    ProgramSchedule,
    PROGRAM_TIME_SLOTS,
)



class MultiValueListField(serializers.ListField):
    def get_value(self, dictionary):
        getlist = getattr(dictionary, "getlist", None)
        if callable(getlist):
            values = getlist(self.field_name)
            if values:
                return values
        return super().get_value(dictionary)

class ProgramScheduleSerializer(serializers.ModelSerializer):
    booked_times = serializers.SerializerMethodField()
    booking_count = serializers.SerializerMethodField()
    remaining_slots = serializers.SerializerMethodField()
    capacity = serializers.IntegerField(min_value=1, max_value=10000, required=False, default=4)
    registration_status = serializers.SerializerMethodField()

    class Meta:
        model = ProgramSchedule
        fields = [
            "id",
            "date",
            "program",
            "location",
            "is_open",
            "capacity",
            "booked_times",
            "booking_count",
            "remaining_slots",
            "registration_status",
            "created_at",
        ]
        read_only_fields = [
            "created_at",
            "booked_times",
            "booking_count",
            "remaining_slots",
            "registration_status",
        ]

    def _confirmed_bookings(self, obj):
        request = self.context.get("request")
        bookings = obj.bookings.all()
        if request and role_name(request.user) == "SIBAT":
            # Prefetched bookings are filtered by the view; no extra query per schedule.
            bookings = obj.scoped_bookings if hasattr(obj, "scoped_bookings") else scope_reviewer_queryset(obj.bookings.all(), request.user)
        return [booking for booking in bookings if booking.status == ProgramBooking.Status.CONFIRMED]

    def get_booked_times(self, obj):
        return [booking.time.strftime("%H:%M") for booking in self._confirmed_bookings(obj)]

    def get_booking_count(self, obj):
        return len(self._confirmed_bookings(obj))

    def get_remaining_slots(self, obj):
        return max(0, obj.capacity - sum(b.status == ProgramBooking.Status.CONFIRMED for b in obj.bookings.all()))

    def get_registration_status(self, obj):
        if obj.date < timezone.localdate():
            return "COMPLETED"
        if not obj.is_open:
            return "CLOSED"
        if self.get_remaining_slots(obj) == 0:
            return "FULL"
        return "AVAILABLE"

    def validate_capacity(self, value):
        if self.instance is not None:
            confirmed = self.instance.bookings.filter(status=ProgramBooking.Status.CONFIRMED).count()
            if value < confirmed:
                raise serializers.ValidationError(
                    f"Capacity cannot be lower than the {confirmed} confirmed bookings."
                )
        return value


class AnnouncementPhotoSerializer(serializers.ModelSerializer):
    class Meta:
        model = AnnouncementPhoto
        fields = ["id", "image", "position"]
        read_only_fields = fields


class AnnouncementSerializer(serializers.ModelSerializer):
    author = serializers.SerializerMethodField()
    image = serializers.ImageField(required=False, allow_null=True)
    photos = AnnouncementPhotoSerializer(many=True, read_only=True)
    photo_uploads = MultiValueListField(
        child=serializers.ImageField(),
        write_only=True,
        required=False,
        max_length=10,
    )
    remove_photo_ids = MultiValueListField(
        child=serializers.IntegerField(min_value=1),
        write_only=True,
        required=False,
    )
    schedule = ProgramScheduleSerializer(read_only=True)
    schedule_id = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=True,
        allow_null=True,
    )
    target_barangay = serializers.PrimaryKeyRelatedField(
        queryset=Barangay.objects.all(),
        required=False,
        allow_null=True,
    )
    target_barangay_id = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=True,
        allow_null=True,
    )
    target_barangay_name = serializers.CharField(
        source="target_barangay.barangay_name",
        read_only=True,
        allow_null=True,
        default=None,
    )
    remove_image = serializers.BooleanField(write_only=True, required=False, default=False)

    class Meta:
        model = Announcement
        fields = [
            "id",
            "title",
            "content",
            "image",
            "photos",
            "photo_uploads",
            "remove_photo_ids",
            "category",
            "audience",
            "target_barangay",
            "target_barangay_id",
            "target_barangay_name",
            "is_published",
            "is_pinned",
            "author",
            "schedule",
            "schedule_id",
            "remove_image",
            "published_at",
            "created_at",
            "updated_at",
        ]
    def to_internal_value(self, data):
        # Normalize legacy audience strings while preserving QueryDict multi-value lists
        if hasattr(data, "copy"):
            data = data.copy()

        if "audience" in data:
            if data["audience"] == "FARMER":
                data["audience"] = Announcement.Audience.FARMER_ONLY
            elif data["audience"] == "SIBAT":
                data["audience"] = Announcement.Audience.SIBAT_ONLY

        return super().to_internal_value(data)

    def validate_image(self, value):
        if value and value.size > 8 * 1024 * 1024:
            raise serializers.ValidationError("Images must be 8 MB or smaller.")
        return value

    def validate_photo_uploads(self, value):
        for image in value:
            if image.size > 8 * 1024 * 1024:
                raise serializers.ValidationError("Each image must be 8 MB or smaller.")
        return value

    def validate_schedule_id(self, value):
        if value in (None, ""):
            return None
        try:
            return ProgramSchedule.objects.get(pk=int(value))
        except (TypeError, ValueError, ProgramSchedule.DoesNotExist):
            raise serializers.ValidationError("Choose an existing field program.")

    def validate_target_barangay_id(self, value):
        if value in (None, ""):
            return None
        try:
            return Barangay.objects.get(pk=int(value))
        except (TypeError, ValueError, Barangay.DoesNotExist):
            raise serializers.ValidationError("Choose an existing barangay.")

    def validate(self, attrs):
        if attrs.get("remove_image") and attrs.get("image"):
            raise serializers.ValidationError(
                {"image": "Choose a new image or remove the current image, not both."}
            )

        # Map target_barangay_id if provided
        if "target_barangay_id" in attrs:
            barangay_obj = attrs.pop("target_barangay_id")
            if barangay_obj is not None:
                attrs["target_barangay"] = barangay_obj

        # Normalize audience & validate barangay requirement
        audience = attrs.get("audience", getattr(self.instance, "audience", Announcement.Audience.FARMER_AND_SIBAT))
        if audience == "FARMER":
            attrs["audience"] = Announcement.Audience.FARMER_ONLY
            audience = Announcement.Audience.FARMER_ONLY
        elif audience == "SIBAT":
            attrs["audience"] = Announcement.Audience.SIBAT_ONLY
            audience = Announcement.Audience.SIBAT_ONLY

        target_barangay = attrs.get("target_barangay")
        if target_barangay is None and self.instance:
            if "audience" not in attrs or attrs["audience"] == self.instance.audience:
                target_barangay = self.instance.target_barangay

        if audience == Announcement.Audience.SIBAT_BARANGAY:
            if not target_barangay and ("target_barangay" in attrs and attrs["target_barangay"] is None):
                raise serializers.ValidationError(
                    {"target_barangay": "Target barangay is required when audience is SIBAT — Their Barangay Only."}
                )
            if not target_barangay and not (self.instance and self.instance.target_barangay):
                raise serializers.ValidationError(
                    {"target_barangay": "Target barangay is required when audience is SIBAT — Their Barangay Only."}
                )
        else:
            # Clear target_barangay when audience is not SIBAT_BARANGAY
            if "target_barangay" in attrs or (self.instance and audience != self.instance.audience):
                attrs["target_barangay"] = None

        return attrs

    def _add_photos(self, announcement, uploads):
        next_position = announcement.photos.count()
        for offset, image in enumerate(uploads):
            announcement.photos.create(image=image, position=next_position + offset)

    def create(self, validated_data):
        schedule = validated_data.pop("schedule_id", None)
        uploads = validated_data.pop("photo_uploads", [])
        validated_data.pop("remove_photo_ids", None)
        validated_data.pop("remove_image", None)
        announcement = Announcement.objects.create(schedule=schedule, **validated_data)
        self._add_photos(announcement, uploads)
        return announcement

    def update(self, instance, validated_data):
        if "schedule_id" in validated_data:
            instance.schedule = validated_data.pop("schedule_id")

        uploads = validated_data.pop("photo_uploads", [])
        remove_ids = validated_data.pop("remove_photo_ids", [])
        remove_image = validated_data.pop("remove_image", False)
        if remove_image and instance.image:
            instance.image.delete(save=False)
            instance.image = None

        for photo in instance.photos.filter(pk__in=remove_ids):
            photo.image.delete(save=False)
            photo.delete()
        if remove_ids and hasattr(instance, "_prefetched_objects_cache"):
            instance._prefetched_objects_cache.pop("photos", None)

        instance = super().update(instance, validated_data)
        self._add_photos(instance, uploads)
        return instance

    def get_author(self, obj):
        return obj.posted_by.get_full_name() or obj.posted_by.username


class ProgramBookingSerializer(serializers.ModelSerializer):
    farmer_name = serializers.SerializerMethodField()
    farmer_barangay = serializers.SerializerMethodField()
    date = serializers.DateField(source="schedule.date", read_only=True)
    program = serializers.CharField(source="schedule.program", read_only=True)

    class Meta:
        model = ProgramBooking
        fields = ["id", "schedule", "farmer_name", "farmer_barangay", "date", "program", "time", "status", "created_at"]
        read_only_fields = ["status", "created_at"]

    def get_farmer_name(self, obj):
        return obj.farmer.get_full_name() or obj.farmer.username

    def get_farmer_barangay(self, obj):
        try:
            profile = obj.farmer.farmer_profile
        except ObjectDoesNotExist:
            return None
        return profile.barangay.barangay_name if profile.barangay_id else None

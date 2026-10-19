from datetime import datetime
from urllib.parse import urlsplit

from django.conf import settings
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
    ProgramSchedulePhoto,
    PROGRAM_TIME_SLOTS,
)



def _announcement_share_url(announcement):
    frontend_url = getattr(settings, "FRONTEND_URL", "").rstrip("/")
    if not frontend_url:
        return None

    parsed = urlsplit(frontend_url)
    local_hosts = {"localhost", "127.0.0.1", "::1"}
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return None
    if not settings.DEBUG and (parsed.scheme != "https" or parsed.hostname in local_hosts):
        return None
    return f"{frontend_url}/share/announcements/{announcement.pk}"


class MultiValueListField(serializers.ListField):
    def get_value(self, dictionary):
        getlist = getattr(dictionary, "getlist", None)
        if callable(getlist):
            values = getlist(self.field_name)
            if values:
                return values
        return super().get_value(dictionary)

class ProgramScheduleSerializer(serializers.ModelSerializer):
    farmer_audience = serializers.ChoiceField(
        choices=ProgramSchedule.FarmerAudience.choices,
        required=False,
    )
    booked_times = serializers.SerializerMethodField()
    booking_count = serializers.SerializerMethodField()
    remaining_slots = serializers.SerializerMethodField()
    # Zero means unlimited registration slots.
    capacity = serializers.IntegerField(min_value=0, max_value=10000, required=False, default=4)
    available_times = MultiValueListField(
        child=serializers.RegexField(regex=r"^(?:[01]\d|2[0-3]):[0-5]\d$"),
        min_length=1,
        max_length=24,
        required=False,
    )
    registration_status = serializers.SerializerMethodField()
    barangay_name = serializers.CharField(source="barangay.barangay_name", read_only=True, allow_null=True)
    remove_cover_image = serializers.BooleanField(write_only=True, required=False, default=False)
    photos = serializers.SerializerMethodField()
    can_manage = serializers.SerializerMethodField()
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
        max_length=10,
    )

    def to_internal_value(self, data):
        if hasattr(data, "copy"):
            data = data.copy()
        if data.get("barangay", "not-provided") == "":
            data["barangay"] = None
        for field_name in ("registration_opens", "registration_deadline"):
            if data.get(field_name, "not-provided") == "":
                data[field_name] = None
        return super().to_internal_value(data)

    class Meta:
        model = ProgramSchedule
        fields = [
            "id",
            "date",
            "program",
            "description",
            "objectives",
            "category",
            "cover_image",
            "remove_cover_image",
            "photos",
            "photo_uploads",
            "remove_photo_ids",
            "barangay",
            "barangay_name",
            "farmer_audience",
            "registration_opens",
            "registration_deadline",
            "eligibility",
            "contact_information",
            "publication_status",
            "location",
            "farmer_notes",
            "is_open",
            "capacity",
            "available_times",
            "booked_times",
            "booking_count",
            "remaining_slots",
            "registration_status",
            "deleted_at",
            "created_at",
            "can_manage",
        ]
        read_only_fields = [
            "created_at",
            "booked_times",
            "booking_count",
            "remaining_slots",
            "registration_status",
            "deleted_at",
        ]

    def _confirmed_bookings(self, obj):
        request = self.context.get("request")
        bookings = obj.bookings.all()
        if request and role_name(request.user) in ("SIBAT", "CBAT"):
            # Prefetched bookings are filtered by the view; no extra query per schedule.
            bookings = obj.scoped_bookings if hasattr(obj, "scoped_bookings") else scope_reviewer_queryset(obj.bookings.all(), request.user)
        return [booking for booking in bookings if booking.status == ProgramBooking.Status.CONFIRMED]

    def get_can_manage(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        role = role_name(request.user)
        if role in ("SIBAT", "CBAT"):
            return obj.created_by_id == request.user.pk
        return role in ("MAO", "ADMIN")

    def get_booked_times(self, obj):
        return [booking.time.strftime("%H:%M") for booking in self._confirmed_bookings(obj)]

    def get_booking_count(self, obj):
        return len(self._confirmed_bookings(obj))

    def get_remaining_slots(self, obj):
        return max(0, obj.capacity - sum(b.status == ProgramBooking.Status.CONFIRMED for b in obj.bookings.all()))

    def get_registration_status(self, obj):
        if obj.publication_status == ProgramSchedule.PublicationStatus.CANCELLED:
            return "CANCELLED"
        if obj.publication_status == ProgramSchedule.PublicationStatus.COMPLETED or obj.date < timezone.localdate():
            return "COMPLETED"
        if obj.publication_status == ProgramSchedule.PublicationStatus.PUBLISHED and obj.registration_opens and obj.registration_opens > timezone.localdate():
            return "NOT_OPEN"
        if obj.publication_status != ProgramSchedule.PublicationStatus.PUBLISHED or not obj.is_open or (
            obj.registration_deadline and obj.registration_deadline < timezone.localdate()
        ):
            return "CLOSED"
        if obj.capacity > 0 and self.get_remaining_slots(obj) == 0:
            return "FULL"
        return "AVAILABLE"

    def validate_capacity(self, value):
        if self.instance is not None:
            confirmed = self.instance.bookings.filter(status=ProgramBooking.Status.CONFIRMED).count()
            if value > 0 and value < confirmed:
                raise serializers.ValidationError(
                    f"Capacity cannot be lower than the {confirmed} confirmed bookings."
                )
        return value

    def validate_cover_image(self, value):
        if value and value.size > 8 * 1024 * 1024:
            raise serializers.ValidationError("Program images must be 8 MB or smaller.")
        return value

    def get_photos(self, obj):
        request = self.context.get("request")
        items = getattr(obj, "prefetched_photos", None)
        photos = items if items is not None else obj.photos.all()
        result = []
        for photo in photos:
            if not photo.image:
                continue
            try:
                url = photo.image.url
                result.append({
                    "id": photo.pk,
                    "image": request.build_absolute_uri(url) if request else url,
                    "position": photo.position,
                })
            except Exception:
                continue
        return result

    def validate_photo_uploads(self, value):
        for image in value:
            if image.size > 8 * 1024 * 1024:
                raise serializers.ValidationError("Each program photo must be 8 MB or smaller.")
        return value

    def validate_remove_photo_ids(self, value):
        if len(value) != len(set(value)):
            raise serializers.ValidationError("Each photo can only be selected for removal once.")
        return value

    def validate_available_times(self, value):
        if len(value) != len(set(value)):
            raise serializers.ValidationError("Choose each appointment time only once.")
        return sorted(value)

    def validate(self, attrs):
        if attrs.get("remove_cover_image") and attrs.get("cover_image"):
            raise serializers.ValidationError({"cover_image": "Choose a replacement image or remove the current image, not both."})
        if self.instance:
            requested_remove_ids = set(attrs.get("remove_photo_ids", []))
            existing_count = self.instance.photos.count()
            removable_count = self.instance.photos.filter(pk__in=requested_remove_ids).count()
            if removable_count != len(requested_remove_ids):
                raise serializers.ValidationError({"remove_photo_ids": "Select photos attached to this program."})
            upload_count = len(attrs.get("photo_uploads", []))
            if existing_count - removable_count + upload_count > 10:
                raise serializers.ValidationError({"photo_uploads": "A program can have up to 10 gallery photos."})
        elif len(attrs.get("photo_uploads", [])) > 10:
            raise serializers.ValidationError({"photo_uploads": "A program can have up to 10 gallery photos."})
        schedule_date = attrs.get("date", self.instance.date if self.instance else None)
        deadline = attrs.get("registration_deadline", self.instance.registration_deadline if self.instance else None)
        registration_opens = attrs.get("registration_opens", self.instance.registration_opens if self.instance else None)
        if schedule_date and deadline and deadline > schedule_date:
            raise serializers.ValidationError({"registration_deadline": "Registration must close on or before the program date."})
        if schedule_date and registration_opens and registration_opens > schedule_date:
            raise serializers.ValidationError({"registration_opens": "Registration cannot open after the program date."})
        if deadline and registration_opens and registration_opens > deadline:
            raise serializers.ValidationError({"registration_opens": "Registration cannot open after its closing date."})
        publication_status = attrs.get("publication_status", getattr(self.instance, "publication_status", ProgramSchedule.PublicationStatus.PUBLISHED))
        if publication_status == ProgramSchedule.PublicationStatus.COMPLETED and schedule_date and schedule_date > timezone.localdate():
            raise serializers.ValidationError({"publication_status": "A future program cannot be marked completed."})
        if self.instance and self.instance.publication_status == ProgramSchedule.PublicationStatus.CANCELLED and publication_status != ProgramSchedule.PublicationStatus.CANCELLED:
            raise serializers.ValidationError({"publication_status": "A cancelled program cannot be republished. Create a new program to preserve the cancellation history."})
        if self.instance and "barangay" in attrs and attrs["barangay"] != self.instance.barangay and self.instance.bookings.exists():
            raise serializers.ValidationError({"barangay": "Program coverage cannot change after farmers have booked. Create a new program for the new coverage area."})

        request = self.context.get("request")
        if request and role_name(request.user) in ("SIBAT", "CBAT"):
            user = request.user
            requested_barangay = attrs.get("barangay", getattr(self.instance, "barangay", None))
            if getattr(user, "access_scope", None) != "ALL_BARANGAYS":
                assigned_id = getattr(user, "assigned_barangay_id", None)
                if assigned_id is None:
                    raise serializers.ValidationError({"barangay": "Ask MAO/Admin to assign your account to a barangay before managing local programs."})
                if requested_barangay and requested_barangay.pk != assigned_id:
                    raise serializers.ValidationError({"barangay": "You can manage programs only for your assigned barangay."})
                attrs["barangay"] = Barangay.objects.get(pk=assigned_id)

        requested_barangay = attrs.get("barangay", self.instance.barangay if self.instance else None)
        if "farmer_audience" not in attrs:
            attrs["farmer_audience"] = (
                self.instance.farmer_audience
                if self.instance
                else ProgramSchedule.FarmerAudience.BARANGAY_ONLY
                if requested_barangay
                else ProgramSchedule.FarmerAudience.ALL_FARMERS
            )
        audience = attrs["farmer_audience"]
        if audience == ProgramSchedule.FarmerAudience.BARANGAY_ONLY and not requested_barangay:
            raise serializers.ValidationError({"barangay": "Choose the program's barangay when access is limited to farmers in that barangay."})
        if (
            self.instance
            and audience == ProgramSchedule.FarmerAudience.BARANGAY_ONLY
            and self.instance.bookings.filter(status=ProgramBooking.Status.CONFIRMED)
            .exclude(farmer__farmer_profile__barangay_id=requested_barangay.pk)
            .exists()
        ):
            raise serializers.ValidationError({"farmer_audience": "This program already has confirmed farmers from other barangays. Keep all-farmer access or manage those bookings first."})

        # Keep existing booking times available when staff edits a schedule.
        if self.instance is None and "available_times" not in attrs:
            attrs["available_times"] = list(PROGRAM_TIME_SLOTS)

        new_times = attrs.get("available_times")
        if self.instance is not None and new_times is not None:
            confirmed_times = {
                booking.time.strftime("%H:%M")
                for booking in self.instance.bookings.filter(status=ProgramBooking.Status.CONFIRMED)
            }
            removed_booked_times = confirmed_times - set(new_times)
            if removed_booked_times:
                formatted = ", ".join(sorted(removed_booked_times))
                raise serializers.ValidationError({
                    "available_times": f"Keep times with confirmed bookings ({formatted}) or move those bookings first."
                })

        # A same-day program must offer only future arrival times. Previously
        # confirmed past bookings remain in the schedule for history.
        if schedule_date == timezone.localdate() and new_times is not None:
            current_time = timezone.localtime().time().replace(tzinfo=None)
            confirmed_times = (
                {
                    booking.time.strftime("%H:%M")
                    for booking in self.instance.bookings.filter(status=ProgramBooking.Status.CONFIRMED)
                }
                if self.instance is not None
                else set()
            )
            past_times = [
                value for value in new_times
                if datetime.strptime(value, "%H:%M").time() <= current_time and value not in confirmed_times
            ]
            if past_times:
                raise serializers.ValidationError({
                    "available_times": "For today's schedule, choose times later than the current time."
                })
        return attrs

    def create(self, validated_data):
        remove_image = validated_data.pop("remove_cover_image", False)
        uploads = validated_data.pop("photo_uploads", [])
        validated_data.pop("remove_photo_ids", None)
        schedule = super().create(validated_data)
        self._add_program_photos(schedule, uploads)
        if remove_image and schedule.cover_image:
            schedule.cover_image.delete(save=True)
        return schedule

    def update(self, instance, validated_data):
        remove_image = validated_data.pop("remove_cover_image", False)
        uploads = validated_data.pop("photo_uploads", [])
        remove_ids = validated_data.pop("remove_photo_ids", [])
        old_cover = instance.cover_image
        if remove_image and instance.cover_image:
            instance.cover_image.delete(save=False)
            instance.cover_image = None
        schedule = super().update(instance, validated_data)
        for photo in schedule.photos.filter(pk__in=remove_ids):
            photo.image.delete(save=False)
            photo.delete()
        if remove_ids and hasattr(schedule, "_prefetched_objects_cache"):
            schedule._prefetched_objects_cache.pop("photos", None)
        self._add_program_photos(schedule, uploads)
        if old_cover and "cover_image" in validated_data and old_cover.name != schedule.cover_image.name:
            old_cover.storage.delete(old_cover.name)
        if remove_image:
            schedule.save(update_fields=["cover_image"])
        return schedule

    @staticmethod
    def _add_program_photos(schedule, uploads):
        next_position = schedule.photos.count()
        for offset, image in enumerate(uploads):
            ProgramSchedulePhoto.objects.create(
                schedule=schedule,
                image=image,
                position=next_position + offset,
            )


class AnnouncementPhotoSerializer(serializers.ModelSerializer):
    class Meta:
        model = AnnouncementPhoto
        fields = ["id", "image", "position"]
        read_only_fields = fields


class AnnouncementSerializer(serializers.ModelSerializer):
    author = serializers.SerializerMethodField()
    share_url = serializers.SerializerMethodField()
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
            "share_url",
            "remove_image",
            "published_at",
            "created_at",
            "updated_at",
        ]

    def get_share_url(self, obj):
        return _announcement_share_url(obj)

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
        uploads = validated_data.pop("photo_uploads", [])
        validated_data.pop("remove_photo_ids", None)
        validated_data.pop("remove_image", None)
        announcement = Announcement.objects.create(**validated_data)
        self._add_photos(announcement, uploads)
        return announcement

    def update(self, instance, validated_data):
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


class PublicAnnouncementSerializer(serializers.ModelSerializer):
    """Minimal read-only fields safe for crawler-visible, all-audience notices."""
    image = serializers.ImageField(read_only=True)
    photos = AnnouncementPhotoSerializer(many=True, read_only=True)
    share_url = serializers.SerializerMethodField()

    class Meta:
        model = Announcement
        fields = ["id", "title", "content", "category", "image", "photos", "published_at", "share_url"]
        read_only_fields = fields

    def get_share_url(self, obj):
        return _announcement_share_url(obj)


class ProgramBookingSerializer(serializers.ModelSerializer):
    farmer_name = serializers.SerializerMethodField()
    farmer_barangay = serializers.SerializerMethodField()
    date = serializers.DateField(source="schedule.date", read_only=True)
    program = serializers.CharField(source="schedule.program", read_only=True)
    available_times = serializers.ListField(source="schedule.available_times", read_only=True)
    program_status = serializers.CharField(source="schedule.publication_status", read_only=True)

    class Meta:
        model = ProgramBooking
        fields = ["id", "schedule", "farmer_name", "farmer_barangay", "date", "program", "program_status", "time", "available_times", "status", "created_at"]
        read_only_fields = ["status", "created_at"]

    def get_farmer_name(self, obj):
        return obj.farmer.get_full_name() or obj.farmer.username

    def get_farmer_barangay(self, obj):
        try:
            profile = obj.farmer.farmer_profile
        except ObjectDoesNotExist:
            return None
        return profile.barangay.barangay_name if profile.barangay_id else None

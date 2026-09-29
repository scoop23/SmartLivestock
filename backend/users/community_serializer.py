from rest_framework import serializers
from .models import Announcement, ProgramSchedule, ProgramBooking

class AnnouncementSerializer(serializers.ModelSerializer):
    author = serializers.SerializerMethodField()

    class Meta:
        model = Announcement
        fields = ["id", "title", "content", "category", "audience", "is_published", "is_pinned", "author", "published_at", "created_at", "updated_at"]
        read_only_fields = ["published_at", "created_at", "updated_at"]

    def get_author(self, obj):
        return obj.posted_by.get_full_name() or obj.posted_by.username

class ProgramScheduleSerializer(serializers.ModelSerializer):
    booked_times = serializers.SerializerMethodField()

    class Meta:
        model = ProgramSchedule
        fields = ["id", "date", "program", "is_open", "booked_times", "created_at"]
        read_only_fields = ["created_at"]

    def get_booked_times(self, obj):
        return [booking.time.strftime("%H:%M") for booking in obj.bookings.all() if booking.status == ProgramBooking.Status.CONFIRMED]

class ProgramBookingSerializer(serializers.ModelSerializer):
    farmer_name = serializers.SerializerMethodField()
    date = serializers.DateField(source="schedule.date", read_only=True)
    program = serializers.CharField(source="schedule.program", read_only=True)

    class Meta:
        model = ProgramBooking
        fields = ["id", "schedule", "farmer_name", "date", "program", "time", "status", "created_at"]
        read_only_fields = ["status", "created_at"]

    def get_farmer_name(self, obj):
        return obj.farmer.get_full_name() or obj.farmer.username

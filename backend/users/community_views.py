from datetime import date, datetime
from django.db import IntegrityError, transaction
from django.db.models import Q, Prefetch
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import Announcement, ProgramSchedule, ProgramBooking, Role, Notification, PROGRAM_TIME_SLOTS
from .community_serializer import AnnouncementSerializer, ProgramScheduleSerializer, ProgramBookingSerializer
from .notification_views import notify_role, create_notification
from smartlivestock.workflows import scope_reviewer_queryset

TIMES = set(PROGRAM_TIME_SLOTS)

def role_of(user):
    return user.role.role_name

def require_role(request, *roles):
    if role_of(request.user) not in roles:
        return Response({"detail": "You do not have permission for this action."}, status=403)
    return None

def _announcement_notification_message(announcement):
    if announcement.schedule_id:
        schedule = announcement.schedule
        when = f" on {schedule.date}"
        if schedule.location:
            when += f" at {schedule.location}"
        return f"{schedule.program}{when}. View Field Scheduling for available times."[:180]
    return announcement.content[:180]


def publish_notifications(announcement):
    roles = [Role.UserRoles.FARMER, Role.UserRoles.SIBAT] if announcement.audience == Announcement.Audience.ALL else [announcement.audience]
    for role in roles:
        notify_role(role, Notification.NotificationType.GENERAL, "New livestock activity: " + announcement.title, _announcement_notification_message(announcement), link="/farmer-announcement" if role == Role.UserRoles.FARMER else "/sibat-announcement", municipal_broadcast=True)

@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def announcements(request):
    role = role_of(request.user)
    if request.method == "GET":
        if role not in (Role.UserRoles.MAO, "ADMIN", Role.UserRoles.FARMER, Role.UserRoles.SIBAT):
            return Response({"detail": "Forbidden."}, status=403)
        qs = Announcement.objects.select_related("posted_by", "schedule").prefetch_related("schedule__bookings", Prefetch("schedule__bookings", queryset=scope_reviewer_queryset(ProgramBooking.objects.all(), request.user), to_attr="scoped_bookings"), "photos")
        if role not in (Role.UserRoles.MAO, "ADMIN", Role.UserRoles.SIBAT):
            qs = qs.filter(is_published=True).filter(Q(audience="ALL") | Q(audience=role))
        return Response(AnnouncementSerializer(qs, many=True, context={"request": request}).data)
    denied = require_role(request, Role.UserRoles.MAO, "ADMIN", Role.UserRoles.SIBAT)
    if denied:
        return denied
    serializer = AnnouncementSerializer(data=request.data, context={"request": request})
    serializer.is_valid(raise_exception=True)
    with transaction.atomic():
        announcement = serializer.save(posted_by=request.user, published_at=timezone.now() if serializer.validated_data.get("is_published") else None)
        if announcement.is_published:
            publish_notifications(announcement)
    return Response(AnnouncementSerializer(announcement, context={"request": request}).data, status=201)

@api_view(["PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def announcement_detail(request, pk):
    denied = require_role(request, Role.UserRoles.MAO, "ADMIN", Role.UserRoles.SIBAT)
    if denied:
        return denied
    announcement = get_object_or_404(Announcement.objects.prefetch_related("photos"), pk=pk)
    if request.method == "DELETE":
        announcement.delete()
        return Response(status=204)
    was_published = announcement.is_published
    serializer = AnnouncementSerializer(announcement, data=request.data, partial=True, context={"request": request})
    serializer.is_valid(raise_exception=True)
    with transaction.atomic():
        announcement = serializer.save(published_at=announcement.published_at or (timezone.now() if serializer.validated_data.get("is_published") else None))
        if announcement.is_published and not was_published:
            publish_notifications(announcement)
    return Response(AnnouncementSerializer(announcement, context={"request": request}).data)

@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def schedules(request):
    role = role_of(request.user)
    if role not in (Role.UserRoles.MAO, "ADMIN", Role.UserRoles.FARMER, Role.UserRoles.SIBAT):
        return Response({"detail": "Forbidden."}, status=403)
    if request.method == "GET":
        qs = ProgramSchedule.objects.prefetch_related(
            "bookings", Prefetch("bookings", queryset=scope_reviewer_queryset(ProgramBooking.objects.all(), request.user), to_attr="scoped_bookings")
        )
        if role == Role.UserRoles.FARMER:
            qs = qs.filter(is_open=True, date__gte=date.today())
        return Response(ProgramScheduleSerializer(qs, many=True, context={"request": request}).data)
    denied = require_role(request, Role.UserRoles.MAO, "ADMIN", Role.UserRoles.SIBAT)
    if denied:
        return denied
    serializer = ProgramScheduleSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    if serializer.validated_data["date"] < date.today():
        return Response({"date": ["Choose a current or future date."]}, status=400)
    try:
        with transaction.atomic():
            schedule = serializer.save(created_by=request.user)
    except IntegrityError:
        return Response({"detail": "This program is already scheduled on that date."}, status=400)
    if schedule.is_open:
        notify_role(Role.UserRoles.FARMER, Notification.NotificationType.GENERAL, "New program available", f"{schedule.program} on {schedule.date}. Book a time in Field Scheduling.", link="/farmer-scheduling")
        notify_role(Role.UserRoles.SIBAT, Notification.NotificationType.GENERAL, "New field program", f"{schedule.program} on {schedule.date}.", link="/sibat-scheduling", municipal_broadcast=True)
    return Response(ProgramScheduleSerializer(schedule, context={"request": request}).data, status=201)

@api_view(["PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def schedule_detail(request, pk):
    denied = require_role(request, Role.UserRoles.MAO, "ADMIN", Role.UserRoles.SIBAT)
    if denied:
        return denied
    schedule = get_object_or_404(ProgramSchedule, pk=pk)
    if request.method == "DELETE":
        if schedule.bookings.exists():
            return Response({"detail": "Close this schedule instead; bookings must be retained."}, status=400)
        schedule.delete()
        return Response(status=204)
    with transaction.atomic():
        schedule = ProgramSchedule.objects.select_for_update().get(pk=pk)
        serializer = ProgramScheduleSerializer(schedule, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        if "date" in serializer.validated_data and serializer.validated_data["date"] < date.today():
            return Response({"date": ["Choose a current or future date."]}, status=400)
        schedule = serializer.save()
    return Response(ProgramScheduleSerializer(schedule, context={"request": request}).data)

@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def bookings(request):
    role = role_of(request.user)
    if role not in (Role.UserRoles.MAO, "ADMIN", Role.UserRoles.FARMER, Role.UserRoles.SIBAT):
        return Response({"detail": "Forbidden."}, status=403)
    if request.method == "GET":
        qs = ProgramBooking.objects.select_related("schedule", "farmer", "farmer__farmer_profile__barangay")
        if role == Role.UserRoles.FARMER:
            qs = qs.filter(farmer=request.user)
        else:
            qs = scope_reviewer_queryset(qs, request.user)
        return Response(ProgramBookingSerializer(qs, many=True).data)
    denied = require_role(request, Role.UserRoles.FARMER)
    if denied:
        return denied
    serializer = ProgramBookingSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    schedule = serializer.validated_data["schedule"]
    chosen_time = serializer.validated_data["time"]
    if chosen_time.strftime("%H:%M") not in TIMES:
        return Response({"time": ["Choose an offered time."]}, status=400)
    try:
        with transaction.atomic():
            schedule = ProgramSchedule.objects.select_for_update().get(pk=schedule.pk)
            if not schedule.is_open or schedule.date < date.today():
                return Response({"detail": "This program is no longer available."}, status=400)
            confirmed_count = schedule.bookings.filter(status=ProgramBooking.Status.CONFIRMED).count()
            if confirmed_count >= schedule.capacity:
                return Response({"detail": "This program is fully booked."}, status=400)
            booking = serializer.save(farmer=request.user, schedule=schedule)
    except IntegrityError:
        return Response({"detail": "You already have a confirmed booking for this program."}, status=400)
    create_notification(request.user, title="Booking confirmed", message=f"{schedule.program} on {schedule.date} at {chosen_time.strftime('%H:%M')}.", link="/farmer-scheduling")
    notify_role(Role.UserRoles.SIBAT, barangay_id=getattr(getattr(request.user, "farmer_profile", None), "barangay_id", None),
                title="New program booking", message=f"A farmer booked {schedule.program} on {schedule.date}.", link="/sibat-scheduling")
    notify_role(Role.UserRoles.MAO, title="New program booking", message=f"A farmer booked {schedule.program} on {schedule.date}.", link="/schedules")
    return Response(ProgramBookingSerializer(booking).data, status=201)

@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def booking_detail(request, pk):
    denied = require_role(request, Role.UserRoles.FARMER)
    if denied:
        return denied
    booking = get_object_or_404(ProgramBooking, pk=pk, farmer=request.user)
    if request.data.get("status") != ProgramBooking.Status.CANCELLED:
        return Response({"status": ["Only cancellation is allowed."]}, status=400)
    if booking.schedule.date < date.today():
        return Response({"detail": "Past bookings cannot be cancelled."}, status=400)
    booking.status = ProgramBooking.Status.CANCELLED
    booking.save(update_fields=["status"])
    notify_role(Role.UserRoles.SIBAT,
                barangay_id=getattr(getattr(request.user, "farmer_profile", None), "barangay_id", None),
                title="Program booking cancelled", message=f"A farmer cancelled {booking.schedule.program} on {booking.schedule.date}.", link="/sibat-scheduling")
    notify_role(Role.UserRoles.MAO, title="Program booking cancelled",
                message=f"A farmer cancelled {booking.schedule.program} on {booking.schedule.date}.", link="/schedules")
    return Response(ProgramBookingSerializer(booking).data)

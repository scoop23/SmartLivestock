from django.db import IntegrityError, transaction
from django.db.models import Q, Prefetch
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from .models import Announcement, ProgramSchedule, ProgramSchedulePhoto, ProgramBooking, Role, User, Notification, PROGRAM_TIME_SLOTS
from .community_serializer import (
    AnnouncementSerializer,
    PublicAnnouncementSerializer,
    ProgramScheduleSerializer,
    ProgramBookingSerializer,
)
from .notification_views import notify_role, create_notification
from smartlivestock.workflows import scope_reviewer_queryset, has_all_barangay_access

def role_of(user):
    return user.role.role_name

def require_role(request, *roles):
    if role_of(request.user) not in roles:
        return Response({"detail": "You do not have permission for this action."}, status=403)
    return None

def _announcement_notification_message(announcement):
    return announcement.content[:180]


def _notify_program_farmers(schedule, *, title, message):
    farmers = User.objects.filter(
        role__role_name=Role.UserRoles.FARMER,
        account_status=User.AccountStatus.APPROVED,
        is_active=True,
    )
    if schedule.farmer_audience == ProgramSchedule.FarmerAudience.BARANGAY_ONLY and schedule.barangay_id:
        farmers = farmers.filter(farmer_profile__barangay_id=schedule.barangay_id)
    Notification.objects.bulk_create([
        Notification(
            user=farmer,
            notification_type=Notification.NotificationType.GENERAL,
            title=title,
            message=message,
            link="/farmer-scheduling",
        )
        for farmer in farmers
    ])


def _notify_program_staff(schedule, *, title, message, exclude_user_id=None):
    reviewers = User.objects.filter(
        role__role_name__in=(Role.UserRoles.SIBAT, Role.UserRoles.CBAT),
        account_status=User.AccountStatus.APPROVED,
        is_active=True,
    )
    if schedule.barangay_id:
        reviewers = reviewers.filter(
            Q(access_scope=User.AccessScope.ALL_BARANGAYS)
            | Q(assigned_barangay_id=schedule.barangay_id)
        )
    else:
        reviewers = reviewers.filter(access_scope=User.AccessScope.ALL_BARANGAYS)
    if exclude_user_id is not None:
        reviewers = reviewers.exclude(pk=exclude_user_id)
    Notification.objects.bulk_create([
        Notification(
            user=reviewer,
            notification_type=Notification.NotificationType.GENERAL,
            title=title,
            message=message,
            link="/sibat-scheduling",
        )
        for reviewer in reviewers.distinct()
    ])


def publish_notifications(announcement):
    """Fan out notices only to the roles/barangay selected by the announcement audience."""
    audience = announcement.audience
    if audience == Announcement.Audience.ALL:
        roles_with_links = [
            (Role.UserRoles.FARMER, "/farmer-announcement", True, None),
            (Role.UserRoles.SIBAT, "/sibat-announcement", True, None),
            (Role.UserRoles.AUCTION, "/auction-announcement", True, None),
            (Role.UserRoles.SLAUGHTERHOUSESTAFF, "/slaughterhouse/announcements", True, None),
        ]
    elif audience in (Announcement.Audience.FARMER_AND_SIBAT, "FARMER_AND_SIBAT"):
        roles_with_links = [
            (Role.UserRoles.FARMER, "/farmer-announcement", True, None),
            (Role.UserRoles.SIBAT, "/sibat-announcement", True, None),
        ]
    elif audience in (Announcement.Audience.FARMER_ONLY, "FARMER"):
        roles_with_links = [
            (Role.UserRoles.FARMER, "/farmer-announcement", True, None),
        ]
    elif audience in (Announcement.Audience.SIBAT_ONLY, "SIBAT"):
        roles_with_links = [
            (Role.UserRoles.SIBAT, "/sibat-announcement", True, None),
        ]
    elif audience == Announcement.Audience.SIBAT_BARANGAY:
        roles_with_links = [
            (Role.UserRoles.SIBAT, "/sibat-announcement", False, announcement.target_barangay_id),
        ]
    else:
        roles_with_links = []

    for role, link, broadcast, barangay_id in roles_with_links:
        notify_role(
            role,
            Notification.NotificationType.GENERAL,
            "New livestock activity: " + announcement.title,
            _announcement_notification_message(announcement),
            link=link,
            municipal_broadcast=broadcast,
            barangay_id=barangay_id,
        )

@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def announcements(request):
    """Role-scoped list/create API used by the shared Auction activities feed."""
    role = role_of(request.user)
    if request.method == "GET":
        # Auction can read announcements selected for its audience; it cannot publish.
        if role not in (
            Role.UserRoles.MAO,
            "ADMIN",
            Role.UserRoles.FARMER,
            Role.UserRoles.SIBAT,
            Role.UserRoles.CBAT,
            Role.UserRoles.AUCTION,
            Role.UserRoles.SLAUGHTERHOUSESTAFF,
        ):
            return Response({"detail": "Forbidden."}, status=403)
        qs = Announcement.objects.select_related("posted_by", "target_barangay").prefetch_related("photos")
        if role in (Role.UserRoles.MAO, "ADMIN"):
            pass
        elif role == Role.UserRoles.FARMER:
            qs = qs.filter(
                is_published=True,
                audience__in=[
                    Announcement.Audience.ALL,
                    Announcement.Audience.FARMER_AND_SIBAT,
                    Announcement.Audience.FARMER_ONLY,
                    "FARMER",
                ],
            )
        elif role in (Role.UserRoles.AUCTION, Role.UserRoles.SLAUGHTERHOUSESTAFF):
            qs = qs.filter(
                is_published=True,
                audience=Announcement.Audience.ALL,
            )
        elif role in (Role.UserRoles.SIBAT, Role.UserRoles.CBAT):
            sibat_audience_filter = Q(
                audience__in=[
                    Announcement.Audience.ALL,
                    Announcement.Audience.FARMER_AND_SIBAT,
                    Announcement.Audience.SIBAT_ONLY,
                    "SIBAT",
                ]
            )
            if has_all_barangay_access(request.user):
                sibat_audience_filter |= Q(audience=Announcement.Audience.SIBAT_BARANGAY)
            elif request.user.assigned_barangay_id:
                sibat_audience_filter |= Q(
                    audience=Announcement.Audience.SIBAT_BARANGAY,
                    target_barangay_id=request.user.assigned_barangay_id,
                )
            qs = qs.filter(
                (Q(is_published=True) & sibat_audience_filter) | Q(posted_by=request.user)
            )
        return Response(AnnouncementSerializer(qs, many=True, context={"request": request}).data)
    denied = require_role(request, Role.UserRoles.MAO, "ADMIN", Role.UserRoles.SIBAT, Role.UserRoles.CBAT)
    if denied:
        return denied
    serializer = AnnouncementSerializer(data=request.data, context={"request": request})
    serializer.is_valid(raise_exception=True)
    with transaction.atomic():
        announcement = serializer.save(posted_by=request.user, published_at=timezone.now() if serializer.validated_data.get("is_published") else None)
        if announcement.is_published:
            publish_notifications(announcement)
    return Response(AnnouncementSerializer(announcement, context={"request": request}).data, status=201)


@api_view(["GET"])
@permission_classes([AllowAny])
def public_announcement_share(request, pk):
    """Expose only explicitly all-audience published announcements to share crawlers."""
    announcement = get_object_or_404(
        Announcement.objects.prefetch_related("photos"),
        pk=pk,
        is_published=True,
        audience=Announcement.Audience.ALL,
    )
    serializer = PublicAnnouncementSerializer(announcement, context={"request": request})
    return Response(serializer.data)

@api_view(["PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def announcement_detail(request, pk):
    denied = require_role(request, Role.UserRoles.MAO, "ADMIN", Role.UserRoles.SIBAT, Role.UserRoles.CBAT)
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
    if role not in (Role.UserRoles.MAO, "ADMIN", Role.UserRoles.FARMER, Role.UserRoles.SIBAT, Role.UserRoles.CBAT):
        return Response({"detail": "Forbidden."}, status=403)
    if request.method == "GET":
        prefetch_items = ["bookings", Prefetch("photos", queryset=ProgramSchedulePhoto.objects.all(), to_attr="prefetched_photos")]
        if role in (Role.UserRoles.SIBAT, Role.UserRoles.CBAT):
            prefetch_items.append(
                Prefetch(
                    "bookings",
                    queryset=scope_reviewer_queryset(ProgramBooking.objects.all(), request.user),
                    to_attr="scoped_bookings",
                )
            )
        # Soft-deleted completed schedules stay in the database for booking history,
        # but are omitted from the active scheduling registry.
        qs = ProgramSchedule.objects.filter(deleted_at__isnull=True).select_related("barangay").prefetch_related(*prefetch_items)
        if role == Role.UserRoles.FARMER:
            farmer_barangay_id = getattr(getattr(request.user, "farmer_profile", None), "barangay_id", None)
            qs = qs.filter(
                publication_status=ProgramSchedule.PublicationStatus.PUBLISHED,
                date__gte=timezone.localdate(),
            )
            if farmer_barangay_id:
                qs = qs.filter(
                    Q(farmer_audience=ProgramSchedule.FarmerAudience.ALL_FARMERS)
                    | Q(
                        farmer_audience=ProgramSchedule.FarmerAudience.BARANGAY_ONLY,
                        barangay_id=farmer_barangay_id,
                    )
                )
            else:
                qs = qs.filter(farmer_audience=ProgramSchedule.FarmerAudience.ALL_FARMERS)
        elif role in (Role.UserRoles.SIBAT, Role.UserRoles.CBAT):
            # The CBAT dashboard currently authenticates through the SIBAT
            # role in existing deployments. Both field-officer roles can
            # browse programs across barangays; booking rosters stay scoped.
            pass
        return Response(ProgramScheduleSerializer(qs, many=True, context={"request": request}).data)
    denied = require_role(request, Role.UserRoles.MAO, "ADMIN", Role.UserRoles.SIBAT, Role.UserRoles.CBAT)
    if denied:
        return denied
    serializer = ProgramScheduleSerializer(data=request.data, context={"request": request})
    serializer.is_valid(raise_exception=True)
    if serializer.validated_data["date"] < timezone.localdate():
        return Response({"date": ["Choose a current or future date."]}, status=400)
    try:
        with transaction.atomic():
            schedule = serializer.save(created_by=request.user)
            if schedule.publication_status != ProgramSchedule.PublicationStatus.PUBLISHED and schedule.is_open:
                schedule.is_open = False
                schedule.save(update_fields=["is_open"])
    except IntegrityError:
        return Response({"detail": "This program is already scheduled on that date."}, status=400)
    if schedule.publication_status == ProgramSchedule.PublicationStatus.PUBLISHED:
        _notify_program_farmers(schedule, title="New program available", message=f"{schedule.program} on {schedule.date}. View Programs to register.")
        _notify_program_staff(schedule, title="New livestock program", message=f"{schedule.program} on {schedule.date}.", exclude_user_id=request.user.pk)
    return Response(ProgramScheduleSerializer(schedule, context={"request": request}).data, status=201)

@api_view(["PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def schedule_detail(request, pk):
    denied = require_role(request, Role.UserRoles.MAO, "ADMIN", Role.UserRoles.SIBAT, Role.UserRoles.CBAT)
    if denied:
        return denied
    if request.method == "DELETE":
        with transaction.atomic():
            schedules = ProgramSchedule.objects.select_for_update().filter(deleted_at__isnull=True)
            if role_of(request.user) in (Role.UserRoles.SIBAT, Role.UserRoles.CBAT):
                schedules = schedules.filter(created_by=request.user)
            schedule = get_object_or_404(schedules, pk=pk)
            if schedule.date < timezone.localdate():
                # Keep past program records for history even when there are no
                # bookings. Deleting the row outright made historical programs
                # disappear permanently from the system.
                schedule.deleted_at = timezone.now()
                schedule.save(update_fields=["deleted_at"])
            elif schedule.bookings.exists():
                return Response({"detail": "Schedules with bookings cannot be deleted before their date."}, status=400)
            else:
                schedule.delete()
        return Response(status=204)
    with transaction.atomic():
        schedules = ProgramSchedule.objects.select_for_update().filter(deleted_at__isnull=True)
        if role_of(request.user) in (Role.UserRoles.SIBAT, Role.UserRoles.CBAT):
            schedules = schedules.filter(created_by=request.user)
        schedule = get_object_or_404(schedules, pk=pk)
        serializer = ProgramScheduleSerializer(schedule, data=request.data, partial=True, context={"request": request})
        serializer.is_valid(raise_exception=True)
        if "date" in serializer.validated_data and serializer.validated_data["date"] < timezone.localdate():
            return Response({"date": ["Choose a current or future date."]}, status=400)
        old_date, old_location, old_status, old_title, old_times = schedule.date, schedule.location, schedule.publication_status, schedule.program, list(schedule.available_times)
        old_farmer_audience = schedule.farmer_audience
        old_registration_window = (schedule.registration_opens, schedule.registration_deadline)
        affected_bookings = list(schedule.bookings.filter(status=ProgramBooking.Status.CONFIRMED).select_related("farmer"))
        schedule = serializer.save()
        if schedule.publication_status != ProgramSchedule.PublicationStatus.PUBLISHED and schedule.is_open:
            schedule.is_open = False
            schedule.save(update_fields=["is_open"])
        elif old_status == ProgramSchedule.PublicationStatus.DRAFT and schedule.publication_status == ProgramSchedule.PublicationStatus.PUBLISHED and not schedule.is_open:
            schedule.is_open = True
            schedule.save(update_fields=["is_open"])
        status_changed = old_status != schedule.publication_status
        details_changed = (
            old_date != schedule.date or old_location != schedule.location or old_title != schedule.program
            or old_times != list(schedule.available_times)
            or old_farmer_audience != schedule.farmer_audience
            or old_registration_window != (schedule.registration_opens, schedule.registration_deadline)
        )
        if status_changed or details_changed:
            if schedule.publication_status == ProgramSchedule.PublicationStatus.CANCELLED:
                title, message = "Program cancelled", f"{schedule.program} on {schedule.date} has been cancelled."
            else:
                title, message = "Program details updated", f"{schedule.program} is now scheduled for {schedule.date}" + (f" at {schedule.location}." if schedule.location else ".")
            for booking in affected_bookings:
                if schedule.publication_status == ProgramSchedule.PublicationStatus.CANCELLED:
                    booking.status = ProgramBooking.Status.CANCELLED
                    booking.save(update_fields=["status"])
                create_notification(booking.farmer, title=title, message=message, link="/farmer-scheduling")
            if old_status != ProgramSchedule.PublicationStatus.PUBLISHED and schedule.publication_status == ProgramSchedule.PublicationStatus.PUBLISHED:
                _notify_program_farmers(schedule, title="Program registration is open", message=f"{schedule.program} on {schedule.date} is now open for farmer registration.")
            elif old_farmer_audience != schedule.farmer_audience and schedule.publication_status == ProgramSchedule.PublicationStatus.PUBLISHED:
                _notify_program_farmers(schedule, title="Program audience updated", message=f"{schedule.program} on {schedule.date} is now available to its updated farmer audience.")
            _notify_program_staff(schedule, title=title, message=message, exclude_user_id=request.user.pk)
    return Response(ProgramScheduleSerializer(schedule, context={"request": request}).data)

@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def bookings(request):
    role = role_of(request.user)
    if role not in (Role.UserRoles.MAO, "ADMIN", Role.UserRoles.FARMER, Role.UserRoles.SIBAT, Role.UserRoles.CBAT):
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
    try:
        with transaction.atomic():
            schedule = ProgramSchedule.objects.select_for_update().get(pk=schedule.pk)
            # Validate against this program's own times, not a global preset list.
            offered_times = schedule.available_times or list(PROGRAM_TIME_SLOTS)
            if chosen_time.strftime("%H:%M") not in offered_times:
                return Response({"time": ["Choose one of this program's offered times."]}, status=400)
            current_local_time = timezone.localtime().time().replace(tzinfo=None)
            if schedule.date == timezone.localdate() and chosen_time <= current_local_time:
                return Response({"time": ["This appointment time has already passed. Choose a later time."]}, status=400)
            if (
                schedule.publication_status != ProgramSchedule.PublicationStatus.PUBLISHED
                or not schedule.is_open
                or schedule.date < timezone.localdate()
                or (schedule.registration_opens and schedule.registration_opens > timezone.localdate())
                or (schedule.registration_deadline and schedule.registration_deadline < timezone.localdate())
            ):
                return Response({"detail": "This program is no longer available."}, status=400)
            farmer_barangay_id = getattr(getattr(request.user, "farmer_profile", None), "barangay_id", None)
            if (
                schedule.farmer_audience == ProgramSchedule.FarmerAudience.BARANGAY_ONLY
                and schedule.barangay_id != farmer_barangay_id
            ):
                return Response({"detail": "This program is not available to your barangay."}, status=403)
            confirmed_count = schedule.bookings.filter(status=ProgramBooking.Status.CONFIRMED).count()
            if schedule.capacity > 0 and confirmed_count >= schedule.capacity:
                return Response({"detail": "This program is fully booked."}, status=400)
            booking = serializer.save(farmer=request.user, schedule=schedule)
    except IntegrityError:
        return Response({"detail": "You already have a confirmed booking for this program."}, status=400)
    create_notification(request.user, title="Booking confirmed", message=f"{schedule.program} on {schedule.date} at {chosen_time.strftime('%H:%M')}.", link="/farmer-scheduling")
    _notify_program_staff(schedule, title="New program booking", message=f"A farmer booked {schedule.program} on {schedule.date}.")
    notify_role(Role.UserRoles.MAO, title="New program booking", message=f"A farmer booked {schedule.program} on {schedule.date}.", link="/schedules")
    return Response(ProgramBookingSerializer(booking).data, status=201)

@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def booking_detail(request, pk):
    if role_of(request.user) in (Role.UserRoles.MAO, "ADMIN", Role.UserRoles.SIBAT, Role.UserRoles.CBAT):
        requested_status = request.data.get("status")
        if set(request.data.keys()) != {"status"} or requested_status not in (
            ProgramBooking.Status.ATTENDED,
            ProgramBooking.Status.NO_SHOW,
            ProgramBooking.Status.CANCELLED,
        ):
            return Response({"detail": "Staff can cancel an upcoming booking or record attendance as ATTENDED or NO_SHOW."}, status=400)
        bookings_qs = ProgramBooking.objects.select_for_update().select_related("schedule", "farmer")
        if role_of(request.user) in (Role.UserRoles.SIBAT, Role.UserRoles.CBAT):
            bookings_qs = scope_reviewer_queryset(bookings_qs, request.user)
        with transaction.atomic():
            booking = get_object_or_404(bookings_qs, pk=pk)
            if booking.status != ProgramBooking.Status.CONFIRMED:
                return Response({"detail": "Only confirmed bookings can be changed."}, status=400)
            if requested_status == ProgramBooking.Status.CANCELLED:
                if booking.schedule.date < timezone.localdate() or (
                    booking.schedule.date == timezone.localdate()
                    and booking.time <= timezone.localtime().time().replace(tzinfo=None)
                ):
                    return Response({"detail": "Only upcoming bookings can be cancelled by staff."}, status=400)
            else:
                if booking.schedule.date > timezone.localdate():
                    return Response({"detail": "Attendance can be recorded on or after the program date."}, status=400)
                if booking.schedule.date == timezone.localdate() and booking.time > timezone.localtime().time().replace(tzinfo=None):
                    return Response({"detail": "Attendance cannot be recorded before the farmer's booked time."}, status=400)
            booking.status = requested_status
            booking.save(update_fields=["status"])
        if booking.status == ProgramBooking.Status.CANCELLED:
            create_notification(booking.farmer, title="Program booking cancelled", message=f"Your booking for {booking.schedule.program} on {booking.schedule.date} was cancelled by program staff.", link="/farmer-scheduling")
            _notify_program_staff(booking.schedule, title="Program booking cancelled", message=f"A booking for {booking.schedule.program} on {booking.schedule.date} was cancelled by program staff.")
            return Response(ProgramBookingSerializer(booking).data)
        label = "attended" if booking.status == ProgramBooking.Status.ATTENDED else "marked as not attending"
        create_notification(booking.farmer, title="Program attendance recorded", message=f"Your attendance for {booking.schedule.program} was {label}.", link="/farmer-scheduling")
        return Response(ProgramBookingSerializer(booking).data)

    denied = require_role(request, Role.UserRoles.FARMER)
    if denied:
        return denied
    if set(request.data.keys()) not in ({"status"}, {"time"}):
        return Response({"detail": "Update either the booking time or cancel the booking."}, status=400)

    with transaction.atomic():
        booking = get_object_or_404(
            ProgramBooking.objects.select_for_update().select_related("schedule"),
            pk=pk,
            farmer=request.user,
        )
        if booking.status != ProgramBooking.Status.CONFIRMED:
            return Response({"detail": "Only confirmed bookings can be changed."}, status=400)

        if request.data.get("status") == ProgramBooking.Status.CANCELLED:
            if booking.schedule.date < timezone.localdate():
                return Response({"detail": "Past bookings cannot be cancelled."}, status=400)
            booking.status = ProgramBooking.Status.CANCELLED
            booking.save(update_fields=["status"])
            change_type = "cancelled"
        elif "time" in request.data:
            if booking.schedule.date < timezone.localdate():
                return Response({"detail": "Past bookings cannot be changed."}, status=400)
            serializer = ProgramBookingSerializer(booking, data={"time": request.data["time"]}, partial=True)
            serializer.is_valid(raise_exception=True)
            chosen_time = serializer.validated_data["time"]
            offered_times = booking.schedule.available_times or list(PROGRAM_TIME_SLOTS)
            if chosen_time.strftime("%H:%M") not in offered_times:
                return Response({"time": ["Choose one of this program's offered times."]}, status=400)
            current_local_time = timezone.localtime().time().replace(tzinfo=None)
            if booking.schedule.date == timezone.localdate() and chosen_time <= current_local_time:
                return Response({"time": ["This appointment time has already passed. Choose a later time."]}, status=400)
            booking.time = chosen_time
            booking.save(update_fields=["time"])
            change_type = "time_changed"
        else:
            return Response({"status": ["Set status to CANCELLED or provide a new time."]}, status=400)

    if change_type == "cancelled":
        notify_message = f"A farmer cancelled {booking.schedule.program} on {booking.schedule.date}."
        farmer_message = "Your program booking was cancelled."
        notify_title = "Program booking cancelled"
    else:
        notify_message = f"A farmer changed their time for {booking.schedule.program} on {booking.schedule.date} to {booking.time.strftime('%H:%M')}."
        farmer_message = f"Your arrival time is now {booking.time.strftime('%H:%M')}."
        notify_title = "Program booking time changed"

    create_notification(request.user, title=notify_title, message=farmer_message, link="/farmer-scheduling")
    _notify_program_staff(booking.schedule, title=notify_title, message=notify_message)
    notify_role(Role.UserRoles.MAO, title=notify_title, message=notify_message, link="/schedules")
    return Response(ProgramBookingSerializer(booking).data)

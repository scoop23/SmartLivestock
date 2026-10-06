from django.db import models
from django.contrib.auth.models import AbstractUser
from phonenumber_field.modelfields import PhoneNumberField  # type: ignore
from django.conf import settings


# Custom User model: uses email as the login identifier instead of username.
# Every user is assigned a Role and an account_status that gates access.
class User(AbstractUser):
    # Tell Django to use email for authentication instead of the default username field
    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username"]

    # Account lifecycle: PENDING (after registration) → APPROVED (by admin) → SUBJECT_TO_REVISION or SUSPENDED
    class AccountStatus(models.TextChoices):
        PENDING = "PENDING", "Pending"
        APPROVED = "APPROVED", "Approved"
        SUBJECT_TO_REVISION = "SUBJECT_TO_REVISION", "Subject to Revision"
        SUSPENDED = "SUSPENDED", "Suspended"

    account_status = models.CharField(
        max_length=20, choices=AccountStatus.choices, default=AccountStatus.PENDING
    )
    email = models.EmailField(unique=True)

    created_at = models.DateTimeField(auto_now_add=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    role = models.ForeignKey("Role", on_delete=models.PROTECT)
    # Review scope is independent of a farmer address; staff are not fake farmers.
    assigned_barangay = models.ForeignKey("livestock.Barangay", on_delete=models.PROTECT,
        null=True, blank=True, related_name="assigned_reviewers")
    class AccessScope(models.TextChoices):
        ASSIGNED_ONLY = "ASSIGNED_ONLY", "Assigned barangay"
        ALL_BARANGAYS = "ALL_BARANGAYS", "All barangays"

    access_scope = models.CharField(
        max_length=20, choices=AccessScope.choices, default=AccessScope.ASSIGNED_ONLY,
    )
    phone_number = PhoneNumberField(blank=True, null=True)
    profile_image = models.ImageField(
        upload_to="profile_photos/", blank=True, null=True
    )

    def __str__(self):
        user_pk = self.pk if self.pk else "New"

        role_info = self.role if hasattr(self, "role") and self.role else "No Role"
        return f"Account {user_pk}. with role: {role_info}!. Account Status: {self.account_status}"


# Role defines what pages and features a user can access.
# FARMER → submits livestock/production data
# SIBAT → cooperative that validates farmer data
# MAO → Municipal Agriculturist Office, approves/rejects records
# ADMIN → system administrator, full access
# AUCTION → auction market staff, handles inspections & clearances
# SLAUGHTERHOUSESTAFF → slaughterhouse personnel
class Role(models.Model):
    class UserRoles(models.TextChoices):
        FARMER = "FARMER", "Farmer"
        MAO = "MAO", "Municipal Agriculturist Office"
        SIBAT = "SIBAT", "Sibat"
        AUCTION = "AUCTION", "Auction"
        SLAUGHTERHOUSESTAFF = "SLAUGHTERHOUSESTAFF", "SlaughterhouseStaff"

    role_name = models.CharField(max_length=20, choices=UserRoles.choices, unique=True)

    def __str__(self):
        return self.role_name


# Documents uploaded by farmers during registration for identity verification.
# RSBSA = Registry System for Basic Sectors in Agriculture (government farmer ID)
# Documents go through PENDING → APPROVED/SUBJECT_TO_REVISION workflow before the farmer's account is activated
class UserDocument(models.Model):
    class DocumentType(models.TextChoices):
        RSBSA = "RSBSA", "RSBSA Certificate"
        GOVERNMENT_ID = "GOVERNMENT_ID", "Government ID"
        BARANGAY_CERTIFICATE = "BARANGAY_CERTIFICATE", "Barangay Certificate"
        OTHER = "OTHER", "Other"

    class VerificationStatus(models.TextChoices):
        PENDING = "PENDING", "Pending"
        APPROVED = "APPROVED", "Approved"
        SUBJECT_TO_REVISION = "SUBJECT_TO_REVISION", "Subject to Revision"

    verification_status = models.CharField(
        max_length=20,
        choices=VerificationStatus.choices,
        default=VerificationStatus.PENDING,
    )

    # Tracks which admin/MAO reviewed the document
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="reviewed_documents",
    )

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="documents")
    document_type = models.CharField(
        max_length=20, choices=DocumentType.choices, default=DocumentType.OTHER
    )
    document_file = models.FileField(upload_to="user_documents/")
    uploaded_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    review_remarks = models.TextField(
        blank=True, default="", help_text="Reason or remarks if returned for revision"
    )

    def __str__(self):
        return f"{self.user.email} - {self.document_type}"


# Notification model: in-app notifications and biosecurity advisories delivered to users
class Notification(models.Model):
    class NotificationType(models.TextChoices):
        DISEASE = "disease", "Disease Surveillance"
        VACCINATION = "vaccination", "Vaccination Schedule"
        SIBAT = "sibat", "SIBAT Inspection"
        PRODUCTION = "production", "Production Milestone"
        WEATHER = "weather", "Weather Advisory"
        GENERAL = "general", "General Notice"
        INSPECTION = "inspection", "Livestock Inspection"

    class Priority(models.TextChoices):
        HIGH = "high", "High"
        MEDIUM = "medium", "Medium"
        LOW = "low", "Low"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    notification_type = models.CharField(
        max_length=20,
        choices=NotificationType.choices,
        default=NotificationType.GENERAL,
    )
    priority = models.CharField(
        max_length=10,
        choices=Priority.choices,
        default=Priority.MEDIUM,
    )
    title = models.CharField(max_length=200)
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    link = models.CharField(max_length=255, blank=True, null=True)
    related_entity_type = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        db_index=True,
        help_text="Entity category for notification lifecycle tracking (e.g. livestock_inventory, inspection)",
    )
    related_entity_id = models.PositiveIntegerField(
        blank=True,
        null=True,
        db_index=True,
        help_text="Primary key of the related model record",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user.email} - {self.title} ({'Read' if self.is_read else 'Unread'})"



PROGRAM_TIME_SLOTS = ("08:00", "09:30", "11:00", "13:30")

class Announcement(models.Model):
    class Audience(models.TextChoices):
        ALL = "ALL", "Farmers and SIBAT"
        FARMER = "FARMER", "Farmers"
        SIBAT = "SIBAT", "SIBAT"

    class Category(models.TextChoices):
        GENERAL = "General", "General"
        VACCINATION = "Vaccination", "Vaccination"
        ANIMAL_HEALTH = "Animal Health", "Animal Health"
        LIVESTOCK_INSPECTION = "Livestock Inspection", "Livestock Inspection"
        DISEASE_PREVENTION = "Disease Prevention", "Disease Prevention"
        FARMER_TRAINING = "Farmer Training", "Farmer Training"
        SEMINAR = "Seminar", "Seminar"
        FARMER_MEETING = "Farmer Meeting", "Farmer Meeting"
        LIVESTOCK_REGISTRATION = "Livestock Registration", "Livestock Registration"
        FIELD_VISIT = "Field Visit", "Field Visit"
        MARKET_AUCTION = "Market / Auction", "Market / Auction"
        LIVESTOCK_PROGRAM = "Livestock Program", "Livestock Program"
        BIOSECURITY_ADVISORY = "Biosecurity Advisory", "Biosecurity Advisory"
        EMERGENCY_NOTICE = "Emergency Notice", "Emergency Notice"
        OTHER = "Other", "Other"
        HEALTH_ALERT = "Health Alert", "Health Alert"
        EVENT = "Event", "Event"
        PROGRAM = "Program", "Program"
        MARKET_UPDATE = "Market Update", "Market Update"
        FIELD_MEMO = "Field Memo", "Field Memo"


    title = models.CharField(max_length=200)
    content = models.TextField()
    image = models.ImageField(upload_to="activity_images/%Y/%m/", blank=True, null=True)
    category = models.CharField(max_length=40, choices=Category.choices, default=Category.GENERAL)
    audience = models.CharField(max_length=10, choices=Audience.choices, default=Audience.ALL)
    is_published = models.BooleanField(default=False)
    is_pinned = models.BooleanField(default=False)
    posted_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="announcements")
    schedule = models.ForeignKey("ProgramSchedule", on_delete=models.SET_NULL, null=True, blank=True, related_name="announcements")
    published_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-is_pinned", "-published_at", "-created_at"]



class AnnouncementPhoto(models.Model):
    announcement = models.ForeignKey(Announcement, on_delete=models.CASCADE, related_name="photos")
    image = models.ImageField(upload_to="activity_images/%Y/%m/")
    position = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["position", "id"]


class ProgramSchedule(models.Model):
    date = models.DateField()
    capacity = models.PositiveIntegerField(default=4)
    program = models.CharField(max_length=100)
    location = models.CharField(max_length=200, blank=True)
    is_open = models.BooleanField(default=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="program_schedules")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["date", "program"]
        constraints = [
            models.UniqueConstraint(fields=["date", "program"], name="unique_program_per_day"),
            models.CheckConstraint(condition=models.Q(capacity__gte=1), name="program_capacity_at_least_one"),
        ]


class ProgramBooking(models.Model):
    class Status(models.TextChoices):
        CONFIRMED = "CONFIRMED", "Confirmed"
        CANCELLED = "CANCELLED", "Cancelled"

    schedule = models.ForeignKey(ProgramSchedule, on_delete=models.PROTECT, related_name="bookings")
    farmer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="program_bookings")
    time = models.TimeField()
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.CONFIRMED)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["schedule__date", "time"]
        constraints = [
            models.UniqueConstraint(fields=["schedule", "farmer"], condition=models.Q(status="CONFIRMED"), name="unique_farmer_program_booking"),
        ]

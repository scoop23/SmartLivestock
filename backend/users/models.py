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

    # Account lifecycle: PENDING (after registration) → APPROVED (by admin) → REJECTED or SUSPENDED
    class AccountStatus(models.TextChoices):
        PENDING = "PENDING", "Pending"
        APPROVED = "APPROVED", "Approved"
        REJECTED = "REJECTED", "Rejected"
        SUSPENDED = "SUSPENDED", "Suspended"

    account_status = models.CharField(
        max_length=20, choices=AccountStatus.choices, default=AccountStatus.PENDING
    )
    email = models.EmailField(unique=True)

    created_at = models.DateTimeField(auto_now_add=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    role = models.ForeignKey("Role", on_delete=models.PROTECT)
    phone_number = PhoneNumberField(blank=True, null=True)

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
        ADMIN = "ADMIN", "Admin"
        AUCTION = "AUCTION", "Auction"
        SLAUGHTERHOUSESTAFF = "SLAUGHTERHOUSESTAFF", "SlaughterhouseStaff"

    role_name = models.CharField(max_length=20, choices=UserRoles.choices, unique=True)

    def __str__(self):
        return self.role_name


# Documents uploaded by farmers during registration for identity verification.
# RSBSA = Registry System for Basic Sectors in Agriculture (government farmer ID)
# Documents go through PENDING → APPROVED/REJECTED workflow before the farmer's account is activated
class UserDocument(models.Model):
    class DocumentType(models.TextChoices):
        RSBSA = "RSBSA", "RSBSA Certificate"
        GOVERNMENT_ID = "GOVERNMENT_ID", "Government ID"
        BARANGAY_CERTIFICATE = "BARANGAY_CERTIFICATE", "Barangay Certificate"
        OTHER = "OTHER", "Other"

    class VerificationStatus(models.TextChoices):
        PENDING = "PENDING", "Pending"
        APPROVED = "APPROVED", "Approved"
        REJECTED = "REJECTED", "Rejected"

    verification_status = models.CharField(
        max_length=20,
        choices=VerificationStatus.choices,
        default=VerificationStatus.PENDING,
    )

    # Tracks which admin/MAO approved the document (self-referential FK — actually should point to User)
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="approved_users",
    )

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="documents")
    document_type = models.CharField(
        max_length=20, choices=DocumentType.choices, default=DocumentType.OTHER
    )
    document_file = models.FileField(upload_to="user_documents/")
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.email} - {self.document_type}"

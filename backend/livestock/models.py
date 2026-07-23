from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from decimal import Decimal
from phonenumber_field.modelfields import PhoneNumberField  # type: ignore


class Barangay(models.Model):
    barangay_name = models.CharField(max_length=255)
    latitude = models.DecimalField(max_digits=9, decimal_places=6)
    longitude = models.DecimalField(max_digits=9, decimal_places=6)
    description = models.TextField(null=True, blank=True)

    def __str__(self):
        return f"{self.barangay_name}"


class Farmer(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="farmer_profile",
    )
    barangay = models.ForeignKey(
        "Barangay", on_delete=models.PROTECT, related_name="farmers"
    )
    farm_size = models.DecimalField(
        max_digits=6, decimal_places=2, null=True, blank=True
    )
    address = models.TextField()
    registered_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} {self.user.last_name}"


# Lookup table for animal types (e.g., Cattle, Carabao, Goat, Sheep, Swine).
# Referenced by LivestockInventory, SlaughterRecord, and InspectionItem.
class LivestockType(models.Model):
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)

    def __str__(self):
        return f"{self.name}"


class LivestockInventory(models.Model):
    class EntryType(models.TextChoices):
        INDIVIDUAL = "INDIVIDUAL", "Individual"
        BATCH = "BATCH", "Batch"

    class StatusType(models.TextChoices):
        PENDING = "PENDING", "Pending"
        APPROVED = "APPROVED", "Approved"
        REJECTED = "REJECTED", "Rejected"

    farmer = models.ForeignKey(
        "Farmer", on_delete=models.PROTECT, related_name="inventories"
    )
    livestock_type = models.ForeignKey(
        "LivestockType", on_delete=models.PROTECT, related_name="inventories"
    )
    entry_type = models.CharField(
        max_length=20, choices=EntryType.choices, default=EntryType.BATCH
    )
    quantity = models.IntegerField(default=1)
    tag_number = models.CharField(max_length=50, blank=True, default="")
    breed = models.CharField(max_length=50, blank=True)
    sex = models.CharField(max_length=10, blank=True)
    weight = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.00"))],
        null=True,
        blank=True,
    )
    health_status = models.CharField(max_length=255, blank=True)
    last_vaccination_date = models.DateField(null=True, blank=True)
    status = models.CharField(
        max_length=25, choices=StatusType.choices, default=StatusType.PENDING
    )
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="reviewed_inventories",
        null=True,
        blank=True,
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    review_remarks = models.TextField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_inventories",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.farmer}, with User {self.farmer.user.account_status} - {self.livestock_type} ({self.quantity})"


class CensusSubmission(models.Model):
    class StatusType(models.TextChoices):
        PENDING = "PENDING", "Pending"
        APPROVED = "APPROVED", "Approved"
        REJECTED = "REJECTED", "Rejected"

    barangay = models.ForeignKey(
        Barangay, on_delete=models.PROTECT, related_name="barangay_census_submission"
    )

    report_year = models.PositiveIntegerField()  # maybe get only the year?

    report_quarter = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(4)]
    )

    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="submitted_census",
    )

    submission_date = models.DateField(auto_now_add=True)

    status = models.CharField(
        max_length=20, choices=StatusType.choices, default=StatusType.PENDING
    )

    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_census",
    )

    reviewed_at = models.DateTimeField(null=True, blank=True)

    review_remarks = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.barangay} Q{self.report_quarter} {self.report_year}"


class CensusSubmissionItem(models.Model):
    census_submission = models.ForeignKey(
        "CensusSubmission",
        on_delete=models.PROTECT,  # if a census_submission is deleted then it wont delete because it has an ITEM
        related_name="items",
    )
    farmer = models.ForeignKey(
        "Farmer", on_delete=models.PROTECT, related_name="farmer_submission_item"
    )
    livestock_type = models.ForeignKey(
        "LivestockType",
        on_delete=models.PROTECT,
        related_name="submission_livestock_type",
    )
    number_of_heads = models.PositiveIntegerField()

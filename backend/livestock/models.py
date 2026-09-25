from decimal import Decimal
from typing import TYPE_CHECKING
from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
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


# Grouping / cohort for batch-managed livestock (e.g. swine, poultry, goats, feedlot cattle).
# Individual animals (LivestockInventory) link to LivestockBatch via batch FK.
class LivestockBatch(models.Model):
    if TYPE_CHECKING:
        animals: models.Manager["LivestockInventory"]

    class StatusType(models.TextChoices):
        ACTIVE = "ACTIVE", "Active"
        HARVESTED = "HARVESTED", "Harvested"
        SOLD = "SOLD", "Sold"
        ARCHIVED = "ARCHIVED", "Archived"

    farmer = models.ForeignKey(
        "Farmer", on_delete=models.PROTECT, related_name="batches"
    )
    livestock_type = models.ForeignKey(
        LivestockType, on_delete=models.PROTECT, related_name="batches"
    )
    batch_name = models.CharField(max_length=100)
    batch_code = models.CharField(max_length=50, unique=True)
    housing_pen = models.CharField(max_length=100, blank=True, default="")
    feed_type = models.CharField(max_length=100, blank=True, default="")
    target_weight = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.00"))],
        null=True,
        blank=True,
    )
    target_harvest_date = models.DateField(null=True, blank=True)
    status = models.CharField(
        max_length=25, choices=StatusType.choices, default=StatusType.ACTIVE
    )
    notes = models.TextField(blank=True, default="")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_batches",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Livestock Batch"
        verbose_name_plural = "Livestock Batches"

    def __str__(self):
        return f"{self.batch_code} - {self.batch_name} ({self.livestock_type.name})"

    @property
    def total_animals(self):
        return self.animals.count()

    @property
    def average_weight(self):
        weights = [
            a.weight
            for a in self.animals.filter(weight__isnull=False)
            if a.weight is not None
        ]
        if weights:
            return round(sum(weights) / len(weights), 2)
        return None


# Each farmer's entry Livestock Inventory with its own specific Livestock Type
# which then gets stored into LivestockInventory.
# If part of a cohort/group, batch points to LivestockBatch.
class LivestockInventory(models.Model):
    class EntryType(models.TextChoices):
        INDIVIDUAL = "INDIVIDUAL", "Individual"
        BATCH = "BATCH", "Batch"

    class StatusType(models.TextChoices):
        PENDING = "PENDING", "Pending"
        VERIFIED = "VERIFIED", "Verified"
        APPROVED = "APPROVED", "Approved"
        SUBJECT_TO_REVISION = "SUBJECT_TO_REVISION", "Subject to Revision"

    batch = models.ForeignKey(
        LivestockBatch,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="animals",
        help_text="Optional cohort/batch this individual animal belongs to.",
    )
    farmer = models.ForeignKey(
        "Farmer", on_delete=models.PROTECT, related_name="inventories"
    )
    livestock_type = models.ForeignKey(
        LivestockType, on_delete=models.PROTECT, related_name="inventories"
    )
    entry_type = models.CharField(
        max_length=20, choices=EntryType.choices, default=EntryType.INDIVIDUAL
    )
    quantity = models.IntegerField(default=1, help_text="Always 1 for individual animal records.")
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
    photo = models.ImageField(
        upload_to="livestock_photos/%Y/%m/",
        null=True,
        blank=True,
        help_text="Animal photograph or digital passport portrait.",
    )
    avatar_key = models.CharField(
        max_length=50,
        blank=True,
        default="",
        help_text="Selected preset avatar key (e.g., 'cattle-brahman', 'swine-native').",
    )
    # health_status = models.CharField(max_length=255, blank=True)
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
        tag = f" [{self.tag_number}]" if self.tag_number else ""
        return f"{self.farmer} - {self.livestock_type}{tag} ({self.quantity})"


class CensusSubmission(models.Model):
    class StatusType(models.TextChoices):
        PENDING = "PENDING", "Pending"
        APPROVED = "APPROVED", "Approved"
        SUBJECT_TO_REVISION = "SUBJECT_TO_REVISION", "Subject to Revision"

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
        max_length=25, choices=StatusType.choices, default=StatusType.PENDING
    )

    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_census",
    )

    reviewed_at = models.DateTimeField(null=True, blank=True)

    remarks = models.TextField(blank=True)
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
    remarks = models.TextField(blank=True)

from django.conf import settings
from django.core.validators import MinValueValidator
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
    address = models.TextField()
    registered_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} {self.user.last_name}"


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

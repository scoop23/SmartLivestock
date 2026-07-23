from django.db import models
from django.conf import settings


# Pre-movement inspection of livestock before transport.
# shipper FK points to Farmer (if registered), but shipper_name is always stored as text
# in case the shipper isn't in the system. The shipper's Barangay is used as the origin
# on the resulting clearance certificate.
class LivestockInspection(models.Model):
    class PurposeType(models.TextChoices):
        BREEDING = "BREEDING", "Breeding"
        FATTENING = "FATTENING", "Fattening"
        SLAUGHTER = "SLAUGHTER", "Slaughter"
        UNKNOWN = "UNKNOWN", "Unknown"

    shipper = models.ForeignKey(
        "livestock.Farmer",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
    )

    shipper_name = models.CharField(max_length=255)

    destination = models.CharField(max_length=255)

    purpose = models.CharField(
        max_length=20,
        choices=PurposeType.choices,
        default=PurposeType.UNKNOWN,
    )

    inspection_date = models.DateField()

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_inspections",
    )

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Inspection #{self.pk} - {self.shipper_name}"


# Line items within an inspection — each item specifies a livestock type, quantity,
# sex, and classification (breeder/slaughter/fattening). One inspection can have multiple items.
class LivestockInspectionItem(models.Model):
    class SexType(models.TextChoices):
        MALE = "MALE", "Male"
        FEMALE = "FEMALE", "Female"
        MIXED = "MIXED", "Mixed"

    class ClassificationType(models.TextChoices):
        BREEDER = "BREEDER", "Breeder"
        SLAUGHTER = "SLAUGHTER", "Slaughter"
        FATTENING = "FATTENING", "Fattening"
        OTHER = "OTHER", "Other"

    inspection = models.ForeignKey(
        LivestockInspection,
        on_delete=models.CASCADE,
        related_name="items",
    )

    livestock_type = models.ForeignKey(
        "livestock.LivestockType",
        on_delete=models.PROTECT,
        related_name="inspection_items",
    )

    quantity = models.PositiveIntegerField()

    sex = models.CharField(
        max_length=10,
        choices=SexType.choices,
        default=SexType.MIXED,
    )

    classification = models.CharField(
        max_length=20,
        choices=ClassificationType.choices,
    )

    remarks = models.TextField(
        blank=True,
    )

    def __str__(self):
        return f"{self.livestock_type} ({self.quantity})"


# Official clearance certificate issued after a successful inspection.
# OneToOne with LivestockInspection — each inspection can have at most one clearance.
# control_number is a unique identifier printed on the physical certificate.
# Contains transport details: origin (default: Padre Garcia), vehicle plate, handler license.
class LivestockInspectionClearance(models.Model):
    class StatusType(models.TextChoices):
        PENDING = "PENDING", "Pending"
        VERIFIED = "VERIFIED", "Verified"
        APPROVED = "APPROVED", "Approved"
        REJECTED = "REJECTED", "Rejected"

    inspection = models.OneToOneField(
        LivestockInspection,
        on_delete=models.PROTECT,
        related_name="clearance",
    )

    control_number = models.CharField(
        max_length=100,
        unique=True,
    )

    date_issued = models.DateField()

    time_issued = models.TimeField()

    shipper_address = models.CharField(
        max_length=255,
    )

    origin = models.CharField(
        max_length=255,
        default="Padre Garcia, Batangas",
    )

    vehicle_plate_number = models.CharField(
        max_length=50,
        blank=True,
        null=True,
    )

    livestock_handler_license_no = models.CharField(
        max_length=100,
        blank=True,
        null=True,
    )

    issued_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="issued_clearances",
    )

    status = models.CharField(
        max_length=20,
        choices=StatusType.choices,
        default=StatusType.PENDING,
    )

    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="reviewed_clearances",
        null=True,
        blank=True,
    )

    reviewed_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    review_remarks = models.TextField(
        blank=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    def __str__(self):
        return self.control_number


# Tracks post-slaughter meat transport from origin barangay to destination.
# Links back to the SlaughterRecord that produced the meat.
# meat_type supports beef, carabeef (carabao meat), goat, pork, and chicken.
class MeatMovementRecord(models.Model):
    class MeatType(models.TextChoices):
        BEEF = "BEEF", "Beef"
        CARABEEF = "CARABEEF", "Carabeef"
        GOAT = "GOAT", "Goat"
        PORK = "PORK", "Pork"

    CHICKEN = "CHICKEN", "Chicken"

    class StatusType(models.TextChoices):
        PENDING = "PENDING", "Pending"
        VERIFIED = "VERIFIED", "Verified"
        APPROVED = "APPROVED", "Approved"
        REJECTED = "REJECTED", "Rejected"

    slaughter = models.ForeignKey(
        "production.SlaughterRecord",
        on_delete=models.PROTECT,
        related_name="meat_movements",
    )

    origin_barangay = models.ForeignKey(
        "livestock.Barangay", on_delete=models.PROTECT, related_name="outgoing_meat"
    )

    destination_barangay = models.ForeignKey(
        "livestock.Barangay", on_delete=models.PROTECT, related_name="incoming_meat"
    )

    destination_name = models.CharField(
        max_length=255,
        blank=True,
        help_text="Optional name of the destination buyer or establishment.",
    )

    meat_type = models.CharField(
        max_length=20,
        choices=MeatType.choices,
    )

    weight_kg = models.DecimalField(
        max_digits=8,
        decimal_places=2,
    )

    price_per_kg = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
    )

    total_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
    )

    movement_date = models.DateField()

    status = models.CharField(
        max_length=20,
        choices=StatusType.choices,
        default=StatusType.PENDING,
    )

    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="reviewed_meat_movements",
        null=True,
        blank=True,
    )

    reviewed_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    review_remarks = models.TextField(
        blank=True,
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_meat_movements",
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

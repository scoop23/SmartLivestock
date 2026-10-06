from django.db import models
from django.conf import settings
from django.core.exceptions import ValidationError


# Pre-movement inspection of livestock before transport.
# shipper FK points to Farmer (if registered), but shipper_name is always stored as text
# in case the shipper isn't in the system. Clearance origin uses the supplied place
# or the registered shipper address, regardless of municipality.
class LivestockInspection(models.Model):
    class PurposeType(models.TextChoices):
        BREEDING = "BREEDING", "Breeding"
        FATTENING = "FATTENING", "Fattening"
        SLAUGHTER = "SLAUGHTER", "Slaughter"
        UNKNOWN = "UNKNOWN", "Unknown"
        OTHER = "OTHER", "Other Purpose"

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

    # Internal items identify a real animal; external items remain aggregate lines.
    inventory = models.ForeignKey("livestock.LivestockInventory", on_delete=models.PROTECT,
        null=True, blank=True, related_name="inspection_items")

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

    def clean(self):
        super().clean()
        if self.quantity is None or self.quantity <= 0:
            raise ValidationError({"quantity": "Inspection head count must be positive."})
        if self.inventory_id:
            animal = self.inventory
            if self.inspection.shipper_id != animal.farmer_id:
                raise ValidationError({"inventory": "Select inventory belonging to the registered shipper."})
            if self.livestock_type_id != animal.livestock_type_id or self.quantity != 1:
                raise ValidationError({"inventory": "Internal items must match the animal species and represent one head."})
            if animal.status != "APPROVED" or animal.operational_status != "ACTIVE" or animal.quantity != 1:
                raise ValidationError({"inventory": "Select an approved, active individual animal."})

    def save(self, *args, **kwargs):
        self.clean()
        return super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.livestock_type} ({self.quantity})"


# Official clearance certificate issued after a successful inspection.
# OneToOne with LivestockInspection — each inspection can have at most one clearance.
# control_number is a unique identifier printed on the physical certificate.
# Origin preserves the supplied place or the registered shipper address; unknown stays blank.
class LivestockInspectionClearance(models.Model):
    class StatusType(models.TextChoices):
        PENDING = "PENDING", "Pending"
        VERIFIED = "VERIFIED", "Verified"
        APPROVED = "APPROVED", "Approved"
        SUBJECT_TO_REVISION = "SUBJECT_TO_REVISION", "Subject to Revision"

    inspection = models.OneToOneField(
        LivestockInspection,
        on_delete=models.PROTECT,
        related_name="clearance",
    )

    control_number = models.CharField(
        max_length=100,
        unique=True,
    )

    date_issued = models.DateField(null=True, blank=True)

    time_issued = models.TimeField(null=True, blank=True)

    shipper_address = models.CharField(
        max_length=255,
    )

    origin = models.CharField(
        max_length=255,
        blank=True,
        default="",
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
        null=True,
        blank=True,
    )

    status = models.CharField(
        max_length=25,
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

    def clean(self):
        super().clean()
        # Pending requests must not look like issued official certificates.
        issuance = (self.issued_by_id, self.date_issued, self.time_issued)
        if self.status == self.StatusType.APPROVED and not all(issuance):
            raise ValidationError("Approved clearance requires an issuer and actual issuance date/time.")
        if self.status != self.StatusType.APPROVED and any(issuance):
            raise ValidationError("Issuance fields must remain empty until clearance is approved.")

    def save(self, *args, **kwargs):
        if not self.origin and self.inspection_id and self.inspection.shipper_id:
            # The address may be outside Padre Garcia; no municipality is guessed.
            self.origin = self.inspection.shipper.address.strip()
            if kwargs.get("update_fields") is not None:
                kwargs["update_fields"] = set(kwargs["update_fields"]) | {"origin"}
        self.clean()
        return super().save(*args, **kwargs)

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
        SUBJECT_TO_REVISION = "SUBJECT_TO_REVISION", "Subject to Revision"

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
        max_length=25,
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

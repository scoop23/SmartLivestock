from django.db import models


# Create your models here.
class LivestockInpection(models.Model):
    class PurposeType(models.TextChoices):
        BREEDING = "BREEDING", "Breeding"
        FATTENING = "FATTENING", "Fattening"
        SLAUGHTER = "SLAUGHTER", "Slaughter"
        UNKNOWN = "UNKNOWN", "Unknown"

    shipper_name = models.CharField(max_length=255)
    livestock_type = models.ForeignKey(
        "livestock.LivestockType", on_delete=models.PROTECT
    )
    quantity = models.PositiveIntegerField()
    purpose = models.CharField(
        max_length=100, choices=PurposeType.choices, default=PurposeType.UNKNOWN
    )
    destination = models.CharField(max_length=255)
    inspection_date = models.DateField()
    created_by = models.ForeignKey(
        "users.User", on_delete=models.PROTECT, related_name="created_inspections"
    )


class LivestockInpectionClearance(models.Model):
    class StatusType(models.TextChoices):
        PENDING = "PENDING", "Pending"
        VERIFIED = "VERIFIED", "Verified"
        APPROVED = "APPROVED", "Approved"
        REJECTED = "REJECTED", "Rejected"

    inspection = models.ForeignKey(
        LivestockInpection, on_delete=models.CASCADE, related_name="clearances"
    )
    control_number = models.CharField(max_length=100, unique=True)
    date_issued = models.DateField()
    time_issued = models.TimeField(auto_now_add=True)
    shipper_name = models.CharField(max_length=255)
    shipper_address = models.CharField(max_length=255)
    origin = models.CharField(max_length=255, default="Padre Garcia, Batangas")
    destination = models.CharField(max_length=255)
    vehicle_number = models.CharField(max_length=50, blank=True, null=True)
    livestock_handler_license_no = models.CharField(
        max_length=100, blank=True, null=True
    )
    issued_by = models.ForeignKey(
        "users.User", on_delete=models.PROTECT, related_name="issued_clearances"
    )
    status = models.CharField(
        max_length=20, choices=StatusType.choices, default=StatusType.PENDING
    )
    reviewed_by = models.ForeignKey(
        "users.User",
        on_delete=models.PROTECT,
        related_name="reviewed_clearances",
        null=True,
        blank=True,
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    review_remarks = models.TextField(blank=True)

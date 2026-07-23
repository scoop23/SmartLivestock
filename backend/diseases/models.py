from django.db import models
from django.conf import settings
from django.db.models.fields import related


# Reports a disease outbreak affecting a farmer's livestock.
# linked to LivestockInventory so we can trace which animals are affected.
# affected_count may differ from the inventory quantity (not all animals may be sick).
class DiseaseCase(models.Model):
    class DiseaseStatus(models.TextChoices):
        PENDING = "PENDING", "Pending"
        VERIFIED = "VERIFIED", "Verified"
        APPROVED = "APPROVED", "Approved"
        REJECTED = "REJECTED", "Rejected"

    livestock = models.ForeignKey(
        "livestock.LivestockInventory",
        on_delete=models.PROTECT,
        related_name="disease_cases",
    )
    name = models.CharField(max_length=150, blank=False)
    affected_count = models.IntegerField(default=0)
    record_date = models.DateField(blank=True, null=True)
    status = models.CharField(
        max_length=50, choices=DiseaseStatus.choices, default=DiseaseStatus.PENDING
    )
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="reviewed_disease_cases",
        null=True,
        blank=True,
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    review_remarks = models.TextField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_disease_case",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Farmer {self.livestock.farmer.user.username} with {self.livestock.quantity} {self.livestock.livestock_type} have {self.name} disease with {self.affected_count} counts"


# Records livestock deaths. Optionally linked to a DiseaseCase via source_disease_case
# to track disease-related mortality. If the death is unrelated to a known disease,
# source_disease_case can be null and cause describes the reason directly.
class MortalityRecord(models.Model):
    class MortalityRecordStatus(models.TextChoices):
        PENDING = "PENDING", "Pending"
        VERIFIED = "VERIFIED", "Verified"
        APPROVED = "APPROVED", "Approved"
        REJECTED = "REJECTED", "Rejected"

    livestock = models.ForeignKey(
        "livestock.LivestockInventory",
        on_delete=models.PROTECT,
        related_name="mortality_cases",
    )
    death_count = models.PositiveIntegerField()
    cause = models.TextField()
    source_disease_case = models.ForeignKey(
        "DiseaseCase",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="mortality_records",
        help_text="Optional disease case that caused these deaths.",
    )
    record_date = models.DateField(blank=True, null=True)
    status = models.CharField(
        max_length=50,
        choices=MortalityRecordStatus.choices,
        default=MortalityRecordStatus.PENDING,
    )
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="reviewed_mortality_records",
        null=True,
        blank=True,
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    review_remarks = models.TextField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_mortality_records",
    )
    created_at = models.DateTimeField(auto_now_add=True)

from django.db import models
from django.conf import settings

# Create your models here.


class ProductionRecord(models.Model):
    class ProductionType(models.TextChoices):
        MILK = "MILK", "Milk"
        EGGS = "EGGS", "Eggs"
        WOOL = "WOOL", "Wool"

    class UnitType(models.TextChoices):
        LITERS = "LITERS", "Liters"
        PIECES = "PIECES", "Pieces"
        KILOGRAMS = "KILOGRAMS", "Kilograms"

    class ProductionStatus(models.TextChoices):
        PENDING = "PENDING", "Pending"
        VERIFIED = "VERIFIED", "Verified"
        APPROVED = "APPROVED", "Approved"
        REJECTED = "REJECTED", "Rejected"

    livestock = models.ForeignKey(
        "livestock.LivestockInventory",
        on_delete=models.PROTECT,
        related_name="production_records",
    )

    production_type = models.CharField(
        max_length=20,
        choices=ProductionType.choices,
    )

    quantity = models.DecimalField(
        max_digits=10,
        decimal_places=2,
    )

    unit = models.CharField(
        max_length=20,
        choices=UnitType.choices,
    )

    record_date = models.DateField()

    status = models.CharField(
        max_length=20,
        choices=ProductionStatus.choices,
        default=ProductionStatus.PENDING,
    )

    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="reviewed_production_records",
    )

    reviewed_at = models.DateTimeField(null=True, blank=True)

    review_remarks = models.TextField(blank=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_production_records",
    )

    created_at = models.DateTimeField(auto_now_add=True)


class SlaughterRecord(models.Model):
    class StatusType(models.TextChoices):
        PENDING = "PENDING", "Pending"
        VERIFIED = "VERIFIED", "Verified"
        APPROVED = "APPROVED", "Approved"
        REJECTED = "REJECTED", "Rejected"

    livestock = models.ForeignKey(
        "livestock.LivestockInventory",
        on_delete=models.PROTECT,
        related_name="slaughter_records",
        null=True,
        blank=True,
    )

    barangay = models.ForeignKey(
        "livestock.Barangay",
        on_delete=models.PROTECT,
        related_name="slaughter_records",
        null=True,
        blank=True,
    )

    livestock_type = models.ForeignKey(
        "livestock.LivestockType",
        on_delete=models.PROTECT,
        related_name="slaughter_records",
    )

    quantity = models.PositiveIntegerField()

    carcass_weight = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Optional total meat produced in kilograms.",
    )

    record_date = models.DateField()

    status = models.CharField(
        max_length=20,
        choices=StatusType.choices,
        default=StatusType.PENDING,
    )

    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="reviewed_slaughter_records",
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
        related_name="created_slaughter_records",
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )


class LiveAnimalSale(models.Model):
    class StatusType(models.TextChoices):
        PENDING = "PENDING", "Pending"
        VERIFIED = "VERIFIED", "Verified"
        APPROVED = "APPROVED", "Approved"
        REJECTED = "REJECTED", "Rejected"

    class SalePurpose(models.TextChoices):
        BREEDING = "BREEDING", "Breeding"
        FATTENING = "FATTENING", "Fattening"
        SLAUGHTER = "SLAUGHTER", "Slaughter"
        UNKNOWN = "UNKNOWN", "Unknown"

    livestock = models.ForeignKey(
        "livestock.LivestockInventory",
        on_delete=models.PROTECT,
        related_name="live_animal_sales",
    )

    quantity = models.PositiveIntegerField()

    total_live_weight = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Optional combined weight of all animals sold.",
    )

    price_per_head = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
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

    destination = models.CharField(
        max_length=255,
        blank=True,
        help_text="Buyer or destination municipality.",
    )

    sale_date = models.DateField()

    status = models.CharField(
        max_length=20,
        choices=StatusType.choices,
        default=StatusType.PENDING,
    )

    purpose = models.CharField(
        max_length=20, choices=SalePurpose.choices, default=SalePurpose.UNKNOWN
    )

    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="reviewed_sale_records",
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
        related_name="created_sale_records",
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )


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

    # slaughter = models.ForeignKey(
    #     "SlaughterRecord",
    # )

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

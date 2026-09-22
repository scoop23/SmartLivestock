from django.db import models
from django.conf import settings


# Tracks daily/non-daily production output from livestock.
# Supports three production types: milk (liters), eggs (pieces), wool (kilograms).
# Status lifecycle: PENDING → VERIFIED → APPROVED/SUBJECT_TO_REVISION
class ProductionRecord(models.Model):
    class ProductionType(models.TextChoices):
        MILK = "MILK", "Milk"
        MEAT = "MEAT", "Meat"
        EGGS = "EGGS", "Eggs"
        WOOL = "WOOL", "Wool"

    class UnitType(models.TextChoices):
        LITERS = "LITERS", "Liters"
        PIECES = "PIECES", "Pieces"
        KILOGRAMS = "KILOGRAMS", "Kilograms"

    class ProductionStatus(models.TextChoices):
        PENDING = "PENDING", "Pending"
        VERIFIED = "VERIFIED", "Verified" # might remove
        APPROVED = "APPROVED", "Approved"
        SUBJECT_TO_REVISION = "SUBJECT_TO_REVISION", "Subject to Revision"

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
        max_length=25,
        choices=ProductionStatus.choices,
        default=ProductionStatus.PENDING,
    )

    notes = models.TextField(
        max_length=500,
        blank=True,
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


# "Katay" (butcher/slaughter) records.
# livestock FK is nullable for batch-level slaughtering where individual tracking isn't feasible.
# carcass_weight tracks meat yield in kg — feeds into MeatMovementRecord for post-slaughter transport.
class SlaughterRecord(models.Model):
    class StatusType(models.TextChoices):
        PENDING = "PENDING", "Pending"
        VERIFIED = "VERIFIED", "Verified"
        APPROVED = "APPROVED", "Approved"
        SUBJECT_TO_REVISION = "SUBJECT_TO_REVISION", "Subject to Revision"

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
        max_length=25,
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


# Tracks live animal sales at auction markets.
# sale_method: MATA-MATA = price estimated by visual inspection (traditional),
#              WEIGHING = price based on actual weight.
# purpose: BREEDING, FATTENING, SLAUGHTER, or UNKNOWN.
# NOTE: May be removed if auction sales are tracked through LivestockInspection instead.
class LiveAnimalSale(models.Model):  # may be removed
    class StatusType(models.TextChoices):
        PENDING = "PENDING", "Pending"
        VERIFIED = "VERIFIED", "Verified"
        APPROVED = "APPROVED", "Approved"
        SUBJECT_TO_REVISION = "SUBJECT_TO_REVISION", "Subject to Revision"

    class SalePurpose(models.TextChoices):
        BREEDING = "BREEDING", "Breeding"
        FATTENING = "FATTENING", "Fattening"
        SLAUGHTER = "SLAUGHTER", "Slaughter"
        UNKNOWN = "UNKNOWN", "Unknown"

    class SaleMethod(models.TextChoices):
        MATA_MATA = (
            "MATA-MATA",
            "Mata-mata",
        )
        WEIGHING = "WEIGHING", "Weighing"
        OTHER = "OTHER", "Other"

    livestock = models.ForeignKey(
        "livestock.LivestockInventory",
        on_delete=models.PROTECT,
        related_name="live_animal_sales",
    )

    quantity = models.PositiveIntegerField()

    sale_method = models.CharField(
        max_length=20,
        choices=SaleMethod.choices,
        default=SaleMethod.MATA_MATA,
    )

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
        max_length=25,
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


# Historical body weight logs for cattle and other livestock to monitor weight gain (ADG)
class WeightRecord(models.Model):
    livestock = models.ForeignKey(
        "livestock.LivestockInventory",
        on_delete=models.CASCADE,
        related_name="weight_records",
    )
    weight = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        help_text="Recorded weight in kilograms.",
    )
    weighing_date = models.DateField()
    notes = models.CharField(max_length=255, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_weight_records",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-weighing_date", "-created_at"]


# Birth and calving records linking mother (dam) to offspring
class CalvingRecord(models.Model):
    class SexType(models.TextChoices):
        MALE = "MALE", "Male"
        FEMALE = "FEMALE", "Female"

    dam = models.ForeignKey(
        "livestock.LivestockInventory",
        on_delete=models.PROTECT,
        related_name="calving_records",
        help_text="Mother cow / dam.",
    )
    calf_tag = models.CharField(max_length=50, blank=True)
    calf_sex = models.CharField(max_length=10, choices=SexType.choices, default=SexType.FEMALE)
    birth_weight = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Birth weight in kilograms.",
    )
    sire_tag = models.CharField(
        max_length=50,
        blank=True,
        help_text="Father / sire bull tag or breed origin.",
    )
    calving_date = models.DateField()
    breed = models.CharField(max_length=50, blank=True)
    calving_ease = models.CharField(max_length=50, blank=True, default="Normal / Unassisted")
    notes = models.TextField(max_length=500, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_calving_records",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-calving_date", "-created_at"]


# Declared commercial disposition intent (For Sale, For Slaughter, Farm Movement)
class AnimalDisposition(models.Model):
    class IntentType(models.TextChoices):
        FOR_SALE = "FOR_SALE", "Intended for Sale"
        FOR_SLAUGHTER = "FOR_SLAUGHTER", "Intended for Slaughter"
        FOR_MOVEMENT = "FOR_MOVEMENT", "Farm Transfer / Movement"
        NONE = "NONE", "Active in Herd"

    livestock = models.ForeignKey(
        "livestock.LivestockInventory",
        on_delete=models.CASCADE,
        related_name="dispositions",
    )
    intent = models.CharField(
        max_length=20,
        choices=IntentType.choices,
        default=IntentType.FOR_SALE,
    )
    target_date = models.DateField(null=True, blank=True)
    target_destination = models.CharField(max_length=255, blank=True)
    notes = models.CharField(max_length=255, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_dispositions",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

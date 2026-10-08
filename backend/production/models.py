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
        null=True,
        blank=True,
    )
    batch = models.ForeignKey(
        "livestock.LivestockBatch",
        on_delete=models.SET_NULL,
        related_name="production_records",
        null=True,
        blank=True,
        help_text="Optional link if production is recorded for an entire batch.",
    )
    # Keep the producing farmer fixed to the recording period: the linked animal's
    # current owner may change later, while the historical production attribution must not.
    farmer_at_record = models.ForeignKey(
        "livestock.Farmer", on_delete=models.PROTECT, null=True, blank=True,
        related_name="production_records_at_time",
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

    # A meat entry is a projection of one authoritative slaughter event.
    slaughter = models.OneToOneField("SlaughterRecord", on_delete=models.PROTECT,
        null=True, blank=True, related_name="production_output")

    valuation_snapshot = models.JSONField(null=True, blank=True, editable=False)

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

    def save(self, *args, **kwargs):
        # Keep attribution stable even for existing service/seed code that creates model instances directly.
        if self.farmer_at_record_id is None:
            if self.livestock_id:
                self.farmer_at_record_id = self.livestock.farmer_id
            elif self.batch_id:
                self.farmer_at_record_id = self.batch.farmer_id
        super().save(*args, **kwargs)


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
    batch = models.ForeignKey(
        "livestock.LivestockBatch",
        on_delete=models.SET_NULL,
        related_name="slaughter_records",
        null=True,
        blank=True,
        help_text="Optional link if slaughter is recorded for a herd.",
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

    # Weight cannot identify animals: preserve the exact inventory IDs independently.
    selected_animals = models.ManyToManyField("livestock.LivestockInventory",
        through="SlaughterAnimal", related_name="selected_slaughters", blank=True)
    inventory_reconciled_at = models.DateTimeField(null=True, blank=True)

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


class SlaughterAnimal(models.Model):
    slaughter = models.ForeignKey(SlaughterRecord, on_delete=models.CASCADE)
    animal = models.ForeignKey("livestock.LivestockInventory", on_delete=models.PROTECT)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["slaughter", "animal"], name="unique_slaughter_animal")]


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
        null=True,
        blank=True,
    )
    batch = models.ForeignKey(
        "livestock.LivestockBatch",
        on_delete=models.SET_NULL,
        related_name="live_animal_sales",
        null=True,
        blank=True,
        help_text="Optional link if animals are sold from a herd.",
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
    inventory_reconciled_at = models.DateTimeField(null=True, blank=True)


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

    class StatusType(models.TextChoices):
        PENDING = "PENDING", "Pending"
        VERIFIED = "VERIFIED", "Verified"
        APPROVED = "APPROVED", "Approved"
        SUBJECT_TO_REVISION = "SUBJECT_TO_REVISION", "Subject to Revision"

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
    status = models.CharField(
        max_length=25,
        choices=StatusType.choices,
        default=StatusType.PENDING,
    )
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="reviewed_calving_records",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    review_remarks = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_calving_records",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    offspring_inventory = models.OneToOneField(
        "livestock.LivestockInventory",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="source_calving_record",
    )
    inventory_reconciled_at = models.DateTimeField(null=True, blank=True)

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


class PSACommodityMapping(models.Model):
    """An explicit species/product mapping; it never changes production eligibility."""
    livestock_type = models.ForeignKey("livestock.LivestockType", on_delete=models.PROTECT)
    production_type = models.CharField(max_length=20, choices=ProductionRecord.ProductionType.choices)
    unit = models.CharField(max_length=20, choices=ProductionRecord.UnitType.choices)
    commodity_id = models.CharField(max_length=100)
    active = models.BooleanField(default=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["livestock_type", "production_type", "unit"], name="unique_psa_product_mapping")]

    def clean(self):
        from django.core.exceptions import ValidationError
        from .serializer import allowed_production_types, PRODUCTION_UNITS
        if self.production_type not in allowed_production_types(self.livestock_type.name):
            raise ValidationError("This species does not support the selected production type.")
        if PRODUCTION_UNITS.get(self.production_type) != self.unit:
            raise ValidationError("The reference unit must match the production unit.")

    def __str__(self):
        return f"{self.livestock_type}: {self.production_type} / {self.unit}"


class PSAReferencePrice(models.Model):
    class ProductBasis(models.TextChoices):
        MILK = "MILK", "Milk"
        EGGS = "EGGS", "Eggs"
        CARCASS = "CARCASS", "Carcass/meat yield"
        WOOL = "WOOL", "Wool"
        LIVEWEIGHT = "LIVEWEIGHT", "Live animal weight (not meat yield)"

    commodity_id = models.CharField(max_length=100)
    commodity = models.CharField(max_length=150)
    product_basis = models.CharField(max_length=20, choices=ProductBasis.choices)
    unit = models.CharField(max_length=20, choices=ProductionRecord.UnitType.choices)
    price = models.DecimalField(max_digits=12, decimal_places=4)
    period_start = models.DateField()
    period_end = models.DateField()
    reference_period = models.CharField(max_length=100)
    geographic_level = models.CharField(max_length=50, default="NATIONAL")
    geography = models.CharField(max_length=100, default="Philippines")
    source_url = models.URLField(max_length=500)
    source_title = models.CharField(max_length=250)
    source_table = models.CharField(max_length=100)
    publication_status = models.CharField(max_length=50, default="Preliminary")
    revision = models.PositiveIntegerField(default=1)
    active = models.BooleanField(default=True)
    loaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.CheckConstraint(condition=models.Q(price__gt=0), name="positive_psa_price"),
            models.CheckConstraint(condition=models.Q(period_end__gte=models.F("period_start")), name="valid_psa_period"),
            models.UniqueConstraint(fields=["commodity_id", "period_start", "period_end", "revision", "geographic_level", "geography"], name="unique_psa_price_revision"),
        ]

    def clean(self):
        from django.core.exceptions import ValidationError
        from urllib.parse import urlparse
        host = urlparse(self.source_url).hostname or ""
        if host != "psa.gov.ph" and not host.endswith(".psa.gov.ph"):
            raise ValidationError("Reference evidence must link to the official PSA website.")
        if self.price <= 0 or self.period_end < self.period_start:
            raise ValidationError("A positive price and valid reference period are required.")

    def save(self, *args, **kwargs):
        from django.core.exceptions import ValidationError
        # Publish a new revision instead of silently changing historical evidence.
        if self.pk:
            previous = type(self).objects.get(pk=self.pk)
            for field in self._meta.concrete_fields:
                if field.name not in {"id", "active", "loaded_at"} and getattr(previous, field.name) != getattr(self, field.name):
                    raise ValidationError("PSA references are immutable; add a new revision and deactivate the old one.")
        self.full_clean()
        return super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.commodity}: {self.reference_period} ({self.geography})"

from django.db import models
from django.conf import settings


# Tracks daily/non-daily production output from livestock.
# Supports milk, meat, eggs, and wool as farmer production logs.
# New logs are RECORDED; earlier PENDING/VERIFIED/APPROVED records retain their history.
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
        RECORDED = "RECORDED", "Recorded by farmer"
        PENDING = "PENDING", "Pending"
        VERIFIED = "VERIFIED", "Verified" # might remove
        APPROVED = "APPROVED", "Approved"
        SUBJECT_TO_REVISION = "SUBJECT_TO_REVISION", "Subject to Revision"

    class MilkingSession(models.TextChoices):
        MORNING = "MORNING", "Morning Session (6:00 AM)"
        AFTERNOON = "AFTERNOON", "Afternoon Session (2:00 PM)"
        EVENING = "EVENING", "Evening Session (6:00 PM)"

    class AnomalyAssessmentStatus(models.TextChoices):
        NOT_APPLICABLE = "NOT_APPLICABLE", "Not Applicable"
        UNAVAILABLE = "UNAVAILABLE", "Assessment Unavailable"
        INSUFFICIENT_HISTORY = "INSUFFICIENT_HISTORY", "Insufficient History"
        CLEAN = "CLEAN", "Assessed — No Anomaly Detected"
        ANOMALY_DETECTED = "ANOMALY_DETECTED", "Unusual yield (advisory)"

    class ReviewQueue(models.TextChoices):
        SIBAT = "SIBAT", "SIBAT Field Verification"
        CBAT = "CBAT", "CBAT Milk Anomaly Verification"
        MAO = "MAO", "MAO Final Approval"
        FARMER = "FARMER", "Farmer Revision Required"
        NONE = "NONE", "Completed"

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

    # Milk is recorded per session. Null is retained for legacy records whose
    # original session cannot be recovered safely from their notes.
    milking_session = models.CharField(
        max_length=12,
        choices=MilkingSession.choices,
        null=True,
        blank=True,
    )
    session_conflict = models.BooleanField(default=False, db_index=True)

    status = models.CharField(
        max_length=25,
        choices=ProductionStatus.choices,
        default=ProductionStatus.PENDING,
    )

    # Optional link used only when the farmer explicitly submits an official
    # slaughter report alongside a meat-yield log. Ordinary yield logs stay unlinked.
    slaughter = models.OneToOneField("SlaughterRecord", on_delete=models.PROTECT,
        null=True, blank=True, related_name="production_output")

    valuation_snapshot = models.JSONField(null=True, blank=True, editable=False)

    # Cow-specific milk assessment; new farmer logs use this only as advice.
    anomaly_assessment_status = models.CharField(
        max_length=24,
        choices=AnomalyAssessmentStatus.choices,
        default=AnomalyAssessmentStatus.NOT_APPLICABLE,
        db_index=True,
    )
    anomaly_detected = models.BooleanField(default=False, db_index=True)
    requires_cbat_verification = models.BooleanField(default=False, db_index=True)
    next_review_queue = models.CharField(
        max_length=16,
        choices=ReviewQueue.choices,
        default=ReviewQueue.SIBAT,
        db_index=True,
    )
    anomaly_reason = models.TextField(blank=True, default="")
    anomaly_assessment = models.JSONField(null=True, blank=True)

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

    # Approval is a distinct event from the most recent reviewer action.
    approved_at = models.DateTimeField(null=True, blank=True, db_index=True)

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

        update_fields = kwargs.get("update_fields")
        if self.status == self.ProductionStatus.APPROVED and self.approved_at is None:
            from django.utils import timezone

            self.approved_at = timezone.now()
            if update_fields is not None and "approved_at" not in update_fields:
                kwargs["update_fields"] = [*update_fields, "approved_at"]
        elif self.status != self.ProductionStatus.APPROVED and self.approved_at is not None:
            self.approved_at = None
            if update_fields is not None and "approved_at" not in update_fields:
                kwargs["update_fields"] = [*update_fields, "approved_at"]
        if (
            self.status == self.ProductionStatus.PENDING
            and self.production_type == self.ProductionType.MILK
            and self.livestock_id
            and self.anomaly_assessment is None
            and update_fields is None
        ):
            from production.services.milk_anomaly import apply_milk_anomaly_assessment

            apply_milk_anomaly_assessment(self)
        elif self.status == self.ProductionStatus.VERIFIED:
            self.next_review_queue = self.ReviewQueue.MAO
            if update_fields is not None and "next_review_queue" not in update_fields:
                kwargs["update_fields"] = [*update_fields, "next_review_queue"]
        elif self.status == self.ProductionStatus.APPROVED:
            self.next_review_queue = self.ReviewQueue.NONE
            if update_fields is not None and "next_review_queue" not in update_fields:
                kwargs["update_fields"] = [*update_fields, "next_review_queue"]
        elif self.status == self.ProductionStatus.SUBJECT_TO_REVISION:
            self.next_review_queue = self.ReviewQueue.FARMER
            if update_fields is not None and "next_review_queue" not in update_fields:
                kwargs["update_fields"] = [*update_fields, "next_review_queue"]
        elif self.status == self.ProductionStatus.RECORDED:
            self.next_review_queue = self.ReviewQueue.NONE
            self.requires_cbat_verification = False
            if update_fields is not None:
                fields = list(kwargs.get("update_fields", update_fields))
                for field in ("next_review_queue", "requires_cbat_verification"):
                    if field not in fields:
                        fields.append(field)
                kwargs["update_fields"] = fields

        super().save(*args, **kwargs)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("livestock", "record_date", "milking_session"),
                condition=models.Q(
                    production_type="MILK", milking_session__isnull=False, session_conflict=False,
                    livestock__isnull=False,
                ),
                name="unique_milk_animal_date_session",
            ),
            models.UniqueConstraint(
                fields=("batch", "record_date", "milking_session"),
                condition=models.Q(
                    production_type="MILK", milking_session__isnull=False, session_conflict=False,
                    batch__isnull=False,
                ),
                name="unique_milk_batch_date_session",
            ),
        ]


class ProductionRecordWorkflowEvent(models.Model):
    """Append-only submission and review events for a production record."""

    class EventType(models.TextChoices):
        SUBMITTED = "SUBMITTED", "Submitted"
        RESUBMITTED = "RESUBMITTED", "Resubmitted"
        VERIFIED = "VERIFIED", "Verified"
        APPROVED = "APPROVED", "Approved"
        RETURNED = "RETURNED", "Returned for revision"

    production_record = models.ForeignKey(
        ProductionRecord, on_delete=models.CASCADE, related_name="workflow_events"
    )
    event_type = models.CharField(max_length=16, choices=EventType.choices)
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    from_status = models.CharField(max_length=25, blank=True)
    to_status = models.CharField(max_length=25)
    remarks = models.TextField(blank=True)
    snapshot = models.JSONField(default=dict, blank=True)
    occurred_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ("occurred_at", "pk")


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


class MilkAnomalyDemoOwnership(models.Model):
    """Auditable ownership markers for objects created by the milk anomaly demo seed."""

    class ObjectType(models.TextChoices):
        USER = "user", "User"
        FARMER = "farmer", "Farmer profile"
        LIVESTOCK = "livestock", "Livestock inventory"
        PRODUCTION_RECORD = "production_record", "Production record"
        NOTIFICATION = "notification", "Notification"

    identifier = models.CharField(max_length=160, unique=True)
    object_type = models.CharField(max_length=24, choices=ObjectType.choices)
    object_id = models.PositiveBigIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["object_type", "object_id"],
                name="unique_milk_demo_owned_object",
            ),
        ]
        ordering = ["identifier"]

    def __str__(self):
        return f"Milk demo {self.identifier} ({self.object_type}:{self.object_id})"


def get_species_gestation_days(livestock_type_name: str | None) -> int:
    """Return standard biological gestation period in days for livestock species."""
    name = (livestock_type_name or "").lower()
    if any(k in name for k in ["carabao", "kalabaw", "buffalo"]):
        return 310
    if any(k in name for k in ["goat", "kambing", "caprine"]):
        return 150
    if any(k in name for k in ["sheep", "tupa", "ovine", "lamb", "ram"]):
        return 147
    if any(k in name for k in ["swine", "pig", "baboy", "hog", "porcine"]):
        return 114
    return 283  # Default cattle / cow


class BreedingRecord(models.Model):
    """
    Farmbrite-style breeding & insemination tracker:
    Logs mating / AI events, calculates expected due dates, and tracks active gestation.
    """
    class BreedingType(models.TextChoices):
        ARTIFICIAL_INSEMINATION = "ARTIFICIAL_INSEMINATION", "Artificial Insemination (AI)"
        NATURAL = "NATURAL", "Natural Service / Bull Mating"
        EMBRYO_TRANSFER = "EMBRYO_TRANSFER", "Embryo Transfer"

    class BreedingStatus(models.TextChoices):
        PENDING_CHECK = "PENDING_CHECK", "Inseminated / Awaiting Check"
        PREGNANT = "PREGNANT", "Confirmed Pregnant / Gestating"
        CALVED = "CALVED", "Calved / Parturition Recorded"
        OPEN = "OPEN", "Open / Not Pregnant / Re-bred"

    dam = models.ForeignKey(
        "livestock.LivestockInventory",
        on_delete=models.PROTECT,
        related_name="breeding_events",
        help_text="Mother cow / dam.",
    )
    breeding_date = models.DateField(help_text="Date of breeding or insemination.")
    breeding_type = models.CharField(
        max_length=32,
        choices=BreedingType.choices,
        default=BreedingType.ARTIFICIAL_INSEMINATION,
    )
    sire_livestock = models.ForeignKey(
        "livestock.LivestockInventory",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sire_breeding_events",
        help_text="Optional link to sire bull in inventory if bull is registered on-farm/herd.",
    )
    sire_tag_or_code = models.CharField(
        max_length=100,
        blank=True,
        help_text="Sire bull tag number, or semen straw batch code.",
    )
    sire_breed = models.CharField(
        max_length=80,
        blank=True,
        help_text="Sire breed.",
    )
    technician_or_inseminator = models.CharField(
        max_length=120,
        blank=True,
        help_text="Technician, AI officer, or farmer who performed insemination.",
    )
    pregnancy_confirmed_date = models.DateField(
        null=True,
        blank=True,
        help_text="Date pregnancy was officially confirmed by palpation, ultrasound, or authorized tech.",
    )
    pregnancy_confirmed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="confirmed_breeding_pregnancies",
    )
    confirmation_method = models.CharField(
        max_length=60,
        blank=True,
        default="",
        help_text="Method of pregnancy diagnosis (e.g., Rectal Palpation, Ultrasound, Vet Exam).",
    )
    calving_record = models.ForeignKey(
        "CalvingRecord",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="breeding_events",
        help_text="Link to resulting calving event that completed this cycle.",
    )
    gestation_days = models.PositiveIntegerField(
        default=283,
        help_text="Standard biological gestation length in days.",
    )
    expected_due_date = models.DateField(
        null=True,
        blank=True,
        help_text="Calculated or estimated expected due date.",
    )
    status = models.CharField(
        max_length=24,
        choices=BreedingStatus.choices,
        default=BreedingStatus.PENDING_CHECK,
    )
    notes = models.TextField(blank=True, max_length=500)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_breeding_records",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-breeding_date", "-created_at"]

    def save(self, *args, **kwargs):
        if not self.expected_due_date and self.breeding_date:
            from datetime import timedelta
            livestock_type = getattr(getattr(self.dam, "livestock_type", None), "name", "")
            days = self.gestation_days or get_species_gestation_days(livestock_type)
            self.gestation_days = days
            self.expected_due_date = self.breeding_date + timedelta(days=days)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Breeding {self.dam.tag_number or self.dam.id} on {self.breeding_date} ({self.breeding_type})"


class LivestockTreatmentRecord(models.Model):
    """
    Veterinary and health management tracker:
    Connects individual livestock to clinical treatments, medications, deworming,
    reproductive therapies, and vaccinations with dosage, route, and follow-up.
    """
    class TreatmentType(models.TextChoices):
        VACCINATION = "VACCINATION", "Vaccination / Immunization"
        ANTIBIOTIC = "ANTIBIOTIC", "Antibiotic / Anti-infective"
        DEWORMING = "DEWORMING", "Deworming / Antiparasitic"
        VITAMIN_SUPPLEMENT = "VITAMIN_SUPPLEMENT", "Vitamin / Mineral Supplement"
        REPRODUCTIVE_THERAPY = "REPRODUCTIVE_THERAPY", "Reproductive Therapy / Hormone"
        WOUND_CARE = "WOUND_CARE", "Wound Care / Antiseptic"
        OTHER = "OTHER", "Other Clinical Treatment"

    livestock = models.ForeignKey(
        "livestock.LivestockInventory",
        on_delete=models.PROTECT,
        related_name="treatment_records",
        help_text="Animal receiving treatment.",
    )
    treatment_date = models.DateField(help_text="Date treatment was administered.")
    treatment_type = models.CharField(
        max_length=32,
        choices=TreatmentType.choices,
        default=TreatmentType.OTHER,
    )
    medication_name = models.CharField(
        max_length=150,
        help_text="Medication, vaccine, or active compound administered.",
    )
    reason = models.TextField(
        blank=True,
        default="",
        help_text="Clinical indication, diagnosis reason, or preventive purpose.",
    )
    dosage = models.CharField(
        max_length=100,
        blank=True,
        default="",
        help_text="Administered dosage (e.g., '10 mL', '500 mg').",
    )
    route_of_administration = models.CharField(
        max_length=60,
        blank=True,
        default="",
        help_text="Administration route (e.g., Intramuscular (IM), Subcutaneous (SC), Oral, Topical, IV).",
    )
    administered_by = models.CharField(
        max_length=120,
        blank=True,
        default="",
        help_text="Veterinarian, livestock inspector, or farmer who administered treatment.",
    )
    related_disease_case = models.ForeignKey(
        "diseases.DiseaseCase",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="treatment_records",
        help_text="Optional link to diagnosed disease case.",
    )
    related_breeding_record = models.ForeignKey(
        BreedingRecord,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="treatment_records",
        help_text="Optional link to reproductive cycle / breeding event.",
    )
    notes = models.TextField(blank=True, default="", max_length=1000)
    follow_up_date = models.DateField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_treatment_records",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-treatment_date", "-created_at"]
        verbose_name = "Livestock Treatment Record"
        verbose_name_plural = "Livestock Treatment Records"

    def __str__(self):
        return f"{self.medication_name} on {self.treatment_date} for {self.livestock}"


class FeedingRecord(models.Model):
    """
    Farmbrite-style daily feeding & ration tracker:
    Logs feed types, quantities (kg), and feed costs for individual animals or batches.
    """
    class FeedType(models.TextChoices):
        FORAGE = "FORAGE", "Fresh Forage & Grass (Napier, Guinea, Native)"
        SILAGE_HAY = "SILAGE_HAY", "Silage & Hay"
        CONCENTRATE = "CONCENTRATE", "Commercial Concentrates & Mash"
        BYPRODUCTS = "BYPRODUCTS", "Byproducts (Rice Bran / Darak, Corn, Copra)"
        MINERALS = "MINERALS", "Minerals & Vitamin Supplements"

    class FeedingTime(models.TextChoices):
        MORNING = "MORNING", "Morning"
        AFTERNOON = "AFTERNOON", "Afternoon"
        EVENING = "EVENING", "Evening"
        ALL_DAY = "ALL_DAY", "All Day / Free Choice"

    livestock = models.ForeignKey(
        "livestock.LivestockInventory",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="feeding_records",
        help_text="Target animal (for individual feeding).",
    )
    batch = models.ForeignKey(
        "livestock.LivestockBatch",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="feeding_records",
        help_text="Target batch (for herd feeding).",
    )
    feeding_date = models.DateField(help_text="Date the feed was provided.")
    feed_type = models.CharField(
        max_length=32,
        choices=FeedType.choices,
        default=FeedType.FORAGE,
    )
    feed_name = models.CharField(
        max_length=120,
        blank=True,
        help_text="Specific feed brand or pasture description (e.g., Napier Grass, Starter Mash).",
    )
    quantity_kg = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        help_text="Weight of feed provided in kilograms.",
    )
    cost = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Optional total cost in PHP for this feeding.",
    )
    feeding_time = models.CharField(
        max_length=16,
        choices=FeedingTime.choices,
        default=FeedingTime.MORNING,
    )
    notes = models.TextField(blank=True, max_length=500)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_feeding_records",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-feeding_date", "-created_at"]

    def __str__(self):
        target = self.livestock.tag_number if self.livestock else (self.batch.batch_code if self.batch else "General")
        return f"Feeding {target} ({self.feed_type}, {self.quantity_kg} kg) on {self.feeding_date}"

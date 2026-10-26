from django.db import models
from django.conf import settings


class IndividualMilkDemoCow(models.Model):
    """A synthetic cow used only by the individual-forecast demonstration."""

    demo_id = models.CharField(max_length=40, primary_key=True)
    tag_number = models.CharField(max_length=50, unique=True)
    breed = models.CharField(max_length=80, blank=True, default="")
    sex = models.CharField(max_length=10, default="FEMALE")
    birth_date = models.DateField(null=True, blank=True)
    weight_kg = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    calving_date = models.DateField(null=True, blank=True)
    seed_marker = models.CharField(max_length=80, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["tag_number"]
        verbose_name = "Individual Milk Forecast Demo Cow"


class IndividualMilkDemoObservation(models.Model):
    """Synthetic daily yield and time-aware health flag, isolated from real production."""

    cow = models.ForeignKey(
        IndividualMilkDemoCow,
        on_delete=models.CASCADE,
        related_name="observations",
    )
    record_date = models.DateField()
    milk_quantity_liters = models.DecimalField(max_digits=6, decimal_places=2)
    disease_active = models.BooleanField(default=False)
    seed_marker = models.CharField(max_length=80, db_index=True)

    class Meta:
        ordering = ["record_date", "cow_id"]
        constraints = [
            models.UniqueConstraint(
                fields=["cow", "record_date"],
                name="uniq_demo_cow_milk_observation_day",
            )
        ]


class MonthlyReportDelivery(models.Model):
    """Idempotency record for the monthly MAO report email."""

    class Status(models.TextChoices):
        GENERATING = "GENERATING", "Generating"
        SENT = "SENT", "Sent"
        FAILED = "FAILED", "Failed"

    period_start = models.DateField(unique=True)
    period_end = models.DateField()
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.GENERATING)
    recipients = models.JSONField(default=list, blank=True)
    started_at = models.DateTimeField(auto_now_add=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    error_summary = models.CharField(max_length=500, blank=True, default="")

    class Meta:
        ordering = ["-period_start"]


class SurveillanceDemoOwnership(models.Model):
    """Explicit ownership ledger for rows created by the surveillance demo seed."""

    identifier = models.CharField(max_length=180, unique=True)
    object_type = models.CharField(max_length=24)
    object_id = models.PositiveBigIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["object_type", "object_id"],
                name="unique_surveillance_demo_owned_object",
            ),
        ]
        ordering = ["identifier"]

    def __str__(self):
        return f"Surveillance demo {self.identifier} ({self.object_type}:{self.object_id})"


class NLPExampleReviewEvent(models.Model):
    """Append-only MAO/Admin decisions for synthetic candidate training rows."""

    class Decision(models.TextChoices):
        ACCEPTED = "accepted", "Accepted"
        REJECTED = "rejected", "Rejected"

    corpus_version = models.CharField(max_length=80)
    example_id = models.CharField(max_length=180, db_index=True)
    decision = models.CharField(max_length=12, choices=Decision.choices)
    utterance_override = models.CharField(max_length=500, blank=True, default="")
    intent_override = models.CharField(max_length=40, blank=True, default="")
    notes = models.TextField(blank=True, default="")
    reviewer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="nlp_example_reviews",
    )
    reviewed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-reviewed_at", "-pk"]
        indexes = [models.Index(fields=["corpus_version", "example_id", "-reviewed_at"], name="nlpex_review_latest_idx")]

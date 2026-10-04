from django.db import models
from django.conf import settings


class DataImportBatch(models.Model):
    """
    Auditable log of bulk data imports executed by authorized MAO / Admin users.
    Stores metadata, validation statistics, processing time, and error details
    without duplicating the entire imported raw file.
    """

    class DatasetType(models.TextChoices):
        LIVESTOCK_INVENTORY = "livestock_inventory", "Livestock Inventory"
        PRODUCTION = "production", "Production Records"
        DISEASE = "disease", "Disease Reports"
        MORTALITY = "mortality", "Mortality Records"
        SLAUGHTER = "slaughter", "Slaughter Records"
        AUCTION = "auction", "Auction / Live Animal Sales"

    class ImportStatus(models.TextChoices):
        PENDING = "PENDING", "Pending"
        VALIDATED = "VALIDATED", "Validated (Previewed)"
        COMPLETED = "COMPLETED", "Completed"
        PARTIAL = "PARTIAL", "Partially Completed"
        FAILED = "FAILED", "Failed"

    class TargetStatus(models.TextChoices):
        APPROVED = "APPROVED", "Approved (Official Historical Data)"
        PENDING = "PENDING", "Pending (Requires SIBAT/MAO Field Verification)"

    dataset_type = models.CharField(
        max_length=50,
        choices=DatasetType.choices,
        help_text="Target municipal dataset domain for this batch import.",
    )
    file_name = models.CharField(
        max_length=255,
        help_text="Original uploaded filename (CSV or XLSX).",
    )
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="data_import_batches",
        help_text="MAO or Admin user who performed the upload.",
    )
    uploaded_at = models.DateTimeField(
        auto_now_add=True,
        help_text="Timestamp when the file was uploaded.",
    )
    status = models.CharField(
        max_length=20,
        choices=ImportStatus.choices,
        default=ImportStatus.PENDING,
    )
    target_status = models.CharField(
        max_length=20,
        choices=TargetStatus.choices,
        default=TargetStatus.APPROVED,
        help_text="Workflow status assigned to imported records.",
    )
    total_rows = models.PositiveIntegerField(
        default=0,
        help_text="Total rows found in the uploaded spreadsheet (excluding header).",
    )
    valid_rows = models.PositiveIntegerField(
        default=0,
        help_text="Number of rows that passed validation.",
    )
    imported_rows = models.PositiveIntegerField(
        default=0,
        help_text="Number of rows successfully inserted into production tables.",
    )
    skipped_rows = models.PositiveIntegerField(
        default=0,
        help_text="Number of duplicate or ignored rows skipped during import.",
    )
    error_rows = models.PositiveIntegerField(
        default=0,
        help_text="Number of rows rejected due to schema or validation errors.",
    )
    error_log = models.JSONField(
        default=list,
        blank=True,
        help_text="Structured log of row errors for downloadable audit reports.",
    )
    completed_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Timestamp when the batch transaction completed.",
    )
    duration_seconds = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Total processing duration in seconds.",
    )
    notes = models.TextField(
        blank=True,
        default="",
        help_text="Optional remarks or notes about the import batch.",
    )

    class Meta:
        ordering = ["-uploaded_at"]
        verbose_name = "Data Import Batch"
        verbose_name_plural = "Data Import Batches"

    def __str__(self):
        return f"Import #{self.pk} - {self.get_dataset_type_display()} ({self.status}) by {self.uploaded_by.username}"

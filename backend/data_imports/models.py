from django.db import models
from django.conf import settings


# =============================================================
# DataImportBatch — Audit Log for Bulk Municipal Data Uploads
# =============================================================
# Every time MAO staff uploads a CSV or XLSX file to bulk-import
# livestock records, one DataImportBatch row is created.
#
# This model acts as an audit trail, so administrators can always
# answer: Who uploaded this? When? How many rows succeeded or failed?
#
# The actual livestock records are written to their own domain tables
# (LivestockInventory, ProductionRecord, DiseaseCase, etc.).
# This model stores ONLY the metadata and counts — not the raw file.
# =============================================================
class DataImportBatch(models.Model):
    """
    Auditable log of bulk data imports executed by authorized MAO / Admin users.
    Stores metadata, validation statistics, processing time, and error details
    without duplicating the entire imported raw file.
    """

    # DatasetType: Which municipal data domain was imported?
    # Each value corresponds to one Django model in the domain apps.
    class DatasetType(models.TextChoices):
        LIVESTOCK_INVENTORY = "livestock_inventory", "Livestock Inventory"
        PRODUCTION = "production", "Production Records"
        DISEASE = "disease", "Disease Reports"
        MORTALITY = "mortality", "Mortality Records"
        SLAUGHTER = "slaughter", "Slaughter Records"
        AUCTION = "auction", "Auction / Live Animal Sales"

    # ImportStatus: Tracks which stage of the pipeline the batch is in.
    # The batch is created as PENDING during execution, then finalized as COMPLETED,
    # PARTIAL, or FAILED. VALIDATED remains a supported historical status value.
    class ImportStatus(models.TextChoices):
        PENDING = "PENDING", "Pending"
        VALIDATED = "VALIDATED", "Validated (Previewed)"
        COMPLETED = "COMPLETED", "Completed"
        PARTIAL = "PARTIAL", "Partially Completed"
        FAILED = "FAILED", "Failed"

    # TargetStatus: Should imported records enter as already APPROVED, or as PENDING?
    # APPROVED = historical official data that skips the SIBAT/MAO review workflow.
    # PENDING  = records that still need field verification before they are official.
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
    # uploaded_by: Who performed the upload?
    # PROTECT prevents deleting a user account that has import history.
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
    # Row counters — computed during import and saved to the audit record.
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
    # error_log: Structured JSON list of per-row errors.
    # Stored here so it can be downloaded later as a CSV error report.
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
    # duration_seconds: How long the transaction took (in seconds).
    # Useful for performance monitoring on large municipal uploads.
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

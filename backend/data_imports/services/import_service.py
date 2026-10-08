import time
from datetime import date
from decimal import Decimal
from typing import Dict, List, Any, Optional
from django.db import transaction
from django.utils import timezone

from livestock.models import LivestockInventory, Farmer, Barangay, LivestockType
from production.models import ProductionRecord, SlaughterRecord, LiveAnimalSale
from diseases.models import DiseaseCase, MortalityRecord
from ..models import DataImportBatch
from .datasets import BaseDatasetConfig, get_dataset_config
from .validation import ValidationEngine


# =============================================================
# BATCH CHUNK SIZE
# =============================================================
# bulk_create() inserts many rows in a single SQL INSERT statement
# instead of one INSERT per row. This is much faster for large uploads.
# We chunk at 500 to avoid hitting database statement size limits.
# =============================================================
BATCH_CHUNK_SIZE = 500


def execute_batch_import(
    dataset_type: str,
    normalized_records: List[Dict[str, Any]],
    user,
    file_name: str,
    skip_duplicates: bool = True,
    target_status: str = "APPROVED",
    all_issues: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """
    Execute a transactional batch import for validated municipal livestock records.
    - All database writes happen inside a single transaction.atomic() block.
    - If a fatal database or constraint exception occurs, the entire transaction rolls back.
    - Audited in DataImportBatch with full duration, counts, and error log.
    """
    # Track total wall-clock time so we can store duration_seconds in the audit record.
    start_time = time.time()
    config = get_dataset_config(dataset_type)
    now = timezone.now()
    today = timezone.localdate()

    # Count row statuses so we know up front how many errors we're dealing with.
    total_rows = len(normalized_records)
    valid_rows = sum(1 for r in normalized_records if r.get("_status") == "VALID")
    warning_rows = sum(1 for r in normalized_records if r.get("_status") == "WARNING")
    error_rows = sum(1 for r in normalized_records if r.get("_status") == "ERROR")

    imported_count = 0
    skipped_count = 0
    # All ERROR rows are always rejected — we count them as rejected immediately.
    rejected_count = error_rows

    instances_to_create: List[Any] = []
    # Start the error_log with pre-existing validation issues found during validate_batch().
    error_log: List[Dict[str, Any]] = list(all_issues) if all_issues else []

    # =============================================================
    # transaction.atomic()
    # =============================================================
    # Everything inside this block is a single database transaction.
    # If any line raises an exception, the ENTIRE import rolls back —
    # no partial data will be written. This is critical for data integrity:
    # you never want 50 out of 100 records inserted and 50 missing.
    # =============================================================
    try:
        with transaction.atomic():
            # Create the audit batch record FIRST, before inserting any domain records.
            # This gives us a batch.id we can reference in review_remarks below.
            batch = DataImportBatch.objects.create(
                dataset_type=dataset_type,
                file_name=file_name,
                uploaded_by=user,
                status=DataImportBatch.ImportStatus.PENDING,
                target_status=target_status,
                total_rows=total_rows,
                valid_rows=valid_rows,
                error_rows=error_rows,
            )

            # =============================================================
            # Build model instances for each row
            # =============================================================
            # We do NOT call .save() here — that would be one SQL INSERT per row (N+1 problem).
            # Instead, we collect all instances in a list and bulk_create them at the end.
            # =============================================================
            for rec in normalized_records:
                status = rec.get("_status")
                row_num = rec.get("_row_number", 0)

                # Skip rows that failed validation (missing required fields, bad foreign key, etc.)
                if status == "ERROR":
                    continue

                # Skip WARNING rows if the user chose "skip duplicates".
                # WARNING rows are usually duplicate ear tags or location mismatches.
                if status == "WARNING" and skip_duplicates:
                    skipped_count += 1
                    continue

                # =============================================================
                # common_kwargs: Fields applied to EVERY domain record.
                # =============================================================
                # created_by: Who triggered the import (the MAO officer).
                # status: Whether records enter as APPROVED or PENDING.
                #
                # If target_status is APPROVED, we also fill in the review fields
                # so the record looks like it has already passed SIBAT/MAO review.
                # This is used for bulk-importing HISTORICAL official data.
                # =============================================================
                common_kwargs = {
                    "created_by": user,
                    "status": target_status,
                }
                if target_status == "APPROVED":
                    common_kwargs["reviewed_by"] = user
                    common_kwargs["reviewed_at"] = now
                    common_kwargs["review_remarks"] = f"Historical bulk import by MAO (Batch #{batch.id})"

                # =============================================================
                # Per-domain model construction
                # =============================================================
                # Each elif branch constructs a Django model instance for the right table.
                # The validation engine already resolved foreign keys (Farmer, Barangay,
                # LivestockType) into Python objects stored in rec["farmer"] etc.
                # We just pass them directly to the model constructor.
                # =============================================================

                if dataset_type == "livestock_inventory":
                    farmer = rec["farmer"]
                    inst = LivestockInventory(
                        farmer=farmer,
                        livestock_type=rec["livestock_type"],
                        entry_type=rec.get("entry_type", LivestockInventory.EntryType.INDIVIDUAL),
                        quantity=rec.get("quantity", 1),
                        tag_number=rec.get("tag_number", ""),
                        breed=rec.get("breed", ""),
                        sex=rec.get("sex", ""),
                        birth_date=rec.get("birth_date"),
                        weight=rec.get("weight"),
                        last_vaccination_date=rec.get("last_vaccination_date"),
                        operational_status=LivestockInventory.OperationalStatus.ACTIVE,
                        **common_kwargs,
                    )
                    instances_to_create.append(inst)

                elif dataset_type == "production":
                    farmer = rec["farmer"]
                    # If an animal tag is provided, optionally link the animal
                    tag = rec.get("tag_number")
                    animal_fk = None
                    if tag:
                        # Try to find the individual livestock record by ear tag.
                        # If not found, animal_fk stays None (production is still recorded).
                        animal_fk = LivestockInventory.objects.filter(
                            farmer=farmer, tag_number=tag, operational_status="ACTIVE"
                        ).first()

                    inst = ProductionRecord(
                        livestock=animal_fk,
                        farmer_at_record=farmer,
                        production_type=rec["production_type"],
                        quantity=rec["quantity"],
                        unit=rec["unit"],
                        record_date=rec.get("record_date", today),
                        notes=rec.get("notes", ""),
                        **common_kwargs,
                    )
                    instances_to_create.append(inst)

                elif dataset_type == "disease":
                    farmer = rec["farmer"]
                    tag = rec.get("tag_number")
                    animal_fk = None
                    if tag:
                        animal_fk = LivestockInventory.objects.filter(
                            farmer=farmer, tag_number=tag, operational_status="ACTIVE"
                        ).first()

                    inst = DiseaseCase(
                        livestock=animal_fk,
                        name=rec["name"],
                        affected_count=rec["affected_count"],
                        record_date=rec.get("record_date", today),
                        **common_kwargs,
                    )
                    instances_to_create.append(inst)

                elif dataset_type == "mortality":
                    farmer = rec["farmer"]
                    tag = rec.get("tag_number")
                    animal_fk = None
                    if tag:
                        # For mortality, we don't filter by operational_status=ACTIVE
                        # because the animal may already be marked as dead/removed.
                        animal_fk = LivestockInventory.objects.filter(
                            farmer=farmer, tag_number=tag
                        ).first()

                    inst = MortalityRecord(
                        livestock=animal_fk,
                        cause=rec["cause"],
                        death_count=rec["death_count"],
                        record_date=rec.get("record_date", today),
                        **common_kwargs,
                    )
                    instances_to_create.append(inst)

                elif dataset_type == "slaughter":
                    barangay = rec["barangay"]
                    # Slaughter records are linked to a barangay (not a specific farmer),
                    # because slaughter often happens at a municipal abattoir.
                    inst = SlaughterRecord(
                        barangay=barangay,
                        livestock_type=rec["livestock_type"],
                        quantity=rec["quantity"],
                        carcass_weight=rec.get("carcass_weight"),
                        record_date=rec.get("record_date", today),
                        **common_kwargs,
                    )
                    instances_to_create.append(inst)

                elif dataset_type == "auction":
                    farmer = rec["farmer"]
                    inst = LiveAnimalSale(
                        quantity=rec["quantity"],
                        sale_method=rec.get("sale_method", LiveAnimalSale.SaleMethod.MATA_MATA),
                        total_live_weight=rec.get("total_live_weight"),
                        price_per_head=rec.get("price_per_head"),
                        total_price=rec["total_price"],
                        sale_date=rec.get("sale_date", today),
                        destination=rec.get("destination", ""),
                        purpose=rec.get("purpose", LiveAnimalSale.SalePurpose.UNKNOWN),
                        **common_kwargs,
                    )
                    instances_to_create.append(inst)

            # =============================================================
            # Bulk Insert — single efficient SQL statement per 500-row chunk
            # =============================================================
            # bulk_create() sends all instances to the database in one go.
            # Django handles chunking into groups of BATCH_CHUNK_SIZE=500.
            # This is orders of magnitude faster than a loop with .save().
            # =============================================================
            if instances_to_create:
                config.model_class.objects.bulk_create(
                    instances_to_create,
                    batch_size=BATCH_CHUNK_SIZE,
                )
                imported_count = len(instances_to_create)

            # =============================================================
            # Finalize the audit record
            # =============================================================
            # Now that the import is done, update the DataImportBatch row
            # with the final counts and status. We use update_fields to issue
            # a targeted SQL UPDATE instead of re-saving all columns.
            # =============================================================
            duration = round(Decimal(str(time.time() - start_time)), 2)
            batch.status = (
                DataImportBatch.ImportStatus.COMPLETED
                if (rejected_count == 0 and skipped_count == 0)
                else DataImportBatch.ImportStatus.PARTIAL
            )
            batch.imported_rows = imported_count
            batch.skipped_rows = skipped_count
            batch.error_rows = rejected_count
            batch.error_log = error_log
            batch.completed_at = timezone.now()
            batch.duration_seconds = duration
            batch.save(update_fields=[
                "status", "imported_rows", "skipped_rows",
                "error_rows", "error_log", "completed_at", "duration_seconds"
            ])

            return {
                "batch_id": batch.id,
                "dataset_type": dataset_type,
                "file_name": file_name,
                "status": batch.status,
                "target_status": target_status,
                "total_rows": total_rows,
                "imported_rows": imported_count,
                "skipped_rows": skipped_count,
                "rejected_rows": rejected_count,
                "duration_seconds": float(duration),
                "error_log": error_log,
            }

    except Exception as e:
        # =============================================================
        # Fatal failure path
        # =============================================================
        # If the transaction.atomic() block raises ANY exception, Django
        # automatically rolls back all database writes made inside it.
        # We then create a FAILED batch record OUTSIDE the (already-rolled-back)
        # transaction so the audit trail still shows the failed attempt.
        # =============================================================
        duration = round(Decimal(str(time.time() - start_time)), 2)
        # Attempt to record failed batch outside atomic block
        DataImportBatch.objects.create(
            dataset_type=dataset_type,
            file_name=file_name,
            uploaded_by=user,
            status=DataImportBatch.ImportStatus.FAILED,
            target_status=target_status,
            total_rows=total_rows,
            valid_rows=valid_rows,
            imported_rows=0,
            skipped_rows=0,
            error_rows=total_rows,
            error_log=[{"error_type": "FATAL_IMPORT_ERROR", "error_message": str(e)}],
            completed_at=timezone.now(),
            duration_seconds=duration,
            notes=f"Transaction rolled back due to error: {str(e)}",
        )
        raise e

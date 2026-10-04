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
    start_time = time.time()
    config = get_dataset_config(dataset_type)
    now = timezone.now()
    today = timezone.localdate()

    total_rows = len(normalized_records)
    valid_rows = sum(1 for r in normalized_records if r.get("_status") == "VALID")
    warning_rows = sum(1 for r in normalized_records if r.get("_status") == "WARNING")
    error_rows = sum(1 for r in normalized_records if r.get("_status") == "ERROR")

    imported_count = 0
    skipped_count = 0
    rejected_count = error_rows

    instances_to_create: List[Any] = []
    error_log: List[Dict[str, Any]] = list(all_issues) if all_issues else []

    # Safe transactional execution
    try:
        with transaction.atomic():
            # Create the audit batch record first
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

            # Build model instances
            for rec in normalized_records:
                status = rec.get("_status")
                row_num = rec.get("_row_number", 0)

                # Skip invalid rows
                if status == "ERROR":
                    continue

                # Skip warnings if duplicate skipping is enabled
                if status == "WARNING" and skip_duplicates:
                    skipped_count += 1
                    continue

                # Prepare common audit fields
                common_kwargs = {
                    "created_by": user,
                    "status": target_status,
                }
                if target_status == "APPROVED":
                    common_kwargs["reviewed_by"] = user
                    common_kwargs["reviewed_at"] = now
                    common_kwargs["review_remarks"] = f"Historical bulk import by MAO (Batch #{batch.id})"

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
                        animal_fk = LivestockInventory.objects.filter(
                            farmer=farmer, tag_number=tag, operational_status="ACTIVE"
                        ).first()

                    inst = ProductionRecord(
                        livestock=animal_fk,
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

            # Insert in chunks using bulk_create for maximum throughput
            if instances_to_create:
                config.model_class.objects.bulk_create(
                    instances_to_create,
                    batch_size=BATCH_CHUNK_SIZE,
                )
                imported_count = len(instances_to_create)

            # Finalize batch audit record
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

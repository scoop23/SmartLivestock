"""Atomic inventory updates triggered by approved livestock events."""

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from livestock.models import LivestockBatch, LivestockInventory


def _require_active(inventory: LivestockInventory, event_name: str) -> None:
    if inventory.status != LivestockInventory.StatusType.APPROVED or inventory.quantity != 1:
        raise ValidationError({"inventory": f"{event_name} requires an approved individual animal with one head."})
    if inventory.operational_status != LivestockInventory.OperationalStatus.ACTIVE:
        raise ValidationError(
            {
                "inventory": (
                    f"{event_name} cannot be reconciled because this animal is already "
                    f"{inventory.get_operational_status_display().lower()}."
                )
            }
        )


@transaction.atomic
def reconcile_approved_calving(calving):
    """Create one official calf inventory record exactly once."""
    calving = type(calving).objects.select_for_update().select_related(
        "dam__farmer", "dam__livestock_type"
    ).get(pk=calving.pk)
    if calving.inventory_reconciled_at:
        return calving
    if calving.status != calving.StatusType.APPROVED:
        raise ValidationError({"status": "Only an approved calving record can update inventory."})

    dam = LivestockInventory.objects.select_for_update().get(pk=calving.dam_id)
    _require_active(dam, "Calving")
    calf = LivestockInventory.objects.create(
        farmer=dam.farmer,
        livestock_type=dam.livestock_type,
        entry_type=LivestockInventory.EntryType.INDIVIDUAL,
        quantity=1,
        tag_number=calving.calf_tag,
        breed=calving.breed or dam.breed,
        sex=calving.calf_sex,
        weight=calving.birth_weight,
        status=LivestockInventory.StatusType.APPROVED,
        operational_status=LivestockInventory.OperationalStatus.ACTIVE,
        reviewed_by=calving.reviewed_by,
        reviewed_at=calving.reviewed_at,
        review_remarks=calving.review_remarks,
        created_by=calving.created_by,
    )
    calving.offspring_inventory = calf
    calving.inventory_reconciled_at = timezone.now()
    calving.save(update_fields=["offspring_inventory", "inventory_reconciled_at"])
    return calving


@transaction.atomic
def reconcile_approved_sale(sale):
    """Remove an individual or a complete tagged batch from the active herd."""
    sale = type(sale).objects.select_for_update().get(pk=sale.pk)
    if sale.inventory_reconciled_at:
        return sale
    if sale.status != sale.StatusType.APPROVED:
        raise ValidationError({"status": "Only an approved sale can update inventory."})

    changed_at = timezone.now()
    if bool(sale.livestock_id) == bool(sale.batch_id) or sale.quantity <= 0:
        raise ValidationError({"inventory": "Select exactly one sale source and a positive head count."})
    if sale.livestock_id:
        inventory = LivestockInventory.objects.select_for_update().get(pk=sale.livestock_id)
        _require_active(inventory, "Sale")
        if sale.quantity != 1:
            raise ValidationError({"quantity": "An individual livestock sale must have a quantity of 1."})
        inventory.operational_status = LivestockInventory.OperationalStatus.SOLD
        inventory.operational_status_changed_at = changed_at
        inventory.save(update_fields=["operational_status", "operational_status_changed_at"])
    elif sale.batch_id:
        batch = LivestockBatch.objects.select_for_update().get(pk=sale.batch_id)
        if batch.status != batch.StatusType.ACTIVE:
            raise ValidationError({"batch": "Only an active herd can be sold."})
        if batch.animals.filter(operational_status="ACTIVE").exclude(status="APPROVED").exists():
            raise ValidationError({"batch": "All active herd animals must be approved before a full-herd sale."})
        active_animals = list(
            LivestockInventory.objects.select_for_update().filter(
                batch=batch,
                status=LivestockInventory.StatusType.APPROVED,
                operational_status=LivestockInventory.OperationalStatus.ACTIVE,
            ).order_by("pk")
        )
        if any(animal.quantity != 1 for animal in active_animals) or sale.quantity != len(active_animals):
            raise ValidationError(
                {"quantity": "Only a complete active batch can be reconciled until exact animals are selected."}
            )
        LivestockInventory.objects.filter(pk__in=[animal.pk for animal in active_animals]).update(
            operational_status=LivestockInventory.OperationalStatus.SOLD,
            operational_status_changed_at=changed_at,
        )
        batch.status = LivestockBatch.StatusType.SOLD
        batch.save(update_fields=["status"])
    else:
        raise ValidationError({"inventory": "The sale must reference livestock or a batch."})

    sale.inventory_reconciled_at = changed_at
    sale.save(update_fields=["inventory_reconciled_at"])
    return sale


@transaction.atomic
def reconcile_approved_mortality(record):
    """Mark one specifically identified animal deceased exactly once."""
    record = type(record).objects.select_for_update().get(pk=record.pk)
    if record.inventory_reconciled_at:
        return record
    if record.status != record.MortalityRecordStatus.APPROVED:
        raise ValidationError({"status": "Only an approved mortality record can update inventory."})
    if not record.livestock_id:
        raise ValidationError(
            {"batch": "Batch mortality reconciliation requires selecting the exact deceased animals."}
        )
    if record.death_count != 1:
        raise ValidationError({"death_count": "An individual mortality record must have a death count of 1."})

    inventory = LivestockInventory.objects.select_for_update().get(pk=record.livestock_id)
    _require_active(inventory, "Mortality")
    changed_at = timezone.now()
    inventory.operational_status = LivestockInventory.OperationalStatus.DECEASED
    inventory.operational_status_changed_at = changed_at
    inventory.save(update_fields=["operational_status", "operational_status_changed_at"])
    record.inventory_reconciled_at = changed_at
    record.save(update_fields=["inventory_reconciled_at"])
    return record

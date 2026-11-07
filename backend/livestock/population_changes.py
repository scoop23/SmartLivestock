"""Atomic registered-population accounting. No physical movements are inferred."""


def snapshot(animal):
    if animal is None:
        return None
    return {
        "counted": animal.entry_type == "INDIVIDUAL" and animal.quantity == 1
        and animal.status == "APPROVED" and animal.operational_status == "ACTIVE",
        "barangay_id": animal.farmer.barangay_id,
        "livestock_type_id": animal.livestock_type_id,
        "operational_status": animal.operational_status,
    }


def record_change(before, after, animal):
    from .models import RegisteredPopulationChange, PopulationTracking
    PopulationTracking.objects.get_or_create(pk=1)
    old_counted = bool(before and before["counted"])
    new_counted = bool(after and after["counted"])
    scope_changed = old_counted and new_counted and any(
        before[key] != after[key] for key in ("barangay_id", "livestock_type_id")
    )
    if old_counted and (not new_counted or scope_changed):
        kind = {"SOLD": "sales", "DECEASED": "deaths", "SLAUGHTERED": "removals"}.get(
            after["operational_status"] if after else "", "removals",
        )
        RegisteredPopulationChange.objects.create(
            animal_id_reference=animal.pk, barangay_id=before["barangay_id"],
            livestock_type_id=before["livestock_type_id"], kind=kind, delta=-1,
        )
    if new_counted and (not old_counted or scope_changed):
        RegisteredPopulationChange.objects.create(
            animal_id_reference=animal.pk, barangay_id=after["barangay_id"],
            livestock_type_id=after["livestock_type_id"],
            kind=getattr(animal, "_population_addition_kind", "registrations"), delta=1,
        )

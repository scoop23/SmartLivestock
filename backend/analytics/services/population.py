"""Canonical current population. Herds and census are never extra heads."""
from django.db.models import Count, F, IntegerField, Q, Sum, Value, Case, When
from django.utils import timezone

from livestock.models import Barangay, Farmer, LivestockBatch, LivestockInventory
from smartlivestock.workflows import scope_reviewer_queryset


def official_inventory(user=None):
    return scope_reviewer_queryset(LivestockInventory.objects.all(), user).filter(
        status="APPROVED", operational_status="ACTIVE", quantity__gt=0)


def population_summary(*, user=None, today=None):
    today = today or timezone.localdate()

    rows = list(official_inventory(user).values(
        "farmer__barangay_id", "livestock_type_id", "livestock_type__name"
    ).annotate(heads=Sum("quantity"), vaccinated=Sum(Case(
        When(last_vaccination_date__lte=today, then=F("quantity")),
        default=Value(0), output_field=IntegerField(),
    ))).order_by("farmer__barangay_id", "livestock_type_id"))

    farmers = dict(scope_reviewer_queryset(Farmer.objects.all(), user).filter(
        user__role__role_name="FARMER", user__account_status="APPROVED"
    ).values("barangay_id").annotate(count=Count("pk")).values_list("barangay_id", "count"))
    herds = dict(scope_reviewer_queryset(LivestockBatch.objects.all(), user).filter(
        status="ACTIVE"
    ).values("farmer__barangay_id").annotate(count=Count("pk")).values_list("farmer__barangay_id", "count"))

    barangays = {b.pk: {"barangay_id": b.pk, "barangay": b.barangay_name,
        "heads": 0, "vaccinated": 0, "species": [],
        "registered_farmers": farmers.get(b.pk, 0), "active_herds": herds.get(b.pk, 0)}
        for b in scope_reviewer_queryset(Barangay.objects.all(), user).order_by("barangay_name", "pk")}
    species = {}
    for row in rows:
        item = {"species_id": row["livestock_type_id"], "species": row["livestock_type__name"], "heads": row["heads"]}
        barangay = barangays[row["farmer__barangay_id"]]
        barangay["heads"] += item["heads"]
        barangay["vaccinated"] += row["vaccinated"] or 0
        barangay["species"].append(item)
        aggregate = species.setdefault(item["species_id"], dict(item, heads=0))
        aggregate["heads"] += item["heads"]
    inventory = scope_reviewer_queryset(LivestockInventory.objects.all(), user)
    operational = inventory.aggregate(
        active_submitted_heads=Sum("quantity", filter=Q(operational_status="ACTIVE", quantity__gt=0)),
        historical_approved_heads=Sum("quantity", filter=Q(status="APPROVED", quantity__gt=0)),
        pending_inventory_records=Count("pk", filter=Q(status="PENDING", operational_status="ACTIVE")),
    )
    return {
        "total_heads": sum(b["heads"] for b in barangays.values()),
        "by_barangay": list(barangays.values()),
        "by_species": sorted(species.values(), key=lambda s: (s["species"], s["species_id"])),
        "registered_farmers": sum(farmers.values()), "barangay_count": len(barangays),
        **{key: value or 0 for key, value in operational.items()},
    }

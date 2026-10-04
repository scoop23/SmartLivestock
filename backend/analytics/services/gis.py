"""
GIS Aggregation Service for Padre Garcia Municipal Agriculture Office (MAO).

Educational Note on GIS Aggregation Architecture:
------------------------------------------------
In modern GIS web applications, transferring spatial boundaries and thematic
statistics should follow a clean separation of concerns:
  1. Geometry (Vector Layer): Handled by the client (Leaflet) using standard
     GeoJSON (padre-garcia-barangays.json).
  2. Thematic Attributes (Data Layer): Aggregated on the server using Django ORM
     and returned as a single JSON response (/api/analytics/gis/).
  3. Joining Strategy: The client joins geometry features to attribute records
     by normalized barangay name: `data = barangaysByName[feature.properties.name]`.

This avoids N+1 database queries on the server and avoids dozens of parallel HTTP
requests from the browser.
"""

from decimal import Decimal
from typing import Any, Dict, List, Optional
from django.db.models import Count, Q, Sum
from django.db.models.functions import Coalesce
from django.utils import timezone

from livestock.models import Barangay, Farmer, LivestockBatch, LivestockInventory
from diseases.models import DiseaseCase, MortalityRecord
from movements.models import (
    LivestockInspection,
    LivestockInspectionItem,
    LivestockInspectionClearance,
    MeatMovementRecord,
)
from production.models import ProductionRecord, SlaughterRecord
from smartlivestock.workflows import scope_reviewer_queryset


# 18 official barangays of Padre Garcia matching frontend/src/data/padre-garcia-barangays.json
OFFICIAL_BARANGAYS: List[str] = [
    "Banaba",
    "Banaybanay",
    "Bawi",
    "Bukal",
    "Castillo",
    "Cawongan",
    "Manggas",
    "Maugat East",
    "Maugat West",
    "Pansol",
    "Payapa",
    "Poblacion",
    "Quilo-quilo North",
    "Quilo-quilo South",
    "San Felipe",
    "San Miguel",
    "Tamak",
    "Tangob",
]

# Canonical name normalization map: converts database variations (hyphens, spaces, casing)
# into the standardized GeoJSON key.
NAME_CANONICAL_MAP: Dict[str, str] = {
    "banaba": "Banaba",
    "banaybanay": "Banaybanay",
    "banay-banay": "Banaybanay",
    "bawi": "Bawi",
    "bukal": "Bukal",
    "castillo": "Castillo",
    "cawongan": "Cawongan",
    "manggas": "Manggas",
    "maugat east": "Maugat East",
    "maugat west": "Maugat West",
    "pansol": "Pansol",
    "payapa": "Payapa",
    "poblacion": "Poblacion",
    "quilo quilo north": "Quilo-quilo North",
    "quilo-quilo north": "Quilo-quilo North",
    "quiloquilo north": "Quilo-quilo North",
    "quilo quilo south": "Quilo-quilo South",
    "quilo-quilo south": "Quilo-quilo South",
    "quiloquilo south": "Quilo-quilo South",
    "san felipe": "San Felipe",
    "san miguel": "San Miguel",
    "tamak": "Tamak",
    "tangob": "Tangob",
}

# Accurate polygon centroids [latitude, longitude] calculated from official geometry
BARANGAY_CENTROIDS: Dict[str, List[float]] = {
    "Banaba": [13.885149, 121.221731],
    "Banaybanay": [13.893419, 121.216281],
    "Bawi": [13.886475, 121.232434],
    "Bukal": [13.863402, 121.258598],
    "Castillo": [13.875098, 121.266738],
    "Cawongan": [13.873038, 121.220908],
    "Manggas": [13.871999, 121.246593],
    "Maugat East": [13.864823, 121.302085],
    "Maugat West": [13.864623, 121.281764],
    "Pansol": [13.882793, 121.247123],
    "Payapa": [13.859442, 121.246674],
    "Poblacion": [13.87908, 121.212894],
    "Quilo-quilo North": [13.862076, 121.223498],
    "Quilo-quilo South": [13.851806, 121.243495],
    "San Felipe": [13.887528, 121.201211],
    "San Miguel": [13.873635, 121.199939],
    "Tamak": [13.876635, 121.229178],
    "Tangob": [13.881157, 121.259591],
}

# Known destination coordinates for movement arcs
DESTINATION_COORDINATES: Dict[str, List[float]] = {
    "lipa": [13.9419, 121.1644],
    "tanauan": [14.0864, 121.1500],
    "batangas city": [13.7565, 121.0583],
    "san jose": [13.8828, 121.1039],
    "rosario": [13.8475, 121.2058],
    "san juan": [13.8267, 121.3967],
    "manila": [14.5995, 120.9842],
    "ncr": [14.5995, 120.9842],
    "bulacan": [14.8527, 120.8160],
    "pampanga": [15.0333, 120.6833],
    "masbate": [12.3667, 123.6167],
    "quezon": [13.9317, 121.6178],
    "laguna": [14.2790, 121.4170],
}


def normalize_barangay_name(raw_name: Optional[str]) -> Optional[str]:
    """Normalizes any variation of a barangay name to match the official GeoJSON key."""
    if not raw_name:
        return None
    cleaned = raw_name.strip().lower()
    return NAME_CANONICAL_MAP.get(cleaned, raw_name.strip())


def get_destination_coords(destination_text: str) -> List[float]:
    """Finds coordinates for a movement destination string, defaulting to Lipa City if unmatched."""
    lower_text = destination_text.lower()
    for key, coords in DESTINATION_COORDINATES.items():
        if key in lower_text:
            return coords
    # Default to neighboring Lipa City hub if external coordinates are unspecified
    return [13.9419, 121.1644]


def ensure_poblacion_exists() -> Barangay:
    """Ensures Barangay Poblacion exists in the database so all 18 barangays are represented."""
    b, _ = Barangay.objects.get_or_create(
        barangay_name="Poblacion",
        defaults={
            "latitude": Decimal("13.879080"),
            "longitude": Decimal("121.212894"),
            "description": "Barangay Poblacion, Padre Garcia, Batangas",
        },
    )
    return b


def get_gis_aggregated_data(user=None) -> Dict[str, Any]:
    """
    Computes real-time municipal GIS telemetry directly from PostgreSQL.
    
    Returns:
      - barangays: Array of all 18 barangays with live livestock, disease,
        production, mortality, and movement metrics.
      - summary: Municipal totals and top-ranked barangays.
      - movements: Geo-referenced active movement/inspection flows.
    """
    # 1. Ensure all 18 barangays exist in DB
    ensure_poblacion_exists()

    # 2. Fetch all barangays from DB scoped by reviewer permissions
    db_barangays = list(scope_reviewer_queryset(Barangay.objects.all(), user))
    
    # Map DB Barangay PK to normalized canonical name and vice-versa
    pk_to_canonical: Dict[int, str] = {}
    canonical_to_pk: Dict[str, int] = {}
    for b in db_barangays:
        c_name = normalize_barangay_name(b.barangay_name)
        if c_name:
            pk_to_canonical[b.pk] = c_name
            canonical_to_pk[c_name] = b.pk

    # 3. Initialize data structure for all 18 barangays
    barangays_data: Dict[str, Dict[str, Any]] = {}
    for name in OFFICIAL_BARANGAYS:
        b_pk = canonical_to_pk.get(name)
        barangays_data[name] = {
            "name": name,
            "db_name": name,
            "barangay_id": b_pk,
            "position": BARANGAY_CENTROIDS.get(name, [13.8741, 121.2529]),
            "cattle": 0,
            "total_livestock": 0,
            "species_breakdown": [],
            "farmers_count": 0,
            "batches_count": 0,
            "disease_cases": 0,
            "active_cases": 0,
            "affected_heads": 0,
            "disease_risk": "low",
            "recent_diseases": [],
            "milk": 0.0,
            "meat": 0.0,
            "slaughter_heads": 0,
            "cheese": 0.0,  # Reserved for dairy cheese production
            "mortality": 0,
            "mortality_causes": [],
            "movement_out": 0,
            "movement_in": 0,
            "inspections_count": 0,
        }

    # 4. Aggregate Livestock Inventory (by farmer's barangay)
    # Filter active and approved livestock
    inventory_qs = scope_reviewer_queryset(LivestockInventory.objects.all(), user).filter(
        status__in=["APPROVED", "VERIFIED", "PENDING"],
        operational_status="ACTIVE",
    )
    
    species_by_barangay = (
        inventory_qs.values("farmer__barangay_id", "livestock_type__name")
        .annotate(total_heads=Sum("quantity"))
        .order_by("farmer__barangay_id", "-total_heads")
    )

    for item in species_by_barangay:
        b_pk = item["farmer__barangay_id"]
        c_name = pk_to_canonical.get(b_pk)
        if not c_name or c_name not in barangays_data:
            continue
        species_name = item["livestock_type__name"] or "Unknown"
        heads = item["total_heads"] or 0
        barangays_data[c_name]["total_livestock"] += heads
        if "cattle" in species_name.lower():
            barangays_data[c_name]["cattle"] += heads
        barangays_data[c_name]["species_breakdown"].append({
            "species": species_name,
            "heads": heads,
        })

    # 5. Count registered farmers & active herds per barangay
    farmers_by_b = (
        scope_reviewer_queryset(Farmer.objects.all(), user)
        .values("barangay_id")
        .annotate(cnt=Count("id"))
    )
    for row in farmers_by_b:
        c_name = pk_to_canonical.get(row["barangay_id"])
        if c_name and c_name in barangays_data:
            barangays_data[c_name]["farmers_count"] = row["cnt"]

    batches_by_b = (
        scope_reviewer_queryset(LivestockBatch.objects.all(), user)
        .filter(status="ACTIVE")
        .values("farmer__barangay_id")
        .annotate(cnt=Count("id"))
    )
    for row in batches_by_b:
        c_name = pk_to_canonical.get(row["farmer__barangay_id"])
        if c_name and c_name in barangays_data:
            barangays_data[c_name]["batches_count"] = row["cnt"]

    # 6. Aggregate Disease Cases (Active & Total)
    disease_qs = scope_reviewer_queryset(DiseaseCase.objects.all(), user)
    disease_grouped = (
        disease_qs.annotate(
            b_id=Coalesce("livestock__farmer__barangay_id", "batch__farmer__barangay_id")
        )
        .values("b_id", "name", "status")
        .annotate(cases_cnt=Count("id"), affected_cnt=Sum("affected_count"))
    )

    for row in disease_grouped:
        c_name = pk_to_canonical.get(row["b_id"])
        if not c_name or c_name not in barangays_data:
            continue
        cases = row["cases_cnt"] or 0
        affected = row["affected_cnt"] or 0
        status = row["status"]
        d_name = row["name"]

        b_entry = barangays_data[c_name]
        b_entry["disease_cases"] += cases
        b_entry["affected_heads"] += affected
        if status in ("PENDING", "VERIFIED"):
            b_entry["active_cases"] += cases
        if d_name and d_name not in b_entry["recent_diseases"]:
            b_entry["recent_diseases"].append(d_name)

    # Calculate Risk Level based on active cases and affected count
    for b_entry in barangays_data.values():
        active = b_entry["active_cases"]
        affected = b_entry["affected_heads"]
        if active >= 3 or affected >= 10:
            b_entry["disease_risk"] = "high"
        elif active > 0 or affected > 0 or b_entry["disease_cases"] > 0:
            b_entry["disease_risk"] = "medium"
        else:
            b_entry["disease_risk"] = "low"

    # 7. Aggregate Production (Milk in Liters)
    production_qs = scope_reviewer_queryset(ProductionRecord.objects.all(), user).filter(
        production_type=ProductionRecord.ProductionType.MILK
    )
    milk_grouped = (
        production_qs.annotate(
            b_id=Coalesce("livestock__farmer__barangay_id", "batch__farmer__barangay_id")
        )
        .values("b_id")
        .annotate(total_milk=Sum("quantity"))
    )
    for row in milk_grouped:
        c_name = pk_to_canonical.get(row["b_id"])
        if c_name and c_name in barangays_data:
            barangays_data[c_name]["milk"] = round(float(row["total_milk"] or 0.0), 2)

    # 8. Aggregate Slaughter / Meat (Katay)
    slaughter_qs = scope_reviewer_queryset(SlaughterRecord.objects.all(), user)
    meat_grouped = (
        slaughter_qs.annotate(
            b_id=Coalesce("barangay_id", "batch__farmer__barangay_id", "livestock__farmer__barangay_id")
        )
        .values("b_id")
        .annotate(
            total_weight=Sum("carcass_weight"),
            total_heads=Sum("quantity"),
        )
    )
    for row in meat_grouped:
        c_name = pk_to_canonical.get(row["b_id"])
        if c_name and c_name in barangays_data:
            barangays_data[c_name]["meat"] = round(float(row["total_weight"] or 0.0), 2)
            barangays_data[c_name]["slaughter_heads"] = row["total_heads"] or 0

    # 9. Aggregate Mortality Records
    mortality_qs = scope_reviewer_queryset(MortalityRecord.objects.all(), user)
    mortality_grouped = (
        mortality_qs.annotate(
            b_id=Coalesce("livestock__farmer__barangay_id", "batch__farmer__barangay_id")
        )
        .values("b_id", "cause")
        .annotate(deaths_cnt=Sum("death_count"))
    )
    for row in mortality_grouped:
        c_name = pk_to_canonical.get(row["b_id"])
        if not c_name or c_name not in barangays_data:
            continue
        deaths = row["deaths_cnt"] or 0
        cause = row["cause"]
        b_entry = barangays_data[c_name]
        b_entry["mortality"] += deaths
        if cause and cause not in b_entry["mortality_causes"]:
            b_entry["mortality_causes"].append(cause)

    # 10. Real Livestock Movement Inspections
    # Inbound / Outbound flows
    inspections_qs = (
        scope_reviewer_queryset(LivestockInspection.objects.all(), user)
        .select_related("shipper", "shipper__barangay")
        .prefetch_related("items", "items__livestock_type")
        .order_by("-inspection_date")
    )

    movements_list: List[Dict[str, Any]] = []
    padre_garcia_hub = [13.87908, 121.212894]  # Poblacion market hub

    for insp in inspections_qs:
        origin_b_name = normalize_barangay_name(
            insp.shipper.barangay.barangay_name if insp.shipper and insp.shipper.barangay else "Poblacion"
        ) or "Poblacion"
        origin_coords = BARANGAY_CENTROIDS.get(origin_b_name, padre_garcia_hub)
        dest_coords = get_destination_coords(insp.destination)

        total_heads = sum(item.quantity for item in insp.items.all()) or 1
        species_names = list({item.livestock_type.name for item in insp.items.all() if item.livestock_type})
        species_label = ", ".join(species_names) if species_names else "Cattle"

        # Check clearance status if exists
        clearance_status = "PENDING"
        control_no = ""
        if hasattr(insp, "clearance") and insp.clearance:
            clearance_status = insp.clearance.status
            control_no = insp.clearance.control_number

        movements_list.append({
            "id": insp.pk,
            "type": "export",  # Outbound transport
            "origin": f"Brgy. {origin_b_name}, Padre Garcia",
            "destination": insp.destination,
            "from": origin_coords,
            "to": dest_coords,
            "heads": total_heads,
            "species": species_label,
            "purpose": insp.get_purpose_display(),
            "date": insp.inspection_date.isoformat() if insp.inspection_date else "",
            "shipper_name": insp.shipper_name,
            "clearance_status": clearance_status,
            "control_number": control_no,
        })

        if origin_b_name in barangays_data:
            barangays_data[origin_b_name]["movement_out"] += total_heads
            barangays_data[origin_b_name]["inspections_count"] += 1

    # 11. Compute Municipal Totals and Top Rankings
    all_b = list(barangays_data.values())
    total_livestock = sum(b["total_livestock"] for b in all_b)
    total_cattle = sum(b["cattle"] for b in all_b)
    total_milk = sum(b["milk"] for b in all_b)
    total_meat = sum(b["meat"] for b in all_b)
    total_disease = sum(b["disease_cases"] for b in all_b)
    total_active_disease = sum(b["active_cases"] for b in all_b)
    total_mortality = sum(b["mortality"] for b in all_b)
    total_farmers = sum(b["farmers_count"] for b in all_b)

    top_cattle = sorted(all_b, key=lambda x: x["cattle"], reverse=True)[:5]
    top_milk = sorted(all_b, key=lambda x: x["milk"], reverse=True)[:5]
    alert_barangays = [b for b in all_b if b["active_cases"] > 0 or b["disease_cases"] > 0]

    return {
        "barangays": all_b,
        "barangays_dict": barangays_data,
        "movements": movements_list,
        "summary": {
            "total_livestock": total_livestock,
            "total_cattle": total_cattle,
            "total_milk": round(total_milk, 1),
            "total_meat": round(total_meat, 1),
            "total_disease_cases": total_disease,
            "active_disease_cases": total_active_disease,
            "total_mortality": total_mortality,
            "total_farmers": total_farmers,
            "total_movements": len(movements_list),
            "top_cattle": [
                {"name": b["name"], "cattle": b["cattle"]} for b in top_cattle
            ],
            "top_milk": [
                {"name": b["name"], "milk": b["milk"]} for b in top_milk
            ],
            "alert_barangays": [
                {
                    "name": b["name"],
                    "active_cases": b["active_cases"],
                    "disease_cases": b["disease_cases"],
                    "disease_risk": b["disease_risk"],
                    "recent_diseases": b["recent_diseases"],
                }
                for alert_b in [alert_barangays]
                for b in alert_b
            ],
        },
        "period": timezone.localdate().strftime("%Y-%m"),
    }

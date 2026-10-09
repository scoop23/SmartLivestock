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

from datetime import timedelta
from decimal import Decimal
from typing import Any, Dict, List, Optional
from django.db.models import Count, F, Q, Sum
from django.db.models.functions import Coalesce, TruncDate
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
from smartlivestock.workflows import (
    scope_reviewer_queryset,
    role_name,
    has_all_barangay_access,
    FARMER,
    SIBAT,
    MAO,
    AUCTION,
    ADMIN,
)
from .movement_direction import classify_movement_direction


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

# Known destination coordinates for movement arcs (official geographic reference points)
DESTINATION_COORDINATES: Dict[str, List[float]] = {
    "padre garcia": [13.87908, 121.212894],
    "lipa": [13.9419, 121.1644],
    "tanauan": [14.0864, 121.1500],
    "batangas city": [13.7565, 121.0583],
    "san jose": [13.8828, 121.1039],
    "rosario": [13.8475, 121.2058],
    "san juan": [13.8267, 121.3967],
    "ibaan": [13.8183, 121.1325],
    "taysan": [13.7936, 121.2019],
    "malvar": [14.0450, 121.1583],
    "sto tomas": [14.1089, 121.1417],
    "santo tomas": [14.1089, 121.1417],
    "cuenca": [13.9036, 121.0478],
    "alitagtag": [13.8647, 121.0042],
    "bauan": [13.7919, 121.0094],
    "san pascual": [13.7881, 121.0322],
    "lemery": [13.8806, 120.9083],
    "taal": [13.8803, 120.9236],
    "calaca": [13.9333, 120.8167],
    "balayan": [13.9392, 120.7344],
    "nasugbu": [14.0772, 120.6322],
    "lian": [14.0361, 120.6508],
    "calatagan": [13.8322, 120.6319],
    "san nicolas": [13.9261, 120.9525],
    "mataasnakahoy": [13.9619, 121.1114],
    "balete": [14.0192, 121.0967],
    "laurel": [14.0506, 120.9328],
    "talisay": [14.0950, 121.0236],
    "lobo": [13.6483, 121.2083],
    "tingloy": [13.6606, 120.8731],
    "lucena": [13.9372, 121.6172],
    "candelaria": [13.9311, 121.4233],
    "tiaong": [13.9614, 121.3242],
    "sariaya": [13.9639, 121.5256],
    "san antonio": [13.8967, 121.2933],
    "dolores": [14.0206, 121.4011],
    "cavite": [14.2456, 120.8786],
    "rizal": [14.6037, 121.3084],
    "laguna": [14.2790, 121.4170],
    "quezon": [13.9317, 121.6178],
    "manila": [14.5995, 120.9842],
    "ncr": [14.5995, 120.9842],
    "bulacan": [14.8527, 120.8160],
    "pampanga": [15.0333, 120.6833],
    "masbate": [12.3667, 123.6167],
}


def normalize_barangay_name(raw_name: Optional[str]) -> Optional[str]:
    """Normalizes any variation of a barangay name to match the official GeoJSON key."""
    if not raw_name:
        return None
    cleaned = raw_name.strip().lower()
    return NAME_CANONICAL_MAP.get(cleaned, raw_name.strip())


def get_destination_coords(destination_text: str) -> Optional[List[float]]:
    """Resolve known place names without inventing coordinates for unknown places."""
    lower_text = destination_text.lower()
    for key, coords in DESTINATION_COORDINATES.items():
        if key in lower_text:
            return coords
    return None


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


def get_user_gis_scope(user) -> Dict[str, Any]:
    """
    Computes the authoritative Geographic Scope and Allowed Layers for a given user.
    
    EDUCATIONAL & ARCHITECTURAL NOTE:
    ---------------------------------
    In a multi-role information system, data access boundaries MUST be determined
    server-side. The frontend is merely a presentation layer; hiding a button or a tab
    in React does NOT secure records.
    
    This function evaluates:
      1. User's Role (ADMIN, MAO, SIBAT, FARMER, AUCTION, SLAUGHTERHOUSESTAFF)
      2. Assigned Jurisdiction (assigned_barangay, farmer_profile.barangay)
      3. Access Scope (e.g. ALL_BARANGAYS vs. ASSIGNED_ONLY)
      
    Returns a structured dictionary:
      - role: Normalized role string
      - scope: 'MUNICIPAL' | 'ASSIGNED_BARANGAYS' | 'OWN_BARANGAY' | 'OPERATIONAL_MOVEMENT' | 'OPERATIONAL_SLAUGHTER'
      - allowed_barangays: Set of canonical barangay names the user is authorized to inspect
      - can_view_all_barangays: Boolean
      - allowed_layers: List of permitted map layers (e.g. ['cattle', 'disease', 'movement'])
      - allowed_modes: List of permitted view modes (['2D'] or ['2D', '3D'])
      - can_use_simulation: Boolean (strictly Admin/MAO only)
      - can_use_advanced_analytics: Boolean
      - title: User-friendly role-specific map title (e.g. "My Barangay Livestock")
    """
    if not user or not user.is_authenticated:
        return {
            "role": "ANONYMOUS",
            "scope": "RESTRICTED",
            "allowed_barangays": set(),
            "can_view_all_barangays": False,
            "allowed_layers": [],
            "allowed_modes": ["2D"],
            "can_use_simulation": False,
            "can_use_advanced_analytics": False,
            "title": "Restricted Access",
        }

    # Extract role string from User.role FK or is_superuser flag
    u_role = role_name(user)
    if user.is_superuser or u_role == ADMIN:
        u_role = ADMIN

    # 1. ADMIN / MAO — Municipal God's-Eye Scope
    if u_role in (ADMIN, MAO):
        return {
            "role": u_role,
            "scope": "MUNICIPAL",
            "allowed_barangays": set(OFFICIAL_BARANGAYS),
            "can_view_all_barangays": True,
            "allowed_layers": ["cattle", "disease", "milk", "farmer_meat", "slaughter_yield", "mortality", "movement", "meat"],
            "allowed_modes": ["2D", "3D"],
            "can_use_simulation": True,
            "can_use_advanced_analytics": True,
            "title": "Municipal GIS — God's-Eye View",
        }

    # 2. SIBAT / CBAT — Field Monitoring Scope
    if u_role in (SIBAT, "CBAT"):
        can_view_all = has_all_barangay_access(user)
        if can_view_all:
            allowed_b = set(OFFICIAL_BARANGAYS)
        else:
            allowed_b = set()
            if getattr(user, "assigned_barangay", None):
                c_name = normalize_barangay_name(user.assigned_barangay.barangay_name)
                if c_name:
                    allowed_b.add(c_name)

        return {
            "role": u_role,
            "scope": "MUNICIPAL" if can_view_all else "ASSIGNED_BARANGAYS",
            "allowed_barangays": allowed_b,
            "can_view_all_barangays": can_view_all,
            # SIBAT/CBAT monitors field inventory, disease reports, production, mortality, and movement
            # But CANNOT use predictive/scenario simulation or municipal decision-support tools
            "allowed_layers": ["cattle", "disease", "milk", "farmer_meat", "slaughter_yield", "mortality", "movement", "meat"],
            "allowed_modes": ["2D"],
            "can_use_simulation": False,
            "can_use_advanced_analytics": False,
            "title": f"Field Monitoring GIS ({u_role}) — Assigned Barangays" if not can_view_all else f"Field Monitoring GIS ({u_role}) — All Barangays",
        }

    # 3. FARMER — Own Barangay Local-Context Scope
    if u_role == FARMER:
        allowed_b = set()
        farmer_b_name = None
        if hasattr(user, "farmer_profile") and user.farmer_profile and user.farmer_profile.barangay:
            farmer_b_name = normalize_barangay_name(user.farmer_profile.barangay.barangay_name)
            if farmer_b_name:
                allowed_b.add(farmer_b_name)

        return {
            "role": FARMER,
            "scope": "OWN_BARANGAY",
            "allowed_barangays": allowed_b,
            "can_view_all_barangays": False,
            # Farmers see their community's aggregate livestock, milk, and farmer meat production (safe aggregates)
            # Strictly NO slaughterhouse carcass records, disease simulation, or out-of-barangay browsing
            "allowed_layers": ["cattle", "milk", "farmer_meat"],
            "allowed_modes": ["2D"],
            "can_use_simulation": False,
            "can_use_advanced_analytics": False,
            "title": f"My Barangay Livestock — Brgy. {farmer_b_name}" if farmer_b_name else "My Barangay Livestock",
        }

    # 4. AUCTION PERSONNEL — Operational Movement & Trade Tracking Scope
    if u_role == AUCTION:
        return {
            "role": AUCTION,
            "scope": "OPERATIONAL_MOVEMENT",
            "allowed_barangays": set(OFFICIAL_BARANGAYS),
            "can_view_all_barangays": True,
            # Auction team needs transport origin/destination, inspection volume, and cattle counts
            "allowed_layers": ["movement", "cattle"],
            "allowed_modes": ["2D"],
            "can_use_simulation": False,
            "can_use_advanced_analytics": False,
            "title": "Livestock Movement & Trade GIS",
        }

    # 5. SLAUGHTERHOUSE PERSONNEL — Slaughter Operational & Origin Traceability Scope
    if u_role == "SLAUGHTERHOUSESTAFF":
        return {
            "role": "SLAUGHTERHOUSESTAFF",
            "scope": "OPERATIONAL_SLAUGHTER",
            "allowed_barangays": set(OFFICIAL_BARANGAYS),
            "can_view_all_barangays": True,
            # Slaughterhouse staff tracks animal origin movements, carcass meat yield, and cattle counts
            # Strictly NO on-farm farmer meat production data
            "allowed_layers": ["slaughter_yield", "movement", "cattle", "meat"],
            "allowed_modes": ["2D"],
            "can_use_simulation": False,
            "can_use_advanced_analytics": False,
            "title": "Livestock Origin & Slaughter GIS",
        }

    # Fallback for unrecognized roles: safe restricted defaults
    return {
        "role": u_role or "RESTRICTED",
        "scope": "RESTRICTED",
        "allowed_barangays": set(),
        "can_view_all_barangays": False,
        "allowed_layers": ["cattle"],
        "allowed_modes": ["2D"],
        "can_use_simulation": False,
        "can_use_advanced_analytics": False,
        "title": "SmartLivestock GIS Map",
    }



def get_gis_aggregated_data(user=None) -> Dict[str, Any]:
    """Build map layers from role-scoped records; movement layer is approved-only."""
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

    # 2. Fetch all barangays from DB for canonical name-to-PK spatial mapping
    db_barangays = list(Barangay.objects.all())
    
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
            "farmer_meat": 0.0,
            "slaughter_yield": 0.0,
            "slaughter_heads": 0,
            "meat": 0.0,  # Legacy alias for slaughter_yield
            "cheese": 0.0,  # Reserved for dairy cheese production
            "mortality": 0,
            "mortality_causes": [],
            "mortality_by_species": [],
            "recent_mortality": 0,
            "movement_out": 0,
            "movement_in": 0,
            "inspections_count": 0,
        }

    # 4. Aggregate Livestock Inventory (by farmer's barangay)
    # DATA TRUST POLICY: Only MAO-approved active livestock are counted in official municipal GIS inventory
    inventory_qs = scope_reviewer_queryset(LivestockInventory.objects.all(), user).filter(
        status=LivestockInventory.StatusType.APPROVED,
        operational_status=LivestockInventory.OperationalStatus.ACTIVE,
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
        .filter(status=LivestockBatch.StatusType.ACTIVE)
        .values("farmer__barangay_id")
        .annotate(cnt=Count("id"))
    )
    for row in batches_by_b:
        c_name = pk_to_canonical.get(row["farmer__barangay_id"])
        if c_name and c_name in barangays_data:
            barangays_data[c_name]["batches_count"] = row["cnt"]

    # 6. Aggregate Disease Cases (Active & Total)
    # DATA TRUST POLICY: Only MAO-approved verified disease cases are mapped to prevent unvetted submissions from distorting municipal surveillance
    disease_qs = scope_reviewer_queryset(DiseaseCase.objects.all(), user).filter(
        status=DiseaseCase.DiseaseStatus.APPROVED
    )
    disease_grouped = (
        disease_qs.annotate(
            b_id=Coalesce("livestock__farmer__barangay_id", "batch__farmer__barangay_id")
        )
        .values("b_id", "name")
        .annotate(cases_cnt=Count("id"), affected_cnt=Sum("affected_count"))
    )

    for row in disease_grouped:
        c_name = pk_to_canonical.get(row["b_id"])
        if not c_name or c_name not in barangays_data:
            continue
        cases = row["cases_cnt"] or 0
        affected = row["affected_cnt"] or 0
        d_name = row["name"]

        b_entry = barangays_data[c_name]
        b_entry["disease_cases"] += cases
        b_entry["affected_heads"] += affected
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
    # DATA TRUST POLICY: Only MAO-approved production logs are summarized
    production_qs = scope_reviewer_queryset(ProductionRecord.objects.all(), user).filter(
        status=ProductionRecord.ProductionStatus.APPROVED,
        production_type=ProductionRecord.ProductionType.MILK,
    )
    milk_grouped = (
        production_qs.annotate(
            b_id=F("farmer_at_record__barangay_id")
        )
        .values("b_id")
        .annotate(total_milk=Sum("quantity"))
    )
    for row in milk_grouped:
        c_name = pk_to_canonical.get(row["b_id"])
        if c_name and c_name in barangays_data:
            barangays_data[c_name]["milk"] = round(float(row["total_milk"] or 0.0), 2)

    # 7b. Aggregate Farmer Meat Production (in Kilograms)
    # DATA TRUST POLICY & SOURCE SEPARATION:
    # -------------------------------------------------------------------------
    # Farmer Meat Production (on-farm logs) vs. Slaughterhouse Yield (facility carcass weight).
    # - Source: ProductionRecord with production_type = MEAT and unit = KILOGRAMS.
    # - CRITICAL INVARIANT: slaughter__isnull=True guarantees that slaughter-projected
    #   records are NOT included here, preventing double-counting.
    # - Associated with farmer's registered barangay.
    # - DATA TRUST: Only MAO-approved production records are included.
    farmer_meat_qs = scope_reviewer_queryset(ProductionRecord.objects.all(), user).filter(
        status=ProductionRecord.ProductionStatus.APPROVED,
        production_type=ProductionRecord.ProductionType.MEAT,
        unit=ProductionRecord.UnitType.KILOGRAMS,
        slaughter__isnull=True,
    )
    farmer_meat_grouped = (
        farmer_meat_qs.annotate(
            b_id=F("farmer_at_record__barangay_id")
        )
        .values("b_id")
        .annotate(total_farmer_meat=Sum("quantity"))
    )
    for row in farmer_meat_grouped:
        c_name = pk_to_canonical.get(row["b_id"])
        if c_name and c_name in barangays_data:
            barangays_data[c_name]["farmer_meat"] = round(float(row["total_farmer_meat"] or 0.0), 2)

    # 8. Aggregate Slaughterhouse Yield (Carcass Weight in Kilograms)
    # DATA TRUST POLICY & SOURCE SEPARATION:
    # -------------------------------------------------------------------------
    # Represents official municipal slaughterhouse facility output (SlaughterRecord).
    # This is NOT farmer-reported on-farm production.
    # - carcass_weight tracks official inspected post-slaughter carcass weight.
    # - quantity tracks slaughtered animal heads.
    # - DATA TRUST: Only officially APPROVED slaughterhouse records.
    slaughter_qs = scope_reviewer_queryset(SlaughterRecord.objects.all(), user).filter(
        status=SlaughterRecord.StatusType.APPROVED,
    )
    slaughter_grouped = (
        slaughter_qs.annotate(
            b_id=Coalesce("barangay_id", "batch__farmer__barangay_id", "livestock__farmer__barangay_id")
        )
        .values("b_id")
        .annotate(
            total_weight=Sum("carcass_weight"),
            total_heads=Sum("quantity"),
        )
    )
    for row in slaughter_grouped:
        c_name = pk_to_canonical.get(row["b_id"])
        if c_name and c_name in barangays_data:
            yield_val = round(float(row["total_weight"] or 0.0), 2)
            barangays_data[c_name]["slaughter_yield"] = yield_val
            barangays_data[c_name]["slaughter_heads"] = row["total_heads"] or 0
            barangays_data[c_name]["meat"] = yield_val  # Legacy alias for backward compatibility

    # 9. Aggregate Mortality Records
    # DATA TRUST POLICY & EDUCATIONAL CONCEPT:
    # -------------------------------------------------------------------------
    # Spatial Aggregation vs. Individual-Animal Prediction:
    # The GIS Mortality Layer answers "Where have recorded livestock deaths occurred?"
    # by aggregating verified deaths from PostgreSQL by farmer barangay centroid.
    # It does NOT predict which individual animal will die next (which would be
    # methodologically invalid). Predictive time-series forecasting (ARIMA / Holt-Winters)
    # is handled strictly at the municipality level in the Analytics module.
    #
    # DATA TRUST: In accordance with the capstone validation workflow:
    # Farmer -> SIBAT / CBAT field inspection -> MAO official approval.
    # Only APPROVED records are mapped to prevent unvetted declarations from distorting
    # municipal public health statistics.
    recent_cutoff = timezone.localdate() - timedelta(days=90)
    mortality_qs = scope_reviewer_queryset(MortalityRecord.objects.all(), user).filter(
        status=MortalityRecord.MortalityRecordStatus.APPROVED,
    )
    mortality_annotated = mortality_qs.annotate(
        b_id=Coalesce("livestock__farmer__barangay_id", "batch__farmer__barangay_id"),
        species_name=Coalesce("livestock__livestock_type__name", "batch__livestock_type__name"),
        effective_date=Coalesce("record_date", TruncDate("created_at")),
    )

    recent_mortality_total = 0
    mortality_species_map: Dict[str, int] = {}

    for row in mortality_annotated.values("b_id", "species_name", "cause", "effective_date", "death_count"):
        c_name = pk_to_canonical.get(row["b_id"])
        if not c_name or c_name not in barangays_data:
            continue
        deaths = row["death_count"] or 0
        cause = row["cause"]
        species = row["species_name"] or "Livestock"
        rec_date = row["effective_date"]

        b_entry = barangays_data[c_name]
        b_entry["mortality"] += deaths
        if cause and cause not in b_entry["mortality_causes"]:
            b_entry["mortality_causes"].append(cause)

        # Track per-barangay species breakdown
        sp_item = next((s for s in b_entry["mortality_by_species"] if s["species"] == species), None)
        if sp_item:
            sp_item["heads"] += deaths
        else:
            b_entry["mortality_by_species"].append({"species": species, "heads": deaths})

        # Global species count
        mortality_species_map[species] = mortality_species_map.get(species, 0) + deaths

        # Recent deaths (within 90-day surveillance window)
        if rec_date and rec_date >= recent_cutoff:
            b_entry["recent_mortality"] += deaths
            recent_mortality_total += deaths

    # 10. Livestock Movements & Transport Inspections
    # Records from LivestockInspection with clearance certificates.
    # DATA INTEGRITY RULE: Only APPROVED clearance records contribute to official
    # municipal statistics (movement_out), while all valid movements can be explored
    # with their authoritative clearance status (APPROVED, PENDING, VERIFIED, etc.).
    inspections_qs = (
        scope_reviewer_queryset(
            LivestockInspection.objects.filter(clearance__isnull=False),
            user,
        )
        .select_related("shipper", "shipper__barangay", "clearance")
        .prefetch_related("items", "items__livestock_type")
        .order_by("-inspection_date")
    )

    movements_list: List[Dict[str, Any]] = []
    for insp in inspections_qs:
        origin = (insp.clearance.origin or insp.clearance.shipper_address or "").strip()
        destination = insp.destination.strip()
        direction = classify_movement_direction(origin, destination, OFFICIAL_BARANGAYS)

        # Coordinate resolution: Origin
        origin_coords = None
        if insp.shipper and insp.shipper.barangay:
            canonical_sb = normalize_barangay_name(insp.shipper.barangay.barangay_name)
            if canonical_sb and canonical_sb in BARANGAY_CENTROIDS:
                origin_coords = BARANGAY_CENTROIDS[canonical_sb]
        if not origin_coords:
            origin_coords = get_destination_coords(origin)
        if not origin_coords:
            for barangay_name, coords in BARANGAY_CENTROIDS.items():
                if barangay_name.lower() in origin.lower():
                    origin_coords = coords
                    break
        if not origin_coords and ("padre garcia" in origin.lower() or not origin):
            origin_coords = BARANGAY_CENTROIDS["Poblacion"]

        # Coordinate resolution: Destination
        dest_coords = get_destination_coords(destination)
        if not dest_coords:
            for barangay_name, coords in BARANGAY_CENTROIDS.items():
                if barangay_name.lower() in destination.lower():
                    dest_coords = coords
                    break
        if not dest_coords and "padre garcia" in destination.lower():
            dest_coords = BARANGAY_CENTROIDS["Poblacion"]

        # If origin or destination cannot be resolved to a geographic reference, skip map rendering
        if not origin_coords or not dest_coords:
            continue

        total_heads = sum(item.quantity for item in insp.items.all())
        species_names = list({item.livestock_type.name for item in insp.items.all() if item.livestock_type})
        items_breakdown = [
            {
                "species": item.livestock_type.name if item.livestock_type else "Livestock",
                "quantity": item.quantity,
                "sex": item.get_sex_display(),
                "classification": item.get_classification_display(),
            }
            for item in insp.items.all()
        ]

        origin_b_name = normalize_barangay_name(
            insp.shipper.barangay.barangay_name if insp.shipper and insp.shipper.barangay else ""
        )
        if not origin_b_name:
            for b_name in OFFICIAL_BARANGAYS:
                if b_name.lower() in origin.lower():
                    origin_b_name = b_name
                    break

        movements_list.append({
            "id": insp.pk,
            "type": "import" if direction == "INBOUND" else "export",
            "origin": origin or "Padre Garcia",
            "destination": destination,
            "direction": direction,
            "from": origin_coords,
            "to": dest_coords,
            "heads": total_heads,
            "species": ", ".join(species_names) if species_names else "Cattle",
            "items_breakdown": items_breakdown,
            "purpose": insp.get_purpose_display(),
            "date": insp.inspection_date.isoformat(),
            "shipper_name": insp.shipper_name,
            "clearance_status": insp.clearance.status,
            "control_number": insp.clearance.control_number,
        })

        # Only officially APPROVED movements increment municipal statistics
        if insp.clearance.status == LivestockInspectionClearance.StatusType.APPROVED:
            if origin_b_name and origin_b_name in barangays_data:
                barangays_data[origin_b_name]["movement_out"] += total_heads
                barangays_data[origin_b_name]["inspections_count"] += 1

    # 11. Security Scoping & Data Masking
    # =========================================================================
    # CRITICAL BACKEND DATA INTEGRITY & PRIVACY POLICY:
    # -------------------------------------------------------------------------
    # Frontend filtering is INSUFFICIENT. If an unauthorized client inspects the
    # browser network tab, private metrics from other barangays or farmers must NOT
    # be present in the JSON payload.
    #
    # We resolve the user's role-aware GIS scope:
    user_scope = get_user_gis_scope(user)
    allowed_barangays_set = user_scope["allowed_barangays"]
    allowed_layers = user_scope["allowed_layers"]
    u_role = user_scope["role"]

    # Filter movement records based on role scope
    # Farmers only see movements involving their own registered barangay as origin
    # SIBAT only sees movements originating from their assigned barangays (unless ALL_BARANGAYS)
    if u_role == FARMER:
        movements_list = [
            m for m in movements_list
            if any(f"Brgy. {b}" in m["origin"] for b in allowed_barangays_set)
        ]
    elif u_role in (SIBAT, "CBAT") and not user_scope["can_view_all_barangays"]:
        movements_list = [
            m for m in movements_list
            if any(f"Brgy. {b}" in m["origin"] for b in allowed_barangays_set)
        ]
    # For roles that do not have "movement" in allowed_layers, clear movement array completely
    if "movement" not in allowed_layers:
        movements_list = []

    # Calculate Farmer's personal metrics (my_stats) safely without leaking other farmers
    farmer_stats = None
    if u_role == FARMER and hasattr(user, "farmer_profile") and user.farmer_profile:
        fp = user.farmer_profile
        my_inv = LivestockInventory.objects.filter(
            farmer=fp,
            status=LivestockInventory.StatusType.APPROVED,
            operational_status=LivestockInventory.OperationalStatus.ACTIVE,
        )
        my_cattle = my_inv.filter(livestock_type__name__icontains="cattle").aggregate(s=Sum("quantity"))["s"] or 0
        my_total_livestock = my_inv.aggregate(s=Sum("quantity"))["s"] or 0
        my_milk = ProductionRecord.objects.filter(
            farmer_at_record=fp,
            status=ProductionRecord.ProductionStatus.APPROVED,
            production_type=ProductionRecord.ProductionType.MILK,
        ).aggregate(s=Sum("quantity"))["s"] or 0.0
        my_farmer_meat = ProductionRecord.objects.filter(
            farmer_at_record=fp,
            status=ProductionRecord.ProductionStatus.APPROVED,
            production_type=ProductionRecord.ProductionType.MEAT,
            unit=ProductionRecord.UnitType.KILOGRAMS,
            slaughter__isnull=True,
        ).aggregate(s=Sum("quantity"))["s"] or 0.0

        farmer_stats = {
            "my_cattle": my_cattle,
            "my_total_livestock": my_total_livestock,
            "my_milk": round(float(my_milk), 2),
            "my_farmer_meat": round(float(my_farmer_meat), 2),
            "my_barangay": list(allowed_barangays_set)[0] if allowed_barangays_set else "Registered Barangay",
        }

    # Mask out-of-scope and unauthorized layer data across all 18 barangays
    for b_name, b_entry in barangays_data.items():
        is_in_scope = (b_name in allowed_barangays_set) or user_scope["can_view_all_barangays"]
        b_entry["is_in_scope"] = is_in_scope

        # If a barangay is out-of-scope for a geographically restricted user (e.g. SIBAT or Farmer):
        # Zero out private statistics so they cannot be inspected over the wire
        if not is_in_scope:
            b_entry["cattle"] = 0
            b_entry["total_livestock"] = 0
            b_entry["species_breakdown"] = []
            b_entry["farmers_count"] = 0
            b_entry["batches_count"] = 0
            b_entry["disease_cases"] = 0
            b_entry["active_cases"] = 0
            b_entry["affected_heads"] = 0
            b_entry["disease_risk"] = "low"
            b_entry["recent_diseases"] = []
            b_entry["milk"] = 0.0
            b_entry["farmer_meat"] = 0.0
            b_entry["slaughter_yield"] = 0.0
            b_entry["slaughter_heads"] = 0
            b_entry["meat"] = 0.0
            b_entry["cheese"] = 0.0
            b_entry["mortality"] = 0
            b_entry["mortality_causes"] = []
            b_entry["mortality_by_species"] = []
            b_entry["recent_mortality"] = 0
            b_entry["movement_out"] = 0
            b_entry["movement_in"] = 0
            b_entry["inspections_count"] = 0
            continue

        # If layer is not permitted for the role, zero out that specific layer's data
        if "cattle" not in allowed_layers:
            b_entry["cattle"] = 0
            b_entry["total_livestock"] = 0
            b_entry["species_breakdown"] = []
        if "disease" not in allowed_layers:
            b_entry["disease_cases"] = 0
            b_entry["active_cases"] = 0
            b_entry["affected_heads"] = 0
            b_entry["disease_risk"] = "low"
            b_entry["recent_diseases"] = []
        if "milk" not in allowed_layers:
            b_entry["milk"] = 0.0
            b_entry["cheese"] = 0.0
        if "farmer_meat" not in allowed_layers:
            b_entry["farmer_meat"] = 0.0
        if "slaughter_yield" not in allowed_layers and "meat" not in allowed_layers:
            b_entry["slaughter_yield"] = 0.0
            b_entry["slaughter_heads"] = 0
            b_entry["meat"] = 0.0
        if "mortality" not in allowed_layers:
            b_entry["mortality"] = 0
            b_entry["mortality_causes"] = []
            b_entry["mortality_by_species"] = []
            b_entry["recent_mortality"] = 0
        if "movement" not in allowed_layers:
            b_entry["movement_out"] = 0
            b_entry["movement_in"] = 0
            b_entry["inspections_count"] = 0

    # 12. Compute Scope-Appropriate Totals and Top Rankings
    all_b = list(barangays_data.values())
    scoped_b = [b for b in all_b if b.get("is_in_scope", True)]

    total_livestock = sum(b["total_livestock"] for b in scoped_b)
    total_cattle = sum(b["cattle"] for b in scoped_b)
    total_milk = sum(b["milk"] for b in scoped_b)
    total_farmer_meat = sum(b["farmer_meat"] for b in scoped_b)
    total_slaughter_yield = sum(b["slaughter_yield"] for b in scoped_b)
    total_slaughter_heads = sum(b["slaughter_heads"] for b in scoped_b)
    total_meat = total_slaughter_yield  # Legacy alias for slaughterhouse yield
    total_disease = sum(b["disease_cases"] for b in scoped_b)
    total_active_disease = sum(b["active_cases"] for b in scoped_b)
    total_mortality = sum(b["mortality"] for b in scoped_b)
    total_farmers = sum(b["farmers_count"] for b in scoped_b)

    top_cattle = sorted(scoped_b, key=lambda x: x["cattle"], reverse=True)[:5]
    top_milk = sorted(scoped_b, key=lambda x: x["milk"], reverse=True)[:5]
    top_farmer_meat = sorted(scoped_b, key=lambda x: x["farmer_meat"], reverse=True)[:5] if "farmer_meat" in allowed_layers else []
    top_slaughter_yield = sorted(scoped_b, key=lambda x: x["slaughter_yield"], reverse=True)[:5] if ("slaughter_yield" in allowed_layers or "meat" in allowed_layers) else []
    alert_barangays = [b for b in scoped_b if b["active_cases"] > 0 or b["disease_cases"] > 0]

    # Structure Mortality Summary for GIS telemetry & Dashboard consumption
    mortality_by_species_summary = [
        {"species": sp, "deaths": cnt}
        for sp, cnt in sorted(mortality_species_map.items(), key=lambda x: -x[1])
    ] if "mortality" in allowed_layers else []

    top_mortality_barangays = [
        {"name": b["name"], "deaths": b["mortality"]}
        for b in sorted([b for b in scoped_b if b["mortality"] > 0], key=lambda x: x["mortality"], reverse=True)[:5]
    ] if "mortality" in allowed_layers else []

    mortality_summary = {
        "total_deaths": total_mortality if "mortality" in allowed_layers else 0,
        "affected_barangays": len([b for b in scoped_b if b["mortality"] > 0]) if "mortality" in allowed_layers else 0,
        "recent_deaths": recent_mortality_total if "mortality" in allowed_layers else 0,
        "by_species": mortality_by_species_summary,
        "top_barangays": top_mortality_barangays,
    }

    # Distinct livestock types present in approved active inventory
    available_types = list(
        inventory_qs.values_list("livestock_type__name", flat=True)
        .distinct()
        .order_by("livestock_type__name")
    )
    if not available_types:
        available_types = ["Cattle"]

    # Convert user_scope allowed_barangays set to sorted list for JSON serialization
    serialized_scope = dict(user_scope)
    serialized_scope["allowed_barangays"] = sorted(list(user_scope["allowed_barangays"]))

    return {
        "barangays": all_b,
        "barangays_dict": barangays_data,
        "movements": movements_list,
        "user_scope": serialized_scope,
        "farmer_stats": farmer_stats,
        "summary": {
            "total_livestock": total_livestock,
            "total_cattle": total_cattle,
            "available_livestock_types": available_types,
            "total_milk": round(total_milk, 1),
            "total_farmer_meat": round(total_farmer_meat, 1),
            "total_slaughter_yield": round(total_slaughter_yield, 1),
            "total_slaughter_heads": total_slaughter_heads,
            "total_meat": round(total_meat, 1),
            "total_disease_cases": total_disease,
            "active_disease_cases": total_active_disease,
            "total_mortality": total_mortality,
            "mortality": mortality_summary,
            "total_farmers": total_farmers,
            "total_movements": len(movements_list),
            "top_cattle": [
                {"name": b["name"], "cattle": b["cattle"]} for b in top_cattle
            ],
            "top_milk": [
                {"name": b["name"], "milk": b["milk"]} for b in top_milk
            ],
            "top_farmer_meat": [
                {"name": b["name"], "farmer_meat": b["farmer_meat"]} for b in top_farmer_meat
            ],
            "top_slaughter_yield": [
                {"name": b["name"], "slaughter_yield": b["slaughter_yield"], "slaughter_heads": b["slaughter_heads"]} for b in top_slaughter_yield
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

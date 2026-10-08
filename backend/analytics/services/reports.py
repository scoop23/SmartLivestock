"""Build approved, role-authorized report datasets shared by preview and exports."""

from datetime import date, timedelta
from decimal import Decimal

from django.db.models import Count, DecimalField, F, Q, Sum, When, Case
from django.db.models.functions import Coalesce
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework.exceptions import PermissionDenied, ValidationError

from diseases.models import DiseaseCase, MortalityRecord
from livestock.models import LivestockInventory
from movements.models import LivestockInspection, LivestockInspectionClearance
from production.models import LiveAnimalSale, ProductionRecord, SlaughterRecord
from smartlivestock.workflows import ADMIN, MAO, role_name

from .movement_direction import classify_movement_direction
from .gis import OFFICIAL_BARANGAYS

REPORT_TITLES = {
    "inventory": "Livestock Inventory Report",
    "production": "Production Report",
    "disease_mortality": "Disease and Mortality Report",
    "slaughter": "Slaughter Report",
    "movement": "Auction and Movement Report",
    "inspection": "Inspection and Clearance Report",
}


def _date(value, label):
    parsed = parse_date(value) if value else None
    if not parsed:
        raise ValidationError({label: "This date is required in YYYY-MM-DD format."})
    return parsed


def _number(value):
    return float(value) if isinstance(value, Decimal) else value


def _apply_species(queryset, species, *paths):
    if species:
        condition = Q(pk__in=[])
        for path in paths:
            condition |= Q(**{f"{path}__iexact": species})
        queryset = queryset.filter(condition)
    return queryset


def _apply_barangay(queryset, barangay, *paths):
    if barangay:
        condition = Q(pk__in=[])
        for path in paths:
            condition |= Q(**{f"{path}__barangay_name__iexact": barangay})
        queryset = queryset.filter(condition)
    return queryset


def _base(report_type, start, end, filters):
    """Return columns, real rows and report-specific summary from approved querysets."""
    species = filters.get("species", "").strip()
    barangay = filters.get("barangay", "").strip()
    purpose = filters.get("purpose", "").strip()
    direction = filters.get("direction", "").strip().upper()
    # These report querysets intentionally use official records. A submitted or
    # returned record can still change during review, so it is not reportable yet.
    approved = "APPROVED"

    if report_type == "inventory":
        query = LivestockInventory.objects.filter(status=approved, created_at__date__range=(start, end))
        query = _apply_species(query, species, "livestock_type__name")
        query = _apply_barangay(query, barangay, "farmer__barangay")
        query = query.select_related("livestock_type", "farmer__user", "farmer__barangay").order_by("livestock_type__name", "tag_number", "pk")
        rows = [{
            "tag_id": obj.tag_number or str(obj.pk), "species": obj.livestock_type.name,
            "breed": obj.breed or "", "sex": obj.sex or "", "quantity": obj.quantity,
            "barangay": obj.farmer.barangay.barangay_name if obj.farmer.barangay_id else "",
            "owner": obj.farmer.user.get_full_name() or obj.farmer.user.username,
            "registration_status": obj.status, "operational_status": obj.operational_status,
            "record_date": obj.created_at.date().isoformat(),
        } for obj in query]
        by_species = {}
        by_status = {}
        for row in rows:
            by_species[row["species"]] = by_species.get(row["species"], 0) + row["quantity"]
            by_status[row["operational_status"]] = by_status.get(row["operational_status"], 0) + row["quantity"]
        return [
            ("tag_id", "Tag ID"), ("species", "Species"), ("breed", "Breed"), ("sex", "Sex"),
            ("quantity", "Heads"), ("barangay", "Barangay"), ("owner", "Farmer / Owner"),
            ("registration_status", "Registration"), ("operational_status", "Operational status"),
            ("record_date", "Registered date"),
        ], rows, {"records": len(rows), "total_heads": sum(row["quantity"] for row in rows),
                 "barangays_represented": len({row["barangay"] for row in rows if row["barangay"]}),
                 "heads_by_species": by_species, "heads_by_operational_status": by_status}

    if report_type == "production":
        query = ProductionRecord.objects.filter(status=approved, record_date__range=(start, end))
        query = _apply_species(query, species, "livestock__livestock_type__name", "batch__livestock_type__name")
        query = _apply_barangay(query, barangay, "farmer_at_record__barangay")
        query = query.annotate(
            output_quantity=Case(When(slaughter__isnull=False, then=F("slaughter__carcass_weight")),
                                 default=F("quantity"), output_field=DecimalField(max_digits=10, decimal_places=2)),
            species_name=Coalesce("livestock__livestock_type__name", "batch__livestock_type__name", output_field=None),
            farmer_name=F("farmer_at_record__user__first_name"),
            barangay_name=F("farmer_at_record__barangay__barangay_name"),
        ).select_related("livestock__farmer__user", "batch__farmer__user", "farmer_at_record__user").order_by("record_date", "pk")
        rows = [{
            "record_date": obj.record_date.isoformat(), "production_type": obj.production_type,
            "species": obj.species_name or "", "quantity": _number(obj.output_quantity), "unit": obj.unit,
            "farmer": (obj.farmer_at_record.user.get_full_name() or obj.farmer_at_record.user.username)
                if obj.farmer_at_record_id else "",
            "barangay": obj.barangay_name or "", "status": obj.status,
        } for obj in query]
        # Count distinct foreign-key identities rather than farmer display names,
        # which can collide when two farmers share the same name.
        farmer_ids = {
            obj.farmer_at_record_id
            for obj in query
        }
        # Keep totals separate by unit: liters, kilograms, and pieces cannot be
        # added together into one meaningful production number.
        totals = {}
        for row in rows:
            key = f"{row['production_type']} ({row['unit']})"
            totals[key] = totals.get(key, 0) + row["quantity"]
        return (
            [("record_date", "Date"), ("production_type", "Production type"), ("species", "Species"),
             ("quantity", "Quantity"), ("unit", "Unit"), ("farmer", "Farmer"),
             ("barangay", "Barangay"), ("status", "Approval status")],
            rows,
            {"records": len(rows), "contributing_farmers": len(farmer_ids - {None}),
             "totals_by_type_and_unit": totals},
        )

    if report_type == "disease_mortality":
        diseases = DiseaseCase.objects.filter(status=approved, record_date__range=(start, end))
        diseases = _apply_species(diseases, species, "livestock__livestock_type__name", "batch__livestock_type__name")
        diseases = _apply_barangay(diseases, barangay, "livestock__farmer__barangay", "batch__farmer__barangay")
        disease_rows = [{"record_kind": "DISEASE", "record_date": obj.record_date.isoformat(),
                         "condition_or_cause": obj.name, "affected_or_dead": obj.affected_count,
                         "species": obj.livestock.livestock_type.name if obj.livestock_id else (obj.batch.livestock_type.name if obj.batch_id else ""),
                         "barangay": obj.livestock.farmer.barangay.barangay_name if obj.livestock_id and obj.livestock.farmer.barangay_id else (obj.batch.farmer.barangay.barangay_name if obj.batch_id and obj.batch.farmer.barangay_id else ""),
                         "status": obj.status} for obj in diseases.select_related("livestock__livestock_type", "livestock__farmer__barangay", "batch__livestock_type", "batch__farmer__barangay")]
        deaths = MortalityRecord.objects.filter(status=approved, record_date__range=(start, end))
        deaths = _apply_species(deaths, species, "livestock__livestock_type__name", "batch__livestock_type__name")
        deaths = _apply_barangay(deaths, barangay, "livestock__farmer__barangay", "batch__farmer__barangay")
        mortality_rows = [{"record_kind": "MORTALITY", "record_date": obj.record_date.isoformat(),
                           "condition_or_cause": obj.cause, "affected_or_dead": obj.death_count,
                           "species": obj.livestock.livestock_type.name if obj.livestock_id else (obj.batch.livestock_type.name if obj.batch_id else ""),
                           "barangay": obj.livestock.farmer.barangay.barangay_name if obj.livestock_id and obj.livestock.farmer.barangay_id else (obj.batch.farmer.barangay.barangay_name if obj.batch_id and obj.batch.farmer.barangay_id else ""),
                           "status": obj.status} for obj in deaths.select_related("livestock__livestock_type", "livestock__farmer__barangay", "batch__livestock_type", "batch__farmer__barangay")]
        rows = sorted(disease_rows + mortality_rows, key=lambda row: row["record_date"])
        disease_frequency = {}
        for row in disease_rows:
            disease_frequency[row["condition_or_cause"]] = disease_frequency.get(row["condition_or_cause"], 0) + 1
        most_reported = max(disease_frequency, key=disease_frequency.get) if disease_frequency else "None"
        return [("record_kind", "Record type"), ("record_date", "Date"), ("condition_or_cause", "Disease / cause"),
                ("species", "Species"), ("affected_or_dead", "Affected / deaths"), ("barangay", "Barangay"),
                ("status", "Approval status")], rows, {"disease_cases": len(disease_rows),
                "affected_heads": sum(row["affected_or_dead"] for row in disease_rows),
                "mortality_records": len(mortality_rows), "deaths": sum(row["affected_or_dead"] for row in mortality_rows),
                "affected_species": len({row["species"] for row in rows if row["species"]}),
                "most_reported_disease": most_reported}

    if report_type == "slaughter":
        query = SlaughterRecord.objects.filter(status=approved, record_date__range=(start, end))
        query = _apply_species(query, species, "livestock_type__name")
        query = _apply_barangay(query, barangay, "barangay")
        query = query.select_related("livestock_type", "barangay").order_by("record_date", "pk")
        rows = [{"record_date": obj.record_date.isoformat(), "species": obj.livestock_type.name,
                 "quantity": obj.quantity, "carcass_weight_kg": _number(obj.carcass_weight),
                 "barangay": obj.barangay.barangay_name if obj.barangay_id else "", "status": obj.status}
                for obj in query]
        weighted_rows = [row for row in rows if row["carcass_weight_kg"] is not None]
        return [("record_date", "Date"), ("species", "Species"), ("quantity", "Heads slaughtered"),
                ("carcass_weight_kg", "Carcass weight (kg)"), ("barangay", "Barangay"),
                ("status", "Approval status")], rows, {"records": len(rows),
                "animals_slaughtered": sum(row["quantity"] for row in rows),
                "carcass_weight_kg": sum(row["carcass_weight_kg"] for row in weighted_rows) if weighted_rows else None,
                "average_carcass_weight_kg": round(sum(row["carcass_weight_kg"] for row in weighted_rows) / len(weighted_rows), 2) if weighted_rows else None}

    if report_type in ("movement", "inspection"):
        # GIS movement layers use the same MAO-approved clearance boundary.
        # Inspection items are expanded below so one inspection can report each
        # livestock line without losing its own species and quantity.
        query = LivestockInspection.objects.filter(clearance__status=LivestockInspectionClearance.StatusType.APPROVED,
                                                   inspection_date__range=(start, end))
        query = _apply_species(query, species, "items__livestock_type__name")
        query = _apply_barangay(query, barangay, "shipper__barangay")
        if purpose:
            query = query.filter(purpose__iexact=purpose)
        query = query.select_related("shipper__barangay", "clearance").prefetch_related("items__livestock_type", "items__inventory").distinct().order_by("inspection_date", "pk")
        rows = []
        for obj in query:
            clearance = obj.clearance
            origin = (clearance.origin or clearance.shipper_address or "").strip()
            direction_value = classify_movement_direction(origin, obj.destination, OFFICIAL_BARANGAYS)
            if direction and direction_value != direction:
                continue
            for item in obj.items.all():
                if species and item.livestock_type.name.lower() != species.lower():
                    continue
                base_row = {"control_number": clearance.control_number, "record_date": obj.inspection_date.isoformat(),
                            "origin": origin, "destination": obj.destination, "direction": direction_value,
                            "purpose": obj.purpose, "species": item.livestock_type.name, "quantity": item.quantity,
                            "vehicle": clearance.vehicle_plate_number or "", "handler_license": clearance.livestock_handler_license_no or "",
                            "barangay": obj.shipper.barangay.barangay_name if obj.shipper_id and obj.shipper.barangay_id else "",
                            "clearance_status": clearance.status, "issued_date": clearance.date_issued.isoformat() if clearance.date_issued else ""}
                if report_type == "movement":
                    # Inspection movements and auction sales are separate record
                    # kinds because activity at the market is not itself proof of
                    # geographic direction or regulatory clearance.
                    rows.append({"record_kind": "MOVEMENT", **base_row})
                else:
                    rows.append({key: value for key, value in base_row.items()
                                 if key in ("control_number", "record_date", "origin", "destination", "purpose", "quantity", "clearance_status", "issued_date")})
        if report_type == "movement":
            # Seeded and user-entered sales use the same approved queryset and
            # filters, so synthetic records never need a special frontend path.
            auction_query = LiveAnimalSale.objects.filter(status=approved, sale_date__range=(start, end))
            auction_query = _apply_species(auction_query, species, "livestock__livestock_type__name", "batch__livestock_type__name")
            auction_query = _apply_barangay(auction_query, barangay, "livestock__farmer__barangay", "batch__farmer__barangay")
            if purpose:
                auction_query = auction_query.filter(purpose__iexact=purpose)
            auction_query = auction_query.select_related(
                "livestock__livestock_type", "livestock__farmer__barangay",
                "batch__livestock_type", "batch__farmer__barangay",
            ).order_by("sale_date", "pk")
            auction_rows = []
            for sale in auction_query:
                sale_species = sale.livestock.livestock_type.name if sale.livestock_id else (sale.batch.livestock_type.name if sale.batch_id else "")
                sale_barangay = sale.livestock.farmer.barangay.barangay_name if sale.livestock_id and sale.livestock.farmer.barangay_id else (sale.batch.farmer.barangay.barangay_name if sale.batch_id and sale.batch.farmer.barangay_id else "")
                auction_rows.append({
                    "record_kind": "AUCTION", "record_date": sale.sale_date.isoformat(),
                    "control_number": f"SALE-{sale.pk}", "origin": sale_barangay,
                    "destination": sale.destination or "", "direction": "",
                    "purpose": sale.purpose, "species": sale_species,
                    "quantity": sale.quantity, "vehicle": "", "handler_license": "",
                    "barangay": sale_barangay, "clearance_status": sale.status,
                    "issued_date": "", "sale_method": sale.sale_method,
                })
            rows.extend(auction_rows)
            rows.sort(key=lambda row: (row["record_date"], row["record_kind"], row["control_number"]))
            columns = [("record_kind", "Activity type"), ("record_date", "Date"), ("control_number", "Record / control number"), ("origin", "Origin / barangay"),
                       ("destination", "Destination"), ("direction", "Direction"), ("purpose", "Purpose"),
                       ("species", "Species"), ("quantity", "Heads / items"), ("vehicle", "Vehicle plate"),
                       ("handler_license", "Handler license"), ("sale_method", "Sale method"), ("clearance_status", "Approval / clearance status")]
        else:
            columns = [("control_number", "Control number"), ("record_date", "Inspection date"), ("origin", "Origin"),
                       ("destination", "Destination"), ("purpose", "Purpose"), ("quantity", "Livestock heads"),
                       ("clearance_status", "Clearance status"), ("issued_date", "Issued date")]
        if report_type == "movement":
            auction = [row for row in rows if row["record_kind"] == "AUCTION"]
            movements = [row for row in rows if row["record_kind"] == "MOVEMENT"]
            summary = {
                "records": len({row["control_number"] for row in movements}) + len(auction),
                "movement_records": len({row["control_number"] for row in movements}),
                "livestock_heads": sum(row["quantity"] for row in movements),
                "movement_lines": len(movements),
                "auction_activity": {"auction_records": len(auction),
                                     "auction_items_processed": sum(row["quantity"] for row in auction),
                                     "auction_species": len({row["species"] for row in auction if row["species"]})},
                "movement_analysis": {"movement_records": len({row["control_number"] for row in movements}),
                                      "movement_lines": len(movements),
                                      "livestock_heads": sum(row["quantity"] for row in movements),
                                      "inbound": sum(row["direction"] == "INBOUND" for row in movements),
                                      "outbound": sum(row["direction"] == "OUTBOUND" for row in movements),
                                      "internal": sum(row["direction"] == "INTERNAL" for row in movements),
                                      "unknown": sum(row["direction"] == "UNKNOWN" for row in movements)},
            }
            return columns, rows, summary
        inspection_count = len({row["control_number"] for row in rows})
        return columns, rows, {"records": inspection_count, "approved_inspections": inspection_count,
                               "clearance_records": inspection_count,
                               "livestock_heads": sum(row["quantity"] for row in rows),
                               "movement_lines": len(rows)}
    raise ValidationError({"report_type": "Select a supported report type."})


def _sum_by(rows, label_key, value_key, *, predicate=None):
    totals = {}
    for row in rows:
        if predicate and not predicate(row):
            continue
        label = str(row.get(label_key) or "Unknown")
        totals[label] = totals.get(label, 0) + (row.get(value_key) or 0)
    return sorted(totals.items(), key=lambda item: item[1], reverse=True)


def _distinct_count(rows, key):
    return len({row.get(key) for row in rows if row.get(key)})


def _format_analysis_number(value):
    formatted = f"{value:,.2f}"
    return formatted.rstrip("0").rstrip(".")


def _analysis_metrics(report_type, rows):
    """Create comparable metrics from report rows without changing report trust rules."""
    if report_type == "inventory":
        # Registration timestamps do not preserve past stock snapshots, so a
        # registration cohort must never be presented as historical holdings.
        return {}
    if report_type == "production":
        # There is deliberately one metric per unit: liters cannot be compared to pieces.
        totals = {}
        for row in rows:
            unit = row.get("unit") or "Unknown unit"
            totals[unit] = totals.get(unit, 0) + row["quantity"]
        return {f"production:{unit}": (value, unit) for unit, value in totals.items()}
    if report_type == "disease_mortality":
        return {
            "disease_cases": (sum(row.get("record_kind") == "DISEASE" for row in rows), "cases"),
            "mortality_records": (sum(row.get("record_kind") == "MORTALITY" for row in rows), "records"),
        }
    if report_type == "slaughter":
        metrics = {
            "animals_slaughtered": (sum(row["quantity"] for row in rows), "heads"),
        }
        weighted = [row["carcass_weight_kg"] for row in rows if row.get("carcass_weight_kg") is not None]
        if weighted:
            metrics["carcass_weight"] = (sum(weighted), "kg")
        return metrics
    if report_type == "movement":
        auction = [row for row in rows if row.get("record_kind") == "AUCTION"]
        movement = [row for row in rows if row.get("record_kind") == "MOVEMENT"]
        return {
            "auction_items": (sum(row["quantity"] for row in auction), "heads / items"),
            "movement_records": (_distinct_count(movement, "control_number"), "records"),
            "movement_heads": (sum(row["quantity"] for row in movement), "heads"),
            "inbound_lines": (sum(row.get("direction") == "INBOUND" for row in movement), "lines"),
            "outbound_lines": (sum(row.get("direction") == "OUTBOUND" for row in movement), "lines"),
        }
    if report_type == "inspection":
        return {
            "inspections": (_distinct_count(rows, "control_number"), "records"),
            "livestock_heads": (sum(row["quantity"] for row in rows), "heads"),
        }
    return {}


def _build_analysis(report_type, rows, previous_rows, previous_period, summary):
    """Derive all narrative/reporting additions from the exact filtered row sets."""
    kpis, findings, rankings = [], [], []

    def kpi(label, value, detail=""):
        kpis.append({"label": label, "value": value, "detail": detail})

    def ranking(title, items, unit=""):
        if items:
            rankings.append({"title": title, "unit": unit,
                             "items": [{"name": name, "value": value} for name, value in items[:5]]})

    if report_type == "inventory":
        species = _sum_by(rows, "species", "quantity")
        barangays = _sum_by([row for row in rows if row.get("barangay")], "barangay", "quantity")
        kpi("Registered livestock heads", summary["total_heads"], "heads in matching approved registrations")
        kpi("Species represented", len(species))
        kpi("Barangays represented", len(barangays))
        if species:
            kpi("Largest species", species[0][0], f"{species[0][1]:,} heads")
            findings.append(f"{species[0][0]} represented the largest registered livestock count in this selection ({species[0][1]:,} heads).")
        if barangays:
            kpi("Largest barangay", barangays[0][0], f"{barangays[0][1]:,} heads")
            findings.append(f"{barangays[0][0]} had the highest registered livestock count in this selection ({barangays[0][1]:,} heads).")
        ranking("Top 5 Barangays by Registered Livestock", barangays, "heads")
    elif report_type == "production":
        units = sorted({str(row.get("unit") or "Unknown") for row in rows})
        kpi("Production records", len(rows))
        if rows:
            kpi("Contributing farmers", summary["contributing_farmers"])
        for unit in units:
            unit_rows = [row for row in rows if str(row.get("unit") or "Unknown") == unit]
            total = sum(row["quantity"] for row in unit_rows)
            kpi(f"Total production ({unit})", total, unit)
            by_barangay = _sum_by([row for row in unit_rows if row.get("barangay")], "barangay", "quantity")
            by_type = _sum_by(unit_rows, "production_type", "quantity")
            ranking(f"Top 5 Barangays by Production ({unit})", by_barangay, unit)
            if by_barangay:
                findings.append(f"{by_barangay[0][0]} recorded the highest production measured in {unit.lower()} ({_format_analysis_number(by_barangay[0][1])} {unit.lower()}).")
            if by_type:
                findings.append(f"{by_type[0][0]} was the highest recorded production type within the {unit.lower()} unit group.")
        if not rows:
            kpi("Production records", 0)
    elif report_type == "disease_mortality":
        diseases = [row for row in rows if row.get("record_kind") == "DISEASE"]
        deaths = [row for row in rows if row.get("record_kind") == "MORTALITY"]
        # Count case records by condition; affected animal counts are a different measure.
        case_counts = {}
        for row in diseases:
            name = row.get("condition_or_cause") or "Unknown"
            case_counts[name] = case_counts.get(name, 0) + 1
        by_type = sorted(case_counts.items(), key=lambda item: item[1], reverse=True)
        barangay_cases = {}
        for row in diseases:
            if row.get("barangay"):
                name = row["barangay"]
                barangay_cases[name] = barangay_cases.get(name, 0) + 1
        by_barangay = sorted(barangay_cases.items(), key=lambda item: item[1], reverse=True)
        kpi("Reported disease cases", len(diseases))
        kpi("Disease types", len(by_type))
        kpi("Affected barangays", len({row.get("barangay") for row in diseases if row.get("barangay")}))
        kpi("Mortality records", len(deaths))
        if by_type:
            kpi("Most reported disease", by_type[0][0], f"{by_type[0][1]} cases")
            findings.append(f"{by_type[0][0]} accounted for the most reported disease cases ({by_type[0][1]}).")
        if by_barangay:
            findings.append(f"{by_barangay[0][0]} recorded the most disease case reports ({by_barangay[0][1]}).")
        if deaths:
            findings.append(f"{len(deaths)} approved mortality records were included in this period.")
        ranking("Barangays with Most Reported Cases", by_barangay, "cases")
        ranking("Disease Cases by Type", by_type, "cases")
    elif report_type == "slaughter":
        species = _sum_by(rows, "species", "quantity")
        total_weight = sum(row.get("carcass_weight_kg") or 0 for row in rows)
        kpi("Animals slaughtered", summary["animals_slaughtered"], "heads")
        kpi("Slaughter records", len(rows))
        if any(row.get("carcass_weight_kg") is not None for row in rows):
            kpi("Carcass weight", total_weight, "kg")
        if species:
            kpi("Most represented species", species[0][0], f"{species[0][1]:,} heads")
            findings.append(f"{species[0][0]} had the highest recorded slaughter volume ({species[0][1]:,} heads).")
        ranking("Species by Slaughter Volume", species, "heads")
    elif report_type == "movement":
        auction = [row for row in rows if row.get("record_kind") == "AUCTION"]
        movement = [row for row in rows if row.get("record_kind") == "MOVEMENT"]
        kpi("Auction records", len(auction))
        kpi("Auction items processed", sum(row["quantity"] for row in auction), "heads / items")
        kpi("Movement records", _distinct_count(movement, "control_number"))
        kpi("Inbound movement lines", sum(row.get("direction") == "INBOUND" for row in movement))
        kpi("Outbound movement lines", sum(row.get("direction") == "OUTBOUND" for row in movement))
        kpi("Internal movement lines", sum(row.get("direction") == "INTERNAL" for row in movement))
        kpi("Unknown direction lines", sum(row.get("direction") == "UNKNOWN" for row in movement))
        auction_origins = _sum_by(auction, "origin", "quantity")
        auction_destinations = _sum_by(auction, "destination", "quantity")
        movement_origins = _sum_by(movement, "origin", "quantity")
        movement_destinations = _sum_by(movement, "destination", "quantity")
        ranking("Auction Origins by Items", auction_origins, "heads / items")
        ranking("Auction Destinations by Items", auction_destinations, "heads / items")
        ranking("Movement Origins by Heads", movement_origins, "heads")
        ranking("Movement Destinations by Heads", movement_destinations, "heads")
        if auction:
            findings.append(f"Auction operations processed {sum(row['quantity'] for row in auction):,} livestock items across {len(auction)} approved sale records.")
        if movement:
            findings.append(f"Movement analysis includes {_distinct_count(movement, 'control_number')} approved clearance records; direction totals are reported separately from auction sales.")
    elif report_type == "inspection":
        count = _distinct_count(rows, "control_number")
        kpi("Inspections", count, "records")
        kpi("Approved inspections", count, "approval filter applied")
        kpi("Clearance records", count)
        purpose_ids = {}
        for index, row in enumerate(rows):
            purpose = row.get("purpose") or "Unknown"
            purpose_ids.setdefault(purpose, set()).add(row.get("control_number") or f"row-{index}")
        purposes = sorted(((name, len(ids)) for name, ids in purpose_ids.items()), key=lambda item: item[1], reverse=True)
        ranking("Most Frequent Inspection Purposes", purposes, "inspections")
        if purposes:
            findings.append(f"{purposes[0][0]} was the most frequent purpose among approved inspection records ({purposes[0][1]}).")

    if report_type == "inventory":
        if rows:
            coverage = (f"{len(rows):,} approved livestock registrations match the selected registration-date range. "
                        "Operational status reflects the latest saved state; historical monthly holdings are not inferred.")
        else:
            coverage = ("No approved livestock registrations match this registration-date range and filter selection. "
                        "Historical monthly inventory snapshots are not available.")
    elif not rows:
        coverage = "No approved records were available for this report and filter selection."
    elif summary.get("records", len(rows)) < 10:
        count = summary.get("records", len(rows))
        coverage = f"Only {count} approved records were available during the selected period; interpret patterns with caution."
    else:
        coverage = f"{summary.get('records', len(rows)):,} approved records were available during the selected period."

    coverage_level = "none" if not rows else "sparse" if summary.get("records", len(rows)) < 10 else "adequate"
    if report_type == "disease_mortality" and rows:
        if not any(row.get("record_kind") == "DISEASE" for row in rows):
            coverage = "No approved disease records were available; the rows in this period are mortality records only."
        elif not any(row.get("record_kind") == "MORTALITY" for row in rows):
            coverage = "No approved mortality records were available for this reporting period."

    methodologies = {
        "inventory": "Inventory rows are approved livestock registrations selected by their registration date. Operational status reflects the latest saved state. The model does not store historical inventory snapshots, so this report cannot reconstruct holdings as of past dates.",
        "production": "Production statistics use approved production records. Quantities remain grouped by recorded unit; liters, kilograms, pieces, and heads are not combined.",
        "disease_mortality": "Disease statistics represent reported approved case records, not clinical diagnoses or epidemiological predictions. Mortality records are counted separately.",
        "slaughter": "Slaughter statistics use approved slaughter records; animal counts and carcass kilograms are separate measures.",
        "movement": "Auction activity comes from approved sale records. Movement direction and volume come from approved inspection/clearance records and remain separate from auction activity.",
        "inspection": "Inspection statistics are based on records with MAO-approved clearances under the existing validation workflow.",
    }
    data_status = {
        "inventory": "Approved registrations; latest operational status",
        "movement": "Approved auction sales and approved clearances",
        "inspection": "MAO-approved clearance records",
    }.get(report_type, "Approved source records")

    current_metrics = _analysis_metrics(report_type, rows)
    previous_metrics = _analysis_metrics(report_type, previous_rows)
    comparison_rows = []
    if rows and previous_rows:
        # Equivalent windows make percentage change interpretable; only metrics
        # represented in both windows are compared, and units remain part of keys.
        for key in current_metrics.keys() & previous_metrics.keys():
            current_value, unit = current_metrics[key]
            previous_value, _ = previous_metrics[key]
            if previous_value == 0:
                continue
            comparison_rows.append({
                "label": key.split(":", 1)[1].title() if key.startswith("production:") else key.replace("_", " ").title(),
                "current": current_value, "previous": previous_value, "unit": unit,
                "change_percent": round((current_value - previous_value) / previous_value * 100, 1),
            })
        comparison_rows.sort(key=lambda item: item["label"])
        for metric in comparison_rows:
            if metric["change_percent"] == 0:
                continue
            trend = "increased" if metric["change_percent"] > 0 else "decreased"
            findings.append(f"{metric['label']} {trend} by {abs(metric['change_percent']):g}% compared with the equivalent previous period.")
    comparison_unavailable_reason = (
        "Historical inventory comparison unavailable because the model does not store inventory snapshots."
        if report_type == "inventory" else
        "Previous-period comparison unavailable due to insufficient data."
    )
    return {
        "executive_summary": kpis,
        "key_findings": findings[:5],
        "rankings": rankings,
        "coverage_notice": coverage,
        "coverage_level": coverage_level,
        "data_status": data_status,
        "methodology": methodologies[report_type],
        "comparison": {"available": bool(comparison_rows), "period": previous_period,
                       "metrics": comparison_rows, "unavailable_reason": comparison_unavailable_reason},
    }


def build_report(report_type, params, user):
    """Validate query parameters, enforce role, and return the shared report dataset."""
    if role_name(user) not in (MAO, ADMIN):
        raise PermissionDenied("Only MAO and Admin can generate official reports.")
    if report_type not in REPORT_TITLES:
        raise ValidationError({"report_type": "Select a supported report type."})
    start, end = _date(params.get("date_from"), "date_from"), _date(params.get("date_to"), "date_to")
    if start > end:
        raise ValidationError({"date_to": "Date To must be on or after Date From."})
    filters = {key: params.get(key, "") for key in ("species", "barangay", "purpose", "direction")}
    allowed_filters = {"species", "barangay"}
    if report_type in ("movement", "inspection"):
        allowed_filters.add("purpose")
    if report_type == "movement":
        allowed_filters.add("direction")
    unsupported = [key for key, value in filters.items() if value and key not in allowed_filters]
    if unsupported:
        raise ValidationError({key: "This filter is not available for the selected report." for key in unsupported})
    if filters["direction"] and filters["direction"].upper() not in {"INBOUND", "OUTBOUND", "INTERNAL", "UNKNOWN"}:
        raise ValidationError({"direction": "Choose INBOUND, OUTBOUND, INTERNAL, or UNKNOWN."})
    columns, rows, summary = _base(report_type, start, end, filters)
    # A previous-period comparison needs a second authorized dataset, using the
    # same report service and filters for an immediately preceding equal-length window.
    period_days = (end - start).days + 1
    previous_end = start - timedelta(days=1)
    previous_start = previous_end - timedelta(days=period_days - 1)
    # Inventory has registration dates but no historical snapshots. An earlier
    # registration cohort is not a valid comparison for holdings at that time.
    previous_rows = [] if report_type == "inventory" else _base(report_type, previous_start, previous_end, filters)[1]
    previous_period = {"date_from": previous_start.isoformat(), "date_to": previous_end.isoformat()}
    analysis = _build_analysis(report_type, rows, previous_rows, previous_period, summary)
    return {"report_type": report_type, "title": REPORT_TITLES[report_type],
            "municipality": "Padre Garcia, Batangas", "period": {"date_from": start.isoformat(), "date_to": end.isoformat()},
            "generated_at": timezone.now().isoformat(), "generated_by": user.get_full_name() or user.username,
            "filters": filters, "period_label": "Registration period" if report_type == "inventory" else "Reporting period",
            "summary": summary, "analysis": analysis,
            "columns": [{"key": key, "label": label} for key, label in columns],
            "rows": rows, "record_count": summary.get("records", len(rows))}

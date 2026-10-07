"""Build approved, role-authorized report datasets shared by preview and exports."""

from datetime import date
from decimal import Decimal

from django.db.models import Count, DecimalField, F, Q, Sum, When, Case
from django.db.models.functions import Coalesce
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework.exceptions import PermissionDenied, ValidationError

from diseases.models import DiseaseCase, MortalityRecord
from livestock.models import LivestockInventory
from movements.models import LivestockInspection, LivestockInspectionClearance
from production.models import ProductionRecord, SlaughterRecord
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
                 "heads_by_species": by_species, "heads_by_operational_status": by_status}

    if report_type == "production":
        query = ProductionRecord.objects.filter(status=approved, record_date__range=(start, end))
        query = _apply_species(query, species, "livestock__livestock_type__name", "batch__livestock_type__name")
        query = _apply_barangay(query, barangay, "livestock__farmer__barangay", "batch__farmer__barangay")
        query = query.annotate(
            output_quantity=Case(When(slaughter__isnull=False, then=F("slaughter__carcass_weight")),
                                 default=F("quantity"), output_field=DecimalField(max_digits=10, decimal_places=2)),
            species_name=Coalesce("livestock__livestock_type__name", "batch__livestock_type__name", output_field=None),
            farmer_name=Coalesce("livestock__farmer__user__first_name", "batch__farmer__user__first_name"),
            barangay_name=Coalesce("livestock__farmer__barangay__barangay_name", "batch__farmer__barangay__barangay_name"),
        ).select_related("livestock__farmer__user", "batch__farmer__user").order_by("record_date", "pk")
        rows = [{
            "record_date": obj.record_date.isoformat(), "production_type": obj.production_type,
            "species": obj.species_name or "", "quantity": _number(obj.output_quantity), "unit": obj.unit,
            "farmer": obj.livestock.farmer.user.get_full_name() or obj.livestock.farmer.user.username
                if obj.livestock_id else (obj.batch.farmer.user.get_full_name() or obj.batch.farmer.user.username if obj.batch_id else ""),
            "barangay": obj.barangay_name or "", "status": obj.status,
        } for obj in query]
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
            {"records": len(rows), "totals_by_type_and_unit": totals},
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
        return [("record_kind", "Record type"), ("record_date", "Date"), ("condition_or_cause", "Disease / cause"),
                ("species", "Species"), ("affected_or_dead", "Affected / deaths"), ("barangay", "Barangay"),
                ("status", "Approval status")], rows, {"disease_cases": len(disease_rows),
                "affected_heads": sum(row["affected_or_dead"] for row in disease_rows),
                "mortality_records": len(mortality_rows), "deaths": sum(row["affected_or_dead"] for row in mortality_rows)}

    if report_type == "slaughter":
        query = SlaughterRecord.objects.filter(status=approved, record_date__range=(start, end))
        query = _apply_species(query, species, "livestock_type__name")
        query = _apply_barangay(query, barangay, "barangay")
        query = query.select_related("livestock_type", "barangay").order_by("record_date", "pk")
        rows = [{"record_date": obj.record_date.isoformat(), "species": obj.livestock_type.name,
                 "quantity": obj.quantity, "carcass_weight_kg": _number(obj.carcass_weight),
                 "barangay": obj.barangay.barangay_name if obj.barangay_id else "", "status": obj.status}
                for obj in query]
        return [("record_date", "Date"), ("species", "Species"), ("quantity", "Heads slaughtered"),
                ("carcass_weight_kg", "Carcass weight (kg)"), ("barangay", "Barangay"),
                ("status", "Approval status")], rows, {"records": len(rows),
                "animals_slaughtered": sum(row["quantity"] for row in rows),
                "carcass_weight_kg": sum(row["carcass_weight_kg"] or 0 for row in rows)}

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
                    rows.append(base_row)
                else:
                    rows.append({key: value for key, value in base_row.items()
                                 if key in ("control_number", "record_date", "origin", "destination", "purpose", "quantity", "clearance_status", "issued_date")})
        if report_type == "movement":
            columns = [("record_date", "Date"), ("control_number", "Control number"), ("origin", "Origin"),
                       ("destination", "Destination"), ("direction", "Direction"), ("purpose", "Purpose"),
                       ("species", "Species"), ("quantity", "Heads"), ("vehicle", "Vehicle plate"),
                       ("handler_license", "Handler license"), ("clearance_status", "Status")]
        else:
            columns = [("control_number", "Control number"), ("record_date", "Inspection date"), ("origin", "Origin"),
                       ("destination", "Destination"), ("purpose", "Purpose"), ("quantity", "Livestock heads"),
                       ("clearance_status", "Clearance status"), ("issued_date", "Issued date")]
        return columns, rows, {"records": len({row["control_number"] for row in rows}),
                               "livestock_heads": sum(row["quantity"] for row in rows),
                               "movement_lines": len(rows)}
    raise ValidationError({"report_type": "Select a supported report type."})


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
    return {"report_type": report_type, "title": REPORT_TITLES[report_type],
            "municipality": "Padre Garcia, Batangas", "period": {"date_from": start.isoformat(), "date_to": end.isoformat()},
            "generated_at": timezone.now().isoformat(), "generated_by": user.get_full_name() or user.username,
            "filters": filters, "summary": summary, "columns": [{"key": key, "label": label} for key, label in columns],
            "rows": rows, "record_count": summary.get("records", len(rows))}

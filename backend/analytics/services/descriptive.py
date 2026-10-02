"""Approved municipal records aggregated for descriptive dashboards."""

import calendar
from datetime import date

from django.db.models import Case, Count, DecimalField, F, Q, Sum, When
from django.db.models.fields.json import KeyTextTransform
from django.db.models.functions import Cast, Coalesce, TruncMonth
from django.utils import timezone

from diseases.models import DiseaseCase, MortalityRecord
from movements.models import (
    LivestockInspection,
    LivestockInspectionItem,
    LivestockInspectionClearance,
)
from .population import population_summary
from smartlivestock.workflows import scope_reviewer_queryset
from production.models import LiveAnimalSale, ProductionRecord, SlaughterRecord


WINDOW_MONTHS = 12


def _window_start(today):
    month_number = today.year * 12 + today.month - WINDOW_MONTHS
    year, month = divmod(month_number, 12)
    return date(year, month + 1, 1)


def _months(start):
    for offset in range(WINDOW_MONTHS):
        month_number = start.year * 12 + start.month - 1 + offset
        year, month = divmod(month_number, 12)
        yield date(year, month + 1, 1)


def _series(rows, value_field, start):
    values = {row["month"]: row[value_field] or 0 for row in rows}
    return [
        {
            "month": month.isoformat(),
            "label": f"{calendar.month_abbr[month.month]} {month.year}",
            value_field: float(values.get(month, 0)),
        }
        for month in _months(start)
    ]


def descriptive_summary(today=None, *, user=None):
    today = today or timezone.localdate()
    start = _window_start(today)

    population = population_summary(user=user, today=today)
    total_heads = population["total_heads"]
    vaccinated_heads = sum(row["vaccinated"] for row in population["by_barangay"])
    coverage = [
        {"barangay_id": row["barangay_id"], "barangay": row["barangay"],
         "total": row["heads"], "vaccinated": row["vaccinated"],
         "coverage_pct": round(row["vaccinated"] / row["heads"] * 100, 1) if row["heads"] else 0}
        for row in population["by_barangay"]
    ]

    # VERIFIED means SIBAT checked the submission; APPROVED is MAO's final
    # decision. All dated event totals use the event date, never created_at.
    production = scope_reviewer_queryset(ProductionRecord.objects.all(), user).filter(
        status=ProductionRecord.ProductionStatus.APPROVED,
        record_date__range=(start, today),
    )
    # Linked meat entries are queue projections: use their slaughter weight once,
    # never add the same event's ProductionRecord and SlaughterRecord weights.
    production = production.annotate(output_quantity=Case(
        When(slaughter__isnull=False, then=F("slaughter__carcass_weight")),
        default=F("quantity"), output_field=DecimalField(max_digits=10, decimal_places=2)))
    # Keep units separate: liters, kilograms, and pieces cannot be added together.
    production_by_type = [
        {"type": row["production_type"], "unit": row["unit"],
         "quantity": float(row["quantity"] or 0), "records": row["records"]}
        for row in production.values("production_type", "unit")
        .annotate(quantity=Sum("output_quantity"), records=Count("id"))
        .order_by("production_type", "unit")
    ]
    production_monthly = list(
        production.annotate(month=TruncMonth("record_date"))
        .values("month", "production_type", "unit")
        .annotate(quantity=Sum("output_quantity"), records=Count("id"))
        .order_by("month", "production_type", "unit")
    )
    # Batch-only events get their location through the batch farmer FK.
    production_by_barangay = [
        {"barangay_id": row["barangay_id"], "barangay": row["barangay"], "type": row["production_type"],
         "unit": row["unit"], "quantity": float(row["quantity"] or 0)}
        for row in production.annotate(
            barangay_id=Coalesce("livestock__farmer__barangay_id", "batch__farmer__barangay_id"),
            barangay=Coalesce("livestock__farmer__barangay__barangay_name", "batch__farmer__barangay__barangay_name"),
        ).values("barangay_id", "barangay", "production_type", "unit")
        .annotate(quantity=Sum("output_quantity"))
        .order_by("barangay", "production_type", "unit")
    ]
    production_trend = [
        {"month": row["month"].isoformat(), "type": row["production_type"],
         "unit": row["unit"], "quantity": float(row["quantity"] or 0)}
        for row in production_monthly
    ]
    milk_rows = [row for row in production_monthly if row["production_type"] == ProductionRecord.ProductionType.MILK and row["unit"] == ProductionRecord.UnitType.LITERS]
    milk_monthly = _series([{"month": row["month"], "milk_l": row["quantity"]} for row in milk_rows], "milk_l", start)
    slaughter_monthly = list(
        scope_reviewer_queryset(SlaughterRecord.objects.all(), user).filter(status=SlaughterRecord.StatusType.APPROVED, record_date__range=(start, today), carcass_weight__isnull=False)
        .annotate(month=TruncMonth("record_date"))
        .values("month").annotate(meat_kg=Sum("carcass_weight"))
    )
    meat_monthly = _series(slaughter_monthly, "meat_kg", start)
    for milk_point, meat_point in zip(milk_monthly, meat_monthly):
        milk_point["meat_kg"] = meat_point["meat_kg"]
    current_month = date(today.year, today.month, 1)
    milk_this_month = next((row for row in milk_monthly if row["month"] == current_month.isoformat()), None)
    milk_ytd = sum(float(row["quantity"] or 0) for row in milk_rows if row["month"].year == today.year)
    milk_records_this_month = sum(row["records"] for row in milk_rows if row["month"] == current_month)

    # Sum saved valuations in SQL; missing references are excluded, not treated as zero value.
    valued = production.filter(valuation_snapshot__isnull=False).annotate(
        psa_value=Cast(KeyTextTransform("estimated_value", "valuation_snapshot"), DecimalField(max_digits=24, decimal_places=2)))
    valuation_totals = valued.aggregate(value=Sum("psa_value"), valued_records=Count("id"))
    def value_rows(queryset, fields):
        return [dict(row, value=float(row["value"])) for row in queryset.values(*fields)
                .annotate(value=Sum("psa_value"), records=Count("id")).order_by(*fields)]
    estimated_values = {
        "estimated_value": float(valuation_totals["value"]) if valuation_totals["value"] is not None else None,
        "valued_records": valuation_totals["valued_records"],
        "unvalued_records": sum(row["records"] for row in production_by_type) - valuation_totals["valued_records"],
        "by_month": value_rows(valued.annotate(month=TruncMonth("record_date")), ["month"]),
        "by_type": value_rows(valued, ["production_type"]),
        "by_species": value_rows(valued.annotate(species=Coalesce("livestock__livestock_type__name", "batch__livestock_type__name")), ["species"]),
        "by_barangay": value_rows(valued.annotate(barangay_id=Coalesce("livestock__farmer__barangay_id", "batch__farmer__barangay_id"),
                                                    barangay=Coalesce("livestock__farmer__barangay__barangay_name", "batch__farmer__barangay__barangay_name")), ["barangay_id", "barangay"]),
        "by_commodity": value_rows(valued, ["valuation_snapshot__commodity_id", "valuation_snapshot__commodity"]),
    }
    for row in estimated_values["by_month"]:
        row["month"] = row["month"].isoformat()

    # A date range excludes undated legacy events rather than inventing dates.
    disease = scope_reviewer_queryset(DiseaseCase.objects.all(), user).filter(status=DiseaseCase.DiseaseStatus.APPROVED, record_date__range=(start, today))
    disease_totals = disease.aggregate(cases=Count("id"), affected_heads=Sum("affected_count"))
    disease_monthly = list(
        disease.annotate(month=TruncMonth("record_date"))
        .values("month").annotate(cases=Count("id"), affected_heads=Sum("affected_count"))
        .order_by("month")
    )
    disease_by_type = list(
        disease.values("name").annotate(cases=Count("id"), affected_heads=Sum("affected_count"))
        .order_by("-affected_heads", "name")
    )
    disease_by_barangay = list(
        disease.annotate(
            barangay_id=Coalesce("livestock__farmer__barangay_id", "batch__farmer__barangay_id"),
            barangay=Coalesce("livestock__farmer__barangay__barangay_name", "batch__farmer__barangay__barangay_name"),
        ).values("barangay_id", "barangay").annotate(cases=Count("id"), affected_heads=Sum("affected_count"))
        .order_by("-affected_heads", "barangay")
    )

    mortality = scope_reviewer_queryset(MortalityRecord.objects.all(), user).filter(status=MortalityRecord.MortalityRecordStatus.APPROVED, record_date__range=(start, today))
    mortality_totals = mortality.aggregate(records=Count("id"), deaths=Sum("death_count"))
    mortality_monthly = list(
        mortality.annotate(month=TruncMonth("record_date"))
        .values("month").annotate(deaths=Sum("death_count"))
        .order_by("month")
    )
    mortality_by_cause = list(
        mortality.values("cause").annotate(deaths=Sum("death_count"))
        .order_by("-deaths", "cause")
    )

    sales = scope_reviewer_queryset(LiveAnimalSale.objects.all(), user).filter(status=LiveAnimalSale.StatusType.APPROVED, sale_date__range=(start, today))
    sale_totals = sales.aggregate(
        sales=Count("id"), animals=Sum("quantity"),
        recorded_value=Sum("total_price"), priced_sales=Count("id", filter=Q(total_price__isnull=False)),
    )

    surveillance = _series(disease_monthly, "affected_heads", start)
    death_series = _series(mortality_monthly, "deaths", start)
    for case_point, death_point in zip(surveillance, death_series):
        case_point["deaths"] = death_point["deaths"]
        case_point["reported_heads"] = case_point.get("affected_heads", 0)

    # -------------------------------------------------------------------------
    # LIVESTOCK INSPECTION & CLEARANCE ANALYTICS
    # -------------------------------------------------------------------------
    # EDUCATIONAL NOTE ON PREVENTING CROSS-JOIN DOUBLE COUNTING:
    # A single LivestockInspection event can contain multiple LivestockInspectionItem
    # rows (e.g. 2 bulls, 5 fattening steers).
    # If we joined inspections directly to items in a single query with COUNT(inspection),
    # an inspection with 3 items would be falsely counted 3 times!
    # Therefore, we count distinct inspections from LivestockInspection, and calculate
    # aggregate head counts from LivestockInspectionItem separately.
    # -------------------------------------------------------------------------
    inspections_base = scope_reviewer_queryset(LivestockInspection.objects.all(), user).filter(
        inspection_date__range=(start, today)
    )
    total_inspections = inspections_base.count()

    inspection_items_base = LivestockInspectionItem.objects.filter(
        inspection__in=inspections_base
    )
    inspected_heads = inspection_items_base.aggregate(total=Sum("quantity"))["total"] or 0

    # Group by inspection purpose
    insp_by_purpose = {
        row["purpose"]: row["count"]
        for row in inspections_base.values("purpose").annotate(count=Count("id"))
    }
    heads_by_purpose = {
        row["inspection__purpose"]: row["heads"]
        for row in inspection_items_base.values("inspection__purpose").annotate(heads=Sum("quantity"))
    }
    by_purpose = [
        {
            "purpose": code,
            "label": label,
            "inspections": insp_by_purpose.get(code, 0),
            "inspected_heads": heads_by_purpose.get(code, 0),
        }
        for code, label in LivestockInspection.PurposeType.choices
    ]

    # Group by destination
    insp_by_dest = {
        row["destination"]: row["count"]
        for row in inspections_base.values("destination").annotate(count=Count("id"))
    }
    heads_by_dest = {
        row["inspection__destination"]: row["heads"]
        for row in inspection_items_base.values("inspection__destination").annotate(heads=Sum("quantity"))
    }
    destinations = sorted(
        insp_by_dest.keys(),
        key=lambda d: (-heads_by_dest.get(d, 0), -insp_by_dest.get(d, 0)),
    )
    by_destination = [
        {
            "destination": dest,
            "inspections": insp_by_dest.get(dest, 0),
            "inspected_heads": heads_by_dest.get(dest, 0),
        }
        for dest in destinations
    ]

    # Monthly inspection trend (12-month window matching descriptive period)
    monthly_insp_counts = {
        row["month"]: row["count"]
        for row in inspections_base.annotate(month=TruncMonth("inspection_date"))
        .values("month")
        .annotate(count=Count("id"))
    }
    monthly_head_counts = {
        row["month"]: row["heads"]
        for row in inspection_items_base.annotate(month=TruncMonth("inspection__inspection_date"))
        .values("month")
        .annotate(heads=Sum("quantity"))
    }
    inspection_monthly_trend = [
        {
            "month": m.isoformat(),
            "label": f"{calendar.month_abbr[m.month]} {m.year}",
            "inspections": monthly_insp_counts.get(m, 0),
            "inspected_heads": monthly_head_counts.get(m, 0),
        }
        for m in _months(start)
    ]

    # Clearance issuance status breakdown
    clearances_qs = LivestockInspectionClearance.objects.filter(inspection__in=inspections_base)
    clearance_status_counts = {
        row["status"]: row["count"]
        for row in clearances_qs.values("status").annotate(count=Count("id"))
    }
    clearance_status_breakdown = [
        {
            "status": code,
            "label": label,
            "count": clearance_status_counts.get(code, 0),
        }
        for code, label in LivestockInspectionClearance.StatusType.choices
    ]

    approved_clearances = clearance_status_counts.get(
        LivestockInspectionClearance.StatusType.APPROVED, 0
    )
    approved_clearance_rate = (
        round((approved_clearances / total_inspections) * 100, 1)
        if total_inspections > 0
        else 0.0
    )

    inspection_analytics = {
        "total_inspections": total_inspections,
        "inspected_heads": inspected_heads,
        "by_purpose": by_purpose,
        "by_destination": by_destination,
        "monthly_trend": inspection_monthly_trend,
        "clearance_status": clearance_status_breakdown,
        "approved_clearances": approved_clearances,
        "approved_clearance_rate_pct": approved_clearance_rate,
        "rate_denominator_description": "Approved clearances divided by total inspections in the reporting period.",
    }

    descriptive = {
        "period": {"start": start.isoformat(), "end": today.isoformat()},
        "population": population,
        "production": {"records": sum(row["records"] for row in production_by_type),
                       "by_type": production_by_type, "trend": production_trend, "by_barangay": production_by_barangay, "valuation": estimated_values},
        "disease": {"cases": disease_totals["cases"], "affected_heads": disease_totals["affected_heads"] or 0,
                    "trend": [{"month": row["month"].isoformat(), "cases": row["cases"], "affected_heads": row["affected_heads"] or 0} for row in disease_monthly],
                    "by_type": disease_by_type, "by_barangay": disease_by_barangay},
        "mortality": {"records": mortality_totals["records"], "deaths": mortality_totals["deaths"] or 0,
                      "trend": [{"month": row["month"].isoformat(), "deaths": row["deaths"] or 0} for row in mortality_monthly],
                      "by_cause": mortality_by_cause},
        "vaccination": {"vaccinated": vaccinated_heads, "total": total_heads,
                        "coverage_pct": round(vaccinated_heads / total_heads * 100, 1) if total_heads else 0,
                        "by_barangay": coverage},
        "sales": {"sales": sale_totals["sales"], "animals": sale_totals["animals"] or 0,
                  "recorded_value": float(sale_totals["recorded_value"]) if sale_totals["recorded_value"] is not None else None,
                  "priced_sales": sale_totals["priced_sales"]},
        "inspection": inspection_analytics,
    }
    return {
        "monthly_dairy_yield_l": milk_this_month["milk_l"] if milk_this_month else 0,
        "year_to_date_l": milk_ytd,
        "records_this_month": milk_records_this_month,
        "period": f"{today.year}-{today.month:02d}",
        "production_series": milk_monthly,
        "surveillance_series": surveillance,
        "vaccination_coverage": coverage,
        "vaccination_totals": {"vaccinated": vaccinated_heads, "total": total_heads},
        "descriptive": descriptive,
    }

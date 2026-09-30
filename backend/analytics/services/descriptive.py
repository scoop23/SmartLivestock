"""Approved municipal records aggregated for descriptive dashboards."""

import calendar
from datetime import date

from django.db.models import Case, Count, F, IntegerField, Q, Sum, Value, When
from django.db.models.functions import Coalesce, TruncMonth
from django.utils import timezone

from diseases.models import DiseaseCase, MortalityRecord
from livestock.models import LivestockInventory
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


def descriptive_summary(today=None):
    today = today or timezone.localdate()
    start = _window_start(today)

    # A herd is a grouping of inventory rows, not another animal count. Sum the
    # row quantity so legacy multi-head entries do not silently count as one.
    inventory = LivestockInventory.objects.filter(
        status=LivestockInventory.StatusType.APPROVED,
        operational_status=LivestockInventory.OperationalStatus.ACTIVE,
        quantity__gt=0,
    )
    barangay_rows = list(
        inventory.values("farmer__barangay_id", "farmer__barangay__barangay_name")
        .annotate(
            heads=Sum("quantity"),
            vaccinated=Sum(
                Case(
                    When(last_vaccination_date__lte=today, then=F("quantity")),
                    default=Value(0),
                    output_field=IntegerField(),
                )
            ),
        )
        .order_by("farmer__barangay__barangay_name")
    )
    population_by_barangay = [
        {"barangay_id": row["farmer__barangay_id"],
         "barangay": row["farmer__barangay__barangay_name"],
         "heads": row["heads"] or 0}
        for row in barangay_rows
    ]
    total_heads = sum(row["heads"] for row in population_by_barangay)
    vaccinated_heads = sum(row["vaccinated"] or 0 for row in barangay_rows)
    coverage = [
        {"barangay": row["farmer__barangay__barangay_name"],
         "total": row["heads"] or 0,
         "vaccinated": row["vaccinated"] or 0,
         "coverage_pct": round((row["vaccinated"] or 0) / row["heads"] * 100, 1) if row["heads"] else 0}
        for row in barangay_rows
    ]
    species = list(
        inventory.values("livestock_type_id", "livestock_type__name")
        .annotate(heads=Sum("quantity"))
        .order_by("livestock_type__name")
    )
    population_by_species = [
        {"species_id": row["livestock_type_id"], "species": row["livestock_type__name"], "heads": row["heads"] or 0}
        for row in species
    ]

    # VERIFIED means SIBAT checked the submission; APPROVED is MAO's final
    # decision. All dated event totals use the event date, never created_at.
    production = ProductionRecord.objects.filter(
        status=ProductionRecord.ProductionStatus.APPROVED,
        record_date__range=(start, today),
    )
    production_by_type = [
        {"type": row["production_type"], "unit": row["unit"],
         "quantity": float(row["quantity"] or 0), "records": row["records"]}
        for row in production.values("production_type", "unit")
        .annotate(quantity=Sum("quantity"), records=Count("id"))
        .order_by("production_type", "unit")
    ]
    production_monthly = list(
        production.annotate(month=TruncMonth("record_date"))
        .values("month", "production_type", "unit")
        .annotate(quantity=Sum("quantity"), records=Count("id"))
        .order_by("month", "production_type", "unit")
    )
    production_by_barangay = [
        {"barangay_id": row["barangay_id"], "barangay": row["barangay"], "type": row["production_type"],
         "unit": row["unit"], "quantity": float(row["quantity"] or 0)}
        for row in production.annotate(
            barangay_id=Coalesce("livestock__farmer__barangay_id", "batch__farmer__barangay_id"),
            barangay=Coalesce("livestock__farmer__barangay__barangay_name", "batch__farmer__barangay__barangay_name"),
        ).values("barangay_id", "barangay", "production_type", "unit")
        .annotate(quantity=Sum("quantity"))
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
        SlaughterRecord.objects.filter(status=SlaughterRecord.StatusType.APPROVED, record_date__range=(start, today), carcass_weight__isnull=False)
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

    disease = DiseaseCase.objects.filter(status=DiseaseCase.DiseaseStatus.APPROVED, record_date__range=(start, today))
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

    mortality = MortalityRecord.objects.filter(status=MortalityRecord.MortalityRecordStatus.APPROVED, record_date__range=(start, today))
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

    sales = LiveAnimalSale.objects.filter(status=LiveAnimalSale.StatusType.APPROVED, sale_date__range=(start, today))
    sale_totals = sales.aggregate(
        sales=Count("id"), animals=Sum("quantity"),
        recorded_value=Sum("total_price"), priced_sales=Count("id", filter=Q(total_price__isnull=False)),
    )

    surveillance = _series(disease_monthly, "affected_heads", start)
    death_series = _series(mortality_monthly, "deaths", start)
    for case_point, death_point in zip(surveillance, death_series):
        case_point["deaths"] = death_point["deaths"]

    descriptive = {
        "period": {"start": start.isoformat(), "end": today.isoformat()},
        "population": {"total_heads": total_heads, "by_barangay": population_by_barangay, "by_species": population_by_species},
        "production": {"records": sum(row["records"] for row in production_by_type),
                       "by_type": production_by_type, "trend": production_trend, "by_barangay": production_by_barangay},
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

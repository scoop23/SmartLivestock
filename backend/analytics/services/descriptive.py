"""Approved municipal records aggregated for descriptive dashboards."""

import calendar
from datetime import date

from django.db.models import Case, CharField, Count, DecimalField, F, Q, Sum, Value, When
from django.db.models.fields.json import KeyTextTransform
from django.db.models.functions import Cast, Coalesce, TruncMonth
from django.utils import timezone

from diseases.models import DiseaseCase, MortalityRecord
from livestock.models import LivestockOwnershipTransfer
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
    # Farmer-reported meat is separate from slaughter output. Slaughter-linked
    # ProductionRecords are projections of SlaughterRecord and must not be added twice.
    farmer_meat_qs = scope_reviewer_queryset(ProductionRecord.objects.all(), user).filter(
        status=ProductionRecord.ProductionStatus.APPROVED,
        production_type=ProductionRecord.ProductionType.MEAT,
        unit=ProductionRecord.UnitType.KILOGRAMS,
        slaughter__isnull=True,
        record_date__range=(start, today),
    )
    farmer_meat_rows = list(
        farmer_meat_qs.annotate(month=TruncMonth("record_date"))
        .values("month")
        .annotate(quantity=Sum("quantity"))
        .order_by("month")
    )
    farmer_meat_by_species = [
        {
            "species": row["species"],
            "quantity_kg": float(row["quantity_kg"] or 0),
            "records": row["records"],
        }
        for row in farmer_meat_qs.annotate(species=Coalesce(
            "livestock__livestock_type__name",
            "batch__livestock_type__name",
            Value("Unspecified"),
            output_field=CharField(),
        ))
        .values("species")
        .annotate(quantity_kg=Sum("quantity"), records=Count("id"))
        .order_by("-quantity_kg", "species")
    ]
    farmer_meat_by_barangay = list(
        farmer_meat_qs.annotate(
            barangay_id=F("farmer_at_record__barangay_id"),
            barangay=F("farmer_at_record__barangay__barangay_name"),
        )
        .values("barangay_id", "barangay")
        .annotate(quantity_kg=Sum("quantity"), records=Count("id"))
        .order_by("barangay", "barangay_id")
    )
    farmer_meat_by_month = {row["month"]: row["quantity"] for row in farmer_meat_rows}
    farmer_meat_trend = [
        {
            "month": month.isoformat(),
            "label": f"{calendar.month_abbr[month.month]} {month.year}",
            "quantity_kg": float(farmer_meat_by_month.get(month, 0) or 0),
        }
        for month in _months(start)
    ]
    # Keep commodity output grouped by livestock type so the dashboard can switch
    # between milk, wool, eggs, and meat without mixing incompatible units.
    production_by_species_monthly = list(
        production.filter(slaughter__isnull=True).annotate(
            month=TruncMonth("record_date"),
            species=Coalesce(
                "livestock__livestock_type__name",
                "batch__livestock_type__name",
                Value("Unspecified"),
                output_field=CharField(),
            ),
        )
        .values("month", "species", "production_type", "unit")
        .annotate(quantity=Sum("quantity"))
        .order_by("month", "species", "production_type", "unit")
    )
    production_species_trend = [
        {
            "month": row["month"].isoformat(),
            "label": f"{calendar.month_abbr[row['month'].month]} {row['month'].year}",
            "species": row["species"],
            "production_type": row["production_type"],
            "unit": row["unit"],
            "quantity": float(row["quantity"] or 0),
        }
        for row in production_by_species_monthly
    ]
    # Batch-only events get their location through the batch farmer FK.
    production_by_barangay = [
        {"barangay_id": row["barangay_id"], "barangay": row["barangay"], "type": row["production_type"],
         "unit": row["unit"], "quantity": float(row["quantity"] or 0)}
        for row in production.annotate(
            barangay_id=F("farmer_at_record__barangay_id"),
            barangay=F("farmer_at_record__barangay__barangay_name"),
        ).values("barangay_id", "barangay", "production_type", "unit")
        .annotate(quantity=Sum("output_quantity"))
        .order_by("barangay", "production_type", "unit")
    ]
    # The consolidated report displays farmer meat and slaughter yield in their
    # own columns, so keep both out of this commodity-output list to avoid doubles.
    report_production_by_barangay = [
        {"barangay_id": row["barangay_id"], "barangay": row["barangay"], "type": row["production_type"],
         "unit": row["unit"], "quantity": float(row["quantity"] or 0)}
        for row in production.filter(
            slaughter__isnull=True,
        ).exclude(production_type=ProductionRecord.ProductionType.MEAT)
        .annotate(
            barangay_id=F("farmer_at_record__barangay_id"),
            barangay=F("farmer_at_record__barangay__barangay_name"),
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
        "by_barangay": value_rows(valued.annotate(barangay_id=F("farmer_at_record__barangay_id"),
                                                    barangay=F("farmer_at_record__barangay__barangay_name")), ["barangay_id", "barangay"]),
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
    mortality_by_barangay = list(
        mortality.annotate(
            barangay_id=Coalesce("livestock__farmer__barangay_id", "batch__farmer__barangay_id"),
            barangay=Coalesce("livestock__farmer__barangay__barangay_name", "batch__farmer__barangay__barangay_name"),
        ).values("barangay_id", "barangay").annotate(records=Count("id"), deaths=Sum("death_count"))
        .order_by("-deaths", "barangay")
    )

    # Empirical mortality risk indicator (comparing recent 3 months against 12-month baseline)
    # Educational note: This is an empirical surveillance indicator to detect statistical anomalies,
    # NOT a biological or epidemiological probability.
    recent_3m_cutoff = today.replace(day=1)
    # 3 months prior to today
    r_month = today.year * 12 + today.month - 3
    r_year, r_m = divmod(r_month, 12)
    recent_3m_start = date(r_year, r_m + 1, 1)

    recent_deaths = sum(
        row["deaths"] or 0
        for row in mortality_monthly
        if row["month"] >= recent_3m_start
    )
    all_deaths = mortality_totals["deaths"] or 0
    # Expected deaths in 3 months based on 12-month average: (all_deaths / 12) * 3
    expected_3m_deaths = (all_deaths / 12.0) * 3.0 if all_deaths > 0 else 0.0

    if expected_3m_deaths > 0:
        death_ratio = recent_deaths / expected_3m_deaths
        if death_ratio >= 1.25:
            risk_level = "ELEVATED"
            risk_trend = "INCREASING"
        elif death_ratio <= 0.80:
            risk_level = "LOW"
            risk_trend = "DECREASING"
        else:
            risk_level = "MODERATE"
            risk_trend = "STABLE"
    else:
        death_ratio = 1.0
        risk_level = "LOW"
        risk_trend = "STABLE"

    mortality_risk_indicator = {
        "level": risk_level,
        "trend": risk_trend,
        "recent_3m_deaths": recent_deaths,
        "baseline_3m_expected": round(expected_3m_deaths, 1),
        "ratio_vs_baseline": round(death_ratio, 2),
        "methodology_note": (
            "Empirical surveillance indicator comparing recent 3-month mortality against "
            "the 12-month baseline rate. This reflects historical reporting velocity and is "
            "NOT a biological or epidemiological probability."
        ),
    }

    # -------------------------------------------------------------------------
    # SLAUGHTERHOUSE ANALYTICS
    # -------------------------------------------------------------------------
    # Head counts (throughput) and carcass weight (meat biomass) are kept strictly separate.
    slaughter_qs = scope_reviewer_queryset(SlaughterRecord.objects.all(), user).filter(
        status=SlaughterRecord.StatusType.APPROVED,
        record_date__range=(start, today),
    )
    slaughter_totals = slaughter_qs.aggregate(
        records=Count("id"),
        total_heads=Sum("quantity"),
        total_carcass_weight=Sum("carcass_weight"),
    )
    slaughter_by_species = list(
        slaughter_qs.values("livestock_type__name")
        .annotate(
            records=Count("id"),
            heads=Sum("quantity"),
            carcass_weight=Sum("carcass_weight"),
        )
        .order_by("-heads")
    )
    slaughter_yield_by_species = [
        {
            "species": row["livestock_type__name"] or "Unspecified",
            "carcass_weight_kg": float(row["carcass_weight_kg"] or 0),
            "heads": row["heads"] or 0,
            "avg_carcass_weight_kg_per_head": (
                round(float(row["carcass_weight_kg"]) / row["heads"], 2)
                if row["heads"] else None
            ),
            "records": row["records"],
        }
        for row in slaughter_qs.filter(carcass_weight__isnull=False)
        .values("livestock_type__name")
        .annotate(
            carcass_weight_kg=Sum("carcass_weight"),
            heads=Sum("quantity"),
            records=Count("id"),
        )
        .order_by("-carcass_weight_kg", "livestock_type__name")
    ]
    sl_heads_map = {
        row["month"]: row["heads"]
        for row in slaughter_qs.annotate(month=TruncMonth("record_date"))
        .values("month")
        .annotate(heads=Sum("quantity"))
    }
    sl_weights_map = {
        row["month"]: row["weight"]
        for row in slaughter_qs.annotate(month=TruncMonth("record_date"))
        .values("month")
        .annotate(weight=Sum("carcass_weight"))
    }
    slaughter_trend = [
        {
            "month": m.isoformat(),
            "label": f"{calendar.month_abbr[m.month]} {m.year}",
            "heads": sl_heads_map.get(m, 0),
            "carcass_weight_kg": float(sl_weights_map.get(m, 0.0) or 0.0),
        }
        for m in _months(start)
    ]
    slaughter_by_species_monthly = list(
        slaughter_qs.annotate(month=TruncMonth("record_date"))
        .values("month", "livestock_type__name")
        .annotate(heads=Sum("quantity"), carcass_weight_kg=Sum("carcass_weight"))
        .order_by("month", "livestock_type__name")
    )
    slaughter_species_trend = [
        {
            "month": row["month"].isoformat(),
            "label": f"{calendar.month_abbr[row['month'].month]} {row['month'].year}",
            "species": row["livestock_type__name"] or "Unknown",
            "heads": row["heads"] or 0,
            "carcass_weight_kg": float(row["carcass_weight_kg"] or 0),
        }
        for row in slaughter_by_species_monthly
    ]
    slaughter_by_barangay = list(
        slaughter_qs.annotate(
            report_barangay_id=Coalesce(
                "livestock__farmer__barangay_id",
                "batch__farmer__barangay_id",
                "barangay_id",
            ),
            report_barangay=Coalesce(
                "livestock__farmer__barangay__barangay_name",
                "batch__farmer__barangay__barangay_name",
                "barangay__barangay_name",
                Value("Unmapped"),
                output_field=CharField(),
            ),
        )
        .values("report_barangay_id", "report_barangay")
        .annotate(
            heads=Sum("quantity"),
            carcass_weight_kg=Sum("carcass_weight"),
            records=Count("id"),
            yield_records=Count("id", filter=Q(carcass_weight__isnull=False)),
        )
        .order_by("report_barangay", "report_barangay_id")
    )
    total_heads_slaughtered = slaughter_totals["total_heads"] or 0
    total_carcass_kg = float(slaughter_totals["total_carcass_weight"] or 0.0)
    avg_carcass_per_head = (
        round(total_carcass_kg / total_heads_slaughtered, 2)
        if total_heads_slaughtered > 0
        else 0.0
    )

    slaughter_analytics = {
        "records": slaughter_totals["records"],
        "total_heads": total_heads_slaughtered,
        "total_carcass_weight_kg": total_carcass_kg,
        "avg_carcass_weight_kg_per_head": avg_carcass_per_head,
        "by_species": [
            {
                "species": row["livestock_type__name"] or "Unknown",
                "records": row["records"],
                "heads": row["heads"] or 0,
                "carcass_weight_kg": float(row["carcass_weight"] or 0.0),
            }
            for row in slaughter_by_species
        ],
        "yield_by_species": slaughter_yield_by_species,
        "monthly_trend": slaughter_trend,
        "monthly_trend_by_species": slaughter_species_trend,
    }

    # -------------------------------------------------------------------------
    # AUCTION / LIVE ANIMAL SALES ANALYTICS
    # -------------------------------------------------------------------------
    sales = scope_reviewer_queryset(LiveAnimalSale.objects.all(), user).filter(status=LiveAnimalSale.StatusType.APPROVED, sale_date__range=(start, today))
    sale_totals = sales.aggregate(
        sales=Count("id"), animals=Sum("quantity"),
        recorded_value=Sum("total_price"), priced_sales=Count("id", filter=Q(total_price__isnull=False)),
    )
    sales_by_method = list(
        sales.values("sale_method").annotate(count=Count("id"), animals=Sum("quantity"), total_value=Sum("total_price"))
        .order_by("-animals")
    )
    sales_by_purpose = list(
        sales.values("purpose").annotate(count=Count("id"), animals=Sum("quantity"))
        .order_by("-animals")
    )
    sales_by_species = [
        {
            "species": row["species"],
            "animals": row["animals"] or 0,
            "transactions": row["transactions"],
            "recorded_value_php": (
                float(row["recorded_value_php"])
                if row["recorded_value_php"] is not None else None
            ),
            "priced_transactions": row["priced_transactions"],
        }
        for row in sales.annotate(species=Coalesce(
            "livestock__livestock_type__name",
            "batch__livestock_type__name",
            Value("Unspecified"),
            output_field=CharField(),
        ))
        .values("species")
        .annotate(
            animals=Sum("quantity"),
            transactions=Count("id"),
            recorded_value_php=Sum("total_price"),
            priced_transactions=Count("id", filter=Q(total_price__isnull=False)),
        )
        .order_by("-animals", "species")
    ]
    sales_monthly = list(
        sales.annotate(month=TruncMonth("sale_date"))
        .values("month").annotate(count=Count("id"), animals=Sum("quantity"), total_value=Sum("total_price"))
        .order_by("month")
    )
    sales_trend_map = {row["month"]: row for row in sales_monthly}
    sales_trend = [
        {
            "month": m.isoformat(),
            "label": f"{calendar.month_abbr[m.month]} {m.year}",
            "transactions": sales_trend_map.get(m, {}).get("count", 0),
            "animals": sales_trend_map.get(m, {}).get("animals", 0),
            "total_value_php": float(sales_trend_map.get(m, {}).get("total_value", 0.0) or 0.0),
        }
        for m in _months(start)
    ]
    sales_by_species_monthly = list(
        sales.annotate(
            month=TruncMonth("sale_date"),
            species=Coalesce(
                "livestock__livestock_type__name",
                "batch__livestock_type__name",
                Value("Unspecified"),
                output_field=CharField(),
            ),
        )
        .values("month", "species")
        .annotate(
            animals=Sum("quantity"),
            transactions=Count("id"),
            recorded_value_php=Sum("total_price"),
        )
        .order_by("month", "species")
    )
    sales_species_trend = [
        {
            "month": row["month"].isoformat(),
            "label": f"{calendar.month_abbr[row['month'].month]} {row['month'].year}",
            "species": row["species"],
            "animals": row["animals"] or 0,
            "transactions": row["transactions"],
            "recorded_value_php": (
                float(row["recorded_value_php"])
                if row["recorded_value_php"] is not None else None
            ),
        }
        for row in sales_by_species_monthly
    ]
    sales_by_barangay = list(
        sales.annotate(
            report_barangay_id=Coalesce(
                "livestock__farmer__barangay_id",
                "batch__farmer__barangay_id",
            ),
            report_barangay=Coalesce(
                "livestock__farmer__barangay__barangay_name",
                "batch__farmer__barangay__barangay_name",
                Value("Unmapped"),
                output_field=CharField(),
            ),
        )
        .values("report_barangay_id", "report_barangay")
        .annotate(
            animals=Sum("quantity"),
            transactions=Count("id"),
            recorded_value_php=Sum("total_price"),
            priced_transactions=Count("id", filter=Q(total_price__isnull=False)),
        )
        .order_by("report_barangay", "report_barangay_id")
    )

    # Start with every in-scope barangay, then merge approved event totals into it.
    # Current heads are a snapshot; the other fields cover the selected 12-month period.
    report_by_barangay = {}

    def ensure_barangay_report_row(barangay_id, barangay_name):
        if barangay_id not in report_by_barangay:
            report_by_barangay[barangay_id] = {
                "barangay_id": barangay_id,
                "barangay": barangay_name or "Unmapped",
                "registered_farmers": 0,
                "current_heads": 0,
                "production_outputs": [],
                "farmer_meat_kg": 0.0,
                "farmer_meat_records": 0,
                "slaughter_heads": 0,
                "slaughter_yield_kg": None,
                "slaughter_records": 0,
                "slaughter_yield_records": 0,
                "animals_sold": 0,
                "sale_transactions": 0,
                "recorded_sale_value_php": None,
                "priced_transactions": 0,
                "disease_cases": 0,
                "affected_heads": 0,
                "mortality_records": 0,
                "deaths": 0,
                "vaccinated_heads": 0,
                "vaccination_coverage_pct": 0.0,
            }
        return report_by_barangay[barangay_id]

    for row in population["by_barangay"]:
        report_row = ensure_barangay_report_row(row["barangay_id"], row["barangay"])
        report_row["registered_farmers"] = row["registered_farmers"]
        report_row["current_heads"] = row["heads"]
    for row in farmer_meat_by_barangay:
        report_row = ensure_barangay_report_row(row["barangay_id"], row["barangay"])
        report_row["farmer_meat_kg"] = float(row["quantity_kg"] or 0)
        report_row["farmer_meat_records"] = row["records"]
    for row in report_production_by_barangay:
        report_row = ensure_barangay_report_row(row["barangay_id"], row["barangay"])
        report_row["production_outputs"].append({
            "type": row["type"],
            "unit": row["unit"],
            "quantity": row["quantity"],
        })
    for row in slaughter_by_barangay:
        report_row = ensure_barangay_report_row(row["report_barangay_id"], row["report_barangay"])
        report_row["slaughter_heads"] = row["heads"] or 0
        report_row["slaughter_yield_kg"] = (
            float(row["carcass_weight_kg"])
            if row["carcass_weight_kg"] is not None else None
        )
        report_row["slaughter_records"] = row["records"]
        report_row["slaughter_yield_records"] = row["yield_records"]
    for row in sales_by_barangay:
        report_row = ensure_barangay_report_row(row["report_barangay_id"], row["report_barangay"])
        report_row["animals_sold"] = row["animals"] or 0
        report_row["sale_transactions"] = row["transactions"]
        report_row["recorded_sale_value_php"] = (
            float(row["recorded_value_php"])
            if row["recorded_value_php"] is not None else None
        )
        report_row["priced_transactions"] = row["priced_transactions"]
    for row in disease_by_barangay:
        report_row = ensure_barangay_report_row(row["barangay_id"], row["barangay"])
        report_row["disease_cases"] = row["cases"]
        report_row["affected_heads"] = row["affected_heads"] or 0
    for row in mortality_by_barangay:
        report_row = ensure_barangay_report_row(row["barangay_id"], row["barangay"])
        report_row["mortality_records"] = row["records"]
        report_row["deaths"] = row["deaths"] or 0
    for row in coverage:
        report_row = ensure_barangay_report_row(row["barangay_id"], row["barangay"])
        report_row["vaccinated_heads"] = row["vaccinated"]
        report_row["vaccination_coverage_pct"] = row["coverage_pct"]
    per_barangay_report = sorted(
        report_by_barangay.values(),
        key=lambda row: (row["barangay_id"] is None, row["barangay"].casefold()),
    )

    # The current ownership workflow marks the seller's animal SOLD only after
    # a transfer is approved. Count one transfer row per animal, while preserving
    # the certificate count for certificates that cover multiple animals.
    ownership_transfers = scope_reviewer_queryset(
        LivestockOwnershipTransfer.objects.all(), user
    ).filter(
        status=LivestockOwnershipTransfer.Status.APPROVED,
        transfer_date__range=(start, today),
    )
    transfer_monthly = list(
        ownership_transfers.annotate(month=TruncMonth("transfer_date"))
        .values("month")
        .annotate(animals=Count("id"), certificates=Count("transfer_certificate_number", distinct=True))
        .order_by("month")
    )
    transfer_by_species_monthly = list(
        ownership_transfers.annotate(month=TruncMonth("transfer_date"))
        .values("month", "livestock__livestock_type__name")
        .annotate(animals=Count("id"), certificates=Count("transfer_certificate_number", distinct=True))
        .order_by("month", "livestock__livestock_type__name")
    )
    transfer_monthly_by_month = {row["month"]: row for row in transfer_monthly}
    ownership_transfer_trend = [
        {
            "month": month.isoformat(),
            "label": f"{calendar.month_abbr[month.month]} {month.year}",
            "animals": transfer_monthly_by_month.get(month, {}).get("animals", 0),
            "certificates": transfer_monthly_by_month.get(month, {}).get("certificates", 0),
        }
        for month in _months(start)
    ]
    ownership_transfer_species_trend = [
        {
            "month": row["month"].isoformat(),
            "label": f"{calendar.month_abbr[row['month'].month]} {row['month'].year}",
            "species": row["livestock__livestock_type__name"] or "Unknown",
            "animals": row["animals"],
            "certificates": row["certificates"],
        }
        for row in transfer_by_species_monthly
    ]

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
                       "by_type": production_by_type, "trend": production_trend,
                       "farmer_meat_trend": farmer_meat_trend,
                       "farmer_meat_by_species": farmer_meat_by_species,
                       "farmer_meat_by_barangay": farmer_meat_by_barangay,
                       "monthly_trend_by_species": production_species_trend,
                       "by_barangay": production_by_barangay, "valuation": estimated_values},
        "disease": {"cases": disease_totals["cases"], "affected_heads": disease_totals["affected_heads"] or 0,
                    "trend": [{"month": row["month"].isoformat(), "cases": row["cases"], "affected_heads": row["affected_heads"] or 0} for row in disease_monthly],
                    "by_type": disease_by_type, "by_barangay": disease_by_barangay},
        "mortality": {
            "records": mortality_totals["records"],
            "deaths": mortality_totals["deaths"] or 0,
            "trend": [{"month": row["month"].isoformat(), "deaths": row["deaths"] or 0} for row in mortality_monthly],
            "by_cause": mortality_by_cause,
            "by_barangay": mortality_by_barangay,
            "risk_indicator": mortality_risk_indicator,
        },
        "slaughter": slaughter_analytics,
        "vaccination": {"vaccinated": vaccinated_heads, "total": total_heads,
                        "coverage_pct": round(vaccinated_heads / total_heads * 100, 1) if total_heads else 0,
                        "by_barangay": coverage},
        "sales": {
            "sales": sale_totals["sales"],
            "animals": sale_totals["animals"] or 0,
            "recorded_value": float(sale_totals["recorded_value"]) if sale_totals["recorded_value"] is not None else None,
            "priced_sales": sale_totals["priced_sales"],
            "by_method": sales_by_method,
            "by_purpose": sales_by_purpose,
            "by_species": sales_by_species,
            "monthly_trend_by_species": sales_species_trend,
            "trend": sales_trend,
        },
        "ownership_transfers": {
            "monthly_trend": ownership_transfer_trend,
            "monthly_trend_by_species": ownership_transfer_species_trend,
        },
        "inspection": inspection_analytics,
        "per_barangay_report": per_barangay_report,
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

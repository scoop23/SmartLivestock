import calendar
from datetime import date

from django.db.models import Count, F, Q, Sum
from django.db.models.functions import TruncMonth
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from diseases.models import DiseaseCase, MortalityRecord
from livestock.models import (
    Barangay,
    CensusSubmission,
    CensusSubmissionItem,
    LivestockInventory,
)
from livestock.permission import isMAO, isSibat
from production.models import ProductionRecord, SlaughterRecord

# Only records that have passed the verification workflow count as official
# municipal numbers, mirroring how release figures are reported.
RECOGNIZED_STATUSES = (
    ProductionRecord.ProductionStatus.APPROVED,
    ProductionRecord.ProductionStatus.VERIFIED,
)

SERIES_MONTHS = 12

# Census workflow states, in the order the municipal report cares about them.
CENSUS_STATUSES = (
    CensusSubmission.StatusType.PENDING,
    CensusSubmission.StatusType.VERIFIED,
    CensusSubmission.StatusType.APPROVED,
    CensusSubmission.StatusType.SUBJECT_TO_REVISION,
)


def _window_start(now, count):
    """First day of the month `count - 1` months before `now`."""
    total_months = now.year * 12 + (now.month - 1) - (count - 1)
    year, month_zero = divmod(total_months, 12)
    return date(year, month_zero + 1, 1)


def _month_keys(now, count):
    """Ordered list of (year, month) tuples for the last `count` months."""
    start = _window_start(now, count)
    keys = []
    year, month = start.year, start.month
    for _ in range(count):
        keys.append((year, month))
        month += 1
        if month == 13:
            month = 1
            year += 1
    return keys


def _assemble_series(field_name, keys, monthly_values):
    """Build an ordered {month, label, field} list, zero-filling empty months.

    `keys` is an ordered list of (year, month) tuples; `monthly_values` comes
    from a TruncMonth GROUP BY with an annotation named `field_name`.
    """
    by_month = {row["month"]: row[field_name] for row in monthly_values}
    series = []
    for year, month_idx in keys:
        key = date(year, month_idx, 1)
        series.append(
            {
                "month": key.strftime("%Y-%m-%d"),
                "label": calendar.month_abbr[month_idx],
                field_name: float(by_month.get(key, 0) or 0),
            }
        )
    return series


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def dashboard_summary(request):
    """Real executive-dashboard numbers, computed directly from the database.

    KPI + chart series: certified dairy yield, monthly milk/meat output,
    disease incidence vs mortality, and vaccination coverage per barangay.
    """
    now = timezone.localdate()
    window = _window_start(now, SERIES_MONTHS)

    # ── KPI: certified dairy yield (current month + year-to-date) ──
    milk_logs = ProductionRecord.objects.filter(
        production_type=ProductionRecord.ProductionType.MILK,
        unit=ProductionRecord.UnitType.LITERS,
        status__in=RECOGNIZED_STATUSES,
        record_date__year=now.year,
    )
    this_month = milk_logs.filter(record_date__month=now.month)
    month_total = this_month.aggregate(total=Sum("quantity"))["total"] or 0
    ytd_total = milk_logs.aggregate(total=Sum("quantity"))["total"] or 0

    # ── Chart series: monthly milk liters & meat kg ──
    milk_monthly = (
        ProductionRecord.objects.filter(
            production_type=ProductionRecord.ProductionType.MILK,
            unit=ProductionRecord.UnitType.LITERS,
            status__in=RECOGNIZED_STATUSES,
            record_date__gte=window,
        )
        .annotate(month=TruncMonth("record_date"))
        .values("month")
        .annotate(milk_l=Sum("quantity"))
    )
    meat_monthly = (
        SlaughterRecord.objects.filter(
            status__in=RECOGNIZED_STATUSES,
            record_date__gte=window,
            carcass_weight__isnull=False,
        )
        .annotate(month=TruncMonth("record_date"))
        .values("month")
        .annotate(meat_kg=Sum("carcass_weight"))
    )

    keys = _month_keys(now, SERIES_MONTHS)
    production_series = _assemble_series("milk_l", keys, milk_monthly)
    meat_series = _assemble_series("meat_kg", keys, meat_monthly)
    for point, meat_point in zip(production_series, meat_series):
        point["meat_kg"] = meat_point["meat_kg"]

    # ── Chart series: disease incidence vs mortality ──
    disease_monthly = (
        DiseaseCase.objects.filter(status__in=RECOGNIZED_STATUSES, record_date__gte=window)
        .annotate(month=TruncMonth("record_date"))
        .values("month")
        .annotate(reported_heads=Sum("affected_count"))
    )
    mortality_monthly = (
        MortalityRecord.objects.filter(status__in=RECOGNIZED_STATUSES, record_date__gte=window)
        .annotate(month=TruncMonth("record_date"))
        .values("month")
        .annotate(deaths=Sum("death_count"))
    )

    surveillance_series = _assemble_series("reported_heads", keys, disease_monthly)
    deaths_series = _assemble_series("deaths", keys, mortality_monthly)
    for point, death_point in zip(surveillance_series, deaths_series):
        point["deaths"] = death_point["deaths"]

    # ── Vaccination coverage per barangay (certified inventories) ──
    # Every barangay that has certified animals is returned — slicing by herd
    # size here would hide small sectors that actually recorded vaccinations.
    coverage_rows = (
        LivestockInventory.objects.filter(
            status__in=RECOGNIZED_STATUSES,
            farmer__barangay__isnull=False,
        )
        .values("farmer__barangay__barangay_name")
        .annotate(
            total=Count("id"),
            vaccinated=Count("id", filter=Q(last_vaccination_date__isnull=False)),
        )
    )
    vaccination_coverage = [
        {
            "barangay": row["farmer__barangay__barangay_name"],
            "total": row["total"],
            "vaccinated": row["vaccinated"],
            "coverage_pct": round(row["vaccinated"] / row["total"] * 100) if row["total"] else 0,
        }
        for row in coverage_rows
    ]
    # Highest coverage first so real vaccination work surfaces at the top.
    vaccination_coverage.sort(key=lambda r: (-r["coverage_pct"], -r["total"], r["barangay"]))

    vaccination_totals = {
        "vaccinated": sum(row["vaccinated"] for row in vaccination_coverage),
        "total": sum(row["total"] for row in vaccination_coverage),
    }

    return Response(
        {
            "monthly_dairy_yield_l": float(month_total),
            "year_to_date_l": float(ytd_total),
            "records_this_month": this_month.count(),
            "period": f"{now.year}-{now.month:02d}",
            "production_series": production_series,
            "surveillance_series": surveillance_series,
            "vaccination_coverage": vaccination_coverage,
            "vaccination_totals": vaccination_totals,
        }
    )


def _latest_census_period():
    """Most recent (year, quarter) that actually has a census submission."""
    latest = (
        CensusSubmission.objects.order_by("-report_year", "-report_quarter")
        .values("report_year", "report_quarter")
        .first()
    )
    if latest:
        return latest["report_year"], latest["report_quarter"]
    now = timezone.localdate()
    return now.year, ((now.month - 1) // 3) + 1


@api_view(["GET"])
@permission_classes([IsAuthenticated, isMAO | isSibat])
def census_summary(request):
    """Quarterly livestock-census coverage, computed from the census tables.

    Read-only municipal reporting for SIBAT/MAO. Defaults to the newest period
    that has submissions so the report never shows an empty future quarter.
    """
    latest_year, latest_quarter = _latest_census_period()

    raw_year = request.query_params.get("year")
    raw_quarter = request.query_params.get("quarter")
    try:
        year = int(raw_year) if raw_year not in (None, "") else latest_year
        quarter = int(raw_quarter) if raw_quarter not in (None, "") else latest_quarter
    except (TypeError, ValueError):
        raise ValidationError("year and quarter must be whole numbers.")
    if quarter not in (1, 2, 3, 4):
        raise ValidationError("quarter must be between 1 and 4.")

    available_periods = [
        {"year": row["report_year"], "quarter": row["report_quarter"]}
        for row in CensusSubmission.objects.values(
            "report_year", "report_quarter"
        )
        .distinct()
        .order_by("-report_year", "-report_quarter")
    ]

    period_items = CensusSubmissionItem.objects.filter(
        census_submission__report_year=year,
        census_submission__report_quarter=quarter,
    )
    heads_rows = list(
        period_items.values(name=F("census_submission__barangay__barangay_name"))
        .annotate(
            heads=Sum("number_of_heads"),
            farmers=Count("farmer", distinct=True),
            submissions=Count("census_submission", distinct=True),
        )
        .order_by("-heads", "name")
    )

    # A submission can legitimately carry no items, so status coverage is read
    # from the submissions themselves rather than from the item rows.
    # `status` is a real model field, so it is selected by name rather than aliased.
    status_breakdown = [
        {
            "barangay": row["barangay__barangay_name"],
            "status": row["status"],
            "submissions": row["submissions"],
            "heads": row["heads"] or 0,
            "farmers": row["farmers"],
        }
        for row in CensusSubmission.objects.filter(
            report_year=year, report_quarter=quarter
        )
        .values("barangay__barangay_name", "status")
        .annotate(
            submissions=Count("id", distinct=True),
            heads=Sum("items__number_of_heads"),
            farmers=Count("items__farmer", distinct=True),
        )
        .order_by("barangay__barangay_name", "status")
    ]

    all_barangays = list(
        Barangay.objects.order_by("barangay_name").values_list(
            "barangay_name", flat=True
        )
    )
    reported = {row["name"] for row in heads_rows} | {
        row["barangay"] for row in status_breakdown
    }
    missing_barangays = [name for name in all_barangays if name not in reported]

    by_status = {status: 0 for status in CENSUS_STATUSES}
    for row in status_breakdown:
        by_status[row["status"]] = by_status.get(row["status"], 0) + row["submissions"]

    return Response(
        {
            "period": {"year": year, "quarter": quarter, "label": f"Q{quarter} {year}"},
            "available_periods": available_periods,
            "heads_by_barangay": [
                {
                    "barangay": row["name"],
                    "heads": row["heads"] or 0,
                    "farmers": row["farmers"],
                    "submissions": row["submissions"],
                }
                for row in heads_rows
            ],
            "status_by_barangay": status_breakdown,
            "coverage": {
                "total_barangays": len(all_barangays),
                "submitted": len(reported),
                "missing": len(missing_barangays),
                "submission_pct": round(len(reported) / len(all_barangays) * 100)
                if all_barangays
                else 0,
                "by_status": by_status,
                "missing_barangays": missing_barangays,
            },
            "totals": {
                "heads": sum(row["heads"] or 0 for row in heads_rows),
                "submissions": sum(row["submissions"] for row in status_breakdown),
                "farmers": period_items.values("farmer_id").distinct().count(),
            },
        }
    )

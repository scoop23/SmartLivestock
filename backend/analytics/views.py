from django.db.models import Count, F, Sum
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from livestock.models import Barangay, CensusSubmission, CensusSubmissionItem
from livestock.permission import isMAO, isSibat
from .services.descriptive import descriptive_summary


CENSUS_STATUSES = (
    CensusSubmission.StatusType.PENDING,
    CensusSubmission.StatusType.VERIFIED,
    CensusSubmission.StatusType.APPROVED,
    CensusSubmission.StatusType.SUBJECT_TO_REVISION,
)


@api_view(["GET"])
@permission_classes([IsAuthenticated, isMAO | isSibat])
def dashboard_summary(request):
    # The service owns the DB -> ORM calculations. This view only publishes
    # approved municipal aggregates to authorized dashboard users.
    return Response(descriptive_summary())


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

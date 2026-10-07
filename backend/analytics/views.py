from django.db.models import Count, F, Sum
import logging
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import APIException, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.http import HttpResponse

from livestock.models import Barangay, CensusSubmission, CensusSubmissionItem
from livestock.permission import isMAO, isSibat
from .services.descriptive import descriptive_summary
from .services.overview import overview_summary
from smartlivestock.workflows import scope_reviewer_queryset
from .services.reports import build_report
from .services.report_exports import excel_report, pdf_report

logger = logging.getLogger(__name__)


def _report_service_error(operation, report_type, filters=None):
    # Log the traceback for developers while returning a safe, stable message to the UI.
    logger.exception(
        "Official report %s failed (report_type=%s)",
        operation,
        report_type,
        extra={"report_type": report_type, "filters": filters or {}},
    )
    return Response({"detail": "The report service encountered an error."}, status=500)


CENSUS_STATUSES = (
    CensusSubmission.StatusType.PENDING,
    CensusSubmission.StatusType.VERIFIED,
    CensusSubmission.StatusType.APPROVED,
    CensusSubmission.StatusType.SUBJECT_TO_REVISION,
)


@api_view(["GET"])
@permission_classes([IsAuthenticated, isMAO])
def reports_preview(request):
    """Return one authorized report dataset for the preview and requested filters."""
    report_type = request.query_params.get("report_type", "")
    try:
        report = build_report(report_type, request.query_params, request.user)
    except APIException:
        raise
    except Exception:
        return _report_service_error("preview", report_type, dict(request.query_params))
    return Response(report)


@api_view(["GET"])
@permission_classes([IsAuthenticated, isMAO])
def reports_export(request):
    """Rebuild the same approved dataset server-side and render it as xlsx or PDF."""
    report_type = request.query_params.get("report_type", "")
    try:
        report = build_report(report_type, request.query_params, request.user)
        # DRF reserves `format` for renderer negotiation, so exports use `file_format`.
        file_format = request.query_params.get("file_format", "").lower()
        if file_format == "xlsx":
            content, content_type, extension = excel_report(report), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx"
        elif file_format == "pdf":
            content, content_type, extension = pdf_report(report), "application/pdf", "pdf"
        else:
            raise ValidationError({"file_format": "Choose xlsx or pdf."})
    except APIException:
        raise
    except Exception:
        return _report_service_error("export", report_type, dict(request.query_params))
    response = HttpResponse(content, content_type=content_type)
    response["Content-Disposition"] = f'attachment; filename="{report["report_type"]}_{report["period"]["date_from"]}_{report["period"]["date_to"]}.{extension}"'
    return response


@api_view(["GET"])
@permission_classes([IsAuthenticated, isMAO | isSibat])
def dashboard_summary(request):
    # The service owns the DB -> ORM calculations. This view only publishes
    # approved municipal aggregates to authorized dashboard users.
    return Response(descriptive_summary(user=request.user))


@api_view(["GET"])
@permission_classes([IsAuthenticated, isMAO | isSibat])
def data_overview_summary(request):
    return Response(overview_summary(user=request.user))


def _latest_census_period(submissions):
    """Most recent (year, quarter) that actually has a census submission."""
    latest = (
        submissions.order_by("-report_year", "-report_quarter")
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
    submissions = scope_reviewer_queryset(CensusSubmission.objects.all(), request.user)
    latest_year, latest_quarter = _latest_census_period(submissions)

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
        for row in submissions.values(
            "report_year", "report_quarter"
        )
        .distinct()
        .order_by("-report_year", "-report_quarter")
    ]

    period_items = scope_reviewer_queryset(CensusSubmissionItem.objects.all(), request.user).filter(
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
        for row in submissions.filter(
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
        scope_reviewer_queryset(Barangay.objects.all(), request.user).order_by("barangay_name").values_list(
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


@api_view(["GET"])
@permission_classes([IsAuthenticated, isMAO | isSibat])
def predictive_model_comparison(request):
    """
    Evaluates candidate forecasting models (Naive, Linear Regression, Random Forest, ARIMA, Holt-Winters)
    on chronological train/test split of approved municipal data across production, disease, mortality,
    slaughter, and auction domains.
    """
    from .services.predictive.evaluation import evaluate_all_models

    domain = request.query_params.get("domain", "production").lower()
    target = request.query_params.get("target") or request.query_params.get("production_type", "MILK")
    target = target.upper()

    default_unit = "LITERS" if domain == "production" else (
        "CASES" if domain == "disease" else (
            "HEADS" if domain in ("mortality", "slaughter", "auction") else "LITERS"
        )
    )
    unit = request.query_params.get("unit", default_unit).upper()

    try:
        res = evaluate_all_models(
            domain=domain,
            target=target,
            unit=unit,
            user=request.user,
        )
        return Response(res)
    except Exception as e:
        import logging
        logging.getLogger(__name__).exception("Predictive model comparison evaluation failed")
        return Response(
            {
                "status": "error",
                "forecast_available": False,
                "readiness_status": "NOT_READY",
                "message": f"Predictive model comparison failed: {str(e)}",
                "domain": domain,
                "target": {"domain": domain, "target": target, "unit": unit},
                "models": [],
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR if not settings.DEBUG else status.HTTP_200_OK,
        )


@api_view(["GET"])
@permission_classes([IsAuthenticated, isMAO | isSibat])
def predictive_forecast(request):
    """
    Generates out-of-sample future projections using the best evaluated model across any domain.
    """
    from .services.predictive.forecasting import generate_future_forecast

    domain = request.query_params.get("domain", "production").lower()
    target = request.query_params.get("target") or request.query_params.get("production_type", "MILK")
    target = target.upper()

    default_unit = "LITERS" if domain == "production" else (
        "CASES" if domain == "disease" else (
            "HEADS" if domain in ("mortality", "slaughter", "auction") else "LITERS"
        )
    )
    unit = request.query_params.get("unit", default_unit).upper()
    horizon = int(request.query_params.get("horizon", 6))
    preferred_model = request.query_params.get("model")

    try:
        res = generate_future_forecast(
            domain=domain,
            target=target,
            unit=unit,
            horizon_months=horizon,
            preferred_model=preferred_model,
            user=request.user,
        )
        return Response(res)
    except Exception as e:
        import logging
        logging.getLogger(__name__).exception("Predictive forecast generation failed")
        return Response(
            {
                "status": "error",
                "forecast_available": False,
                "readiness_status": "NOT_READY",
                "message": f"Predictive forecast generation failed: {str(e)}",
                "domain": domain,
                "target": {"domain": domain, "target": target, "unit": unit},
                "forecast": [],
                "chart_data": [],
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR if not settings.DEBUG else status.HTTP_200_OK,
        )


@api_view(["GET"])
@permission_classes([IsAuthenticated, isMAO | isSibat])
def prescriptive_recommendations(request):
    """
    Evaluates transparent, evidence-based prescriptive rules based on forecasts
    and real municipal observations.
    """
    from .services.predictive.rules import generate_prescriptive_recommendations

    production_type = request.query_params.get("production_type", "MILK").upper()
    unit = request.query_params.get("unit", "LITERS").upper()

    res = generate_prescriptive_recommendations(production_type=production_type, unit=unit, user=request.user)
    return Response(res)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def gis_summary(request):
    """
    Role-Aware GIS Telemetry Endpoint:
    Returns real-time aggregated territorial demographics, cattle distribution,
    disease surveillance, milk/meat production, mortality rates, and movement flows.
    
    Data isolation and geographic boundaries are strictly enforced on the server
    via `get_gis_aggregated_data(user=request.user)`.
    """
    from .services.gis import get_gis_aggregated_data

    return Response(get_gis_aggregated_data(user=request.user))

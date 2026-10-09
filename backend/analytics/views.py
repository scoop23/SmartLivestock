from django.db.models import Count, F, Sum
from django.conf import settings
from django.db.utils import DatabaseError
import logging
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework import status
from rest_framework.exceptions import APIException, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.http import HttpResponse
from django.shortcuts import get_object_or_404

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
def individual_milk_forecast(request):
    """List isolated demo cows or forecast one selected demo cow for seven days."""
    from .services.predictive.individual_milk import get_individual_milk_forecast, list_demo_cows

    try:
        demo_id = request.query_params.get("cow_id")
        if not demo_id:
            # The no-selection response powers the frontend dropdown without exposing real inventory.
            cows = list_demo_cows()
            return Response({
                "status": "READY" if cows else "NOT_READY",
                "data_source": "synthetic_demo",
                "cows": cows,
                "message": None if cows else "No demo cows are available. Run seed_individual_milk_forecasting.",
            })

        forecast = get_individual_milk_forecast(demo_id)
        if forecast is None:
            return Response({"detail": "Demo cow was not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(forecast)
    except DatabaseError:
        # Missing migration tables and database outages should produce actionable, safe API errors.
        logger.exception("Individual milk demo data could not be loaded")
        return Response(
            {"detail": "Demo data is unavailable. Check database connectivity and apply `python manage.py migrate analytics`."},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def livestock_milk_forecast(request, livestock_id):
    """Return a safe service error if any part of the database-backed request fails."""
    try:
        return _livestock_milk_forecast_response(request, livestock_id)
    except DatabaseError:
        logger.exception("Real livestock milk forecast could not read its records")
        return Response(
            {"detail": "Milk production history is temporarily unavailable. Check database connectivity and try again."},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )


def _livestock_milk_forecast_response(request, livestock_id):
    """Authorize one animal, then route to real history or an explicit demo.

    Normal requests use approved ProductionRecord rows. The optional demo source
    is a separate branch so synthetic observations can never satisfy real-data
    readiness or silently replace an insufficient real history.
    """
    from django.db.models import Q, Sum
    from livestock.models import LivestockInventory
    from production.models import CalvingRecord, ProductionRecord
    from smartlivestock.workflows import require_action, role_name
    from .services.predictive.livestock_milk import forecast_livestock_milk

    # Scope the livestock queryset first. Every later data source (including the
    # demo option) is reached only after this object-level access check succeeds.
    user_role = role_name(request.user)
    animals = LivestockInventory.objects.select_related("farmer__barangay", "livestock_type")
    if user_role == "FARMER":
        # Farmer access follows current ownership, so a previous owner receives the same 404 as an unknown ID.
        animals = animals.filter(farmer__user=request.user)
    else:
        require_action(request.user, "production", "read_all")
        animals = scope_reviewer_queryset(animals, request.user)
    animal = get_object_or_404(animals, pk=livestock_id)

    animal_type = animal.livestock_type.name.strip().lower()
    # Carabao/buffalo are milk-producing bovines in the supported livestock
    # taxonomy, so they use this same individual milk-forecast workflow.
    is_cattle = any(term in animal_type for term in ("cattle", "cow", "bovine", "baka", "carabao", "buffalo"))
    if (
        not is_cattle
        or animal.entry_type != LivestockInventory.EntryType.INDIVIDUAL
        or animal.quantity != 1
        or animal.status != LivestockInventory.StatusType.APPROVED
        or animal.operational_status != LivestockInventory.OperationalStatus.ACTIVE
        or animal.sex.strip().upper() not in {"FEMALE", "F"}
        or animal.age_classification_as_of() == "CALF"
    ):
        return Response(
            {"detail": "Milk forecasts are available only for approved, active, individual female cattle or carabao that are not calves."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Demo records are never substituted for real production. They are available only
    # after the authorized owner explicitly selects the synthetic demonstration.
    demo_source = request.query_params.get("source") == "synthetic_demo"
    demo_cow = None
    if demo_source or request.query_params.get("source") not in (None, "", "approved_livestock_records"):
        if not demo_source:
            return Response({"detail": "Unsupported milk forecast data source."}, status=status.HTTP_400_BAD_REQUEST)
        from analytics.models import IndividualMilkDemoCow
        from analytics.seed_markers import SEED_MARKER_INDIVIDUAL_MILK_DEMO
        demo_cow = IndividualMilkDemoCow.objects.filter(
            tag_number=animal.tag_number,
            seed_marker=SEED_MARKER_INDIVIDUAL_MILK_DEMO,
        ).first()
        if demo_cow is None:
            return Response({"detail": "No synthetic demonstration has been seeded for this livestock."}, status=status.HTTP_404_NOT_FOUND)
        from .services.predictive.individual_milk import get_individual_milk_forecast
        from .services.predictive.weather import get_weather_context
        first_demo_observation = demo_cow.observations.order_by("record_date").first()
        demo_weather_rows, _, demo_weather_message = get_weather_context(
            animal.farmer.barangay.latitude,
            animal.farmer.barangay.longitude,
            first_demo_observation.record_date if first_demo_observation else timezone.localdate(),
            timezone.localdate(),
        )
        demo_result = get_individual_milk_forecast(
            demo_cow.demo_id,
            weather_rows=demo_weather_rows,
            weather_message=demo_weather_message,
        )
        # Return the canonical livestock identity, while the explicit source field
        # and visible UI warning identify the observations as synthetic.
        demo_result["livestock"] = {
            "id": animal.pk,
            "tag_number": animal.tag_number,
            "livestock_type": animal.livestock_type.name,
            "breed": animal.breed or None,
            "sex": animal.sex or None,
            "age_years": demo_result["livestock"]["age_years"],
            "days_since_calving": demo_result["livestock"]["days_since_calving"],
        }
        demo_result["demonstration_available"] = True
        demo_result["weather"]["location_source"] = "Farmer's barangay centroid"
        demo_result["weather"]["location_name"] = animal.farmer.barangay.barangay_name if animal.farmer.barangay_id else None
        return Response(demo_result)

    # Keep real data eligibility strict: draft, unrelated, future, or other-unit
    # records must not count toward this animal's approved milk history.
    records = ProductionRecord.objects.filter(
        livestock=animal,
        production_type=ProductionRecord.ProductionType.MILK,
        unit=ProductionRecord.UnitType.LITERS,
        status=ProductionRecord.ProductionStatus.APPROVED,
        record_date__lte=timezone.localdate(),
    )
    if user_role == "FARMER":
        # Historical attribution stays private to the farmer who recorded that ownership period.
        records = records.filter(
            Q(farmer_at_record=animal.farmer)
            | Q(farmer_at_record__isnull=True, created_by=request.user)
        )
    else:
        records = scope_reviewer_queryset(ProductionRecord.objects.all(), request.user).filter(
            livestock=animal,
            production_type=ProductionRecord.ProductionType.MILK,
            unit=ProductionRecord.UnitType.LITERS,
            status=ProductionRecord.ProductionStatus.APPROVED,
            record_date__lte=timezone.localdate(),
        )

    # Several approved entries may exist on one date. Sum them into one daily
    # observation because the model predicts daily milk totals.
    daily_records = list(
        records.values("record_date")
        .annotate(milk_liters=Sum("quantity"))
        .order_by("record_date")
    )
    daily_records = [
        {"date": row["record_date"], "milk_liters": float(row["milk_liters"])}
        for row in daily_records
    ]
    calving_events = list(
        CalvingRecord.objects.filter(
            dam=animal,
            status=CalvingRecord.StatusType.APPROVED,
            calving_date__lte=timezone.localdate(),
            reviewed_at__isnull=False,
        ).values_list("calving_date", "reviewed_at")
    )
    calving_events = [(calving_date, reviewed_at.date()) for calving_date, reviewed_at in calving_events]

    # Weather is fetched only when the real milk history is otherwise forecast-ready.
    # Open-Meteo gets the farmer's barangay centroid, not private farm coordinates.
    weather_rows = {}
    weather_message = "Weather is omitted until this animal has sufficient recent approved milk history."
    today = timezone.localdate()
    if (
        len(daily_records) >= 60
        and daily_records
        and (today - daily_records[-1]["date"]).days <= 7
    ):
        from .services.predictive.weather import get_weather_context
        barangay = animal.farmer.barangay
        weather_rows, _, weather_message = get_weather_context(
            barangay.latitude,
            barangay.longitude,
            daily_records[0]["date"],
            today,
        )

    result = forecast_livestock_milk(
        animal,
        daily_records,
        calving_events,
        weather_rows=weather_rows,
        weather_message=weather_message,
    )
    from analytics.models import IndividualMilkDemoCow
    from analytics.seed_markers import SEED_MARKER_INDIVIDUAL_MILK_DEMO
    result["demonstration_available"] = IndividualMilkDemoCow.objects.filter(
        tag_number=animal.tag_number,
        seed_marker=SEED_MARKER_INDIVIDUAL_MILK_DEMO,
    ).exists()
    return Response(result)


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

import hashlib
from django.db.models import Count, F, Q, Sum
from django.db.utils import DatabaseError
import logging
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework import serializers, status
from rest_framework.exceptions import APIException, ValidationError
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response
from django.http import HttpResponse
from django.shortcuts import get_object_or_404

from livestock.models import Barangay, CensusSubmission, CensusSubmissionItem, Farmer
from livestock.permission import isMAO, isSibat
from .services.descriptive import descriptive_summary
from .services.overview import overview_summary
from .services.population import official_inventory
from smartlivestock.workflows import has_all_barangay_access, role_name, scope_reviewer_queryset
from .services.reports import build_report
from .services.report_exports import excel_report, pdf_report
from .services.review_workload import review_workload_summary
from .services.surveillance import surveillance_summary
from .services.predictive.surveillance_experiment import evaluate_surveillance_forecast_experiment
from .services.nlp_query import execute_question
from .permissions import IsNLPDeveloper

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


class IsSibatReportUser(BasePermission):
    """Allow field reviewers to use reports, with row scope enforced by the service."""

    def has_permission(self, request, view):
        role = getattr(getattr(request.user, "role", None), "role_name", "")
        return role in {"SIBAT", "CBAT"}


@api_view(["GET"])
@permission_classes([IsAuthenticated, isMAO | IsSibatReportUser])
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
@permission_classes([IsAuthenticated, isMAO | IsSibatReportUser])
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
@permission_classes([IsAuthenticated, isMAO])
def disease_mortality_surveillance(request):
    """Return approved-record surveillance indicators for MAO/Admin."""
    return Response(surveillance_summary(user=request.user))


@api_view(["GET"])
@permission_classes([IsAuthenticated, isMAO])
def surveillance_forecast_experiment(request):
    """Run the on-demand, scoped experimental forecast comparison."""
    return Response(evaluate_surveillance_forecast_experiment(user=request.user))


@api_view(["GET"])
@permission_classes([IsAuthenticated, isMAO | isSibat])
def mortality_weather_context(request):
    """Provide recent and near-term weather context for mortality surveillance."""
    from .services.gis import BARANGAY_CENTROIDS
    from .services.predictive.weather import get_mortality_weather_context

    role = role_name(request.user)
    if role in {"SIBAT", "CBAT"} and not has_all_barangay_access(request.user):
        barangay = getattr(request.user, "assigned_barangay", None)
        if barangay is None:
            return Response({"detail": "Assign this field account a barangay before viewing weather context."}, status=403)
        location = BARANGAY_CENTROIDS.get(barangay.barangay_name)
        scope = barangay.barangay_name
    else:
        points = list(BARANGAY_CENTROIDS.values())
        location = [sum(point[index] for point in points) / len(points) for index in range(2)]
        scope = "Padre Garcia municipality (barangay-centroid average)"

    result = get_mortality_weather_context(*location, today=timezone.localdate()) if location else {
        "available": False, "provider": "Open-Meteo", "message": "Coordinates are unavailable for this scope."
    }
    return Response({**result, "scope": scope})


class AskSmartLivestockSerializer(serializers.Serializer):
    """Keep the natural-language input small and predictable before parsing."""
    question = serializers.CharField(max_length=500, allow_blank=False, trim_whitespace=True)
    explain = serializers.BooleanField(required=False, default=False)


@api_view(["POST"])
@permission_classes([IsAuthenticated, isMAO | isSibat])
def nlp_query(request):
    """Answer one allowlisted analytics question using the caller's data scope."""
    serializer = AskSmartLivestockSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    # Retrieve the factual answer first. Passing request.user lets the existing
    # NLP handlers enforce the caller's permissions and geographic data scope.
    result = execute_question(serializer.validated_data["question"], user=request.user)
    # The UI's explain flag requests optional prose; the explanation service
    # still checks both deployment gates before sending any aggregates to Groq.
    if serializer.validated_data["explain"]:
        from .services.nlp_explanation import add_optional_explanation

        result = add_optional_explanation(result)
    return Response(result, status=status.HTTP_200_OK)


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsNLPDeveloper])
def nlp_evaluation(request):
    """Evaluate checked-in language examples, never user questions or farm data."""
    from .services.nlp_evaluation import compare_pipelines, evaluate_parser
    comparison = request.query_params.get("compare", "0")
    if comparison not in ("0", "1"):
        raise ValidationError({"compare": "Use 0 for the parser report or 1 for the offline comparison."})
    # ML is loaded only for an explicit admin diagnostic request, never Ask.
    return Response(compare_pipelines() if comparison == "1" else evaluate_parser())


class NLPExampleDecisionSerializer(serializers.Serializer):
    decision = serializers.ChoiceField(choices=("accepted", "rejected"))
    utterance = serializers.CharField(required=False, max_length=500, allow_blank=False, trim_whitespace=True)
    intent = serializers.ChoiceField(required=False, choices=tuple((label, label) for label in (
        "population_summary", "production_trend", "production_breakdown", "disease_by_barangay",
        "mortality_comparison", "pending_reviews", "farmer_livestock_count", "unsupported", "clarification",
    )))
    notes = serializers.CharField(required=False, max_length=2000, allow_blank=True, trim_whitespace=True)


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsNLPDeveloper])
def nlp_dataset(request):
    """Return only synthetic, versioned examples and their developer review state."""
    import json
    from collections import Counter
    from .models import NLPExampleReviewEvent
    from .services.nlp_dataset import CORPUS_PATH, REPORT_PATH

    corpus = json.loads(CORPUS_PATH.read_text(encoding="utf-8"))
    latest = {}
    events = NLPExampleReviewEvent.objects.filter(corpus_version=corpus["version"]).select_related("reviewer")
    for event in events:
        latest.setdefault(event.example_id, event)
    examples = []
    for source in corpus["examples"]:
        event = latest.get(source["example_id"])
        examples.append({
            **source,
            "review": {
                "decision": event.decision if event else "candidate",
                "utterance": event.utterance_override if event and event.utterance_override else source["utterance"],
                "intent": event.intent_override if event and event.intent_override else source["intent"],
                "notes": event.notes if event else "",
                "reviewer": (event.reviewer.get_full_name().strip() or event.reviewer.username) if event else None,
                "reviewed_at": event.reviewed_at.isoformat() if event else None,
            },
        })
    summary = {}
    for key in ("intent", "language", "role", "expected_behavior", "difficulty", "split", "source_type"):
        summary[key] = dict(Counter(row[key] for row in corpus["examples"]))
    evaluation = None
    if REPORT_PATH.exists():
        saved = json.loads(REPORT_PATH.read_text(encoding="utf-8"))
        if saved.get("dataset", {}).get("sha256") == hashlib.sha256(
                json.dumps(corpus, sort_keys=True, ensure_ascii=False).encode()
            ).hexdigest():
            evaluation = {
                "version": saved.get("report_version"),
                "evaluated_at": saved.get("evaluated_at"),
                "baseline_classifier_accuracy": saved["model_evaluation"]["baseline_tf_idf_logistic_regression"]["outcome_accuracy"],
                "baseline_classifier_macro_f1": saved["model_evaluation"]["baseline_tf_idf_logistic_regression"]["macro_f1"],
                "candidate_classifier_accuracy": saved["model_evaluation"]["candidate_tf_idf_logistic_regression"]["outcome_accuracy"],
                "candidate_classifier_macro_f1": saved["model_evaluation"]["candidate_tf_idf_logistic_regression"]["macro_f1"],
                "candidate_training_count": saved["model_evaluation"]["candidate_training_count"],
                "candidate_per_intent": saved["model_evaluation"]["candidate_tf_idf_logistic_regression"]["per_intent"],
                "candidate_confidence": saved["model_evaluation"]["candidate_confidence"],
                "baseline_parser_accuracy": saved["parser_evaluation"]["original_committed_rules_same_test"]["outcome_accuracy"],
                "candidate_parser_accuracy": saved["parser_evaluation"]["end_to_end_static_contract"]["exact_correctness"],
                "candidate_parser_macro_f1": saved["parser_evaluation"]["improved_rules_same_test"]["macro_f1"],
                "entity_exact_match": saved["parser_evaluation"]["entity_extraction"]["per_entity"],
                "near_duplicate_flags": len(saved.get("dataset", {}).get("near_duplicates_for_review", [])),
                "label_conflicts": sum(bool(row.get("label_conflict")) for row in saved.get("dataset", {}).get("near_duplicates_for_review", [])),
                "near_duplicate_pairs": saved.get("dataset", {}).get("near_duplicates_for_review", []),
                "production_model_changed": False,
                "limitations": saved.get("limitations"),
            }
    return Response({
        "corpus_version": corpus["version"], "generation_method": corpus["generation_method"],
        "production_training_file_changed": False, "summary": summary, "examples": examples,
        "candidate_count": sum(item["review"]["decision"] == "candidate" for item in examples),
        "accepted_count": sum(item["review"]["decision"] == "accepted" for item in examples),
        "rejected_count": sum(item["review"]["decision"] == "rejected" for item in examples),
        "evaluation": evaluation,
    })


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsNLPDeveloper])
def nlp_dataset_review(request, example_id):
    """Append a human review event; evaluation groups cannot be edited in place."""
    import json
    from .models import NLPExampleReviewEvent
    from .services.nlp_dataset import CORPUS_PATH

    corpus = json.loads(CORPUS_PATH.read_text(encoding="utf-8"))
    example = next((row for row in corpus["examples"] if row["example_id"] == example_id), None)
    if example is None:
        return Response({"detail": "Candidate example not found."}, status=404)
    if example["split"] != "train" or example["source_type"] != "generated_candidate":
        return Response({"detail": "Only training candidates can be reviewed. Validation and test examples remain frozen."}, status=400)
    serializer = NLPExampleDecisionSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    values = serializer.validated_data
    decision = values["decision"]
    event = NLPExampleReviewEvent.objects.create(
        corpus_version=corpus["version"], example_id=example_id, decision=decision,
        utterance_override=values.get("utterance", "") if decision == "accepted" else "",
        intent_override=values.get("intent", "") if decision == "accepted" else "",
        notes=values.get("notes", ""), reviewer=request.user,
    )
    return Response({"example_id": example_id, "decision": event.decision,
                     "reviewed_at": event.reviewed_at, "reviewer": event.reviewer.username}, status=201)


@api_view(["GET"])
@permission_classes([IsAuthenticated, isMAO | isSibat])
def review_workload(request):
    """Return stage-aware counts for MAO or the authenticated SIBAT scope."""
    return Response(review_workload_summary(user=request.user))


@api_view(["GET"])
@permission_classes([IsAuthenticated, isMAO | isSibat])
def data_overview_summary(request):
    return Response(overview_summary(user=request.user))


@api_view(["GET"])
@permission_classes([IsAuthenticated, isMAO])
def barangay_current_farmers(request, barangay_id):
    """Return livestock-type and farmer breakdowns for one barangay."""
    barangay = get_object_or_404(Barangay, pk=barangay_id)
    registered_farmers = list(
        Farmer.objects.filter(
            barangay_id=barangay.pk,
            user__role__role_name="FARMER",
            user__account_status="APPROVED",
        )
        .values("id", "user__first_name", "user__last_name", "user__username")
    )

    # Use the same approved-active inventory queryset as the municipal head totals.
    inventory_rows = list(
        official_inventory().filter(farmer__barangay_id=barangay.pk)
        .values(
            "farmer_id", "farmer__user__first_name", "farmer__user__last_name",
            "farmer__user__username", "livestock_type_id", "livestock_type__name",
        )
        .annotate(heads=Sum("quantity"))
        .order_by("livestock_type__name", "farmer__user__last_name", "farmer__user__first_name")
    )

    farmers_by_id = {}
    for row in registered_farmers:
        name = " ".join(
            value for value in (row["user__first_name"], row["user__last_name"]) if value
        ) or row["user__username"]
        farmers_by_id[row["id"]] = {
            "id": row["id"], "name": name, "current_heads": 0, "livestock_types": [],
        }

    livestock_types_by_id = {}
    for row in inventory_rows:
        farmer = farmers_by_id.setdefault(row["farmer_id"], {
            "id": row["farmer_id"],
            "name": " ".join(
                value for value in (row["farmer__user__first_name"], row["farmer__user__last_name"])
                if value
            ) or row["farmer__user__username"],
            "current_heads": 0,
            "livestock_types": [],
        })
        heads = row["heads"] or 0
        farmer["current_heads"] += heads
        farmer["livestock_types"].append({
            "id": row["livestock_type_id"], "name": row["livestock_type__name"], "heads": heads,
        })
        livestock_type = livestock_types_by_id.setdefault(row["livestock_type_id"], {
            "id": row["livestock_type_id"], "name": row["livestock_type__name"], "heads": 0,
        })
        livestock_type["heads"] += heads

    farmers = sorted(farmers_by_id.values(), key=lambda farmer: (-farmer["current_heads"], farmer["name"].casefold()))
    livestock_types = sorted(livestock_types_by_id.values(), key=lambda livestock_type: livestock_type["name"].casefold())
    return Response({
        "barangay_id": barangay.pk,
        "barangay": barangay.barangay_name,
        "farmer_count": len(farmers),
        "current_heads": sum(farmer["current_heads"] for farmer in farmers),
        "livestock_types": livestock_types,
        "farmers": farmers,
    })


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


class ForecastHorizonSerializer(serializers.Serializer):
    horizon = serializers.IntegerField(min_value=1, max_value=12, default=6)


@api_view(["GET"])
@permission_classes([IsAuthenticated, isMAO | isSibat])
def predictive_model_comparison(request):
    """
    Evaluates candidate forecasting models (Naive, Linear Regression, Random Forest, ARIMA, Holt-Winters)
    on chronological train/test split of approved municipal data across production, disease, mortality,
    slaughter, and auction domains.
    """
    domain = request.query_params.get("domain", "production").lower()
    target = request.query_params.get("target") or request.query_params.get("production_type", "MILK")
    target = target.upper()

    default_unit = "LITERS" if domain == "production" else (
        "CASES" if domain == "disease" else (
            "HEADS" if domain in ("mortality", "slaughter", "auction") else "LITERS"
        )
    )
    unit = request.query_params.get("unit", default_unit).upper()
    parameters = ForecastHorizonSerializer(data=request.query_params)
    parameters.is_valid(raise_exception=True)
    horizon = parameters.validated_data["horizon"]

    try:
        from .services.predictive.evaluation import evaluate_all_models

        res = evaluate_all_models(
            domain=domain,
            target=target,
            unit=unit,
            user=request.user,
            horizon_months=horizon,
        )
        return Response(res)
    except APIException:
        raise
    except Exception:
        import logging
        logging.getLogger(__name__).exception("Predictive model comparison evaluation failed")
        return Response(
            {
                "status": "error",
                "forecast_available": False,
                "readiness_status": "NOT_READY",
                "message": "Predictive model comparison is temporarily unavailable.",
                "domain": domain,
                "target": {"domain": domain, "target": target, "unit": unit},
                "models": [],
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["GET"])
@permission_classes([IsAuthenticated, isMAO | isSibat])
def predictive_forecast(request):
    """
    Generates out-of-sample future projections using the best evaluated model across any domain.
    """
    domain = request.query_params.get("domain", "production").lower()
    target = request.query_params.get("target") or request.query_params.get("production_type", "MILK")
    target = target.upper()

    default_unit = "LITERS" if domain == "production" else (
        "CASES" if domain == "disease" else (
            "HEADS" if domain in ("mortality", "slaughter", "auction") else "LITERS"
        )
    )
    unit = request.query_params.get("unit", default_unit).upper()
    parameters = ForecastHorizonSerializer(data=request.query_params)
    parameters.is_valid(raise_exception=True)
    horizon = parameters.validated_data["horizon"]
    preferred_model = request.query_params.get("model")

    try:
        from .services.predictive.forecasting import generate_future_forecast

        res = generate_future_forecast(
            domain=domain,
            target=target,
            unit=unit,
            horizon_months=horizon,
            preferred_model=preferred_model,
            user=request.user,
        )
        return Response(res)
    except APIException:
        raise
    except Exception:
        import logging
        logging.getLogger(__name__).exception("Predictive forecast generation failed")
        return Response(
            {
                "status": "error",
                "forecast_available": False,
                "readiness_status": "NOT_READY",
                "message": "Predictive forecast generation is temporarily unavailable.",
                "domain": domain,
                "target": {"domain": domain, "target": target, "unit": unit},
                "forecast": [],
                "chart_data": [],
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["GET"])
@permission_classes([IsAuthenticated, isMAO | isSibat])
def predictive_readiness_diagnostics(request):
    """
    Returns authoritative forecast readiness, validation diagnostics, checklist,
    and cutoff timeline for MAO/Admin decision support.
    """
    domain = request.query_params.get("domain")
    target = request.query_params.get("target") or request.query_params.get("production_type")
    unit = request.query_params.get("unit")
    parameters = ForecastHorizonSerializer(data=request.query_params)
    parameters.is_valid(raise_exception=True)
    horizon = parameters.validated_data["horizon"]

    try:
        from .services.predictive.diagnostics import (
            get_forecast_readiness_diagnostics,
            get_all_forecast_readiness_diagnostics,
        )

        if domain or target:
            res = get_forecast_readiness_diagnostics(
                domain=domain or "production",
                target=target or "MILK",
                unit=unit or ("LITERS" if (domain or "production") == "production" else "HEADS"),
                user=request.user,
                horizon_months=horizon,
            )
        else:
            res = get_all_forecast_readiness_diagnostics(
                user=request.user,
                horizon_months=horizon,
            )
        return Response(res)
    except APIException:
        raise
    except Exception:
        import logging
        logging.getLogger(__name__).exception("Predictive readiness diagnostics failed")
        return Response(
            {
                "status": "error",
                "message": "Predictive readiness diagnostics are temporarily unavailable.",
                "summary_cards": [],
                "diagnostics": {},
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
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
    from django.db.models import Count, Q, Sum
    from livestock.models import LivestockInventory
    from production.models import CalvingRecord, ProductionRecord, WeightRecord
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
            demo_cow = IndividualMilkDemoCow.objects.filter(
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
        approved_at__isnull=False,
        session_conflict=False,
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
            approved_at__isnull=False,
            session_conflict=False,
            record_date__lte=timezone.localdate(),
        )

    # Several approved entries may exist on one date. Sum them into one daily
    # observation because the model predicts daily milk totals.
    daily_records = list(
        records.values("record_date")
        .annotate(milk_liters=Sum("quantity"), session_count=Count("milking_session", distinct=True),
                  record_count=Count("pk"))
        .order_by("record_date")
    )
    daily_records = [
        {"date": row["record_date"], "milk_liters": float(row["milk_liters"]),
         "session_count": row["session_count"], "record_count": row["record_count"]}
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

    # Use dated weigh-ins only. LivestockInventory.weight is the latest value
    # without a history timestamp, so it cannot safely train historical rows.
    weight_records = [
        {
            "weight_kg": float(row["weight"]),
            "weighing_date": row["weighing_date"],
            "recorded_date": timezone.localtime(row["created_at"]).date(),
        }
        for row in (
            WeightRecord.objects.filter(
                livestock=animal,
                weighing_date__lte=timezone.localdate(),
                created_at__date__lte=timezone.localdate(),
            )
            .order_by("-weighing_date", "-created_at", "-pk")
            .values("weight", "weighing_date", "created_at")
        )
    ]

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
        weight_records=weight_records,
    )
    from analytics.models import IndividualMilkDemoCow
    from analytics.seed_markers import SEED_MARKER_INDIVIDUAL_MILK_DEMO
    result["demonstration_available"] = IndividualMilkDemoCow.objects.filter(
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

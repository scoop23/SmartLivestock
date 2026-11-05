"""Evidence-based follow-up rules for disease and vaccination records.

These are transparent administrative rules, not diagnoses or proof of immunity.
Production records and production forecasts are not queried by this service.
"""
from typing import Dict, Any, List
from datetime import timedelta
from django.utils import timezone
from django.db.models import Sum

from diseases.models import DiseaseCase
from smartlivestock.workflows import scope_reviewer_queryset
from ..population import population_summary


def generate_prescriptive_recommendations(user=None) -> Dict[str, Any]:
    """Return scoped health follow-up recommendations and their evidence."""
    recommendations: List[Dict[str, Any]] = []

    # -------------------------------------------------------------
    # Rule 3: Active Disease Surveillance & Biosecurity
    # Condition: Query approved DiseaseCases in the past 90 days
    # -------------------------------------------------------------
    today = timezone.localdate()
    ninety_days_ago = today - timedelta(days=90)

    recent_disease_cases = scope_reviewer_queryset(DiseaseCase.objects.all(), user).filter(
        status=DiseaseCase.DiseaseStatus.APPROVED,
        record_date__gte=ninety_days_ago,
        record_date__lte=today,
        clinical_status__in=[DiseaseCase.ClinicalStatus.OPEN, DiseaseCase.ClinicalStatus.NOT_RECORDED],
    )
    case_count = recent_disease_cases.count()
    affected_heads = recent_disease_cases.aggregate(total=Sum("affected_count"))["total"] or 0

    if case_count > 0:
        recommendations.append({
            "rule": "DISEASE_SURVEILLANCE_PRESSURE",
            "category": "Biosecurity & Surveillance",
            "severity": "HIGH" if case_count >= 3 or affected_heads >= 10 else "MEDIUM",
            "title": f"Disease reports need follow-up ({case_count} approved reports)",
            "reason": (
                f"Recorded {case_count} approved disease incidents affecting {affected_heads} head(s) "
                f"within the past 90 days."
            ),
            "evidence": {
                "approved_reports_last_90_days": case_count,
                "total_affected_heads": affected_heads,
                "threshold_applied": "> 0 approved reports in the past 90 days",
            },
            "recommendation": (
                "Ask CBAT officers for targeted livestock health inspections, verify herd "
                "movement permits, and issue biosecurity reminders to neighboring barangays."
            ),
            "action_type": "SURVEILLANCE_DEPLOYMENT",
        })

    # -------------------------------------------------------------
    # Rule 4: Vaccination Coverage Check
    # Condition: Check total approved inventory vs vaccinated heads
    # -------------------------------------------------------------
    population = population_summary(user=user, today=today)
    total_approved_heads = population["total_heads"]
    vaccinated_heads = sum(row["vaccinated"] for row in population["by_barangay"])
    coverage_pct = round((vaccinated_heads / total_approved_heads) * 100, 1) if total_approved_heads > 0 else 0.0

    if total_approved_heads > 0 and coverage_pct < 60.0:
        recommendations.append({
            "rule": "LOW_VACCINATION_COVERAGE",
            "category": "Preventive Healthcare",
            "severity": "MEDIUM",
            "title": f"Low Vaccination Record Coverage ({coverage_pct}%)",
            "reason": (
                f"Only {vaccinated_heads} of {total_approved_heads} approved livestock heads ({coverage_pct}%) "
                f"have a recorded vaccination date. This does not establish current immunity."
            ),
            "evidence": {
                "vaccinated_heads": vaccinated_heads,
                "total_heads": total_approved_heads,
                "coverage_percentage": f"{coverage_pct}%",
                "target_threshold": "60.0%",
            },
            "recommendation": (
                "Ask MAO veterinary technicians to review missing vaccination dates and verify which animals "
                "need vaccination before scheduling a drive. The 60% threshold is an administrative record-review trigger."
            ),
            "action_type": "VACCINATION_DRIVE",
        })

    # Keep observed-record checks distinct from model-based planning signals.
    for recommendation in recommendations:
        recommendation["category_key"] = "DISEASE" if recommendation["rule"] == "DISEASE_SURVEILLANCE_PRESSURE" else "VACCINATION"
        recommendation["source"] = "record_review"
        recommendation["responsible_role"] = "MAO / CBAT"
    from .prescriptive_forecasts import forecast_recommendations
    planning, forecast_readiness = forecast_recommendations(user)
    recommendations.extend(planning)

    return {
        "status": "ready" if total_approved_heads > 0 and all(item["available"] for item in forecast_readiness.values()) else "partial",
        "rule_readiness": {
            "disease": "ready",
            "vaccination_records": "ready" if total_approved_heads > 0 else "unavailable",
        },
        "forecast_readiness": forecast_readiness,
        "total_recommendations": len(recommendations),
        "recommendations": recommendations,
    }

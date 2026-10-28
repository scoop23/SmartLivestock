"""
Prescriptive Rules and Transparent Decision-Support Engine.

=============================================================================
EDUCATIONAL OVERVIEW: PRESCRIPTIVE ANALYTICS
=============================================================================
What is Prescriptive Analytics?
- Descriptive Analytics: "What happened?" (e.g. 450 Liters of milk produced last month)
- Predictive Analytics: "What is likely to happen?" (e.g. 390 Liters projected next month)
- Prescriptive Analytics: "What action should be considered?" (e.g. Inspect feed and pasture conditions)

CRITICAL PRINCIPLES:
1. Not Black-Box Magic:
   Prescriptive recommendations are NOT another opaque neural network. They are
   transparent, deterministic, domain-rule evaluations based on:
     Forecasts + Observed Historical Data + Administrative Thresholds.

2. Evidence-Based & Explainable:
   Every recommendation displays:
   - Rule Name (which policy triggered)
   - Severity Level (LOW, MEDIUM, HIGH)
   - Quantified Evidence (the exact metrics that crossed thresholds)
   - Operational Action (clear municipal advice)

3. Administrative / Operational Scope:
   SmartLivestock is an agricultural information management system, not an automated
   veterinarian. Recommendations advise scheduling field visits, reviewing cold-storage,
   or organizing vaccination campaigns — never diagnosing disease or prescribing drugs.
"""

from typing import Dict, Any, List, Optional
from datetime import timedelta
from django.utils import timezone
from django.db.models import Sum

from diseases.models import DiseaseCase
from smartlivestock.workflows import scope_reviewer_queryset
from ..population import population_summary


def generate_prescriptive_recommendations(
    production_type: str = "MILK",
    unit: str = "LITERS",
    user=None,
) -> Dict[str, Any]:
    """
    Evaluates system indicators against transparent domain rules and returns
    actionable recommendations.
    """
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
            "title": f"Heightened Disease Risk ({case_count} Approved Case(s))",
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
                "Deploy SIBAT surveillance officers for targeted livestock health inspections, verify herd "
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

    return {
        "status": "ready" if total_approved_heads > 0 else "partial",
        "rule_readiness": {
            "disease": "ready",
            "vaccination_records": "ready" if total_approved_heads > 0 else "unavailable",
        },
        "total_recommendations": len(recommendations),
        "recommendations": recommendations,
    }

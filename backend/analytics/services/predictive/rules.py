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
from livestock.models import LivestockInventory
from .forecasting import generate_future_forecast


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

    # 1. Fetch Forecast & Baseline Data
    forecast_data = generate_future_forecast(production_type=production_type, unit=unit, horizon_months=3, user=user)

    forecast_status = forecast_data.get("status")
    recent_baseline = 0.0
    forecast_avg = 0.0
    pct_change = 0.0

    if forecast_status == "ready":
        meta = forecast_data.get("metadata", {})
        recent_baseline = meta.get("recent_baseline_avg", 0.0)
        forecast_avg = meta.get("forecast_period_avg", 0.0)
        pct_change = meta.get("projected_change_pct", 0.0)

        # -------------------------------------------------------------
        # Rule 1: Significant Production Decline
        # Condition: Forecasted production drops > 10% below recent baseline
        # -------------------------------------------------------------
        if pct_change <= -10.0 and recent_baseline > 0:
            severity = "HIGH" if pct_change <= -20.0 else "MEDIUM"
            recommendations.append({
                "rule": "PRODUCTION_DECLINE_ALERT",
                "category": "Production Monitoring",
                "severity": severity,
                "title": f"Projected {abs(pct_change)}% Production Decline",
                "reason": (
                    f"Forecasted monthly average ({forecast_avg} {unit}) is trending significantly "
                    f"below the recent 3-month baseline ({recent_baseline} {unit})."
                ),
                "evidence": {
                    "recent_baseline": f"{recent_baseline} {unit}",
                    "forecasted_average": f"{forecast_avg} {unit}",
                    "change_percentage": f"{pct_change}%",
                    "threshold_applied": "-10.0%",
                },
                "recommendation": (
                    "Schedule field visits with dairy/livestock technologists to inspect feed quality, "
                    "water availability, and seasonal calving cycles in affected farmer clusters."
                ),
                "action_type": "FIELD_VISIT",
            })

        # -------------------------------------------------------------
        # Rule 2: Production Surge / High Yield Outlook
        # Condition: Forecasted production increases > 10% above recent baseline
        # -------------------------------------------------------------
        elif pct_change >= 10.0 and recent_baseline > 0:
            recommendations.append({
                "rule": "PRODUCTION_SURGE_PREPARATION",
                "category": "Logistics & Storage",
                "severity": "LOW",
                "title": f"Anticipated +{pct_change}% Production Surge",
                "reason": (
                    f"Forecasted monthly yield ({forecast_avg} {unit}) indicates strong growth "
                    f"compared to the recent baseline ({recent_baseline} {unit})."
                ),
                "evidence": {
                    "recent_baseline": f"{recent_baseline} {unit}",
                    "forecasted_average": f"{forecast_avg} {unit}",
                    "change_percentage": f"+{pct_change}%",
                    "threshold_applied": "+10.0%",
                },
                "recommendation": (
                    "Coordinate with municipal collection centers and dairy cooperatives to ensure "
                    "adequate cold-storage capacity, milk transport containers, and marketing channels."
                ),
                "action_type": "LOGISTICS_PREPARATION",
            })
        else:
            recommendations.append({
                "rule": "STABLE_PRODUCTION_OUTLOOK",
                "category": "Production Monitoring",
                "severity": "LOW",
                "title": "Stable Production Trajectory",
                "reason": f"Forecasted yield ({forecast_avg} {unit}) aligns closely with recent baseline ({recent_baseline} {unit}).",
                "evidence": {
                    "recent_baseline": f"{recent_baseline} {unit}",
                    "forecasted_average": f"{forecast_avg} {unit}",
                    "change_percentage": f"{pct_change}%",
                },
                "recommendation": "Maintain standard rotational monitoring and quarterly census verification.",
                "action_type": "ROUTINE_MONITORING",
            })

    # -------------------------------------------------------------
    # Rule 3: Active Disease Surveillance & Biosecurity
    # Condition: Query approved DiseaseCases in the past 90 days
    # -------------------------------------------------------------
    today = timezone.localdate()
    ninety_days_ago = today - timedelta(days=90)

    recent_disease_cases = DiseaseCase.objects.filter(
        status=DiseaseCase.DiseaseStatus.APPROVED,
        record_date__gte=ninety_days_ago,
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
                "active_cases_last_90_days": case_count,
                "total_affected_heads": affected_heads,
                "threshold_applied": "> 0 active cases",
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
    total_approved_heads = LivestockInventory.objects.filter(status="APPROVED").count()
    vaccinated_heads = LivestockInventory.objects.filter(status="APPROVED", last_vaccination_date__isnull=False).count()
    coverage_pct = round((vaccinated_heads / total_approved_heads) * 100, 1) if total_approved_heads > 0 else 0.0

    if total_approved_heads > 0 and coverage_pct < 60.0:
        recommendations.append({
            "rule": "LOW_VACCINATION_COVERAGE",
            "category": "Preventive Healthcare",
            "severity": "MEDIUM",
            "title": f"Low Vaccination Coverage ({coverage_pct}%)",
            "reason": (
                f"Only {vaccinated_heads} of {total_approved_heads} approved livestock heads ({coverage_pct}%) "
                f"have verified vaccination records."
            ),
            "evidence": {
                "vaccinated_heads": vaccinated_heads,
                "total_heads": total_approved_heads,
                "coverage_percentage": f"{coverage_pct}%",
                "target_threshold": "60.0%",
            },
            "recommendation": (
                "Prioritize scheduling municipal vaccination drives and coordinate with MAO veterinary technicians "
                "to update animal health ledgers."
            ),
            "action_type": "VACCINATION_DRIVE",
        })

    return {
        "status": "ready",
        "target": {"production_type": production_type, "unit": unit},
        "forecast_status": forecast_status,
        "is_seeded": forecast_data.get("metadata", {}).get("is_seeded", False),
        "total_recommendations": len(recommendations),
        "recommendations": recommendations,
    }

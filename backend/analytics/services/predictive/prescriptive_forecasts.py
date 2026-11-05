"""Translate existing forecast outputs into transparent planning rules.

Thresholds below are administrative review triggers, not clinical thresholds.
This module never creates predictions, diagnoses, or changes official records.
"""
from math import isfinite
from statistics import mean

from django.core.cache import cache
from livestock.models import Barangay
from smartlivestock.workflows import role_name, scope_reviewer_queryset
from .diagnostics import get_forecast_readiness_diagnostics


TARGETS = [
    dict(id="disease_reports", domain="disease", target="ALL", unit="CASES", label="Disease reports", category="DISEASE", owner="MAO / CBAT", action="Prioritize report verification and arrange CBAT follow-up visits. A projected rise in reports does not establish disease spread.", minimum_change=2),
    dict(id="disease_heads", domain="disease", target="ALL", unit="HEADS", label="Reported disease-affected heads", category="DISEASE", owner="MAO / CBAT", action="Review affected-animal records and coordinate CBAT follow-up. Reported affected heads can include repeated episodes involving the same animal.", minimum_change=2),
    dict(id="mortality_deaths", domain="mortality", target="ALL", unit="HEADS", label="Recorded deaths", category="MORTALITY", owner="MAO / CBAT", action="Review mortality declarations, linked disease histories, and disposal documentation. Ask field staff to verify the reports; this is not an individual mortality-risk prediction.", minimum_change=2),
    dict(id="livestock_sales", domain="auction", target="ALL", unit="HEADS", label="Recorded livestock sales", category="AUCTION", owner="MAO / Auction staff", action="Review auction staffing, advance document-review slots, and inspection capacity for the estimated recorded workload. Transfers do not measure all market attendance.", minimum_change=1),
    dict(id="slaughter_meat", domain="slaughter", target="ALL", unit="KILOGRAMS", label="Recorded slaughter carcass weight", category="SLAUGHTER", owner="MAO / Slaughterhouse personnel", action="Review slaughter inspection schedules and facility handling capacity. This estimate concerns recorded carcass weight, not a forecast of animals arriving.", minimum_change=1),
    dict(id="registered_cattle_price", domain="auction", target="CATTLE", unit="PHP_PER_HEAD", transfer_source="REGISTERED", label="Registered cattle price per head", category="PRICE", owner="MAO / Auction staff", action="Monitor upcoming recorded cattle prices and share the estimate with its uncertainty for planning. It is not a guaranteed price or advice to buy or sell; weekly averages can change with the cattle sold.", minimum_change=0),
    dict(id="external_cattle_price", domain="auction", target="CATTLE", unit="PHP_PER_HEAD", transfer_source="EXTERNAL", label="External cattle price per head", category="PRICE", owner="MAO / Auction staff", action="Monitor recorded external-market cattle prices and explain the uncertainty when discussing market conditions. The average is not adjusted for animal traits and is not a guaranteed sale price.", minimum_change=0),
]


def _number(value):
    try:
        value = float(value)
        return value if isfinite(value) and value >= 0 else None
    except (TypeError, ValueError):
        return None


def forecast_recommendations(user):
    # Scope is part of the key: cached evidence is never shared across users or
    # retained after a user's authorized barangay set or role changes.
    scope = ",".join(str(pk) for pk in scope_reviewer_queryset(Barangay.objects.all(), user).order_by("pk").values_list("pk", flat=True))
    cache_key = f"prescriptive-planning-v1:{user.pk}:{role_name(user)}:{scope}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached
    recommendations, readiness = [], {}
    for target in TARGETS:
        horizon = 6 if target["domain"] == "auction" else 3
        frequency = "week" if target["domain"] == "auction" else "month"
        try:
            diagnostic = get_forecast_readiness_diagnostics(
                domain=target["domain"], target=target["target"], unit=target["unit"],
                user=user, horizon_months=horizon, transfer_source=target.get("transfer_source"),
            )
        except Exception:
            diagnostic = {"forecast_available": False, "blocker_summary": "This estimate could not be evaluated. Try refreshing the predictive page.", "next_step": "Review the predictive page before making a planning decision."}
        output = diagnostic.get("forecast") or {}
        points = output.get("forecast_points") or []
        future = [_number(point.get("predicted")) for point in points]
        future = [value for value in future if value is not None]
        available = bool(diagnostic.get("forecast_available") and future)
        validation = diagnostic.get("validation_status", "NOT_YET_VALIDATED")
        readiness[target["id"]] = {"available": available, "validation_status": validation}
        common = {
            "responsible_role": target["owner"], "target_id": target["id"],
            "action_link": "/analysis/predictive", "source": "forecast",
        }
        if not available:
            recommendations.append({
                **common, "rule": f"READINESS_{target['id'].upper()}", "category_key": "DATA_QUALITY",
                "category": "Forecast readiness", "severity": "LOW",
                "title": f"Prepare records for {target['label'].lower()}",
                "reason": diagnostic.get("blocker_summary") or diagnostic.get("readiness_details") or "A usable future estimate is not available.",
                "evidence": {"target": target["label"], "estimate_available": "No", "validation": validation},
                "recommendation": diagnostic.get("next_step") or "Review missing dates, approvals, and required reporting coverage on the predictive page. Do not fill unknown periods with invented zero counts.",
                "action_type": "REVIEW_FORECAST_READINESS",
            })
            continue
        history = [point for point in output.get("chart_data", []) if not point.get("is_future") and _number(point.get("actual")) is not None]
        history.sort(key=lambda point: point.get("date") or "")
        recent = history[-(8 if frequency == "week" else 3):]
        if not recent:
            recommendations.append({**common, "rule": f"BASELINE_{target['id'].upper()}", "category_key": "DATA_QUALITY", "category": "Forecast readiness", "severity": "LOW", "title": f"Check the comparison for {target['label'].lower()}", "reason": "The estimate is available but its recent observed baseline is missing.", "evidence": {"target": target["label"]}, "recommendation": "Review the predictive chart before drawing a direction or workload conclusion.", "action_type": "REVIEW_FORECAST_READINESS"})
            continue
        baseline = mean(float(point["actual"]) for point in recent)
        projection = mean(future)
        difference = projection - baseline
        change = difference / baseline * 100 if baseline > 0 else None
        metadata = output.get("metadata") or {}
        demo = bool(metadata.get("is_seeded"))
        evidence = {
            "target": target["label"], "unit": target["unit"],
            "recent_period_average": round(baseline, 2), "estimated_period_average": round(projection, 2),
            "average_difference": round(difference, 2), "change_percent": round(change, 2) if change is not None else "Not defined: baseline is zero",
            "baseline_periods": len(recent), "forecast_periods": len(future), "period_unit": frequency,
            "baseline_start": recent[0].get("date") or "Not recorded", "baseline_end": recent[-1].get("date") or "Not recorded",
            "forecast_start": points[0].get("date") or "Not recorded", "forecast_end": points[-1].get("date") or "Not recorded",
            "model": output.get("model_name") or "Not recorded", "validation": validation,
            "threshold": (
                "At least 10% price change in either direction (administrative trigger)"
                if target["category"] == "PRICE" else
                f"Increase of at least 10% and {target['minimum_change']} {target['unit']} per period; when baseline is zero, use the absolute increase only (administrative trigger)"
            ),
            "data_source": "Synthetic demonstration" if demo else "Eligible recorded history",
        }
        caution = (" Demonstration data only; do not use this as evidence for actual staffing or animal-health decisions." if demo else "")
        caution += " Predictive accuracy has not been sufficiently validated; use this only as a tentative planning signal." if validation != "VALIDATED" else " Past model checks do not guarantee future results."
        # Prices can warrant monitoring in either direction; workload rules use
        # increases only. A zero baseline uses the stated absolute threshold.
        triggered = (
            change is not None and abs(change) >= 10 if target["category"] == "PRICE" else
            difference >= target["minimum_change"] and (change is None or change >= 10)
        )
        title = f"Monitor {target['label'].lower()}" if target["category"] == "PRICE" else f"Plan follow-up for {target['label'].lower()}"
        if not triggered:
            title = f"Continue routine monitoring: {target['label'].lower()}"
        recommendations.append({
            **common, "rule": f"FORECAST_{target['id'].upper()}", "category_key": target["category"],
            "category": {"DISEASE": "Disease follow-up", "MORTALITY": "Mortality follow-up", "AUCTION": "Auction workload", "SLAUGHTER": "Slaughter planning", "PRICE": "Cattle-price monitoring"}[target["category"]],
            "severity": "MEDIUM" if triggered and validation == "VALIDATED" and not demo else "LOW",
            "title": title,
            "reason": f"The average estimate for the next {len(future)} {frequency}s is {projection:,.2f} {target['unit']}, compared with {baseline:,.2f} in the latest {len(recent)} recorded {frequency}s." + caution,
            "evidence": evidence,
            "recommendation": (target["action"] if triggered else "Continue routine record review and monitor the next updates. The administrative change threshold was not reached; this does not establish normal health conditions or market stability.") + caution,
            "action_type": "REVIEW_PLANNING" if triggered else "ROUTINE_MONITORING",
        })
    result = (recommendations, readiness)
    cache.set(cache_key, result, timeout=300)
    return result

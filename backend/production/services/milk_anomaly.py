"""Cow-specific milk anomaly detection and conditional review-routing service.

Assesses an individual cow's submitted milk ProductionRecord against that same
cow's approved historical milk production records using a transparent,
rule-based rolling baseline (median, mean, MAD, standard deviation, and
percentage/absolute deviation), and attaches advisory 7-day forecast context
when date-aligned and ready.

An anomaly is a review signal for CBAT field verification, never automatic
rejection or proof of inaccurate reporting.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from math import sqrt
from statistics import mean, median
from typing import Any

from django.db.models import Sum
from django.utils import timezone

from analytics.services.predictive.livestock_milk import forecast_livestock_milk

DETECTOR_VERSION = "milk-rule-v1.0"

DEFAULT_MILK_ANOMALY_THRESHOLDS: dict[str, float | int] = {
    "min_history_days": 5,
    "rolling_window_days": 14,
    "max_history_gap_days": 45,
    "spike_pct_threshold": 35.0,
    "decline_pct_threshold": 35.0,
    "min_abs_liter_delta": 2.0,
    "extreme_pct_threshold": 60.0,
    "extreme_min_abs_liter_delta": 1.0,
    "z_score_threshold": 3.0,
    "min_rel_pct_for_z": 20.0,
    "high_severity_pct_threshold": 60.0,
    "high_severity_z_threshold": 4.5,
}


def _population_std(values: list[float]) -> float:
    if len(values) <= 1:
        return 0.0
    avg = mean(values)
    variance = sum((val - avg) ** 2 for val in values) / len(values)
    return sqrt(max(variance, 0.0))


def _median_absolute_deviation(values: list[float], center: float) -> float:
    if not values:
        return 0.0
    return float(median([abs(val - center) for val in values]))


def _extract_prior_history(prev_assessment: dict[str, Any] | None) -> list[dict[str, Any]]:
    """Preserve prior assessment snapshots when a farmer edits/resubmits a record."""
    if not isinstance(prev_assessment, dict):
        return []
    prior_entries = list(prev_assessment.get("history") or [])
    snapshot = {k: v for k, v in prev_assessment.items() if k != "history"}
    if snapshot.get("assessment_status"):
        prior_entries.append(snapshot)
    return prior_entries[-10:]


def _build_forecast_comparison(
    *,
    livestock: Any,
    submitted_date: date,
    submitted_qty: float,
    exclude_record_id: int | None = None,
) -> dict[str, Any]:
    """Evaluate the existing 7-day cow milk forecast without altering its model or rules.

    Rules enforced:
    - Never include pending or unapproved records in training history.
    - Never compare a past or current record_date against a mismatched future forecast date.
    - Include forecast comparison only when the forecast is READY and has an exact date match.
    """
    from production.models import CalvingRecord, ProductionRecord

    if livestock is None or getattr(livestock, "pk", None) is None:
        return {
            "available": False,
            "status": "UNAVAILABLE",
            "reason": "Forecast comparison requires an individual livestock record.",
            "forecast_date": None,
            "expected_liters": None,
            "deviation_liters": None,
            "deviation_pct": None,
            "model_used": None,
        }

    approved_qs = ProductionRecord.objects.filter(
        livestock_id=livestock.pk,
        production_type=ProductionRecord.ProductionType.MILK,
        status=ProductionRecord.ProductionStatus.APPROVED,
        record_date__lt=submitted_date,
    )
    if exclude_record_id is not None:
        approved_qs = approved_qs.exclude(pk=exclude_record_id)

    raw_daily = list(
        approved_qs.values("record_date")
        .annotate(total_liters=Sum("quantity"))
        .order_by("record_date")
    )
    daily_records = [
        {"date": row["record_date"], "milk_liters": float(row["total_liters"])}
        for row in raw_daily
    ]
    raw_calvings = list(
        CalvingRecord.objects.filter(
            dam_id=livestock.pk,
            status=CalvingRecord.StatusType.APPROVED,
        )
        .values("calving_date", "reviewed_at", "created_at")
        .order_by("calving_date")
    )
    calving_events = [
        (
            row["calving_date"],
            (row["reviewed_at"] or row["created_at"]).date()
            if (row["reviewed_at"] or row["created_at"])
            else row["calving_date"],
        )
        for row in raw_calvings
    ]

    try:
        forecast_result = forecast_livestock_milk(
            livestock=livestock,
            daily_records=daily_records,
            calving_events=calving_events,
            weather_rows=None,
            weather_message="Forecast context evaluated during milk anomaly assessment.",
        )
    except Exception:
        return {
            "available": False,
            "status": "UNAVAILABLE",
            "reason": "7-day milk forecast service could not be evaluated for this submission.",
            "forecast_date": None,
            "expected_liters": None,
            "deviation_liters": None,
            "deviation_pct": None,
            "model_used": None,
        }

    if forecast_result.get("status") != "READY":
        return {
            "available": False,
            "status": "NOT_READY",
            "reason": (
                forecast_result.get("reason")
                or "7-day milk forecast is not ready for this cow (requires at least 60 recent approved daily records)."
            ),
            "forecast_date": None,
            "expected_liters": None,
            "deviation_liters": None,
            "deviation_pct": None,
            "model_used": None,
        }

    forecast_points = forecast_result.get("forecast") or []
    submitted_iso = submitted_date.isoformat()
    matched_point = next(
        (pt for pt in forecast_points if pt.get("date") == submitted_iso),
        None,
    )
    raw_selected = forecast_result.get("selected_model")
    selected_model_name = (
        raw_selected.get("name")
        if isinstance(raw_selected, dict)
        else str(raw_selected) if raw_selected else None
    )

    if matched_point is None:
        horizon_start = forecast_points[0]["date"] if forecast_points else "N/A"
        horizon_end = forecast_points[-1]["date"] if forecast_points else "N/A"
        return {
            "available": False,
            "status": "DATE_NOT_IN_HORIZON",
            "reason": (
                f"Submitted record date ({submitted_iso}) does not match the 7-day forecast "
                f"horizon ({horizon_start} to {horizon_end}); forecast comparison is omitted "
                f"to avoid comparing against a different date."
            ),
            "forecast_date": None,
            "expected_liters": None,
            "deviation_liters": None,
            "deviation_pct": None,
            "model_used": selected_model_name,
        }

    expected_liters = float(matched_point["expected_liters"])
    deviation_liters = round(submitted_qty - expected_liters, 2)
    deviation_pct = (
        round(((submitted_qty - expected_liters) / expected_liters) * 100.0, 2)
        if expected_liters > 0
        else None
    )
    return {
        "available": True,
        "status": "MATCHED",
        "reason": (
            f"7-day statistical forecast context for {submitted_iso} estimates "
            f"{expected_liters:.2f} L (advisory reference only, not a guaranteed biological yield)."
        ),
        "forecast_date": submitted_iso,
        "expected_liters": round(expected_liters, 2),
        "deviation_liters": deviation_liters,
        "deviation_pct": deviation_pct,
        "model_used": selected_model_name,
    }


def assess_milk_production_record(
    *,
    livestock: Any,
    production_type: str,
    quantity: Decimal | float | int,
    unit: str,
    record_date: date,
    exclude_record_id: int | None = None,
    previous_assessment: dict[str, Any] | None = None,
    thresholds: dict[str, float | int] | None = None,
) -> dict[str, Any]:
    """Assess an individual cow's milk production submission against approved history."""
    from production.models import ProductionRecord

    cfg = {**DEFAULT_MILK_ANOMALY_THRESHOLDS, **(thresholds or {})}
    submitted_qty = float(quantity)
    assessed_at = timezone.now().isoformat()
    history_trail = _extract_prior_history(previous_assessment)
    norm_type = (production_type or "").upper()

    if norm_type != ProductionRecord.ProductionType.MILK or livestock is None or getattr(livestock, "pk", None) is None:
        return {
            "assessment_status": "NOT_APPLICABLE",
            "sufficient_history": False,
            "anomaly_detected": False,
            "requires_cbat_verification": False,
            "next_review_queue": "SIBAT",
            "reason": "Milk anomaly detection applies only to individual-animal milk production records.",
            "severity": "NONE",
            "anomaly_direction": "NONE",
            "submitted_quantity": round(submitted_qty, 2),
            "unit": unit,
            "record_date": record_date.isoformat() if isinstance(record_date, date) else str(record_date),
            "historical_baseline": None,
            "deviation": None,
            "forecast_comparison": {
                "available": False,
                "status": "UNAVAILABLE",
                "reason": "Not an individual milk production record.",
                "forecast_date": None,
                "expected_liters": None,
                "deviation_liters": None,
                "deviation_pct": None,
                "model_used": None,
            },
            "detector_version": DETECTOR_VERSION,
            "thresholds": cfg,
            "assessed_at": assessed_at,
            "history": history_trail,
        }

    tag_label = getattr(livestock, "tag_number", None) or f"Animal #{livestock.pk}"

    approved_qs = ProductionRecord.objects.filter(
        livestock_id=livestock.pk,
        production_type=ProductionRecord.ProductionType.MILK,
        status=ProductionRecord.ProductionStatus.APPROVED,
        record_date__lt=record_date,
    )
    if exclude_record_id is not None:
        approved_qs = approved_qs.exclude(pk=exclude_record_id)

    prior_daily_rows = list(
        approved_qs.values("record_date")
        .annotate(total_liters=Sum("quantity"))
        .order_by("record_date")
    )

    forecast_comparison = _build_forecast_comparison(
        livestock=livestock,
        submitted_date=record_date,
        submitted_qty=submitted_qty,
        exclude_record_id=exclude_record_id,
    )

    min_days = int(cfg["min_history_days"])
    rolling_window = int(cfg["rolling_window_days"])
    max_gap_days = int(cfg["max_history_gap_days"])

    if len(prior_daily_rows) < min_days:
        latest_date_iso = (
            prior_daily_rows[-1]["record_date"].isoformat() if prior_daily_rows else None
        )
        return {
            "assessment_status": "INSUFFICIENT_HISTORY",
            "sufficient_history": False,
            "anomaly_detected": False,
            "requires_cbat_verification": False,
            "next_review_queue": "SIBAT",
            "reason": (
                f"Insufficient approved milk history for {tag_label} to establish a reliable "
                f"cow-specific baseline ({len(prior_daily_rows)} of {min_days} required approved "
                f"daily observations prior to {record_date.isoformat()}). Standard field verification applies."
            ),
            "severity": "NONE",
            "anomaly_direction": "NONE",
            "submitted_quantity": round(submitted_qty, 2),
            "unit": unit,
            "record_date": record_date.isoformat(),
            "historical_baseline": {
                "history_days_count": len(prior_daily_rows),
                "window_days_used": len(prior_daily_rows),
                "baseline_median_liters": None,
                "baseline_mean_liters": None,
                "mad_liters": None,
                "std_liters": None,
                "min_liters": None,
                "max_liters": None,
                "latest_approved_date": latest_date_iso,
            },
            "deviation": None,
            "forecast_comparison": forecast_comparison,
            "detector_version": DETECTOR_VERSION,
            "thresholds": cfg,
            "assessed_at": assessed_at,
            "history": history_trail,
        }

    latest_approved_date: date = prior_daily_rows[-1]["record_date"]
    gap_days = (record_date - latest_approved_date).days
    if gap_days > max_gap_days:
        return {
            "assessment_status": "INSUFFICIENT_HISTORY",
            "sufficient_history": False,
            "anomaly_detected": False,
            "requires_cbat_verification": False,
            "next_review_queue": "SIBAT",
            "reason": (
                f"Approved milk history for {tag_label} is not recent enough for automated "
                f"baseline comparison (latest approved record was {gap_days} days before "
                f"{record_date.isoformat()}, exceeding the {max_gap_days}-day recency limit). "
                f"Standard field verification applies."
            ),
            "severity": "NONE",
            "anomaly_direction": "NONE",
            "submitted_quantity": round(submitted_qty, 2),
            "unit": unit,
            "record_date": record_date.isoformat(),
            "historical_baseline": {
                "history_days_count": len(prior_daily_rows),
                "window_days_used": 0,
                "baseline_median_liters": None,
                "baseline_mean_liters": None,
                "mad_liters": None,
                "std_liters": None,
                "min_liters": None,
                "max_liters": None,
                "latest_approved_date": latest_approved_date.isoformat(),
            },
            "deviation": None,
            "forecast_comparison": forecast_comparison,
            "detector_version": DETECTOR_VERSION,
            "thresholds": cfg,
            "assessed_at": assessed_at,
            "history": history_trail,
        }

    window_rows = prior_daily_rows[-rolling_window:]
    window_values = [float(row["total_liters"]) for row in window_rows if float(row["total_liters"]) > 0]

    if len(window_values) < min_days:
        return {
            "assessment_status": "INSUFFICIENT_HISTORY",
            "sufficient_history": False,
            "anomaly_detected": False,
            "requires_cbat_verification": False,
            "next_review_queue": "SIBAT",
            "reason": (
                f"Insufficient positive approved milk observations for {tag_label} to compute "
                f"a non-zero baseline. Standard field verification applies."
            ),
            "severity": "NONE",
            "anomaly_direction": "NONE",
            "submitted_quantity": round(submitted_qty, 2),
            "unit": unit,
            "record_date": record_date.isoformat(),
            "historical_baseline": {
                "history_days_count": len(prior_daily_rows),
                "window_days_used": len(window_values),
                "baseline_median_liters": None,
                "baseline_mean_liters": None,
                "mad_liters": None,
                "std_liters": None,
                "min_liters": None,
                "max_liters": None,
                "latest_approved_date": latest_approved_date.isoformat(),
            },
            "deviation": None,
            "forecast_comparison": forecast_comparison,
            "detector_version": DETECTOR_VERSION,
            "thresholds": cfg,
            "assessed_at": assessed_at,
            "history": history_trail,
        }

    baseline_median = float(median(window_values))
    baseline_mean = float(mean(window_values))
    mad_val = _median_absolute_deviation(window_values, baseline_median)
    std_val = _population_std(window_values)

    # Guard low-variance or constant history so zero MAD/std never divides by zero
    # or flags tiny biological day-to-day variations.
    robust_sigma = 1.4826 * mad_val
    effective_sigma = max(robust_sigma, std_val, baseline_median * 0.05, 0.5)

    abs_diff = submitted_qty - baseline_median
    abs_delta = abs(abs_diff)
    pct_change = (abs_diff / baseline_median) * 100.0 if baseline_median > 0 else 0.0
    abs_pct = abs(pct_change)
    robust_z = abs_diff / effective_sigma

    spike_pct_threshold = float(cfg["spike_pct_threshold"])
    decline_pct_threshold = float(cfg["decline_pct_threshold"])
    min_abs_delta = float(cfg["min_abs_liter_delta"])
    extreme_pct_threshold = float(cfg["extreme_pct_threshold"])
    extreme_min_abs_delta = float(cfg["extreme_min_abs_liter_delta"])
    z_threshold = float(cfg["z_score_threshold"])
    min_rel_pct_for_z = float(cfg["min_rel_pct_for_z"])

    is_spike = (
        abs_diff > 0
        and (
            (pct_change >= spike_pct_threshold and abs_delta >= min_abs_delta)
            or (pct_change >= extreme_pct_threshold and abs_delta >= extreme_min_abs_delta)
            or (robust_z >= z_threshold and pct_change >= min_rel_pct_for_z and abs_delta >= min_abs_delta)
        )
    )
    is_decline = (
        abs_diff < 0
        and (
            (abs_pct >= decline_pct_threshold and abs_delta >= min_abs_delta)
            or (abs_pct >= extreme_pct_threshold and abs_delta >= extreme_min_abs_delta)
            or (abs(robust_z) >= z_threshold and abs_pct >= min_rel_pct_for_z and abs_delta >= min_abs_delta)
        )
    )

    anomaly_detected = bool(is_spike or is_decline)

    historical_baseline = {
        "history_days_count": len(prior_daily_rows),
        "window_days_used": len(window_values),
        "baseline_median_liters": round(baseline_median, 2),
        "baseline_mean_liters": round(baseline_mean, 2),
        "mad_liters": round(mad_val, 2),
        "std_liters": round(std_val, 2),
        "min_liters": round(min(window_values), 2),
        "max_liters": round(max(window_values), 2),
        "latest_approved_date": latest_approved_date.isoformat(),
        "recent_observations": [
            {
                "record_date": row["record_date"].isoformat(),
                "quantity_liters": round(float(row["total_liters"]), 2),
            }
            for row in window_rows[-7:]
        ],
    }
    deviation_info = {
        "absolute_liters": round(abs_diff, 2),
        "percentage_change": round(pct_change, 2),
        "robust_z_score": round(robust_z, 2),
    }

    if anomaly_detected:
        direction = "SPIKE" if is_spike else "DECLINE"
        is_high_severity = (
            abs_pct >= float(cfg["high_severity_pct_threshold"])
            or abs(robust_z) >= float(cfg["high_severity_z_threshold"])
        )
        severity = "HIGH" if is_high_severity else "MODERATE"
        sign_str = f"+{abs_diff:.2f}" if abs_diff >= 0 else f"{abs_diff:.2f}"
        pct_str = f"+{pct_change:.1f}%" if pct_change >= 0 else f"{pct_change:.1f}%"
        direction_word = "above" if is_spike else "below"
        context_note = (
            "confirm whether this increase reflects a lactation peak, milking schedule change, or encoding error"
            if is_spike
            else "check animal health, lactation stage, or recording accuracy"
        )
        reason = (
            f"Reported milk yield of {submitted_qty:.2f} L on {record_date.isoformat()} for {tag_label} "
            f"is {abs_pct:.1f}% ({sign_str} L, {pct_str}) {direction_word} this cow's approved rolling median "
            f"baseline of {baseline_median:.2f} L/day (mean {baseline_mean:.2f} L/day across "
            f"{len(window_values)} recent approved days). Routed to CBAT field verification to {context_note}."
        )
        return {
            "assessment_status": "ANOMALY_DETECTED",
            "sufficient_history": True,
            "anomaly_detected": True,
            "requires_cbat_verification": True,
            "next_review_queue": "CBAT",
            "reason": reason,
            "severity": severity,
            "anomaly_direction": direction,
            "submitted_quantity": round(submitted_qty, 2),
            "unit": unit,
            "record_date": record_date.isoformat(),
            "historical_baseline": historical_baseline,
            "deviation": deviation_info,
            "forecast_comparison": forecast_comparison,
            "detector_version": DETECTOR_VERSION,
            "thresholds": cfg,
            "assessed_at": assessed_at,
            "history": history_trail,
        }

    sign_str = f"+{abs_diff:.2f}" if abs_diff >= 0 else f"{abs_diff:.2f}"
    pct_str = f"+{pct_change:.1f}%" if pct_change >= 0 else f"{pct_change:.1f}%"
    reason = (
        f"Reported milk yield of {submitted_qty:.2f} L on {record_date.isoformat()} for {tag_label} "
        f"is consistent with this cow's approved rolling median baseline of {baseline_median:.2f} L/day "
        f"({sign_str} L, {pct_str} across {len(window_values)} recent approved days). "
        f"No anomaly detected; routed directly to the MAO approval queue."
    )
    return {
        "assessment_status": "CLEAN",
        "sufficient_history": True,
        "anomaly_detected": False,
        "requires_cbat_verification": False,
        "next_review_queue": "MAO",
        "reason": reason,
        "severity": "NONE",
        "anomaly_direction": "NONE",
        "submitted_quantity": round(submitted_qty, 2),
        "unit": unit,
        "record_date": record_date.isoformat(),
        "historical_baseline": historical_baseline,
        "deviation": deviation_info,
        "forecast_comparison": forecast_comparison,
        "detector_version": DETECTOR_VERSION,
        "thresholds": cfg,
        "assessed_at": assessed_at,
        "history": history_trail,
    }


def apply_milk_anomaly_assessment(
    record: Any,
    *,
    previous_assessment: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Run anomaly assessment and populate fields on a ProductionRecord instance."""
    assessment = assess_milk_production_record(
        livestock=getattr(record, "livestock", None),
        production_type=getattr(record, "production_type", ""),
        quantity=getattr(record, "quantity", 0),
        unit=getattr(record, "unit", ""),
        record_date=getattr(record, "record_date", timezone.localdate()),
        exclude_record_id=getattr(record, "pk", None),
        previous_assessment=previous_assessment if previous_assessment is not None else getattr(record, "anomaly_assessment", None),
    )
    record.anomaly_assessment_status = assessment["assessment_status"]
    record.anomaly_detected = assessment["anomaly_detected"]
    record.requires_cbat_verification = assessment["requires_cbat_verification"]
    record.next_review_queue = assessment["next_review_queue"]
    record.anomaly_reason = assessment["reason"]
    record.anomaly_assessment = assessment
    return assessment

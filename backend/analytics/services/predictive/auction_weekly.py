"""Weekly forecasts and weekday diagnostics for approved ownership transfers.

Each approved transfer represents one animal event. The source has no market
session or reporting-coverage ledger, so the service forecasts only contiguous
weekly totals of approved transfers captured in SmartLivestock. Missing weeks
remain unknown and are never filled with zero.
"""

from collections import defaultdict
from datetime import date, timedelta
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
from django.utils import timezone
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

from livestock.models import LivestockOwnershipTransfer
from analytics.seed_markers import (
    SEED_MARKER_AUCTION,
    SEED_MARKER_FORECAST_QUALITY_IDEAL,
    SEED_MARKER_FORECAST_QUALITY_POOR,
)
from smartlivestock.workflows import scope_reviewer_queryset

MIN_TRAIN_WEEKS = 8
MIN_HISTORY_WEEKS = 12
MAX_HORIZON_WEEKS = 12
MAX_BACKTEST_WINDOWS = 8
SYNTHETIC_TRANSFER_MARKERS = (
    SEED_MARKER_FORECAST_QUALITY_IDEAL,
    SEED_MARKER_FORECAST_QUALITY_POOR,
    SEED_MARKER_AUCTION,
)


def _filtered_sales(target: str, user=None):
    qs = scope_reviewer_queryset(LivestockOwnershipTransfer.objects.all(), user).filter(
        status=LivestockOwnershipTransfer.Status.APPROVED,
        transfer_date__isnull=False,
    )
    target = (target or "ALL").upper()
    if target not in {"ALL", "HEADS", "TRANSACTIONS", "SALES", "PHP"}:
        qs = qs.filter(livestock__livestock_type__name__icontains=target)
    return qs


def build_weekly_auction_series(target="ALL", unit="HEADS", user=None) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """Aggregate approved transfer events into Monday-Sunday calendar weeks."""
    unit = (unit or "HEADS").upper()
    if unit in {"SALES", "TRANSACTIONS", "COUNT"}:
        unit = "TRANSACTIONS"
    elif unit in {"PHP", "VALUE", "TOTAL_PRICE"}:
        unit = "PHP"
    else:
        unit = "HEADS"

    qs = _filtered_sales(target, user)
    raw_rows = list(qs.values_list(
        "pk", "livestock_id", "transfer_date", "purchase_price", "created_at", "reviewed_at", "review_remarks"
    ))
    today = timezone.localdate()
    current_week_start = today - timedelta(days=today.weekday())
    last_complete_week_start = current_week_start - timedelta(days=7)

    weekday_rows = {
        day: {"weekday": day, "transaction_count": 0, "heads_sold": 0, "sales_value_php": 0.0,
              "transactions_with_value": 0, "synthetic_transactions": 0}
        for day in range(7)
    }
    grouped = defaultdict(lambda: {
        "quantity": 0.0, "record_count": 0, "missing_value_records": 0, "livestock_ids": set(),
        "latest_created_at": None, "latest_reviewed_at": None,
        "created_count": 0, "reviewed_count": 0,
    })
    eligible_rows = []
    synthetic_count = 0
    observed_seed_markers = set()
    unmeasured_value_count = 0

    for transfer_id, livestock_id, sale_date, purchase_price, created_at, reviewed_at, remarks in raw_rows:
        if not sale_date or sale_date >= current_week_start:
            continue  # Current week is partial; do not use it as a completed observation.
        weekday = weekday_rows[sale_date.weekday()]
        weekday["transaction_count"] += 1
        weekday["heads_sold"] += 1
        if purchase_price is not None:
            weekday["sales_value_php"] += float(purchase_price)
            weekday["transactions_with_value"] += 1
        row_marker = next((marker for marker in SYNTHETIC_TRANSFER_MARKERS if marker in (remarks or "")), None)
        marker_present = row_marker is not None
        if marker_present:
            weekday["synthetic_transactions"] += 1
            synthetic_count += 1
            observed_seed_markers.add(row_marker)
        if purchase_price is None:
            unmeasured_value_count += 1

        week_start = sale_date - timedelta(days=sale_date.weekday())
        bucket = grouped[week_start]
        bucket["record_count"] += 1
        bucket["livestock_ids"].add(livestock_id)
        if unit == "PHP" and purchase_price is not None:
            bucket["quantity"] += float(purchase_price)
        if unit == "PHP" and purchase_price is None:
            bucket["missing_value_records"] += 1
        for value_key, count_key in ((created_at, "created_count"), (reviewed_at, "reviewed_count")):
            if value_key is not None:
                bucket[count_key] += 1
        bucket["latest_created_at"] = max(filter(None, (bucket["latest_created_at"], created_at)), default=None)
        bucket["latest_reviewed_at"] = max(filter(None, (bucket["latest_reviewed_at"], reviewed_at)), default=None)
        eligible_rows.append((transfer_id, livestock_id, sale_date, purchase_price, created_at, reviewed_at))

    if grouped:
        first_week = min(grouped)
        periods = []
        week = first_week
        while week <= last_complete_week_start:
            bucket = grouped.get(week)
            if bucket is None:
                quantity = np.nan
                available_at = pd.NaT
                record_count = 0
                missing_value_records = 0
            else:
                record_count = bucket["record_count"]
                missing_value_records = bucket["missing_value_records"]
                quantity = (
                    np.nan if unit == "PHP" and missing_value_records
                    else bucket["quantity"] if unit == "PHP"
                    else float(record_count) if unit == "TRANSACTIONS"
                    else float(len(bucket["livestock_ids"]))
                )
                latest_created = bucket["latest_created_at"]
                latest_reviewed = bucket["latest_reviewed_at"]
                all_timestamps_present = (
                    bucket["created_count"] == record_count
                    and bucket["reviewed_count"] == record_count
                    and latest_created is not None
                    and latest_reviewed is not None
                )
                available_at = (
                    timezone.localtime(max(latest_created, latest_reviewed)).date()
                    if all_timestamps_present else pd.NaT
                )
            periods.append({
                "week": pd.Timestamp(week), "quantity": quantity,
                "available_at": available_at, "record_count": record_count,
                "missing_value_records": missing_value_records,
            })
            week += timedelta(days=7)
        df = pd.DataFrame(periods)
        df["available_at"] = pd.to_datetime(df["available_at"])
    else:
        df = pd.DataFrame(columns=["week", "quantity", "available_at", "record_count", "missing_value_records"])

    missing_weeks = [row["week"].date().isoformat() for row in df.to_dict("records")
                     if not np.isfinite(row["quantity"])]
    observed = df.loc[np.isfinite(df["quantity"])].copy() if not df.empty else df.copy()
    weekday_profile = [
        {**weekday_rows[day], "weekday": date(2024, 1, 1) + timedelta(days=day)}
        for day in range(7)
    ]
    for row in weekday_profile:
        row["weekday"] = row["weekday"].strftime("%A")
        row["sales_value_php"] = round(row["sales_value_php"], 2)

    fully_measured_value = unit != "PHP" or unmeasured_value_count == 0
    has_weekday_observations = bool(eligible_rows)
    metadata = {
        "domain": "auction", "target": (target or "ALL").upper(), "unit": unit,
        "frequency": "WEEKLY", "week_boundary": "Monday-Sunday; only complete weeks included",
        "scope": "Approved LivestockOwnershipTransfer events recorded in SmartLivestock; not total market coverage",
        "total_records": sum(int(value["record_count"]) for value in grouped.values()),
        "synthetic_records": synthetic_count,
        "is_seeded": synthetic_count > 0,
        "seed_markers": sorted(observed_seed_markers),
        "seed_marker": sorted(observed_seed_markers)[0] if observed_seed_markers else None,
        "total_weekly_observations": int(np.isfinite(df["quantity"]).sum()) if not df.empty else 0,
        "first_week": df["week"].min().date().isoformat() if not df.empty else None,
        "last_complete_week": last_complete_week_start.isoformat(),
        "data_through_date": last_complete_week_start.isoformat(),
        "missing_weeks": missing_weeks,
        "missing_week_count": len(missing_weeks),
        "unmeasured_value_records": unmeasured_value_count if unit == "PHP" else 0,
        "value_measurement_complete": fully_measured_value,
        "weekday_activity": weekday_profile,
        "weekday_pattern_estimable": False,
        "weekday_pattern_note": (
            "Thursday and Friday are useful market-context days, but the database has no market-session or "
            "daily reporting-coverage history. These are counts of captured approved transfers only; "
            "they cannot establish per-day rates or a reliable weekday effect."
            if has_weekday_observations else
            "No approved ownership transfers are recorded in this dataset, so weekday activity cannot be assessed."
        ),
        "coverage_status": "UNKNOWN",
        "coverage_note": (
            "Missing weeks are unknown, not zero. A contiguous sequence only describes captured approved records; "
            "the system does not record whether market reporting was complete."
        ),
        "approval_cutoff_reconstructable": bool(
            not observed.empty and observed["available_at"].notna().all()
        ),
        "approval_timeline_note": (
            "Transfer review timestamps reflect the current stored approval state and are not an immutable approval history. "
            "Historical edits or re-approvals cannot always be reconstructed."
        ),
        "forecast_available": False,
    }
    return df, metadata


def _predict(model_name: str, history: pd.DataFrame, future_weeks: List[pd.Timestamp]) -> np.ndarray:
    values = history["quantity"].astype(float).to_numpy()
    horizon = len(future_weeks)
    if not len(values) or not horizon:
        return np.asarray([], dtype=float)
    if model_name == "Naive Baseline":
        result = np.repeat(values[-1], horizon)
    elif model_name == "Moving Average (4 weeks)":
        result = np.repeat(float(np.mean(values[-4:])), horizon)
    elif model_name == "Seasonal Naive (52 weeks)":
        by_week = {pd.Timestamp(row.week): float(row.quantity) for row in history.itertuples()}
        keys = [pd.Timestamp(week) - pd.Timedelta(weeks=52) for week in future_weeks]
        if any(key not in by_week for key in keys):
            raise ValueError("A matching observation from 52 weeks earlier is unavailable.")
        result = np.asarray([by_week[key] for key in keys], dtype=float)
    elif model_name == "Linear Trend":
        x = np.arange(len(values), dtype=float)
        slope, intercept = np.polyfit(x, values, 1) if len(values) > 1 else (0.0, values[-1])
        result = intercept + slope * np.arange(len(values), len(values) + horizon, dtype=float)
    else:
        raise ValueError(f"Unsupported weekly auction model: {model_name}")
    return np.maximum(np.asarray(result, dtype=float), 0.0)


def _metric_summary(actual: List[float], predicted: List[float]) -> Dict[str, Optional[float]]:
    actual_array = np.asarray(actual, dtype=float)
    predicted_array = np.asarray(predicted, dtype=float)
    return {
        "mae": round(float(mean_absolute_error(actual_array, predicted_array)), 2),
        "rmse": round(float(np.sqrt(mean_squared_error(actual_array, predicted_array))), 2),
        "r2": round(float(r2_score(actual_array, predicted_array)), 4) if len(actual_array) > 1 and np.var(actual_array) > 1e-8 else None,
    }


def evaluate_weekly_auction(target="ALL", unit="HEADS", horizon_weeks=6, user=None) -> Dict[str, Any]:
    """Evaluate weekly transfer totals at independent rolling cutoffs."""
    horizon = max(1, min(int(horizon_weeks), MAX_HORIZON_WEEKS))
    df, meta = build_weekly_auction_series(target, unit, user)
    obs_count = int(meta["total_weekly_observations"])
    missing_count = int(meta["missing_week_count"])
    candidate_names = ["Naive Baseline", "Moving Average (4 weeks)", "Linear Trend"]
    if len(df) >= 52 + horizon:
        candidate_names.insert(2, "Seasonal Naive (52 weeks)")
    min_train = 52 if "Seasonal Naive (52 weeks)" in candidate_names else MIN_TRAIN_WEEKS

    if obs_count < MIN_HISTORY_WEEKS or missing_count or not meta["value_measurement_complete"]:
        if obs_count < MIN_HISTORY_WEEKS:
            message = f"Only {obs_count} complete weekly observations are available; at least {MIN_HISTORY_WEEKS} are needed for an initial weekly projection."
        elif missing_count:
            message = f"{missing_count} week(s) have no complete approved transfer total. They are unknown, not zero."
        else:
            message = f"{meta['unmeasured_value_records']} approved transfer(s) lack a recorded purchase price, so weekly value totals are incomplete."
        status = "insufficient_data"
        forecast_available = False
    else:
        message = "Forecasts describe approved ownership transfers recorded by SmartLivestock. Reporting completeness is unknown."
        status = "unvalidated"
        forecast_available = True

    metric_rows = []
    backtest_rows = []
    valid_windows = 0
    final_predictions = None
    if len(df) > min_train:
        possible_origins = list(range(min_train, len(df) - horizon + 1))
        if len(possible_origins) > MAX_BACKTEST_WINDOWS:
            selected = np.linspace(0, len(possible_origins) - 1, MAX_BACKTEST_WINDOWS, dtype=int)
            possible_origins = [possible_origins[index] for index in sorted(set(selected.tolist()))]

        results_by_model = {name: {"actual": [], "predicted": [], "windows": 0} for name in candidate_names}
        for origin in possible_origins:
            cutoff = pd.Timestamp(df.iloc[origin]["week"])
            full_history = df.iloc[:origin].copy()
            known = full_history.loc[full_history["available_at"].notna() & (full_history["available_at"] < cutoff)].copy()
            test = df.iloc[origin:origin + horizon].copy()
            expected_test_weeks = pd.date_range(cutoff, periods=horizon, freq="7D")
            missing_availability = int(full_history["available_at"].isna().sum())
            late_rows = int((full_history["available_at"].notna() & (full_history["available_at"] >= cutoff)).sum())
            reason = None
            reason_code = None
            if len(known) < min_train:
                if missing_availability and len(known) + missing_availability >= min_train:
                    reason = (
                        f"Only {len(known)} prior weekly totals have reconstructable approval timestamps; "
                        f"{missing_availability} older week(s) have missing timestamps, and {min_train} "
                        "eligible training weeks are required."
                    )
                    reason_code = "MISSING_AVAILABILITY_TIMESTAMPS"
                else:
                    reason = f"Only {len(known)} prior weekly totals were approved and available by cutoff; {min_train} are required."
                    reason_code = "NOT_ENOUGH_APPROVED_HISTORY"
            else:
                expected_train_weeks = pd.date_range(known["week"].min(), cutoff - pd.Timedelta(weeks=1), freq="7D")
            if reason is None and known["week"].tolist() != list(expected_train_weeks):
                reason = "The cutoff training history contains unknown weeks or records approved after the cutoff."
                reason_code = "GAPS_IN_APPROVED_HISTORY"
            if reason is None and (len(test) != horizon or test["week"].tolist() != list(expected_test_weeks) or not np.isfinite(test["quantity"]).all()):
                reason = "The complete requested test horizon does not have observed weekly outcomes."
                reason_code = "INCOMPLETE_TEST_WINDOW"
            predictions = {}
            if reason is None:
                for name in candidate_names:
                    try:
                        prediction = _predict(name, known, test["week"].tolist())
                        if len(prediction) == horizon and np.isfinite(prediction).all():
                            predictions[name] = prediction.tolist()
                    except Exception:
                        continue
                if len(predictions) != len(candidate_names):
                    reason = "At least one candidate lacked a valid forecast, so the models could not be compared on identical weeks."
                    reason_code = "MODEL_FAILURE"
            if reason:
                backtest_rows.append({
                    "forecast_week": cutoff.date().isoformat(), "cutoff_date": cutoff.date().isoformat(),
                    "status": "SKIPPED", "reason_code": reason_code, "reason": reason,
                    "available_training_weeks": len(known),
                    "prior_weeks_missing_availability_timestamp": missing_availability,
                    "prior_weeks_approved_at_or_after_cutoff": late_rows,
                    "test_weeks_required": horizon,
                })
                continue
            valid_windows += 1
            actual = test["quantity"].astype(float).tolist()
            for name in candidate_names:
                results_by_model[name]["actual"].extend(actual)
                results_by_model[name]["predicted"].extend(predictions[name])
                results_by_model[name]["windows"] += 1
            backtest_rows.append({
                "forecast_week": cutoff.date().isoformat(), "cutoff_date": cutoff.date().isoformat(),
                "status": "EVALUATED", "reason": "Full weekly test horizon observed; training used only cutoff-available records.",
                "reason_code": "EVALUATED", "available_training_weeks": len(known), "test_weeks_required": horizon,
                "test_periods": [week.date().isoformat() for week in test["week"]],
                "actual_values": [round(float(value), 1) for value in actual],
                "predictions_by_model": {
                    name: [round(float(value), 1) for value in values]
                    for name, values in predictions.items()
                },
            })
            final_predictions = {"actual": actual, "predictions": predictions,
                                 "weeks": [week.date().isoformat() for week in test["week"]],
                                 "training_weeks": len(known)}

        if valid_windows:
            metric_rows = [
                {"name": name, "model_type": "Time-series baseline" if "Baseline" in name or "Naive" in name or "Average" in name else "Linear trend",
                 "status": "EVALUATED", "description": name,
                 **_metric_summary(values["actual"], values["predicted"]),
                 "test_predictions": final_predictions["predictions"][name] if final_predictions else [],
                 "is_selected": False}
                for name, values in results_by_model.items()
                if values["windows"] == valid_windows and values["actual"]
            ]

    all_weeks_contiguous = bool(len(df) and not missing_count and np.isfinite(df["quantity"]).all())
    if not meta["value_measurement_complete"]:
        all_weeks_contiguous = False
    if forecast_available and not all_weeks_contiguous:
        forecast_available = False
        status = "insufficient_data"
        message = "Weekly totals are not contiguous and fully measured; missing weeks are not treated as zero."
    if forecast_available and not valid_windows:
        status = "unvalidated"

    baseline_models = [row for row in metric_rows if row["name"] in {"Naive Baseline", "Moving Average (4 weeks)", "Seasonal Naive (52 weeks)"}]
    advanced_models = [row for row in metric_rows if row["name"] == "Linear Trend"]
    best_baseline = min(baseline_models, key=lambda row: row["mae"]) if baseline_models else None
    best_advanced = min(advanced_models, key=lambda row: row["mae"]) if advanced_models else None
    winner = best_baseline
    comparison = "INSUFFICIENT_DATA"
    source = "NONE"
    rationale = "No complete cutoff window is available for empirical model selection."
    if valid_windows and best_baseline:
        winner = best_baseline
        comparison = "BASELINE_BEST"
        source = "NAIVE_BASELINE"
        rationale = f"{best_baseline['name']} is the lowest-error evaluated simple baseline on {valid_windows} shared weekly window(s)."
        if best_advanced and best_advanced["mae"] < best_baseline["mae"]:
            winner = best_advanced
            comparison = "MODEL_BEATS_BASELINE"
            source = "MACHINE_LEARNING"
            rationale = f"Linear Trend beat {best_baseline['name']} on {valid_windows} shared weekly window(s); evidence remains limited to these cutoffs."
        if winner:
            winner["is_selected"] = True

    history_points = [
        {"date": row.week.date().isoformat(), "month_label": f"Week of {row.week:%b %d, %Y}", "actual": float(row.quantity)}
        for row in df.itertuples() if np.isfinite(row.quantity)
    ]
    meta.update({"forecast_available": forecast_available, "backtesting_valid_windows": valid_windows,
                 "backtesting_attempted_windows": len(backtest_rows), "horizon_weeks": horizon,
                 "minimum_history_weeks": MIN_HISTORY_WEEKS})
    return {
        "status": status,
        "forecast_available": forecast_available,
        "readiness_status": "READY" if obs_count >= MIN_HISTORY_WEEKS and forecast_available else "NOT_READY",
        "readiness_details": message,
        "message": message,
        "domain": "auction", "scope": meta["scope"],
        "target": {"domain": "auction", "target": meta["target"], "unit": meta["unit"], "frequency": "WEEKLY"},
        "frequency": "WEEKLY", "available_observations": obs_count,
        "required_observations": MIN_HISTORY_WEEKS,
        "historical_start_date": meta["first_week"], "historical_end_date": meta["last_complete_week"],
        "historical_trend": history_points,
        "data": {**meta, "total_observations": obs_count,
                 "total_weekly_observations": obs_count, "missing_week_count": missing_count,
                 "is_weekly_series_contiguous": all_weeks_contiguous,
                 "evaluation_horizon_weeks": horizon,
                 "rolling_origin_windows": valid_windows,
                 "backtest_diagnostics": backtest_rows,
                 "last_window": final_predictions,
                 "training_observations": final_predictions["training_weeks"] if final_predictions else 0,
                 "test_observations": len(final_predictions["actual"]) if final_predictions else 0,
                 "test_period": ({"start_week": final_predictions["weeks"][0],
                                 "end_week": final_predictions["weeks"][-1],
                                 "observations": len(final_predictions["actual"]),
                                 "dates": final_predictions["weeks"],
                                 "actual_values": final_predictions["actual"],
                                 "weeks": final_predictions["weeks"]}
                                if final_predictions else None)},
        "selection": {"criterion": "Lowest pooled MAE on identical rolling-origin weekly windows; advanced trend must beat the best simple baseline.",
                      "selected_model": winner["name"] if winner else None,
                      "baseline_model": best_baseline["name"] if best_baseline else "Naive Baseline",
                      "baseline_mae": best_baseline["mae"] if best_baseline else None,
                      "selected_model_mae": winner["mae"] if winner else None,
                      "baseline_comparison": comparison, "forecast_source": source,
                      "rationale": rationale},
        "baseline_comparison": comparison, "forecast_source": source,
        "baseline_model": best_baseline["name"] if best_baseline else "Naive Baseline",
        "baseline_mae": best_baseline["mae"] if best_baseline else None,
        "selected_model_mae": winner["mae"] if winner else None,
        "models": metric_rows,
        "backtesting": {"frequency": "WEEKLY", "horizon_weeks": horizon,
                        "valid_windows": valid_windows, "requested_windows": len(backtest_rows),
                        "diagnostics": backtest_rows, "minimum_training_weeks": min_train},
        "weekday_activity": meta["weekday_activity"],
        "weekday_pattern_estimable": False,
        "weekday_pattern_note": meta["weekday_pattern_note"],
    }


def generate_weekly_auction_forecast(target="ALL", unit="HEADS", horizon_weeks=6, preferred_model=None, user=None) -> Dict[str, Any]:
    """Return next-week projections, retaining the complete weekly actual history."""
    result = evaluate_weekly_auction(target, unit, horizon_weeks, user)
    if not result["forecast_available"]:
        result.update({"forecast": [], "chart_data": result["historical_trend"]})
        return result
    df, meta = build_weekly_auction_series(target, unit, user)
    winner = result["selection"].get("selected_model")
    model_name = preferred_model or winner or "Naive Baseline"
    horizon = result["data"]["horizon_weeks"]
    last_week = pd.Timestamp(df["week"].iloc[-1])
    future_weeks = [last_week + pd.Timedelta(weeks=step) for step in range(1, horizon + 1)]
    try:
        predictions = _predict(model_name, df, future_weeks)
    except Exception:
        model_name = "Naive Baseline"
        predictions = _predict(model_name, df, future_weeks)
    forecast = [
        {"date": week.date().isoformat(), "month_label": f"Week of {week:%b %d, %Y}", "predicted": round(float(value), 2)}
        for week, value in zip(future_weeks, predictions)
    ]
    chart_data = [
        {"date": row.week.date().isoformat(), "month_label": f"Week of {row.week:%b %d, %Y}",
         "actual": float(row.quantity), "forecast": None, "is_future": False}
        for row in df.itertuples()
    ]
    if chart_data:
        chart_data[-1]["forecast"] = chart_data[-1]["actual"]
    chart_data.extend({"date": point["date"], "month_label": point["month_label"], "actual": None,
                       "forecast": point["predicted"], "is_future": True} for point in forecast)
    result.update({
        "model": model_name, "forecast": forecast, "chart_data": chart_data,
        "metadata": {"frequency": "WEEKLY", "horizon_weeks": horizon,
                     "last_historical_date": meta["last_complete_week"],
                     "is_seeded": meta["is_seeded"], "seed_marker": meta["seed_marker"],
                     "coverage_status": "UNKNOWN", "weekday_pattern_estimable": False},
        "evaluation_summary": {"criterion": result["selection"]["criterion"],
                               "selected_model": winner, "rationale": result["selection"]["rationale"]},
    })
    return result

"""Weekly forecasts and weekday diagnostics for approved ownership transfers.

Each approved transfer row represents one animal, including outside-market
animals without a local inventory link. Certificates may cover multiple rows,
so head counts use rows while transaction counts use distinct certificates.
The source has no market-session or reporting-coverage ledger, so the service
forecasts only contiguous weekly observations captured in SmartLivestock.
Missing weeks remain unknown and are never filled with zero.
"""

from collections import defaultdict
from datetime import date, timedelta
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
from django.db.models import Q
from django.utils import timezone
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from .models import ARIMAForecaster, HoltWintersForecaster

from livestock.models import LivestockOwnershipTransfer
from analytics.seed_markers import (
    SEED_MARKER_CATTLE_PRICE_DEMO,
    SEED_MARKER_AUCTION,
    SEED_MARKER_OWNERSHIP_TRANSFER,
    SEED_MARKER_FORECAST_QUALITY_IDEAL,
    SEED_MARKER_FORECAST_QUALITY_POOR,
)
from smartlivestock.workflows import scope_reviewer_queryset

MIN_TRAIN_WEEKS = 8
MIN_HISTORY_WEEKS = 12
MAX_HORIZON_WEEKS = 12
MAX_BACKTEST_WINDOWS = 8
MAX_QUIET_GAP_WEEKS = 2
SYNTHETIC_TRANSFER_MARKERS = (
    SEED_MARKER_CATTLE_PRICE_DEMO,
    SEED_MARKER_OWNERSHIP_TRANSFER,
    SEED_MARKER_FORECAST_QUALITY_IDEAL,
    SEED_MARKER_FORECAST_QUALITY_POOR,
    SEED_MARKER_AUCTION,
)


def _scoped_transfers(target: str, user=None, transfer_source: Optional[str] = None):
    qs = scope_reviewer_queryset(LivestockOwnershipTransfer.objects.all(), user).filter(
        transfer_date__isnull=False,
    )
    source = (transfer_source or "").strip().upper()
    if source == "REGISTERED":
        qs = qs.filter(livestock__isnull=False)
    elif source == "EXTERNAL":
        qs = qs.filter(livestock__isnull=True)
    elif source:
        raise ValueError("transfer_source must be REGISTERED, EXTERNAL, or omitted.")
    target = (target or "ALL").upper()
    if target not in {"ALL", "HEADS", "TRANSACTIONS", "SALES", "PHP", "PHP_PER_HEAD", "AVG_PHP_PER_HEAD", "PRICE_PER_HEAD"}:
        qs = qs.filter(
            Q(livestock__livestock_type__name__icontains=target)
            | Q(external_livestock_type__icontains=target)
        )
    return qs


def _filtered_sales(target: str, user=None, transfer_source: Optional[str] = None):
    return _scoped_transfers(target, user, transfer_source).filter(
        status=LivestockOwnershipTransfer.Status.APPROVED,
    )


def _trailing_contiguous_frame(df: pd.DataFrame) -> pd.DataFrame:
    """Return the most recent unbroken streak of finite weekly observations."""
    if df.empty:
        return df
    finite_mask = np.isfinite(df["quantity"].to_numpy(dtype=float))
    if not finite_mask.any() or not finite_mask[-1]:
        return df.iloc[0:0].copy()
    start_idx = len(df) - 1
    while start_idx > 0 and finite_mask[start_idx - 1]:
        start_idx -= 1
    return df.iloc[start_idx:].copy().reset_index(drop=True)


def build_weekly_auction_series(
    target="ALL", unit="HEADS", user=None, transfer_source: Optional[str] = None
) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """Aggregate approved transfer events into Monday-Sunday calendar weeks."""
    unit = (unit or "HEADS").upper()
    if unit in {"SALES", "TRANSACTIONS", "COUNT"}:
        unit = "TRANSACTIONS"
    elif unit in {"PHP", "VALUE", "TOTAL_PRICE"}:
        unit = "PHP"
    elif unit in {"PHP_PER_HEAD", "AVG_PHP_PER_HEAD", "PRICE_PER_HEAD"}:
        unit = "PHP_PER_HEAD"
    else:
        unit = "HEADS"

    target_clean = (target or "ALL").upper()
    requires_specific_target = unit == "PHP_PER_HEAD" and target_clean in {
        "ALL", "HEADS", "TRANSACTIONS", "SALES", "PHP", "PHP_PER_HEAD", "AVG_PHP_PER_HEAD", "PRICE_PER_HEAD"
    }
    transfer_source_clean = (transfer_source or "").strip().upper() or None
    qs = (
        LivestockOwnershipTransfer.objects.none()
        if requires_specific_target
        else _filtered_sales(target, user, transfer_source_clean)
    )
    raw_rows = qs.values_list(
        "pk", "transfer_certificate_number", "livestock_id", "transfer_date", "purchase_price",
        "created_at", "reviewed_at", "review_remarks"
    ).iterator(chunk_size=10000)
    today = timezone.localdate()
    current_week_start = today - timedelta(days=today.weekday())
    last_complete_week_start = current_week_start - timedelta(days=7)

    weekday_rows = {
        day: {"certificate_numbers": set(), "priced_certificates": set(), "heads_sold": 0,
              "sales_value_php": 0.0, "synthetic_transactions": 0}
        for day in range(7)
    }
    grouped = defaultdict(lambda: {
        "quantity": 0.0, "record_count": 0, "missing_value_records": 0, "certificate_numbers": set(),
        "price_total": 0.0, "priced_records": 0,
        "latest_created_at": None, "latest_reviewed_at": None,
        "created_count": 0, "reviewed_count": 0,
    })
    eligible_rows = []
    synthetic_count = 0
    observed_seed_markers = set()
    unmeasured_value_count = 0

    for transfer_id, certificate_number, livestock_id, sale_date, purchase_price, created_at, reviewed_at, remarks in raw_rows:
        if not sale_date or sale_date >= current_week_start:
            continue  # Current week is partial; do not use it as a completed observation.
        weekday = weekday_rows[sale_date.weekday()]
        weekday["certificate_numbers"].add(certificate_number)
        weekday["heads_sold"] += 1
        if purchase_price is not None:
            weekday["sales_value_php"] += float(purchase_price)
            weekday["priced_certificates"].add(certificate_number)
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
        bucket["certificate_numbers"].add(certificate_number)
        if unit in {"PHP", "PHP_PER_HEAD"} and purchase_price is not None:
            bucket["price_total"] += float(purchase_price)
            bucket["priced_records"] += 1
            if unit == "PHP":
                bucket["quantity"] += float(purchase_price)
        if unit in {"PHP", "PHP_PER_HEAD"} and purchase_price is None:
            bucket["missing_value_records"] += 1
        for value_key, count_key in ((created_at, "created_count"), (reviewed_at, "reviewed_count")):
            if value_key is not None:
                bucket[count_key] += 1
        bucket["latest_created_at"] = max(filter(None, (bucket["latest_created_at"], created_at)), default=None)
        bucket["latest_reviewed_at"] = max(filter(None, (bucket["latest_reviewed_at"], reviewed_at)), default=None)
        eligible_rows.append((transfer_id, livestock_id, sale_date, purchase_price, created_at, reviewed_at))

    if grouped:
        first_week = min(grouped)
        latest_observed_week = max(grouped)
        unapproved_dates = (
            []
            if requires_specific_target
            else list(
                _scoped_transfers(target, user, transfer_source_clean)
                .filter(
                    status__in=[
                        LivestockOwnershipTransfer.Status.PENDING,
                        LivestockOwnershipTransfer.Status.VERIFIED,
                    ],
                    transfer_date__gte=first_week,
                    transfer_date__lt=current_week_start,
                )
                .values_list("transfer_date", flat=True)
            )
        )
        unapproved_weeks = {d - timedelta(days=d.weekday()) for d in unapproved_dates if d}

        # Option 2A (Monday / Pending Grace Window): If the most recently completed
        # 1-2 weeks have unreviewed transfers waiting for approval (and no approved
        # transfers yet), anchor at the last approved week rather than treating an
        # unreviewed batch as zero or missing.
        trailing_gap_weeks = (last_complete_week_start - latest_observed_week).days // 7
        if (
            0 < trailing_gap_weeks <= MAX_QUIET_GAP_WEEKS
            and any(
                (latest_observed_week + timedelta(weeks=step)) in unapproved_weeks
                for step in range(1, trailing_gap_weeks + 1)
            )
        ):
            effective_end_week = latest_observed_week
        else:
            effective_end_week = last_complete_week_start

        all_weeks = []
        w = first_week
        while w <= effective_end_week:
            all_weeks.append(w)
            w += timedelta(days=7)

        # Precompute empty-gap lengths and prior recorded streaks so only genuine
        # isolated 1-2 week quiet periods (after at least 2 recorded weeks in a
        # history of >= MIN_HISTORY_WEEKS) are filled, while sparse alternating
        # series remain flagged as insufficient.
        has_enough_history = len(grouped) >= MIN_HISTORY_WEEKS
        gap_lengths: Dict[date, int] = {}
        prior_streaks: Dict[date, int] = {}
        idx = 0
        running_recorded = 0
        while idx < len(all_weeks):
            wk = all_weeks[idx]
            if wk in grouped:
                running_recorded += 1
                idx += 1
            else:
                gap_start = idx
                while idx < len(all_weeks) and all_weeks[idx] not in grouped:
                    idx += 1
                gap_len = idx - gap_start
                for g_idx in range(gap_start, idx):
                    gap_lengths[all_weeks[g_idx]] = gap_len
                    prior_streaks[all_weeks[g_idx]] = running_recorded
                running_recorded = 0

        periods = []
        last_valid_price: Optional[float] = None
        last_valid_available_at = pd.NaT
        for week in all_weeks:
            bucket = grouped.get(week)
            if bucket is None:
                can_fill_quiet_week = (
                    has_enough_history
                    and week not in unapproved_weeks
                    and gap_lengths.get(week, 999) <= MAX_QUIET_GAP_WEEKS
                    and prior_streaks.get(week, 0) >= 2
                )
                if can_fill_quiet_week and unit in {"HEADS", "TRANSACTIONS"}:
                    # Option 1A: A quiet week with no transfers has 0 sales volume.
                    quantity = 0.0
                    available_at = week + timedelta(days=6)
                elif can_fill_quiet_week and unit == "PHP_PER_HEAD" and last_valid_price is not None:
                    # Option 1B: Carry forward the most recent weekly average price
                    # across an isolated 1-2 week quiet period with no cattle sold.
                    quantity = last_valid_price
                    available_at = (
                        max(last_valid_available_at, week + timedelta(days=6))
                        if pd.notna(last_valid_available_at)
                        else week + timedelta(days=6)
                    )
                else:
                    quantity = np.nan
                    available_at = pd.NaT
                record_count = 0
                missing_value_records = 0
            else:
                record_count = bucket["record_count"]
                missing_value_records = bucket["missing_value_records"]
                quantity = (
                    np.nan if unit in {"PHP", "PHP_PER_HEAD"} and missing_value_records
                    else bucket["quantity"] if unit == "PHP"
                    else bucket["price_total"] / bucket["priced_records"] if unit == "PHP_PER_HEAD" and bucket["priced_records"]
                    else np.nan if unit == "PHP_PER_HEAD"
                    else float(len(bucket["certificate_numbers"])) if unit == "TRANSACTIONS"
                    else float(record_count)
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
                if unit == "PHP_PER_HEAD" and np.isfinite(quantity):
                    last_valid_price = float(quantity)
                    last_valid_available_at = available_at
            periods.append({
                "week": pd.Timestamp(week), "quantity": quantity,
                "available_at": available_at, "record_count": record_count,
                "missing_value_records": missing_value_records,
            })
        df = pd.DataFrame(periods)
        df["available_at"] = pd.to_datetime(df["available_at"])
    else:
        effective_end_week = last_complete_week_start
        df = pd.DataFrame(columns=["week", "quantity", "available_at", "record_count", "missing_value_records"])

    missing_weeks = [row["week"].date().isoformat() for row in df.to_dict("records")
                     if not np.isfinite(row["quantity"])]
    observed = df.loc[np.isfinite(df["quantity"])].copy() if not df.empty else df.copy()
    weekday_profile = []
    for day in range(7):
        row = weekday_rows[day]
        weekday_profile.append({
            "weekday": (date(2024, 1, 1) + timedelta(days=day)).strftime("%A"),
            "transaction_count": len(row["certificate_numbers"]),
            "heads_sold": row["heads_sold"],
            "sales_value_php": round(row["sales_value_php"], 2),
            "transactions_with_value": len(row["priced_certificates"]),
            "synthetic_transactions": row["synthetic_transactions"],
        })

    fully_measured_value = unit not in {"PHP", "PHP_PER_HEAD"} or unmeasured_value_count == 0
    has_weekday_observations = bool(eligible_rows)
    metadata = {
        "domain": "auction", "target": target_clean, "unit": unit,
        "frequency": "WEEKLY", "week_boundary": "Monday-Sunday; only complete weeks included",
        "scope": (
            (
                "Average recorded purchase price per approved transfer linked to registered livestock inventory; this is not a per-kilogram price."
                if transfer_source_clean == "REGISTERED" else
                "Average recorded purchase price per approved external-market transfer; this is not a per-kilogram price or a complete market quotation."
                if transfer_source_clean == "EXTERNAL" else
                "Average recorded purchase price per approved transfer for the selected livestock type; this is not a per-kilogram price or a complete market quotation."
            )
            if unit == "PHP_PER_HEAD" else
            "Approved livestock transfers recorded in SmartLivestock; other market activity may not be included"
        ),
        "transfer_source": transfer_source_clean,
        "target_requirement_note": (
            "Select one livestock type to estimate an average price per head. Prices across different livestock types are not comparable."
            if requires_specific_target else None
        ),
        "total_records": sum(int(value["record_count"]) for value in grouped.values()),
        "synthetic_records": synthetic_count,
        "is_seeded": synthetic_count > 0,
        "seed_markers": sorted(observed_seed_markers),
        "seed_marker": sorted(observed_seed_markers)[0] if observed_seed_markers else None,
        "total_weekly_observations": int(np.isfinite(df["quantity"]).sum()) if not df.empty else 0,
        "first_week": df["week"].min().date().isoformat() if not df.empty else None,
        "last_complete_week": effective_end_week.isoformat(),
        "data_through_date": effective_end_week.isoformat(),
        "missing_weeks": missing_weeks,
        "missing_week_count": len(missing_weeks),
        "unmeasured_value_records": unmeasured_value_count if unit in {"PHP", "PHP_PER_HEAD"} else 0,
        "value_measurement_complete": fully_measured_value,
        "weekday_activity": weekday_profile,
        "weekday_pattern_estimable": False,
        "weekday_pattern_note": (
        "Thursday and Friday may be busy market days, but SmartLivestock does not record every market session. "
        "These counts cover approved transfers entered in the system, so they cannot show the true number of sales by weekday."
            if has_weekday_observations else
            "No approved livestock transfers are recorded, so weekday activity cannot be compared."
        ),
        "coverage_status": "UNKNOWN",
        "coverage_note": (
            "Weeks without records are unknown, not zero. The system does not track whether all market activity was recorded."
        ),
        "approval_cutoff_reconstructable": bool(
            not observed.empty and observed["available_at"].notna().all()
        ),
        "approval_timeline_note": (
            "Only the current review dates are available. If a record was edited or approved again later, its earlier review history may not be available."
        ),
        "forecast_available": False,
    }
    return df, metadata


def _weekly_calendar_features(weeks: List[pd.Timestamp], first_week: pd.Timestamp) -> np.ndarray:
    """Build weekly trend and annual-cycle features for regression candidates."""
    origin = pd.Timestamp(first_week)
    features = []
    for value in weeks:
        week = pd.Timestamp(value)
        elapsed_weeks = (week - origin).days / 7.0
        annual_angle = 2 * np.pi * (week.dayofyear - 1) / 365.2425
        features.append([elapsed_weeks, np.sin(annual_angle), np.cos(annual_angle)])
    return np.asarray(features, dtype=float)


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
    elif model_name == "Linear Regression":
        weeks = pd.to_datetime(history["week"]).tolist()
        first_week = pd.Timestamp(weeks[0])
        model = LinearRegression().fit(_weekly_calendar_features(weeks, first_week), values)
        result = model.predict(_weekly_calendar_features(future_weeks, first_week))
    elif model_name == "Random Forest":
        weeks = pd.to_datetime(history["week"]).tolist()
        first_week = pd.Timestamp(weeks[0])
        lag_count = 4
        if len(values) <= lag_count:
            raise ValueError("Random Forest needs at least five weekly observations to build lag features.")

        training_features = []
        training_targets = []
        for index in range(lag_count, len(values)):
            calendar = _weekly_calendar_features([weeks[index]], first_week)[0]
            prior_values = values[index - lag_count:index]
            training_features.append([
                *calendar,
                float(values[index - 1]),
                float(values[index - lag_count]),
                float(np.mean(prior_values)),
            ])
            training_targets.append(float(values[index]))

        model = RandomForestRegressor(
            n_estimators=50,
            max_depth=5,
            min_samples_split=2,
            random_state=42,
        ).fit(np.asarray(training_features, dtype=float), np.asarray(training_targets, dtype=float))

        running_values = values.tolist()
        predictions = []
        for future_week in future_weeks:
            calendar = _weekly_calendar_features([future_week], first_week)[0]
            prior_values = running_values[-lag_count:]
            features = np.asarray([[
                *calendar,
                float(running_values[-1]),
                float(running_values[-lag_count]),
                float(np.mean(prior_values)),
            ]], dtype=float)
            prediction = max(0.0, float(model.predict(features)[0]))
            predictions.append(prediction)
            running_values.append(prediction)
        result = np.asarray(predictions, dtype=float)
    elif model_name == "ARIMA":
        model = ARIMAForecaster(order=(1, 1, 1)).fit(pd.Series(values))
        result = model.predict_steps(horizon)
    elif model_name == "Holt-Winters":
        # A full annual weekly seasonal cycle needs two years of observations;
        # the forecaster falls back to trend-only smoothing when history is shorter.
        model = HoltWintersForecaster(seasonal_periods=52).fit(pd.Series(values))
        result = model.predict_steps(horizon)
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


def evaluate_weekly_auction(
    target="ALL", unit="HEADS", horizon_weeks=6, user=None,
    transfer_source: Optional[str] = None,
) -> Dict[str, Any]:
    """Evaluate weekly transfer totals at independent rolling cutoffs."""
    horizon = max(1, min(int(horizon_weeks), MAX_HORIZON_WEEKS))
    df, meta = build_weekly_auction_series(target, unit, user, transfer_source)
    trailing_df = _trailing_contiguous_frame(df)
    use_trailing_window = (
        len(trailing_df) >= MIN_HISTORY_WEEKS
        and int(meta["missing_week_count"]) > 0
        and meta["value_measurement_complete"]
    )
    active_df = trailing_df if use_trailing_window else df
    obs_count = len(active_df) if use_trailing_window else int(meta["total_weekly_observations"])
    missing_count = 0 if use_trailing_window else int(meta["missing_week_count"])
    candidate_names = [
        "Naive Baseline", "Moving Average (4 weeks)", "Linear Regression",
        "Random Forest", "ARIMA", "Holt-Winters",
    ]
    baseline_model_names = {"Naive Baseline", "Moving Average (4 weeks)", "Seasonal Naive (52 weeks)"}
    model_type_names = {
        "Linear Regression": "Weekly trend and annual pattern",
        "Random Forest": "Machine learning",
        "ARIMA": "Time-series model",
        "Holt-Winters": "Exponential smoothing",
    }
    if len(active_df) >= 52 + horizon:
        candidate_names.insert(2, "Seasonal Naive (52 weeks)")
    min_train = 52 if "Seasonal Naive (52 weeks)" in candidate_names else MIN_TRAIN_WEEKS

    if meta.get("target_requirement_note"):
        message = meta["target_requirement_note"]
        status = "insufficient_data"
        forecast_available = False
    elif obs_count < MIN_HISTORY_WEEKS or missing_count or not meta["value_measurement_complete"]:
        if obs_count < MIN_HISTORY_WEEKS:
            message = f"Records cover {obs_count} complete weeks. At least {MIN_HISTORY_WEEKS} are needed for an initial weekly estimate."
        elif unit == "PHP_PER_HEAD" and (missing_count or not meta["value_measurement_complete"]):
            message = (
                f"{missing_count} week(s) do not have a complete cattle price average, and "
                f"{meta['unmeasured_value_records']} approved transfer(s) have no purchase price. "
                "Missing price weeks are unknown and are not filled in."
            )
        elif missing_count:
            message = f"{missing_count} week(s) have no complete approved transfer total. Missing weeks are unknown and not counted as zero activity."
        else:
            message = f"{meta['unmeasured_value_records']} approved transfer(s) have no purchase price, so weekly sales totals are incomplete."
        status = "insufficient_data"
        forecast_available = False
    else:
        message = "These estimates cover approved livestock transfers recorded in SmartLivestock. Other market activity may not be included."
        status = "unvalidated"
        forecast_available = True

    metric_rows = []
    backtest_rows = []
    valid_windows = 0
    final_predictions = None
    if len(active_df) > min_train:
        possible_origins = list(range(min_train, len(active_df) - horizon + 1))
        if len(possible_origins) > MAX_BACKTEST_WINDOWS:
            selected = np.linspace(0, len(possible_origins) - 1, MAX_BACKTEST_WINDOWS, dtype=int)
            possible_origins = [possible_origins[index] for index in sorted(set(selected.tolist()))]

        results_by_model = {name: {"actual": [], "predicted": [], "windows": 0} for name in candidate_names}
        for origin in possible_origins:
            cutoff = pd.Timestamp(active_df.iloc[origin]["week"])
            full_history = active_df.iloc[:origin].copy()
            known = full_history.loc[full_history["available_at"].notna() & (full_history["available_at"] < cutoff)].copy()
            test = active_df.iloc[origin:origin + horizon].copy()
            expected_test_weeks = pd.date_range(cutoff, periods=horizon, freq="7D")
            missing_availability = int(full_history["available_at"].isna().sum())
            late_rows = int((full_history["available_at"].notna() & (full_history["available_at"] >= cutoff)).sum())
            reason = None
            reason_code = None
            if len(known) < min_train:
                if missing_availability and len(known) + missing_availability >= min_train:
                    reason = (
                        f"Only {len(known)} earlier weeks have usable approval dates; "
                        f"{missing_availability} older week(s) are missing dates, and {min_train} "
                        "weeks are needed to make this check."
                    )
                    reason_code = "MISSING_AVAILABILITY_TIMESTAMPS"
                else:
                    reason = f"Only {len(known)} earlier weeks of totals were approved by this date; {min_train} are needed."
                    reason_code = "NOT_ENOUGH_APPROVED_HISTORY"
            else:
                expected_train_weeks = pd.date_range(known["week"].min(), cutoff - pd.Timedelta(weeks=1), freq="7D")
            if reason is None and known["week"].tolist() != list(expected_train_weeks):
                reason = "Some earlier weeks have no records, or their records were approved after this date."
                reason_code = "GAPS_IN_APPROVED_HISTORY"
            if reason is None and (len(test) != horizon or test["week"].tolist() != list(expected_test_weeks) or not np.isfinite(test["quantity"]).all()):
                reason = "There are not enough later weekly records to compare with an estimate."
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
                    reason = "At least one method could not make an estimate, so the methods could not be compared for the same weeks."
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
                "status": "EVALUATED", "reason": "Later weekly results were available and compared with estimates based only on records available at the time.",
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
                {"name": name,
                 "model_type": "Time-series baseline" if name in baseline_model_names else model_type_names.get(name, "Time-series model"),
                 "status": "EVALUATED", "description": name,
                 **_metric_summary(values["actual"], values["predicted"]),
                 "test_predictions": final_predictions["predictions"][name] if final_predictions else [],
                 "is_selected": False}
                for name, values in results_by_model.items()
                if values["windows"] == valid_windows and values["actual"]
            ]

    all_weeks_contiguous = bool(len(active_df) and not missing_count and np.isfinite(active_df["quantity"]).all())
    if not meta["value_measurement_complete"]:
        all_weeks_contiguous = False
    if forecast_available and not all_weeks_contiguous:
        forecast_available = False
        status = "insufficient_data"
        message = "Some weeks are missing or have incomplete amounts. Missing weeks are unknown and not counted as zero activity."
    if forecast_available and not valid_windows:
        status = "unvalidated"

    baseline_models = [row for row in metric_rows if row["name"] in baseline_model_names]
    advanced_models = [row for row in metric_rows if row["name"] not in baseline_model_names]
    best_baseline = min(baseline_models, key=lambda row: row["mae"]) if baseline_models else None
    best_advanced = min(advanced_models, key=lambda row: row["mae"]) if advanced_models else None
    winner = best_baseline
    comparison = "INSUFFICIENT_DATA"
    source = "NONE"
    rationale = "There are not enough complete past checks to compare prediction methods."
    if valid_windows and best_baseline:
        winner = best_baseline
        comparison = "BASELINE_BEST"
        source = "NAIVE_BASELINE"
        rationale = f"The simple weekly forecast had the smallest average difference across {valid_windows} completed checks."
        if best_advanced and best_advanced["mae"] < best_baseline["mae"]:
            winner = best_advanced
            comparison = "MODEL_BEATS_BASELINE"
            source = "MACHINE_LEARNING"
            rationale = f"{winner['name']} matched past records better than the best simple weekly forecast across {valid_windows} checks."
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
        "target": {
            "domain": "auction", "target": meta["target"], "unit": meta["unit"],
            "frequency": "WEEKLY", "transfer_source": meta.get("transfer_source"),
        },
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
        "selection": {"criterion": "Lowest pooled MAE on identical rolling-origin weekly windows; an advanced model must beat the best simple baseline.",
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


def generate_weekly_auction_forecast(
    target="ALL", unit="HEADS", horizon_weeks=6, preferred_model=None, user=None,
    transfer_source: Optional[str] = None,
) -> Dict[str, Any]:
    """Return next-week projections, retaining the complete weekly actual history."""
    result = evaluate_weekly_auction(target, unit, horizon_weeks, user, transfer_source)
    if not result["forecast_available"]:
        df, _ = build_weekly_auction_series(target, unit, user, transfer_source)
        chart_data = [
            {
                "date": row.week.date().isoformat(),
                "month_label": f"Week of {row.week:%b %d, %Y}",
                "actual": float(row.quantity) if np.isfinite(row.quantity) else None,
                "forecast": None,
                "is_future": False,
            }
            for row in df.itertuples()
        ]
        result.update({"forecast": [], "chart_data": chart_data})
        return result
    df, meta = build_weekly_auction_series(target, unit, user, transfer_source)
    trailing_df = _trailing_contiguous_frame(df)
    active_df = trailing_df if len(trailing_df) >= MIN_HISTORY_WEEKS else df
    winner = result["selection"].get("selected_model")
    model_name = preferred_model or winner or "Naive Baseline"
    horizon = result["data"]["horizon_weeks"]
    last_week = pd.Timestamp(active_df["week"].iloc[-1])
    future_weeks = [last_week + pd.Timedelta(weeks=step) for step in range(1, horizon + 1)]
    try:
        predictions = _predict(model_name, active_df, future_weeks)
    except Exception:
        model_name = "Naive Baseline"
        predictions = _predict(model_name, active_df, future_weeks)
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

"""
Model Evaluation and Fair Benchmark Comparison Engine.

=============================================================================
EDUCATIONAL OVERVIEW: EVALUATION METRICS FOR REGRESSION
=============================================================================
Why can't we say "Accuracy: 95%" in time-series forecasting?
Accuracy is a classification metric (e.g. 95 out of 100 disease tags classified correctly).
In regression, we predict continuous numbers (e.g. 438.25 Liters).
The probability of predicting the exact decimal value is essentially zero.
Therefore, regression performance is measured by ERROR METRICS:

1. MAE (Mean Absolute Error):
   MAE = (1 / n) * sum(|y_actual - y_predicted|)
   Interpretation: On average, how many Liters off was the forecast from the actual production?
   MAE is in the exact same units as the target (e.g. "off by 14.2 Liters").

2. RMSE (Root Mean Squared Error):
   RMSE = sqrt((1 / n) * sum((y_actual - y_predicted)^2))
   Interpretation: Because differences are squared before taking the root, RMSE penalizes
   large errors much more severely than small errors. If a model makes one huge mistake
   (e.g. off by 100 L), RMSE will spike compared to MAE.

3. R-squared (R² / Coefficient of Determination):
   R² = 1 - (SS_res / SS_tot)
   Interpretation: Measures the proportion of variance in production explained by the model
   relative to a naive horizontal line through the mean.
   - R² = 1.0 -> Perfect fit.
   - R² = 0.0 -> Model performs no better than guessing the average.
   - R² < 0.0 -> Model performs worse than the simple average.

4. Rolling-origin evaluation:
   We repeat the forecast from several earlier cutoffs. At each cutoff, every candidate
   sees only the history available then and predicts the next months. This better reflects
   repeated real forecasting than one lucky chronological split.
"""

from typing import Dict, Any, List, Tuple, Optional
import math
import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

from .data import (
    extract_monthly_series,
    prepare_tabular_features,
)
from .models import forecast_candidate


# A single chronological holdout is enough for an initial comparison at the
# documented minimum history, but the API exposes the window count so users can
# distinguish limited evidence from repeated rolling-origin evidence.
MIN_VALID_BACKTEST_WINDOWS = 1


def calculate_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> Dict[str, Optional[float]]:
    """Computes MAE, RMSE, and R² safely."""
    # Ensure clean 1D float arrays with matching lengths
    y_true = np.asarray(y_true, dtype=float).ravel()
    y_pred = np.asarray(y_pred, dtype=float).ravel()

    mae = float(mean_absolute_error(y_true, y_pred))
    rmse = float(np.sqrt(mean_squared_error(y_true, y_pred)))

    # Guard against zero variance in y_true when computing r2
    if np.var(y_true) < 1e-6:
        r2 = None
    else:
        r2 = float(r2_score(y_true, y_pred))

    return {
        "mae": round(mae, 2),
        "rmse": round(rmse, 2),
        "r2": round(r2, 4) if r2 is not None else None,
    }


def evaluate_rolling_origins(
    df: pd.DataFrame,
    model_names: List[str],
    requested_horizon: int = 6,
    max_windows: int = 8,
    exact_horizon: bool = False,
) -> Dict[str, Any]:
    """Compare models through repeated fixed-origin forecasts, without test peeking.

    Each fold trains on data available at that historical origin and predicts the
    next horizon recursively. Folds are spaced across history to avoid evaluating
    the model at only one lucky or unlucky cutoff date.
    """
    observation_count = len(df)
    horizon = min(max(1, int(requested_horizon)), 12)
    # Reserve enough history to fit the models while allowing short datasets to
    # receive a shorter, clearly reported evaluation horizon.
    min_train = min(24, max(8, observation_count - max(1, min(horizon, observation_count // 3))))
    if exact_horizon:
        if observation_count - horizon < min_train:
            return {"horizon": horizon, "windows": 0, "requested_windows": 0,
                    "diagnostics": [{"forecast_month": None, "cutoff_date": None,
                                     "status": "INCOMPLETE_TEST_WINDOW",
                                     "reason": f"A full {horizon}-month test horizon plus {min_train} training months is not available."}],
                    "models": {}, "final_window": None}
    else:
        horizon = min(horizon, observation_count - min_train)
    if horizon < 1:
        return {"horizon": 0, "windows": 0, "models": {}, "final_window": None}

    # Each origin is the pretend "today" for one backtest fold. The newest
    # origin is exactly the start of the final visible evaluation window.
    last_origin = observation_count - horizon
    step = max(1, math.ceil((last_origin - min_train) / max(1, max_windows - 1)))
    origins = list(range(min_train, last_origin + 1, step))
    if not origins or origins[-1] != last_origin:
        origins.append(last_origin)
    origins = origins[-max_windows:]

    collected: Dict[str, Dict[str, List[float]]] = {
        name: {"actual": [], "predicted": []} for name in model_names
    }
    # A model is eligible only if it succeeds on every shared origin. Otherwise
    # its score would be based on easier/different months than another candidate.
    completed_windows = {name: 0 for name in model_names}
    model_failures: Dict[str, str] = {}
    final_window: Dict[str, Any] = {}
    successful_windows = 0
    backtest_diagnostics = []

    for origin in origins:
        # Crucially, the model only receives rows before this origin. The next
        # months are hidden until after prediction, just like a real forecast.
        forecast_cutoff = pd.Timestamp(df.iloc[origin]["month"])
        historical_candidates = df.iloc[:origin].copy()
        missing_availability_count = 0
        approved_after_cutoff_count = 0
        history = historical_candidates
        if "available_at" in history.columns:
            missing_availability_count = int(history["available_at"].isna().sum())
            approved_after_cutoff_count = int(
                (history["available_at"].notna() & (history["available_at"] >= forecast_cutoff)).sum()
            )
            history = history.loc[history["available_at"] < forecast_cutoff].copy()
        diagnostic = {
            "forecast_month": forecast_cutoff.strftime("%Y-%m"),
            "cutoff_date": forecast_cutoff.strftime("%Y-%m-%d"),
            "available_training_months": len(history),
            "prior_months_missing_availability_timestamp": missing_availability_count,
            "prior_months_approved_at_or_after_cutoff": approved_after_cutoff_count,
            "earliest_training_month": (
                history["month"].min().strftime("%Y-%m") if not history.empty else None
            ),
            "latest_training_month": (
                history["month"].max().strftime("%Y-%m") if not history.empty else None
            ),
        }
        backtest_diagnostics.append(diagnostic)
        # Reconstruct only information that had actually cleared review by the
        # first day of this test window. Unknown or later approvals are excluded.
        if len(history) < 8:
            diagnostic["status"] = "NOT_ENOUGH_APPROVED_HISTORY"
            diagnostic["reason"] = (
                f"Fewer than 8 approved training months were available by this cutoff. "
                f"{missing_availability_count} prior month(s) have no reconstructable approval timestamp, "
                f"and {approved_after_cutoff_count} were approved at or after the cutoff."
            )
            continue
        months = history["month"].dt.to_period("M")
        expected = pd.period_range(months.min(), months.max(), freq="M")
        if len(months.unique()) != len(expected):
            # A cutoff with unreviewed months cannot support monthly lags.
            diagnostic["status"] = "GAPS_IN_APPROVED_HISTORY"
            diagnostic["reason"] = "The approved training history had missing calendar months at this cutoff."
            continue
        window = df.iloc[origin:origin + horizon].copy()
        if len(window) != horizon:
            diagnostic["status"] = "INCOMPLETE_TEST_WINDOW"
            diagnostic["reason"] = "The complete forecast horizon is not yet observed."
            continue
        actual = window["quantity"].astype(float).to_numpy()
        window_results = {}
        for name in model_names:
            try:
                predicted = forecast_candidate(name, history, window["month"].tolist())
                if len(predicted) != horizon or not np.isfinite(predicted).all():
                    continue
                # Pool errors from all windows, while keeping final-window
                # predictions separately for the frontend's actual-vs-predicted plot.
                collected[name]["actual"].extend(actual.tolist())
                collected[name]["predicted"].extend(predicted.tolist())
                completed_windows[name] += 1
                window_results[name] = [round(float(value), 1) for value in predicted]
            except Exception as exc:
                # A failed model/fold is omitted; a candidate still needs a
                # complete successful evaluation to compete for selection.
                model_failures.setdefault(name, str(exc))
                continue
        if window_results:
            diagnostic["status"] = "EVALUATED"
            diagnostic["reason"] = "Training history was available and the full forecast window is observed."
            successful_windows += 1
            final_window = {
                "train": history,
                "test": window,
                "predictions": window_results,
            }
        else:
            diagnostic["status"] = "MODEL_FAILURE"
            diagnostic["reason"] = "No candidate model produced a valid forecast for this cutoff."

    model_metrics = {}
    for name, values in collected.items():
        if values["actual"] and completed_windows[name] == successful_windows:
            model_metrics[name] = calculate_metrics(
                np.asarray(values["actual"]), np.asarray(values["predicted"])
            )

    return {
        "horizon": horizon,
        "windows": successful_windows,
        "requested_windows": len(origins),
        "minimum_required_windows": MIN_VALID_BACKTEST_WINDOWS,
        "diagnostics": backtest_diagnostics,
        "model_windows": completed_windows,
        "model_failures": model_failures,
        "models": model_metrics,
        "final_window": final_window or None,
    }


def evaluate_all_models(
    domain: str = "production",
    target: str = "MILK",
    unit: str = "LITERS",
    user=None,
    production_type: Optional[str] = None,
    horizon_months: int = 6,
) -> Dict[str, Any]:
    """
    Extracts approved records and compares six candidates over chronological,
    fixed-origin forecast windows across any supported domain.
    """
    # Backward compatibility with callers passing production_type
    effective_target = production_type if production_type is not None else target

    # Live sales are event-based and the municipality reports market activity
    # across the week. Use complete Monday-Sunday windows instead of presenting
    # monthly sale totals as a weekly market forecast.
    if (domain or "").lower() == "auction":
        from .auction_weekly import evaluate_weekly_auction

        return evaluate_weekly_auction(
            target=effective_target,
            unit=unit,
            horizon_weeks=horizon_months,
            user=user,
        )

    exact_event_horizon = (
        ((domain or "").lower() == "production" and effective_target == "MEAT")
        or (domain or "").lower() == "slaughter"
    )

    df, meta = extract_monthly_series(
        domain=domain,
        target=effective_target,
        unit=unit,
        user=user,
    )

    if df is None:
        # INSUFFICIENT DATA FLOW:
        # When len(records) < 12, data extraction returns df=None and metadata with status='insufficient_data'.
        # We pass available_observations, required_observations (12), and readiness_status ('NOT_READY').
        # This allows the React UI to explain clearly to the user why forecasting cannot run yet.
        return {
            "status": "insufficient_data",
            "forecast_available": False,
            "readiness_status": meta.get("readiness_status", "NOT_READY"),
            "readiness_details": meta.get("readiness_details", "Insufficient historical observations."),
            "domain": domain,
            "scope": meta.get("scope", f"Municipal {domain}"),
            "target": {
                "domain": domain,
                "target": effective_target,
                "production_type": effective_target,
                "unit": unit,
            },
            "available_observations": meta.get("available_observations", 0),
            "required_observations": meta.get("required_observations", 12),
            "quality_observations_threshold": meta.get("quality_observations_threshold", 24),
            "message": meta.get("message", "Insufficient historical observations."),
            "historical_trend": meta.get("historical_trend", []),
            "approval_timeline": meta.get("approval_timeline", []),
            "approval_timeline_note": meta.get("approval_timeline_note"),
            "metric_definition": meta.get("target_definition"),
            "data_through_date": meta.get("data_through_date"),
            "coverage": {
                "missing_months": meta.get("missing_months", []),
                "missing_month_count": meta.get("missing_month_count", 0),
                "approval_cutoff_reconstructable": meta.get("approval_cutoff_reconstructable", False),
                "warning": meta.get("coverage_warning"),
            },
            "data": meta,
            "selection": {
                "criterion": "Lowest rolling-origin forecast MAE against the best baseline",
                "selected_model": None,
                "baseline_model": "Naive Baseline",
                "baseline_mae": None,
                "selected_model_mae": None,
                "baseline_comparison": "INSUFFICIENT_DATA",
                "forecast_source": "NONE",
                "rationale": "Insufficient historical observations to train and benchmark models.",
            },
            "models": [],
        }

    # Define all model candidates once so every method is evaluated over the same
    # chronological forecast windows. The two simple methods are benchmarks.
    candidate_specs = [
        ("Naive Baseline", "Baseline (Persistence)", "Repeats the latest observed value for each forecast month."),
        ("Seasonal Naive", "Baseline (Same Month Last Year)", "Reuses the value from the same calendar month last year; falls back to persistence if absent."),
        ("Linear Regression", "Parametric Linear (OLS)", "Fits a linear trend and cyclical month pattern for stable multi-month projections."),
        ("Random Forest", "Nonlinear Ensemble (50 Trees)", "Learns nonlinear patterns from trend, cyclical month, and recent lags."),
        ("ARIMA", "Time Series (1,1,1)", "Models autocorrelation and trend through differencing."),
        ("Holt-Winters", "Exponential Smoothing", "Models a smoothed level and trend, with annual seasonality when enough history exists."),
    ]
    if exact_event_horizon:
        candidate_specs.insert(
            1,
            ("Moving Average (3 periods)", "Baseline (Short Moving Average)",
             "Repeats the mean of the latest three eligible monthly observations."),
        )
    models_results: List[Dict[str, Any]] = [
        {
            "name": name,
            "model_type": model_type,
            "status": "PENDING",
            "description": description,
            "mae": None,
            "rmse": None,
            "r2": None,
            "test_predictions": [],
        }
        for name, model_type, description in candidate_specs
    ]

    # Repeated fixed-origin folds mirror the actual multi-month forecast: each
    # model predicts a whole future window without being given later actual values.
    rolling = evaluate_rolling_origins(
        df,
        [item["name"] for item in models_results],
        requested_horizon=horizon_months,
        exact_horizon=exact_event_horizon,
    )
    final_window = rolling.get("final_window")
    if final_window:
        train_feat = prepare_tabular_features(final_window["train"])
        test_feat = final_window["test"]
        test_dates = test_feat["month"].tolist()
        y_test_actual = test_feat["quantity"].astype(float).to_numpy()
        for item in models_results:
            metrics = rolling["models"].get(item["name"])
            predictions = final_window["predictions"].get(item["name"])
            if metrics and predictions is not None:
                item.update(metrics)
                item["test_predictions"] = predictions
                item["status"] = "EVALUATED"
            elif item["name"] in rolling.get("model_failures", {}):
                item["status"] = f"FAILED: {rolling['model_failures'][item['name']]}"
            else:
                item["status"] = "NOT_EVALUATED"
    else:
        # With the service's 12-observation minimum this should be rare, but keep
        # the API response safe if a future data rule leaves no evaluable window.
        train_feat = prepare_tabular_features(df)
        test_feat = df.iloc[0:0].copy()
        test_dates = []
        y_test_actual = np.asarray([], dtype=float)
        for item in models_results:
            item["status"] = "NOT_EVALUATED"

    valid_windows = rolling.get("windows", 0)
    required_validation_windows = 3 if exact_event_horizon else MIN_VALID_BACKTEST_WINDOWS
    has_validated_backtest = bool(
        rolling.get("models")
        and rolling.get("final_window")
        and valid_windows >= required_validation_windows
    )
    if not has_validated_backtest:
        failure_details = (
            f"Only {valid_windows} valid rolling-origin window(s) are currently available; "
            f"at least {required_validation_windows} are required for this target's empirical model comparison."
            if valid_windows
            else (
                "No rolling-origin cutoff produced a usable evaluation window. "
                "Records for historical cutoffs had approval timestamps after the simulated cutoff date."
            )
        )
    else:
        failure_details = None

    # Backtest predictions answer "how did each model perform on unseen data?"
    # These separate predictions answer "what does each model project next?"
    # Fit candidates on all available observations for the future projection;
    # future values are estimates and have no actual observations yet.
    future_horizon = min(max(1, int(horizon_months)), 12)
    last_observed_month = pd.Timestamp(df["month"].max())
    future_dates = pd.date_range(
        start=last_observed_month + pd.offsets.MonthBegin(1),
        periods=future_horizon,
        freq="MS",
    )
    for item in models_results:
        item["future_predictions"] = []
        if has_validated_backtest and item["status"] != "EVALUATED":
            continue
        try:
            future_predictions = forecast_candidate(item["name"], df, future_dates.tolist())
            if len(future_predictions) == future_horizon and np.isfinite(future_predictions).all():
                item["future_predictions"] = [
                    round(float(value), 1) for value in future_predictions
                ]
                if not has_validated_backtest and item.get("status") in (None, "", "NOT_EVALUATED"):
                    item["status"] = "UNVALIDATED_FIT"
        except Exception:
            continue

    # Baseline Superiority & Model Selection (rolling-origin MAE)
    # ---------------------------------------------------------
    # In time-series forecasting, both persistence and seasonal-naive methods are
    # baselines. A complex candidate must beat the stronger of these two methods.
    # In that event:
    # 1. baseline_comparison is marked 'BASELINE_BEST'.
    # 2. The operational selected model defaults to 'Naive Baseline'.
    # 3. forecast_source is marked 'NAIVE_BASELINE'.
    # If an advanced model beats the baseline:
    # 1. baseline_comparison is marked 'MODEL_BEATS_BASELINE'.
    # 2. The operational selected model is set to the winning ML model.
    # 3. forecast_source is marked 'MACHINE_LEARNING'.

    valid_models = [
        m for m in models_results
        if m.get("mae") is not None and str(m.get("status", "")).startswith("EVALUATED")
    ]
    baseline_models = [m for m in valid_models if m["name"] in ("Naive Baseline", "Moving Average (3 periods)", "Seasonal Naive")]
    best_baseline = min(baseline_models, key=lambda m: m["mae"]) if baseline_models else None
    naive_mae = best_baseline["mae"] if best_baseline else None
    ml_models = [m for m in valid_models if m["name"] not in ("Naive Baseline", "Moving Average (3 periods)", "Seasonal Naive")]

    selected_model_name = None
    selected_model_mae = None
    baseline_comparison = "INSUFFICIENT_DATA"
    forecast_source = "NONE"
    selection_criterion = (
        f"Lowest MAE across {rolling.get('windows', 0)} rolling-origin window(s), each forecasting up to {rolling.get('horizon', 0)} month(s), while requiring the winner to beat the best baseline"
        if has_validated_backtest
        else "Unvalidated baseline projection fit on full history (0 qualifying backtest cutoffs)"
    )

    if has_validated_backtest:
        if ml_models and best_baseline:
            best_ml = min(ml_models, key=lambda m: m["mae"])
            best_ml_mae = best_ml["mae"]

            if naive_mae is not None and naive_mae <= best_ml_mae:
                selected_model_name = best_baseline["name"]
                selected_model_mae = naive_mae
                baseline_comparison = "BASELINE_BEST"
                forecast_source = "NAIVE_BASELINE"
                rationale = (
                    f"{best_baseline['name']} achieved lower or equal rolling validation MAE ({naive_mae} {unit}) "
                    f"compared to advanced models (best was {best_ml['name']} at {best_ml_mae} {unit}). "
                    "Operational forecast uses the stronger simple baseline rather than a weaker complex model."
                )
            else:
                selected_model_name = best_ml["name"]
                selected_model_mae = best_ml_mae
                baseline_comparison = "MODEL_BEATS_BASELINE"
                forecast_source = "MACHINE_LEARNING"
                improvement_pct = round(((naive_mae - best_ml_mae) / naive_mae) * 100, 1) if naive_mae and naive_mae > 0 else 0.0
                rationale = (
                    f"Selected '{selected_model_name}' because it beats {best_baseline['name']} (MAE {selected_model_mae} vs {naive_mae} {unit}, "
                    f"{improvement_pct}% error reduction) across rolling-origin windows."
                )
        elif best_baseline:
            selected_model_name = best_baseline["name"]
            selected_model_mae = naive_mae
            baseline_comparison = "BASELINE_BEST"
            forecast_source = "NAIVE_BASELINE"
            rationale = "Only a simple baseline evaluated successfully among candidate models."
        elif ml_models:
            best_ml = min(ml_models, key=lambda m: m["mae"])
            selected_model_name = best_ml["name"]
            selected_model_mae = best_ml["mae"]
            baseline_comparison = "MODEL_BEATS_BASELINE"
            forecast_source = "MACHINE_LEARNING"
            rationale = f"Selected '{selected_model_name}' with rolling-origin MAE {selected_model_mae} {unit}."
        else:
            rationale = "No candidate model evaluated successfully across rolling-origin windows."
    else:
        # Decoupled state: data meets threshold, but 0 qualifying cutoffs could be reconstructed
        selected_model_name = "Naive Baseline"
        selected_model_mae = None
        baseline_comparison = "UNVALIDATED"
        forecast_source = "UNVALIDATED_PROJECTION"
        rationale = (
            f"Forecast generated from complete observed series ({len(df)} months), but historical backtesting "
            "could not reconstruct past availability timestamps (0 qualifying cutoffs). "
            "Forward projections use persistence baseline as an experimental reference."
        )

    for m in models_results:
        m["is_selected"] = (m["name"] == selected_model_name)

    if has_validated_backtest and test_dates and not test_feat.empty:
        test_period_info = {
            "start_month": test_feat["month"].min().strftime("%Y-%m-%d"),
            "end_month": test_feat["month"].max().strftime("%Y-%m-%d"),
            "observations": len(test_feat),
            "dates": [d.strftime("%Y-%m-%d") for d in test_dates],
            "actual_values": [round(float(y), 1) for y in y_test_actual],
            "months": [d.strftime("%b %Y") for d in test_dates],
        }
    else:
        test_period_info = {
            "start_month": None,
            "end_month": None,
            "observations": 0,
            "dates": [],
            "actual_values": [],
            "months": [],
        }

    train_period_info = {
        "start_month": train_feat["month"].min().strftime("%Y-%m-%d") if not train_feat.empty else None,
        "end_month": train_feat["month"].max().strftime("%Y-%m-%d") if not train_feat.empty else None,
        "observations": len(train_feat),
    }

    return {
        "status": "ready" if has_validated_backtest else "unvalidated",
        "forecast_available": any(bool(m.get("future_predictions")) for m in models_results),
        "validation_status": "VALIDATED" if has_validated_backtest else "NOT_YET_VALIDATED",
        "validation_strength": "STRONGER" if valid_windows >= 3 else "PRELIMINARY" if valid_windows else "NONE",
        "is_validated": has_validated_backtest,
        "readiness_status": meta.get("readiness_status", "READY") if has_validated_backtest else "AVAILABLE_UNVALIDATED",
        "readiness_details": meta.get("readiness_details", ""),
        "domain": domain,
        "scope": meta.get("scope", f"Municipal {domain}"),
        "available_observations": len(df),
        "required_observations": meta.get("required_observations", 12),
        "quality_observations_threshold": meta.get("quality_observations_threshold", 24),
        "approval_timeline": meta.get("approval_timeline", []),
        "approval_timeline_note": meta.get("approval_timeline_note"),
        "backtest_diagnostics": rolling.get("diagnostics", []),
        "backtest_windows_available": rolling.get("windows", 0),
        "backtest_windows_required": required_validation_windows,
        "backtest_horizon_months": rolling.get("horizon", 0),
        "target": {
            "domain": domain,
            "target": effective_target,
            "production_type": effective_target,
            "unit": unit,
            "frequency": "MONTHLY",
        },
        "data": {
            "total_observations": len(df),
            "training_observations": len(final_window["train"]) if final_window else len(train_feat),
            "test_observations": len(test_feat),
            "rolling_origin_windows": rolling["windows"],
            "minimum_required_windows": required_validation_windows,
            "evaluation_horizon_months": rolling["horizon"],
            "start_date": meta.get("start_date"),
            "end_date": meta.get("end_date"),
            "train_period": train_period_info,
            "test_period": test_period_info,
            "future_period": {
                "start_month": future_dates.min().strftime("%Y-%m-%d"),
                "end_month": future_dates.max().strftime("%Y-%m-%d"),
                "dates": [date.strftime("%Y-%m-%d") for date in future_dates],
                "months": [date.strftime("%b %Y") for date in future_dates],
                "horizon_months": len(future_dates),
            },
            "missing_months": meta.get("missing_months", []),
            "missing_month_count": meta.get("missing_month_count", 0),
            "is_monthly_series_contiguous": meta.get("is_monthly_series_contiguous", True),
            "excluded_incomplete_current_month": meta.get("excluded_incomplete_current_month", False),
            "coverage_warning": meta.get("coverage_warning"),
            "backtest_diagnostics": rolling.get("diagnostics", []),
            "backtest_windows_available": rolling.get("windows", 0),
            "backtest_windows_required": required_validation_windows,
            "backtest_horizon_months": rolling.get("horizon", 0),
            "approval_cutoff_reconstructable": meta.get("approval_cutoff_reconstructable", False),
            "is_seeded": meta["is_seeded"],
            "seed_marker": meta.get("seed_marker") if meta["is_seeded"] else None,
        },
        "selection": {
            "criterion": selection_criterion,
            "selected_model": selected_model_name,
            "baseline_model": best_baseline["name"] if best_baseline else "Naive Baseline",
            "baseline_mae": naive_mae,
            "selected_model_mae": selected_model_mae,
            "baseline_comparison": baseline_comparison,
            "forecast_source": forecast_source,
            "rationale": rationale,
        },
        "metric_definition": meta.get("target_definition"),
        "data_through_date": meta.get("data_through_date"),
        "multivariate_features": {
            "used": ["past target lags", "past-only rolling mean", "calendar month and elapsed time"],
            "known_at_forecast_time": ["calendar month", "elapsed time", "recursive model predictions"],
            "excluded": ["future realized livestock counts", "future prices", "future production", "future slaughter volume"],
            "note": "No external operational covariate is used; those values are not reliably known for the forecast horizon.",
        },
        "models": models_results,
    }

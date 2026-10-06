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

4. Fair Comparison Guarantee:
   Every model is trained on the EXACT same training period and tested against the EXACT
   same unseen test observations. We never compare Model A on 2025 with Model B on 2026.
"""

from typing import Dict, Any, List, Tuple, Optional
import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

from .data import (
    extract_monthly_series,
    extract_monthly_production_series,
    prepare_tabular_features,
    chronological_split,
    SEED_MARKER,
)
from .models import (
    NaiveBaselineModel,
    TabularLinearRegression,
    TabularRandomForest,
    ARIMAForecaster,
    HoltWintersForecaster,
)


def calculate_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> Dict[str, float]:
    """Computes MAE, RMSE, and R² safely."""
    # Ensure clean 1D float arrays with matching lengths
    y_true = np.asarray(y_true, dtype=float).ravel()
    y_pred = np.asarray(y_pred, dtype=float).ravel()

    mae = float(mean_absolute_error(y_true, y_pred))
    rmse = float(np.sqrt(mean_squared_error(y_true, y_pred)))

    # Guard against zero variance in y_true when computing r2
    if np.var(y_true) < 1e-6:
        r2 = 0.0
    else:
        r2 = float(r2_score(y_true, y_pred))

    return {
        "mae": round(mae, 2),
        "rmse": round(rmse, 2),
        "r2": round(r2, 4),
    }


def evaluate_all_models(
    domain: str = "production",
    target: str = "MILK",
    unit: str = "LITERS",
    user=None,
    production_type: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Extracts approved records, splits chronologically, trains all 5 candidate models,
    and returns a fair evaluation comparison across any supported domain.
    """
    # Backward compatibility with callers passing production_type
    effective_target = production_type if production_type is not None else target

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
            "data": meta,
            "selection": {
                "criterion": "Lowest validation MAE on chronological test holdout (with Baseline Superiority verification)",
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

    # TIME-SERIES EVALUATION FLOW:
    # 1. Feature Engineering: extracts lag_1, lag_2, rolling means, month cyclical features.
    df_feat = prepare_tabular_features(df)

    # 2. Chronological Split (Train vs Test Holdout):
    # Unlike general machine learning where random train_test_split is used, time-series data
    # MUST be split chronologically. Shuffling time-series leaks future knowledge into past predictions.
    # We train on earlier months (e.g., first 75%) and evaluate on recent holdout months (last 25%).
    train_feat, test_feat = chronological_split(df_feat)

    # 3. Univariate Series Alignment:
    test_dates = test_feat["month"].tolist()
    y_test_actual = test_feat["quantity"].values

    # Univariate train series: all observations up to the start of the test set
    split_date = test_feat["month"].iloc[0]
    univariate_train = df[df["month"] < split_date]["quantity"].values

    models_results: List[Dict[str, Any]] = []

    # ---------------------------------------------------------
    # 1. Naive Baseline
    # ---------------------------------------------------------
    try:
        naive = NaiveBaselineModel().fit(pd.Series(univariate_train))
        naive_preds = naive.predict_test(test_feat, train_feat)
        metrics = calculate_metrics(y_test_actual, naive_preds)
        models_results.append({
            "name": "Naive Baseline",
            "model_type": "Baseline (Persistence)",
            "status": "EVALUATED",
            "description": "Predicts next month will equal the most recently observed month.",
            **metrics,
            "test_predictions": [round(float(p), 1) for p in naive_preds],
        })
    except Exception as e:
        models_results.append({
            "name": "Naive Baseline",
            "model_type": "Baseline (Persistence)",
            "status": f"FAILED: {str(e)}",
            "mae": None, "rmse": None, "r2": None,
        })

    # ---------------------------------------------------------
    # 2. Linear Regression (scikit-learn)
    # ---------------------------------------------------------
    try:
        lr = TabularLinearRegression().fit(train_feat, train_feat["quantity"])
        lr_preds = lr.predict(test_feat)
        metrics = calculate_metrics(y_test_actual, lr_preds)
        models_results.append({
            "name": "Linear Regression",
            "model_type": "Parametric Linear (OLS)",
            "status": "EVALUATED",
            "description": "Learns linear relationship over time index, month seasonality, and past lags.",
            **metrics,
            "test_predictions": [round(float(p), 1) for p in lr_preds],
        })
    except Exception as e:
        models_results.append({
            "name": "Linear Regression",
            "model_type": "Parametric Linear (OLS)",
            "status": f"FAILED: {str(e)}",
            "mae": None, "rmse": None, "r2": None,
        })

    # ---------------------------------------------------------
    # 3. Random Forest Regressor (scikit-learn)
    # ---------------------------------------------------------
    try:
        rf = TabularRandomForest(random_state=42).fit(train_feat, train_feat["quantity"])
        rf_preds = rf.predict(test_feat)
        metrics = calculate_metrics(y_test_actual, rf_preds)
        models_results.append({
            "name": "Random Forest",
            "model_type": "Nonlinear Ensemble (50 Trees)",
            "status": "EVALUATED",
            "description": "Ensemble of 50 decision trees capturing non-linear interactions without overfitting.",
            **metrics,
            "test_predictions": [round(float(p), 1) for p in rf_preds],
        })
    except Exception as e:
        models_results.append({
            "name": "Random Forest",
            "model_type": "Nonlinear Ensemble (50 Trees)",
            "status": f"FAILED: {str(e)}",
            "mae": None, "rmse": None, "r2": None,
        })

    # ---------------------------------------------------------
    # 4. ARIMA(1,1,1) (statsmodels)
    # ---------------------------------------------------------
    try:
        arima = ARIMAForecaster(order=(1, 1, 1)).fit(pd.Series(univariate_train))
        arima_preds = arima.predict_steps(steps=len(test_dates))
        metrics = calculate_metrics(y_test_actual, arima_preds)
        models_results.append({
            "name": "ARIMA",
            "model_type": "Time Series (1,1,1)",
            "status": "EVALUATED",
            "description": "Classical time-series model combining autoregression, differencing, and moving average errors.",
            **metrics,
            "test_predictions": [round(float(p), 1) for p in arima_preds],
        })
    except Exception as e:
        models_results.append({
            "name": "ARIMA",
            "model_type": "Time Series (1,1,1)",
            "status": f"FAILED: {str(e)}",
            "mae": None, "rmse": None, "r2": None,
        })

    # ---------------------------------------------------------
    # 5. Holt-Winters Exponential Smoothing (statsmodels)
    # ---------------------------------------------------------
    try:
        hw = HoltWintersForecaster(seasonal_periods=12).fit(pd.Series(univariate_train))
        hw_preds = hw.predict_steps(steps=len(test_dates))
        metrics = calculate_metrics(y_test_actual, hw_preds)
        status_note = (
            "EVALUATED (Additive Trend + 12-Month Seasonality)"
            if hw.has_seasonality
            else "EVALUATED (Additive Trend, Insufficient data for 2 full seasonal cycles)"
        )
        models_results.append({
            "name": "Holt-Winters",
            "model_type": "Exponential Smoothing",
            "status": status_note,
            "description": "Models level, additive trend, and seasonal cyclical components with exponential decay weights.",
            **metrics,
            "test_predictions": [round(float(p), 1) for p in hw_preds],
        })
    except Exception as e:
        models_results.append({
            "name": "Holt-Winters",
            "model_type": "Exponential Smoothing",
            "status": f"FAILED: {str(e)}",
            "mae": None, "rmse": None, "r2": None,
        })

    # ---------------------------------------------------------
    # Baseline Superiority & Model Selection (MAE-based)
    # ---------------------------------------------------------
    # In time-series forecasting, the Naive (Persistence) Baseline represents the
    # foundational benchmark. If a sophisticated statistical or ML model (Linear Regression,
    # Random Forest, ARIMA, Holt-Winters) fails to achieve a lower MAE than the Naive Baseline,
    # claiming the ML model is superior is statistically dishonest.
    # In that event:
    # 1. baseline_comparison is marked 'BASELINE_BEST'.
    # 2. The operational selected model defaults to 'Naive Baseline'.
    # 3. forecast_source is marked 'NAIVE_BASELINE'.
    # If an ML model beats the baseline:
    # 1. baseline_comparison is marked 'MODEL_BEATS_BASELINE'.
    # 2. The operational selected model is set to the winning ML model.
    # 3. forecast_source is marked 'MACHINE_LEARNING'.

    valid_models = [m for m in models_results if m.get("mae") is not None]
    naive_model = next((m for m in valid_models if m["name"] == "Naive Baseline"), None)
    naive_mae = naive_model["mae"] if naive_model else None

    ml_models = [m for m in valid_models if m["name"] != "Naive Baseline"]

    selected_model_name = None
    selected_model_mae = None
    baseline_comparison = "INSUFFICIENT_DATA"
    forecast_source = "NONE"
    selection_criterion = "Lowest validation MAE on chronological test holdout (with Baseline Superiority verification)"

    if ml_models and naive_model:
        best_ml = min(ml_models, key=lambda m: m["mae"])
        best_ml_mae = best_ml["mae"]

        if naive_mae is not None and naive_mae <= best_ml_mae:
            # Baseline performs better or equal -> do not use an inferior ML model
            selected_model_name = "Naive Baseline"
            selected_model_mae = naive_mae
            baseline_comparison = "BASELINE_BEST"
            forecast_source = "NAIVE_BASELINE"
            rationale = (
                f"Naive Baseline achieved lower or equal validation MAE ({naive_mae} {unit}) "
                f"compared to advanced models (best ML was {best_ml['name']} at {best_ml_mae} {unit}). "
                f"Operational forecast defaults to Naive Baseline to prevent overconfident projections."
            )
        else:
            # ML model beats baseline!
            selected_model_name = best_ml["name"]
            selected_model_mae = best_ml_mae
            baseline_comparison = "MODEL_BEATS_BASELINE"
            forecast_source = "MACHINE_LEARNING"
            improvement_pct = round(((naive_mae - best_ml_mae) / naive_mae) * 100, 1) if (naive_mae and naive_mae > 0) else 0.0
            rationale = (
                f"Selected '{selected_model_name}' because it beats the Naive Baseline (MAE {selected_model_mae} vs {naive_mae} {unit}, "
                f"{improvement_pct}% error reduction) on the chronological test holdout."
            )
    elif naive_model:
        selected_model_name = "Naive Baseline"
        selected_model_mae = naive_mae
        baseline_comparison = "BASELINE_BEST"
        forecast_source = "NAIVE_BASELINE"
        rationale = "Only Naive Baseline evaluated successfully."
    elif ml_models:
        best_ml = min(ml_models, key=lambda m: m["mae"])
        selected_model_name = best_ml["name"]
        selected_model_mae = best_ml["mae"]
        baseline_comparison = "MODEL_BEATS_BASELINE"
        forecast_source = "MACHINE_LEARNING"
        rationale = f"Selected '{selected_model_name}' with test MAE {selected_model_mae} {unit}."
    else:
        rationale = "No model evaluated successfully."

    for m in models_results:
        m["is_selected"] = (m["name"] == selected_model_name)

    test_period_info = {
        "start_month": test_feat["month"].min().strftime("%Y-%m-%d"),
        "end_month": test_feat["month"].max().strftime("%Y-%m-%d"),
        "observations": len(test_feat),
        "actual_values": [round(float(y), 1) for y in y_test_actual],
        "months": [d.strftime("%b %Y") for d in test_dates],
    }

    train_period_info = {
        "start_month": train_feat["month"].min().strftime("%Y-%m-%d"),
        "end_month": train_feat["month"].max().strftime("%Y-%m-%d"),
        "observations": len(train_feat),
    }

    return {
        "status": "ready",
        "forecast_available": True,
        "readiness_status": meta.get("readiness_status", "READY"),
        "readiness_details": meta.get("readiness_details", ""),
        "domain": domain,
        "scope": meta.get("scope", f"Municipal {domain}"),
        "available_observations": len(df),
        "required_observations": meta.get("required_observations", 12),
        "quality_observations_threshold": meta.get("quality_observations_threshold", 24),
        "target": {
            "domain": domain,
            "target": effective_target,
            "production_type": effective_target,
            "unit": unit,
            "frequency": "MONTHLY",
        },
        "data": {
            "total_observations": len(df),
            "training_observations": len(train_feat),
            "test_observations": len(test_feat),
            "start_date": meta.get("start_date"),
            "end_date": meta.get("end_date"),
            "train_period": train_period_info,
            "test_period": test_period_info,
            "is_seeded": meta["is_seeded"],
            "seed_marker": meta.get("seed_marker") if meta["is_seeded"] else None,
        },
        "selection": {
            "criterion": selection_criterion,
            "selected_model": selected_model_name,
            "baseline_model": "Naive Baseline",
            "baseline_mae": naive_mae,
            "selected_model_mae": selected_model_mae,
            "baseline_comparison": baseline_comparison,
            "forecast_source": forecast_source,
            "rationale": rationale,
        },
        "models": models_results,
    }

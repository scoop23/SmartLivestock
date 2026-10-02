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
        return {
            "status": "insufficient_data",
            "forecast_available": False,
            "domain": domain,
            "target": {
                "domain": domain,
                "target": effective_target,
                "production_type": effective_target,
                "unit": unit,
            },
            "message": meta.get("message", "Insufficient historical observations."),
            "historical_trend": meta.get("historical_trend", []),
            "data": meta,
            "models": [],
        }

    # Prepare tabular features for ML models
    df_feat = prepare_tabular_features(df)

    # Perform chronological train/test split on tabular dataset
    train_feat, test_feat = chronological_split(df_feat)

    # Also prepare univariate series aligned with the test dates
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
    # Model Selection: Lowest Validation MAE
    # ---------------------------------------------------------
    # Filter only successfully evaluated models
    valid_models = [m for m in models_results if m.get("mae") is not None]

    selected_model_name = None
    selection_criterion = "Lowest validation MAE on unseen test period"

    if valid_models:
        best_model = min(valid_models, key=lambda m: m["mae"])
        selected_model_name = best_model["name"]
        for m in models_results:
            m["is_selected"] = (m["name"] == selected_model_name)
    else:
        best_model = None

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
        "domain": domain,
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
            "train_period": train_period_info,
            "test_period": test_period_info,
            "is_seeded": meta["is_seeded"],
            "seed_marker": meta.get("seed_marker") if meta["is_seeded"] else None,
        },
        "selection": {
            "criterion": selection_criterion,
            "selected_model": selected_model_name,
            "rationale": (
                f"Selected '{selected_model_name}' because it achieved the lowest test MAE "
                f"({best_model['mae']} {unit}) on the chronological test split."
                if best_model
                else "No model evaluated successfully."
            ),
        },
        "models": models_results,
    }

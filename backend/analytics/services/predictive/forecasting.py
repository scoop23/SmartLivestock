"""
Future Forecast Generation Engine.

=============================================================================
EDUCATIONAL OVERVIEW: OUT-OF-SAMPLE FORECASTING
=============================================================================
Once models are evaluated and benchmarked on the test period:
1. We select the winning model based on lowest test MAE.
2. We re-fit the winning model on ALL historical data (so it learns from both
   train and test periods up to the present day).
3. We project forward into the UNSEEN FUTURE (e.g. next 3 to 6 months).
4. For tabular models (Linear Regression, Random Forest), recursive forecasting
   is used: predicting month t + 1, then using that prediction as lag_1 for t + 2.
5. The API packages both historical actuals and future predictions into a single
   timeline so the frontend Recharts line chart can render the continuous transition.
"""

from typing import Dict, Any, List, Optional
from datetime import date
from dateutil.relativedelta import relativedelta
import numpy as np
import pandas as pd

from .data import (
    extract_monthly_series,
    extract_monthly_production_series,
    prepare_tabular_features,
)
from .models import (
    NaiveBaselineModel,
    TabularLinearRegression,
    TabularRandomForest,
    ARIMAForecaster,
    HoltWintersForecaster,
)
from .evaluation import evaluate_all_models


def generate_future_forecast(
    domain: str = "production",
    target: str = "MILK",
    unit: str = "LITERS",
    horizon_months: int = 6,
    preferred_model: Optional[str] = None,
    user=None,
    production_type: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Produces out-of-sample future forecasts using the best evaluated model (or specified model)
    across any supported domain (production, disease, mortality, slaughter, auction).
    """
    # Backward compatibility with callers passing production_type
    effective_target = production_type if production_type is not None else target

    # Step 1: Run model evaluation to discover the best performing model
    eval_res = evaluate_all_models(
        domain=domain,
        target=effective_target,
        unit=unit,
        user=user,
    )
    if eval_res.get("status") == "insufficient_data":
        return eval_res

    selected_model_name = preferred_model or eval_res["selection"]["selected_model"] or "Linear Regression"

    # Step 2: Extract the full historical dataset
    df, meta = extract_monthly_series(
        domain=domain,
        target=effective_target,
        unit=unit,
        user=user,
    )
    if df is None:
        return eval_res

    # Bound horizon: between 1 and 12 months
    horizon = max(1, min(int(horizon_months), 12))

    # Determine future dates
    last_date = df["month"].max()
    future_dates = [last_date + relativedelta(months=i) for i in range(1, horizon + 1)]

    predicted_values: List[float] = []

    # Step 3: Train and project based on chosen model architecture
    if selected_model_name == "ARIMA":
        arima = ARIMAForecaster(order=(1, 1, 1)).fit(df["quantity"])
        raw_preds = arima.predict_steps(steps=horizon)
        predicted_values = [round(max(0.0, float(v)), 1) for v in raw_preds]

    elif selected_model_name == "Holt-Winters":
        hw = HoltWintersForecaster(seasonal_periods=12).fit(df["quantity"])
        raw_preds = hw.predict_steps(steps=horizon)
        predicted_values = [round(max(0.0, float(v)), 1) for v in raw_preds]

    elif selected_model_name in ("Random Forest", "Linear Regression"):
        # Tabular models require recursive multi-step forecasting
        df_feat = prepare_tabular_features(df)
        if selected_model_name == "Random Forest":
            model = TabularRandomForest(random_state=42).fit(df_feat, df_feat["quantity"])
        else:
            model = TabularLinearRegression().fit(df_feat, df_feat["quantity"])

        # Recursive step-by-step projection
        cur_history = list(df["quantity"].values)
        cur_time_step = len(df)

        for f_date in future_dates:
            lag1 = cur_history[-1]
            lag2 = cur_history[-2] if len(cur_history) >= 2 else lag1
            lag3 = cur_history[-3] if len(cur_history) >= 3 else lag2
            roll3 = np.mean(cur_history[-3:])

            row_dict = {
                "time_step": cur_time_step,
                "month_num": f_date.month,
                "lag_1": lag1,
                "lag_2": lag2,
                "lag_3": lag3,
                "rolling_mean_3": roll3,
            }
            X_future = pd.DataFrame([row_dict])
            pred_val = float(model.predict(X_future)[0])
            pred_val = round(max(0.0, pred_val), 1)

            predicted_values.append(pred_val)
            cur_history.append(pred_val)
            cur_time_step += 1

    else:
        # Default fallback: Naive Persistence (last observed value)
        last_val = float(df["quantity"].iloc[-1])
        predicted_values = [round(last_val, 1)] * horizon
        selected_model_name = "Naive Baseline"

    # Step 4: Assemble historical timeline
    historical_timeline = [
        {
            "date": row["month"].strftime("%Y-%m-%d"),
            "month_label": row["month"].strftime("%b %Y"),
            "actual": round(float(row["quantity"]), 1),
            "forecast": None,
        }
        for _, row in df.iterrows()
    ]

    # Stitch the transition point: give the last historical item the forecast value too
    # so the chart line connects smoothly
    if historical_timeline:
        historical_timeline[-1]["forecast"] = historical_timeline[-1]["actual"]

    future_timeline = [
        {
            "date": f_date.strftime("%Y-%m-%d"),
            "month_label": f_date.strftime("%b %Y"),
            "actual": None,
            "forecast": pred_val,
        }
        for f_date, pred_val in zip(future_dates, predicted_values)
    ]

    combined_timeline = historical_timeline + future_timeline

    # Summary metrics
    recent_baseline = float(df["quantity"].iloc[-3:].mean())
    forecast_avg = float(np.mean(predicted_values)) if predicted_values else recent_baseline
    pct_change = round(((forecast_avg - recent_baseline) / recent_baseline) * 100, 1) if recent_baseline > 0 else 0.0

    return {
        "status": "ready",
        "forecast_available": True,
        "domain": domain,
        "model": selected_model_name,
        "target": {
            "domain": domain,
            "target": effective_target,
            "production_type": effective_target,
            "unit": unit,
            "frequency": "MONTHLY",
        },
        "metadata": {
            "horizon_months": horizon,
            "is_seeded": meta["is_seeded"],
            "seed_marker": meta.get("seed_marker"),
            "last_historical_date": last_date.strftime("%Y-%m-%d"),
            "recent_baseline_avg": round(recent_baseline, 1),
            "forecast_period_avg": round(forecast_avg, 1),
            "projected_change_pct": pct_change,
        },
        "evaluation_summary": eval_res.get("selection", {}),
        "forecast": [
            {
                "date": f_date.strftime("%Y-%m-%d"),
                "month_label": f_date.strftime("%b %Y"),
                "predicted": val,
            }
            for f_date, val in zip(future_dates, predicted_values)
        ],
        "chart_data": combined_timeline,
    }

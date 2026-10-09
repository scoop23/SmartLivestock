"""Experimental forecasting service for the isolated synthetic cow dataset.

Flow: demo tables -> past-only features -> chronological model comparison ->
selected model refit -> seven recursive daily estimates. No ProductionRecord,
farmer inventory, or official analytics table is read or written here.
"""

from datetime import date, timedelta

import numpy as np
import pandas as pd
from django.utils import timezone
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import OneHotEncoder

from analytics.models import IndividualMilkDemoCow
from analytics.seed_markers import SEED_MARKER_INDIVIDUAL_MILK_DEMO


MIN_COW_HISTORY = 30
FORECAST_HORIZON_DAYS = 7
NUMERIC_FEATURES = [
    "lag_1", "lag_2", "lag_3", "lag_7", "rolling_mean_3", "rolling_mean_7",
    "day_of_week", "month", "age_years", "weight_kg", "days_since_calving",
    "health_events_previous_7d", "prior_day_temperature_c", "prior_day_humidity_pct",
    "prior_day_precipitation_mm",
]
CATEGORICAL_FEATURES = ["breed", "sex"]
WEATHER_FEATURE_LABELS = {
    "prior_day_temperature_c": "Previous-day mean temperature from Open-Meteo",
    "prior_day_humidity_pct": "Previous-day mean relative humidity from Open-Meteo",
    "prior_day_precipitation_mm": "Previous-day precipitation from Open-Meteo",
}


def _eligible_cows():
    """Return only cows explicitly marked as belonging to this demo dataset."""
    # Filtering by the unique marker prevents accidentally mixing in unrelated analytics data.
    return IndividualMilkDemoCow.objects.filter(
        seed_marker=SEED_MARKER_INDIVIDUAL_MILK_DEMO
    ).prefetch_related("observations")


def _age_years(birth_date, reference_date):
    """Convert an existing birth date to an age feature at a specific cutoff date."""
    # The reference date matters: a training row may only use the cow's age on that day.
    if not birth_date or birth_date > reference_date:
        return None
    return round((reference_date - birth_date).days / 365.2425, 3)


def _days_since_calving(calving_date, reference_date):
    """Derive lactation timing from the available calving date without guessing missing dates."""
    if not calving_date:
        return None
    return max(0, (reference_date - calving_date).days)


def list_demo_cows():
    """Build the selector payload from demo animals, not registered farmer inventory."""
    result = []
    for cow in _eligible_cows():
        latest_observation = next(
            (item for item in reversed(list(cow.observations.all()))
             if item.seed_marker == SEED_MARKER_INDIVIDUAL_MILK_DEMO),
            None,
        )
        reference_date = latest_observation.record_date if latest_observation else timezone.localdate()
        result.append({
            "id": cow.demo_id,
            "tag_number": cow.tag_number,
            "breed": cow.breed,
            "sex": cow.sex,
            "age_years": _age_years(cow.birth_date, reference_date),
            "weight_kg": float(cow.weight_kg) if cow.weight_kg is not None else None,
            "days_since_calving": _days_since_calving(cow.calving_date, reference_date),
            "observation_count": sum(
                item.seed_marker == SEED_MARKER_INDIVIDUAL_MILK_DEMO
                for item in cow.observations.all()
            ),
        })
    return result


def _build_feature_frame(cows, weather_rows=None):
    """Create one model row per date using only information known before that date's yield."""
    weather_rows = weather_rows or {}
    rows = []
    for cow in cows:
        observations = [
            item for item in cow.observations.all()
            if item.seed_marker == SEED_MARKER_INDIVIDUAL_MILK_DEMO
        ]
        observations.sort(key=lambda item: item.record_date)
        for observation in observations:
            # Training uses the preceding date's weather, so the target day's
            # observed weather can never leak into a historical prediction row.
            prior_weather = weather_rows.get((observation.record_date - timedelta(days=1)).isoformat(), {})
            rows.append({
                "cow_id": cow.demo_id,
                "date": observation.record_date,
                "milk_quantity_liters": float(observation.milk_quantity_liters),
                "disease_active": int(observation.disease_active),
                "breed": cow.breed or None,
                "sex": cow.sex or None,
                "age_years": _age_years(cow.birth_date, observation.record_date),
                "weight_kg": float(cow.weight_kg) if cow.weight_kg is not None else None,
                "days_since_calving": _days_since_calving(cow.calving_date, observation.record_date),
                "prior_day_temperature_c": prior_weather.get("temperature_c"),
                "prior_day_humidity_pct": prior_weather.get("humidity_pct"),
                "prior_day_precipitation_mm": prior_weather.get("precipitation_mm"),
            })

    if not rows:
        return pd.DataFrame()

    # Rows are sorted before group shifts so each lag belongs to the same cow's past.
    frame = pd.DataFrame(rows).sort_values(["cow_id", "date"]).reset_index(drop=True)
    grouped_yield = frame.groupby("cow_id", sort=False)["milk_quantity_liters"]
    grouped_health = frame.groupby("cow_id", sort=False)["disease_active"]
    for lag_days in (1, 2, 3, 7):
        frame[f"lag_{lag_days}"] = grouped_yield.shift(lag_days)

    # Shift health before rolling: same-day illness flags may not yet be known when predicting that day's milk.
    frame["rolling_mean_3"] = grouped_yield.transform(lambda values: values.shift(1).rolling(3).mean())
    frame["rolling_mean_7"] = grouped_yield.transform(lambda values: values.shift(1).rolling(7).mean())
    frame["health_events_previous_7d"] = grouped_health.transform(
        lambda values: values.shift(1).rolling(7).sum()
    )
    frame["day_of_week"] = pd.to_datetime(frame["date"]).dt.dayofweek
    frame["month"] = pd.to_datetime(frame["date"]).dt.month

    # The first seven records lack a full seven-day history, so they cannot train/evaluate the model.
    return frame.dropna(subset=["lag_1", "lag_2", "lag_3", "lag_7", "rolling_mean_3", "rolling_mean_7", "health_events_previous_7d"]).reset_index(drop=True)


def _make_model(model_name, numeric_features=None, categorical_features=None):
    """Create a model pipeline that encodes breed/sex and keeps numeric features intact."""
    numeric_features = numeric_features or NUMERIC_FEATURES
    categorical_features = categorical_features or CATEGORICAL_FEATURES
    # Fit the category encoder only on training rows; unseen categories are safely ignored.
    categorical_pipeline = Pipeline([
        ("fill_missing", SimpleImputer(strategy="constant", fill_value="Unknown")),
        ("encode", OneHotEncoder(handle_unknown="ignore")),
    ])
    preparation = ColumnTransformer(
        transformers=[
            # Median values are learned from training rows only, so the holdout does not influence imputation.
                ("numeric", SimpleImputer(strategy="median"), numeric_features),
                ("categories", categorical_pipeline, categorical_features),
        ]
    )
    estimator = (
        LinearRegression()
        if model_name == "Linear Regression"
        else RandomForestRegressor(
            n_estimators=120,
            max_depth=7,
            min_samples_leaf=2,
            random_state=42,
            n_jobs=1,
        )
    )
    return Pipeline([("features", preparation), ("regressor", estimator)])


def _metrics(actual, predicted):
    """Summarize regression errors in liters; these are demo-only holdout scores."""
    actual = np.asarray(actual, dtype=float)
    predicted = np.asarray(predicted, dtype=float)
    return {
        "mae": round(float(mean_absolute_error(actual, predicted)), 3),
        "rmse": round(float(np.sqrt(mean_squared_error(actual, predicted))), 3),
        "r2": round(float(r2_score(actual, predicted)), 4) if np.var(actual) > 1e-8 else None,
    }


def _evaluate_candidates(frame):
    """Compare persistence, linear regression, and random forest on a chronological holdout."""
    dates = sorted(frame["date"].unique())
    split_index = int(len(dates) * 0.8)
    split_index = min(max(split_index, 1), len(dates) - 1)
    split_date = dates[split_index]
    train = frame[frame["date"] < split_date]
    test = frame[frame["date"] >= split_date]

    # The latest 20% of dates are held out, never shuffled into training.
    if len(train) < 20 or len(test) < 10:
        return None
    actual = test["milk_quantity_liters"].to_numpy(dtype=float)
    # Optional weather columns are used only if this demo request actually has weather data.
    numeric_features = [name for name in NUMERIC_FEATURES if frame[name].notna().any()]
    feature_columns = numeric_features + CATEGORICAL_FEATURES
    results = [{
        "name": "Naive Baseline",
        "description": "Repeats the most recent observed daily milk quantity.",
        **_metrics(actual, test["lag_1"].to_numpy(dtype=float)),
    }]
    for model_name in ("Linear Regression", "Random Forest"):
        model = _make_model(model_name, numeric_features, CATEGORICAL_FEATURES)
        model.fit(train[feature_columns], train["milk_quantity_liters"])
        predictions = model.predict(test[feature_columns])
        results.append({
            "name": model_name,
            "description": (
                "Fits linear effects from past yields and cow characteristics."
                if model_name == "Linear Regression"
                else "Fits nonlinear patterns from past yields and cow characteristics."
            ),
            **_metrics(actual, predictions),
        })

    # Choosing lowest held-out MAE gives the transparent persistence baseline a fair chance to win.
    selected = min(results, key=lambda item: item["mae"])
    return {
        "results": results,
        "selected_model": selected["name"],
        "methodology": (
            "Dates were split chronologically: earliest 80% for training, latest 20% for testing. "
            "Test values use rolling one-day-ahead features built only from dates before each target date."
        ),
        "train_samples": int(len(train)),
        "test_samples": int(len(test)),
        "train_end_date": str(train["date"].max()),
        "test_start_date": str(test["date"].min()),
        "test_end_date": str(test["date"].max()),
    }


def _forecast_next_week(cow, observations, frame, selected_model, weather_rows=None):
    """Generate seven recursive daily estimates, feeding each estimate into the next day's lags."""
    weather_rows = weather_rows or {}
    numeric_features = [name for name in NUMERIC_FEATURES if frame[name].notna().any()]
    feature_columns = numeric_features + CATEGORICAL_FEATURES
    model = None
    if selected_model != "Naive Baseline":
        model = _make_model(selected_model, numeric_features, CATEGORICAL_FEATURES)
        model.fit(frame[feature_columns], frame["milk_quantity_liters"])

    recent_yields = [float(item.milk_quantity_liters) for item in observations[-7:]]
    recent_health = [bool(item.disease_active) for item in observations[-7:]]
    last_date = observations[-1].record_date
    output = []

    for forecast_day in range(1, FORECAST_HORIZON_DAYS + 1):
        target_date = last_date + timedelta(days=forecast_day)
        if selected_model == "Naive Baseline":
            prediction = recent_yields[-1]
        else:
            # Future weather is forecast by Open-Meteo; use the date before each
            # target day, matching the no-look-ahead rule used for training rows.
            prior_weather = weather_rows.get((target_date - timedelta(days=1)).isoformat(), {})
            feature_row = {
                "lag_1": recent_yields[-1],
                "lag_2": recent_yields[-2],
                "lag_3": recent_yields[-3],
                "lag_7": recent_yields[-7],
                "rolling_mean_3": float(np.mean(recent_yields[-3:])),
                "rolling_mean_7": float(np.mean(recent_yields[-7:])),
                "day_of_week": target_date.weekday(),
                "month": target_date.month,
                "age_years": _age_years(cow.birth_date, target_date),
                "weight_kg": float(cow.weight_kg) if cow.weight_kg is not None else None,
                "days_since_calving": _days_since_calving(cow.calving_date, target_date),
                "health_events_previous_7d": sum(recent_health[-7:]),
                "prior_day_temperature_c": prior_weather.get("temperature_c"),
                "prior_day_humidity_pct": prior_weather.get("humidity_pct"),
                "prior_day_precipitation_mm": prior_weather.get("precipitation_mm"),
                "breed": cow.breed or None,
                "sex": cow.sex or None,
            }
            prediction = float(model.predict(pd.DataFrame([feature_row])[feature_columns])[0])

        prediction = max(0.0, prediction)
        output.append({"date": target_date.isoformat(), "expected_liters": round(prediction, 2)})
        recent_yields.append(prediction)
        # No future health events are fabricated; the recursive window assumes no newly reported event.
        recent_health.append(False)

    return output


def get_individual_milk_forecast(demo_id, weather_rows=None, weather_message=None):
    """Return demo history, readiness, validation metrics, and a seven-day cow forecast."""
    weather_rows = weather_rows or {}
    cow = _eligible_cows().filter(demo_id=demo_id).first()
    if cow is None:
        return None
    observations = [
        item for item in cow.observations.all()
        if item.seed_marker == SEED_MARKER_INDIVIDUAL_MILK_DEMO
    ]
    observations.sort(key=lambda item: item.record_date)
    history = [{
        "date": item.record_date.isoformat(),
        "milk_liters": float(item.milk_quantity_liters),
    } for item in observations[-30:]]
    reference_date = observations[-1].record_date if observations else timezone.localdate()
    cow_info = {
        "id": cow.demo_id,
        "tag_number": cow.tag_number,
        "breed": cow.breed,
        "sex": cow.sex,
        "age_years": _age_years(cow.birth_date, reference_date),
        "weight_kg": float(cow.weight_kg) if cow.weight_kg is not None else None,
        "days_since_calving": _days_since_calving(cow.calving_date, reference_date),
    }
    base = {
        "title": "Individual Cow 7-Day Milk Production Forecast",
        "data_source": "synthetic_demo",
        "livestock": cow_info,
        "observation_count": len(observations),
        "minimum_history_required": MIN_COW_HISTORY,
        "history": history,
        "horizon_days": FORECAST_HORIZON_DAYS,
        "limitations": (
            "Experimental demonstration only. Synthetic records do not validate biological accuracy. "
            "Missing numeric characteristics are imputed from training rows; missing categories use Unknown. "
            "Future health events are unknown and are not fabricated. Pregnancy, milking frequency, and feed are not modeled."
        ),
        "weather": {
            "provider": "Open-Meteo",
            "available": False,
            "used_in_forecast": False,
            "message": weather_message or "Weather was not provided for this demo forecast.",
        },
    }

    if len(observations) < MIN_COW_HISTORY:
        return {
            **base,
            "status": "NOT_READY",
            "reason": "Insufficient historical production data for this demo cow.",
            "forecast": [],
            "evaluation": None,
        }

    frame = _build_feature_frame(_eligible_cows(), weather_rows)
    evaluation = _evaluate_candidates(frame) if not frame.empty else None
    if evaluation is None:
        return {
            **base,
            "status": "NOT_READY",
            "reason": "The isolated demo dataset does not yet contain enough chronological observations for model evaluation.",
            "forecast": [],
            "evaluation": None,
        }

    cow_frame = frame[frame["cow_id"] == cow.demo_id]
    if cow_frame.empty:
        return {
            **base,
            "status": "NOT_READY",
            "reason": "Insufficient lag history to prepare forecasting features for this demo cow.",
            "forecast": [],
            "evaluation": evaluation,
        }

    selected_model = evaluation["selected_model"]
    has_weather_features = any(
        feature in frame.columns and frame[feature].notna().any()
        for feature in WEATHER_FEATURE_LABELS
    )
    uses_weather = has_weather_features and selected_model != "Naive Baseline"
    forecast = _forecast_next_week(cow, observations, frame, selected_model, weather_rows)
    used_features = [
        "Historical milk lags and rolling averages", "Breed and sex", "Age and weight",
        "Days since calving", "Health events in the previous seven days", "Calendar day and month",
    ]
    if uses_weather:
        used_features.extend(
            label for feature, label in WEATHER_FEATURE_LABELS.items()
            if frame[feature].notna().any()
        )
    elif has_weather_features:
        weather_message = "Weather was available and evaluated, but the selected naive baseline does not use it."

    if uses_weather:
        weather_status_message = None
    elif has_weather_features:
        weather_status_message = weather_message
    else:
        weather_status_message = weather_message or "Open-Meteo weather was unavailable; weather features were omitted."

    chart_dates = [item.record_date for item in observations[-30:]] + [
        date.fromisoformat(item["date"]) for item in forecast
    ]
    weather_timeline = [
        {
            "date": chart_date.isoformat(),
            "temperature_c": weather_rows.get((chart_date - timedelta(days=1)).isoformat(), {}).get("temperature_c"),
            "humidity_pct": weather_rows.get((chart_date - timedelta(days=1)).isoformat(), {}).get("humidity_pct"),
            "precipitation_mm": weather_rows.get((chart_date - timedelta(days=1)).isoformat(), {}).get("precipitation_mm"),
        }
        for chart_date in chart_dates
    ]

    return {
        **base,
        "status": "READY",
        "reason": None,
        "forecast": forecast,
        "selected_model": selected_model,
        "baseline_model": "Naive Baseline",
        "evaluation": evaluation,
        "features_used": used_features if selected_model != "Naive Baseline" else [
            "Most recent synthetic milk quantity (naive baseline)"
        ],
        "weather": {
            "provider": "Open-Meteo",
            "available": has_weather_features,
            "used_in_forecast": uses_weather,
            "message": weather_status_message,
            "timeline": weather_timeline,
        },
    }

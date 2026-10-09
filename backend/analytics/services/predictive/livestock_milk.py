"""Forecast approved milk records for one currently authorized cow.

Flow: the view supplies this service with one livestock row and its approved,
date-aggregated milk records -> this module checks readiness -> builds features
from earlier records -> compares models chronologically -> recursively creates
seven expected daily yields. It never queries or writes the demo tables.
"""

from datetime import date, timedelta

import numpy as np
import pandas as pd
from django.utils import timezone

from analytics.services.predictive.individual_milk import _age_years, _days_since_calving, _make_model, _metrics


MIN_REAL_HISTORY_DAYS = 60
NUMERIC_FEATURES = [
    "lag_1", "lag_2", "lag_3", "lag_7", "rolling_mean_3", "rolling_mean_7",
    "day_of_week", "month", "age_years", "days_since_calving",
    "prior_day_temperature_c", "prior_day_humidity_pct", "prior_day_precipitation_mm",
]
CATEGORICAL_FEATURES = ["breed", "sex"]


def _feature_rows(livestock, daily_records, calving_events, weather_rows):
    """Build each training row from earlier recorded milk values and known animal facts."""
    rows = []
    yields = [float(record["milk_liters"]) for record in daily_records]
    dates = [record["date"] for record in daily_records]

    # The current weight has no historical timestamp, so exclude it to avoid future-data leakage.
    # Each target day becomes a training example; the previous yields are inputs,
    # and that day's yield is the value the model learns to estimate.
    for index in range(7, len(daily_records)):
        target_date = dates[index]
        # A calving event is usable only after its approval was visible at the target cutoff.
        known_calvings = [
            event_date for event_date, approval_date in calving_events
            if event_date <= target_date and approval_date <= target_date
        ]
        calving_date = max(known_calvings) if known_calvings else None
        previous_values = yields[:index]
        # Weather from the preceding date was already observable before this day's
        # milk target, avoiding use of same-day/future weather during training.
        prior_weather = weather_rows.get((target_date - timedelta(days=1)).isoformat(), {})
        rows.append({
            "date": target_date,
            "milk_liters": yields[index],
            "lag_1": previous_values[-1],
            "lag_2": previous_values[-2],
            "lag_3": previous_values[-3],
            "lag_7": previous_values[-7],
            "rolling_mean_3": float(np.mean(previous_values[-3:])),
            "rolling_mean_7": float(np.mean(previous_values[-7:])),
            "day_of_week": target_date.weekday(),
            "month": target_date.month,
            "age_years": _age_years(livestock.birth_date, target_date),
            "days_since_calving": _days_since_calving(calving_date, target_date),
            "prior_day_temperature_c": prior_weather.get("temperature_c"),
            "prior_day_humidity_pct": prior_weather.get("humidity_pct"),
            "prior_day_precipitation_mm": prior_weather.get("precipitation_mm"),
            "breed": livestock.breed or None,
            "sex": livestock.sex or None,
        })
    return pd.DataFrame(rows)


def _evaluate(frame, numeric_features):
    """Compare the naive baseline and two models using an ordered 80/20 date split."""
    # Testing on later dates better matches deployment: the model predicts future
    # milk values using patterns learned from earlier observations.
    split_index = int(len(frame) * 0.8)
    train, test = frame.iloc[:split_index], frame.iloc[split_index:]
    if len(train) < 20 or len(test) < 10:
        return None

    actual = test["milk_liters"].to_numpy(dtype=float)
    results = [{
        "name": "Naive Baseline",
        "description": "Repeats the most recent approved daily milk quantity.",
        **_metrics(actual, test["lag_1"].to_numpy(dtype=float)),
    }]
    feature_columns = numeric_features + CATEGORICAL_FEATURES
    for name in ("Linear Regression", "Random Forest"):
        model = _make_model(name, numeric_features, CATEGORICAL_FEATURES)
        model.fit(train[feature_columns], train["milk_liters"])
        results.append({
            "name": name,
            "description": "Evaluated on later records for this cow using past-only features.",
            **_metrics(actual, model.predict(test[feature_columns])),
        })

    selected = min(results, key=lambda item: item["mae"])
    return {
        "results": results,
        "selected_model": selected["name"],
        "methodology": "Chronological split: earliest 80% of records train the models; latest 20% are held out. Each row uses earlier records only.",
        "train_samples": len(train),
        "test_samples": len(test),
        "train_end_date": frame.iloc[split_index - 1]["date"].isoformat(),
        "test_start_date": frame.iloc[split_index]["date"].isoformat(),
        "test_end_date": frame.iloc[-1]["date"].isoformat(),
    }


def forecast_livestock_milk(livestock, daily_records, calving_events, weather_rows=None, weather_message=None):
    """Return an honest readiness result or a cow-specific seven-day forecast."""
    # Start with NOT_READY so every early return clearly tells the API/UI why a
    # forecast cannot yet be offered instead of returning an empty success.
    today = timezone.localdate()
    weather_rows = weather_rows or {}
    latest_date = daily_records[-1]["date"] if daily_records else today
    history = [
        {"date": item["date"].isoformat(), "milk_liters": item["milk_liters"]}
        for item in daily_records[-30:]
    ]
    eligible_calvings = [
        event_date for event_date, approval_date in calving_events
        if event_date <= today and approval_date <= today
    ]
    latest_calving = max(eligible_calvings) if eligible_calvings else None
    result = {
        "status": "NOT_READY",
        "data_source": "approved_livestock_records",
        "livestock": {
            "id": livestock.pk,
            "tag_number": livestock.tag_number,
            "livestock_type": livestock.livestock_type.name,
            "breed": livestock.breed or None,
            "sex": livestock.sex or None,
            "age_years": _age_years(livestock.birth_date, latest_date),
            "days_since_calving": _days_since_calving(latest_calving, latest_date),
        },
        "observation_count": len(daily_records),
        "minimum_history_required": MIN_REAL_HISTORY_DAYS,
        "horizon_days": 7,
        "history": history,
        "forecast": [],
        "evaluation": None,
        "features_used": [
            "Approved historical milk production",
            "Breed and sex",
            "Calendar date features",
        ],
        "weather": {
            "provider": "Open-Meteo",
            "location_source": "Farmer's barangay centroid",
            "location_name": livestock.farmer.barangay.barangay_name if livestock.farmer_id and livestock.farmer.barangay_id else None,
            "available": False,
            "used_in_forecast": False,
            "message": weather_message or "Weather is unavailable for this request; weather features were omitted.",
        },
        "limitations": (
            "Experimental estimate based on this animal's approved records. It is not a guaranteed biological prediction. "
            "Current weight is excluded because the inventory field has no historical timestamp. Disease history is excluded because available events are not reliably time-aligned to daily milk records; feed, pregnancy, and milking frequency are not modeled."
        ),
    }
    if len(daily_records) < MIN_REAL_HISTORY_DAYS:
        result["reason"] = (
            f"Insufficient approved daily milk history: {MIN_REAL_HISTORY_DAYS} dated observations are required; "
            f"this animal has {len(daily_records)}."
        )
        return result

    if (today - latest_date).days > 7:
        result["reason"] = "The latest approved milk record is more than seven days old. Record current production before forecasting the coming week."
        return result

    frame = _feature_rows(livestock, daily_records, calving_events, weather_rows)
    # A characteristic is included only when the cow has real values for it.
    numeric_features = [name for name in NUMERIC_FEATURES if frame[name].notna().any()]
    feature_columns = numeric_features + CATEGORICAL_FEATURES
    features_used = list(result["features_used"])
    if "age_years" in numeric_features:
        features_used.append("Age derived from recorded birth date")
    if "days_since_calving" in numeric_features:
        features_used.append("Days since last approved calving")
    weather_features = {
        "prior_day_temperature_c": "Previous-day mean temperature from Open-Meteo",
        "prior_day_humidity_pct": "Previous-day mean relative humidity from Open-Meteo",
        "prior_day_precipitation_mm": "Previous-day precipitation from Open-Meteo",
    }
    for feature, label in weather_features.items():
        if feature in numeric_features:
            features_used.append(label)
    result["features_used"] = features_used
    weather_used = any(feature in numeric_features for feature in weather_features)
    result["weather"] = {
        "provider": "Open-Meteo",
        "location_source": "Farmer's barangay centroid",
        "available": weather_used,
        "used_in_forecast": False,
        "message": None if weather_used else (
            weather_message or "Weather history was unavailable; the forecast used milk history and livestock characteristics only."
        ),
    }
    evaluation = _evaluate(frame, numeric_features)
    if evaluation is None:
        result["reason"] = "There are not enough chronological records to evaluate a forecast for this animal."
        return result

    # The validation winner is then refit on all available historical examples
    # before being used for the actual seven-day forecast.
    selected_name = evaluation["selected_model"]
    weather_feature_available = any(feature in numeric_features for feature in weather_features)
    uses_ml_model = selected_name != "Naive Baseline"
    result["weather"] = {
        "provider": "Open-Meteo",
        "location_source": "Farmer's barangay centroid",
        "available": weather_feature_available,
        "used_in_forecast": weather_feature_available and uses_ml_model,
        "message": (
            "Weather data was available and evaluated, but the selected naive baseline does not use weather."
            if weather_feature_available and not uses_ml_model
            else None if weather_feature_available
            else weather_message or "Weather history was unavailable; the forecast used milk history and livestock characteristics only."
        ),
    }
    if not uses_ml_model:
        # The naive baseline predicts from the latest yield alone, so report that
        # actual input rather than characteristics/weather used by other candidates.
        result["features_used"] = ["Most recent approved milk quantity (naive baseline)"]

    model = None
    if selected_name != "Naive Baseline":
        model = _make_model(selected_name, numeric_features, CATEGORICAL_FEATURES)
        model.fit(frame[feature_columns], frame["milk_liters"])

    recent_yields = [float(item["milk_liters"]) for item in daily_records[-7:]]
    forecast = []
    # Forecast recursively: after predicting tomorrow, append that estimate so
    # the next date can use it as recent history. No future observations are read.
    for offset in range(1, 8):
        target_date = today + timedelta(days=offset)
        future_calvings = [
            event_date for event_date, approval_date in calving_events
            if event_date <= target_date and approval_date <= today
        ]
        target_calving = max(future_calvings) if future_calvings else None
        if model is None:
            prediction = recent_yields[-1]
        else:
            # Use the preceding day's observed/forecast weather for each target date.
            prior_weather = weather_rows.get((target_date - timedelta(days=1)).isoformat(), {})
            row = {
                "lag_1": recent_yields[-1],
                "lag_2": recent_yields[-2],
                "lag_3": recent_yields[-3],
                "lag_7": recent_yields[-7],
                "rolling_mean_3": float(np.mean(recent_yields[-3:])),
                "rolling_mean_7": float(np.mean(recent_yields[-7:])),
                "day_of_week": target_date.weekday(),
                "month": target_date.month,
                "age_years": _age_years(livestock.birth_date, target_date),
                "days_since_calving": _days_since_calving(target_calving, target_date),
                "prior_day_temperature_c": prior_weather.get("temperature_c"),
                "prior_day_humidity_pct": prior_weather.get("humidity_pct"),
                "prior_day_precipitation_mm": prior_weather.get("precipitation_mm"),
                "breed": livestock.breed or None,
                "sex": livestock.sex or None,
            }
            prediction = float(model.predict(pd.DataFrame([row])[feature_columns])[0])
        prediction = round(max(0.0, prediction), 2)
        forecast.append({"date": target_date.isoformat(), "expected_liters": prediction})
        recent_yields.append(prediction)

    result.update({
        "status": "READY",
        "forecast": forecast,
        "selected_model": selected_name,
        "baseline_model": "Naive Baseline",
        "evaluation": evaluation,
    })
    # Send the same previous-day weather values used as model context so the
    # chart can visualize environmental conditions without inventing data.
    chart_dates = [item["date"] for item in daily_records[-30:]] + [
        date.fromisoformat(item["date"]) for item in forecast
    ]
    result["weather"]["timeline"] = [
        {
            "date": chart_date.isoformat(),
            "temperature_c": weather_rows.get((chart_date - timedelta(days=1)).isoformat(), {}).get("temperature_c"),
            "humidity_pct": weather_rows.get((chart_date - timedelta(days=1)).isoformat(), {}).get("humidity_pct"),
            "precipitation_mm": weather_rows.get((chart_date - timedelta(days=1)).isoformat(), {}).get("precipitation_mm"),
        }
        for chart_date in chart_dates
    ]
    return result

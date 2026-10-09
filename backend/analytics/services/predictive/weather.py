"""Retrieve cached Open-Meteo weather context for an individual milk forecast."""

import json
from datetime import timedelta
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from django.core.cache import cache


WEATHER_FIELDS = (
    "temperature_2m_mean",
    "relative_humidity_2m_mean",
    "precipitation_sum",
)
CACHE_SECONDS = 6 * 60 * 60


def _request_daily_weather(base_url, params):
    """Call one Open-Meteo daily endpoint and return its JSON response."""
    request = Request(
        f"{base_url}?{urlencode(params)}",
        headers={"User-Agent": "SmartLivestock/1.0 (individual milk forecast)"},
    )
    with urlopen(request, timeout=8) as response:
        return json.loads(response.read().decode("utf-8"))


def _daily_rows(payload):
    """Convert Open-Meteo's parallel date/value arrays into date-keyed rows."""
    daily = payload.get("daily") or {}
    dates = daily.get("time") or []
    values = {field: daily.get(field) or [] for field in WEATHER_FIELDS}
    rows = {}
    for index, day in enumerate(dates):
        # Keep missing source values as None; the forecasting pipeline handles them
        # with an imputer fitted only on its chronological training partition.
        rows[day] = {
            "temperature_c": values["temperature_2m_mean"][index]
            if index < len(values["temperature_2m_mean"]) else None,
            "humidity_pct": values["relative_humidity_2m_mean"][index]
            if index < len(values["relative_humidity_2m_mean"]) else None,
            "precipitation_mm": values["precipitation_sum"][index]
            if index < len(values["precipitation_sum"]) else None,
        }
    return rows


def get_weather_context(latitude, longitude, first_milk_date, today):
    """Fetch past observed and near-future forecast weather for one barangay.

    The returned map uses the barangay centroid, not a household coordinate.
    `available` is true only when the archive yielded historical features and
    Open-Meteo returned all prior-day values needed for the next seven forecasts.
    Any external API failure degrades to the existing milk-only feature set.
    """
    if latitude is None or longitude is None:
        return {}, False, "Barangay coordinates are unavailable."

    start_date = (first_milk_date - timedelta(days=1)).isoformat()
    end_date = (today - timedelta(days=1)).isoformat()
    lat = round(float(latitude), 4)
    lon = round(float(longitude), 4)
    cache_key = f"milk-weather-v1:{lat}:{lon}:{start_date}:{today.isoformat()}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached["rows"], cached["available"], cached["message"]

    rows = {}
    errors = []
    if start_date <= end_date:
        try:
            archive = _request_daily_weather(
                "https://archive-api.open-meteo.com/v1/archive",
                {
                    "latitude": lat,
                    "longitude": lon,
                    "start_date": start_date,
                    "end_date": end_date,
                    "daily": ",".join(WEATHER_FIELDS),
                    "timezone": "auto",
                },
            )
            rows.update(_daily_rows(archive))
        except (OSError, ValueError, KeyError) as error:
            errors.append(type(error).__name__)

    try:
        forecast = _request_daily_weather(
            "https://api.open-meteo.com/v1/forecast",
            {
                "latitude": lat,
                "longitude": lon,
                "forecast_days": 8,
                "daily": ",".join(WEATHER_FIELDS),
                "timezone": "auto",
            },
        )
        rows.update(_daily_rows(forecast))
    except (OSError, ValueError, KeyError) as error:
        errors.append(type(error).__name__)

    # The feature for each forecast date uses weather from the preceding day.
    # Requiring the seven source dates avoids silently filling the full horizon.
    future_source_dates = [(today + timedelta(days=offset)).isoformat() for offset in range(7)]
    historical_rows = [day for day in rows if day < today.isoformat()]
    has_historical_data = bool(historical_rows) and any(
        any(value is not None for value in rows[day].values()) for day in historical_rows
    )
    has_forecast_data = all(
        day in rows and any(value is not None for value in rows[day].values())
        for day in future_source_dates
    )
    available = has_historical_data and has_forecast_data
    message = None if available else (
        "Open-Meteo weather was unavailable; this forecast uses milk history and livestock characteristics only."
    )
    if errors and not available:
        # Keep provider/network details out of the API response; only the safe state reaches the UI.
        message = "Open-Meteo could not provide the required weather history and forecast; weather was omitted."

    result = {"rows": rows, "available": available, "message": message}
    cache.set(cache_key, result, CACHE_SECONDS)
    return rows, available, message

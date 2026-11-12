"""Public-to-farmers cattle price summaries. Never return individual sale data."""
from collections import defaultdict
from datetime import date, timedelta

import numpy as np
import pandas as pd
from django.db.models import Q
from django.conf import settings
from django.utils import timezone

from livestock.models import LivestockOwnershipTransfer
from .predictive.auction_weekly import _predict

MIN_SALES = 5


def week_of(day):
    return day - timedelta(days=day.weekday())


def price_outlook(buckets, current_week):
    """Compare the same four future weeks at past cutoffs; skip each partial week."""
    result = {"available": False, "points": [], "model": None, "checked_windows": 0,
              "message": "More consecutive weeks of complete priced sales are needed for a checked outlook."}
    rows = []
    week = current_week - timedelta(weeks=1)
    while len(rows) < 52:
        bucket = buckets.get(week)
        if not bucket or len(bucket["prices"]) < MIN_SALES or bucket["missing"] or bucket["available"] is None:
            break
        rows.append({"week": pd.Timestamp(week), "quantity": float(np.mean(bucket["prices"])),
                     "available_at": pd.Timestamp(bucket["available"])})
        week -= timedelta(weeks=1)
    rows.reverse()
    if len(rows) < 15:
        return result
    frame = pd.DataFrame(rows)
    candidates = ("Naive Baseline", "Moving Average (4 weeks)", "Random Forest")
    errors = {name: [] for name in candidates}
    windows = {name: 0 for name in candidates}
    valid_windows = 0
    # Eight training weeks plus the current skipped week and four test weeks.
    for origin in list(range(8, len(frame) - 4))[-6:]:
        cutoff = frame.iloc[origin]["week"]
        train = frame.iloc[:origin]
        if (train["available_at"] >= cutoff).any():
            continue
        test = frame.iloc[origin + 1:origin + 5]
        dates = [cutoff + pd.Timedelta(weeks=i) for i in range(5)]
        valid_windows += 1
        for name in candidates:
            try:
                predicted = _predict(name, train, dates)[1:]
                if len(predicted) != 4 or not np.isfinite(predicted).all():
                    continue
                errors[name].extend(np.abs(test["quantity"].to_numpy() - predicted).tolist())
                windows[name] += 1
            except (ValueError, RuntimeError, np.linalg.LinAlgError):
                continue
    if valid_windows < 3:
        return result
    scores = {name: float(np.mean(values)) for name, values in errors.items()
              if values and windows[name] == valid_windows}
    if not scores:
        return result
    model = min(scores, key=scores.get)
    cutoff = pd.Timestamp(current_week)
    try:
        if (frame["available_at"] >= cutoff).any():
            return result
        predictions = _predict(model, frame, [cutoff + pd.Timedelta(weeks=i) for i in range(5)])[1:]
        if len(predictions) != 4 or not np.isfinite(predictions).all():
            return result
    except (ValueError, RuntimeError, np.linalg.LinAlgError):
        return result
    return {"available": True, "model": model, "checked_windows": valid_windows,
            "average_error_php": round(scores[model], 2),
            "training_through": (current_week - timedelta(days=1)).isoformat(),
            "points": [{"week_start": (current_week + timedelta(weeks=i)).isoformat(),
                        "price": round(float(value), 2)} for i, value in enumerate(predictions, 1)],
            "message": "Estimates for the next four weeks, checked against earlier recorded weeks. Actual selling prices can differ."}


def market_prices(*, breed="ALL", weight_band="ALL", data_mode="AUTO", include_forecast=True):
    today = timezone.localdate()
    now = timezone.now()
    current_week = week_of(today)
    first_week = current_week - timedelta(weeks=51)
    # This endpoint intentionally publishes municipal aggregates to approved
    # farmer accounts. It does not expose the staff transaction-list API.
    qs = LivestockOwnershipTransfer.objects.filter(
        status="APPROVED", created_by__role__role_name="AUCTION", transfer_date__range=(first_week, today),
        reviewed_at__isnull=False, reviewed_at__lte=now, created_at__lte=now,
    ).filter(Q(livestock__isnull=False, livestock__livestock_type__name__iexact="Cattle")
             | Q(livestock__isnull=True, external_livestock_type__iexact="Cattle"))
    synthetic = Q(review_remarks__icontains="AI_SEED") | Q(animal_description__icontains="synthetic")
    demo_available = qs.filter(synthetic).exists()
    requested_mode = data_mode
    if data_mode == "AUTO":
        # Automatic mode uses real sales if enough priced sales exist to publish an average;
        # otherwise falls back to demonstration data if available.
        real_has_enough = qs.exclude(synthetic).filter(purchase_price__gt=0).count() >= MIN_SALES
        data_mode = "REAL" if real_has_enough else ("DEMO" if demo_available else "REAL")
    qs = qs.filter(synthetic) if data_mode == "DEMO" else qs.exclude(synthetic)
    breed_counts = defaultdict(int)
    buckets = defaultdict(lambda: {"prices": [], "weighted_sales": [], "missing": 0, "available": None})
    latest_update = None
    for row in qs.values("transfer_date", "purchase_price", "breed_at_transfer", "weight_at_transfer_kg", "created_at", "reviewed_at"):
        recorded_breed = (row["breed_at_transfer"] or "").strip().casefold()
        price = row["purchase_price"]
        if recorded_breed and price is not None and price > 0:
            breed_counts[recorded_breed] += 1
        if breed != "ALL" and recorded_breed != breed.strip().casefold():
            continue
        weight = row["weight_at_transfer_kg"]
        if weight_band != "ALL" and (weight is None or weight <= 0):
            continue
        if weight_band == "UNDER_300" and weight >= 300:
            continue
        if weight_band == "300_TO_499" and not 300 <= weight < 500:
            continue
        if weight_band == "500_PLUS" and weight < 500:
            continue
        week = week_of(row["transfer_date"])
        bucket = buckets[week]
        available = timezone.localdate(max(row["created_at"], row["reviewed_at"]))
        bucket["available"] = max(bucket["available"], available) if bucket["available"] else available
        latest_update = max(latest_update, row["reviewed_at"]) if latest_update else row["reviewed_at"]
        if price is None or price <= 0:
            bucket["missing"] += 1
        else:
            bucket["prices"].append(float(price))
            if weight is not None and weight > 0:
                bucket["weighted_sales"].append((float(price), float(weight)))
    history = []
    for offset in range(52):
        week = first_week + timedelta(weeks=offset)
        prices = buckets[week]["prices"]
        publish = len(prices) >= MIN_SALES
        weighted_sales = buckets[week]["weighted_sales"]
        publish_weight = publish and len(weighted_sales) >= MIN_SALES
        history.append({"week_start": week.isoformat(), "week_end": (week + timedelta(days=6)).isoformat(),
                        "average_price": round(float(np.mean(prices)), 2) if publish else None,
                        "sales": len(prices) if publish else None,
                        "middle_low": round(float(np.percentile(prices, 25)), 2) if publish else None,
                        "middle_high": round(float(np.percentile(prices, 75)), 2) if publish else None,
                        "average_live_weight_kg": round(sum(weight for _, weight in weighted_sales) / len(weighted_sales), 1) if publish_weight else None,
                        "price_per_live_kg": round(sum(price for price, _ in weighted_sales) / sum(weight for _, weight in weighted_sales), 2) if publish_weight else None,
                        "sales_with_weight": len(weighted_sales) if publish_weight else None,
                        "partial_week": week == current_week})
    published = [point for point in history if point["average_price"] is not None]
    latest = published[-1] if published else None
    previous = next((point for point in history if latest and point["week_start"] ==
                     (date.fromisoformat(latest["week_start"]) - timedelta(weeks=1)).isoformat()), None)
    change = None
    if latest and previous and previous["average_price"] is not None:
        change = round(latest["average_price"] - previous["average_price"], 2)
    return {"as_of": today.isoformat(), "data_mode": data_mode, "requested_data_mode": requested_mode, "is_demo": data_mode == "DEMO",
            "demo_available": demo_available, "minimum_sales": MIN_SALES,
            "last_updated": latest_update.isoformat() if latest_update else None,
            "latest": latest, "change_from_previous_week": change,
            "history": history,
            "breed_options": [{"value": name, "label": name.title()} for name, count in sorted(breed_counts.items()) if count >= MIN_SALES],
            "forecast": price_outlook(buckets, current_week) if include_forecast else None,
            "price_basis": "Average recorded price per animal from approved cattle sales recorded by Auction personnel, including registered and external cattle. These are sale prices, not asking prices or prices per kilogram.",
            "filter_note": "Breed and weight filters use details recorded at sale. Sales missing a selected detail are left out.",
            "privacy_note": f"Only weekly summaries with at least {MIN_SALES} priced sales are published. Buyer and seller identities are not shared.",
            "data_notice": "Sample data for demonstration; these figures are not real market prices." if data_mode == "DEMO" else "Based on approved recorded sales. Marked sample data is excluded."}

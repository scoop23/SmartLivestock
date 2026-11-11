"""Scoped livestock prices, with explicitly separate real-sales and seed-demo modes."""
import re
from collections import defaultdict
from datetime import timedelta
import numpy as np
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.pipeline import make_pipeline
from sklearn.linear_model import Ridge
from sklearn.ensemble import RandomForestRegressor
from django.utils import timezone
from django.db.models import Q
from django.db.models.functions import Trim
from analytics.services.predictive.auction_weekly import _filtered_sales
from livestock.models import LivestockType
from .cattle_price_forecast import MIN_SALES, MIN_WEEKS, PriceSale, regression_scores, rounded_scores, week_of, weekly_profile_forecast


def profile_bounds(profile):
    """Missing bounds mean unknown; no guessed age or weight is substituted."""
    age = ((profile["age_months"], profile["age_months"]) if "age_months" in profile
           else (profile["age_min_months"], profile["age_max_months"]) if "age_min_months" in profile else None)
    weight = ((profile["weight_kg"], profile["weight_kg"]) if "weight_kg" in profile
              else (profile["weight_min_kg"], profile["weight_max_kg"]) if "weight_min_kg" in profile else None)
    return age, weight


def matches_profile(traits, profile):
    age, weight = profile_bounds(profile)
    if "age_months" in profile:
        age = (profile["age_months"] - 12, profile["age_months"] + 12)
    if "weight_kg" in profile:
        weight = (profile["weight_kg"] * 0.85, profile["weight_kg"] * 1.15)
    return (traits[2] == profile["sex"] and traits[3] == profile["breed"].strip().casefold()
            and (age is None or age[0] <= traits[0] <= age[1])
            and (weight is None or weight[0] <= traits[1] <= weight[1]))


def price_history(rows, profile):
    """Weekly recorded means; gaps remain missing rather than zero."""
    buckets = defaultdict(lambda: {"prices": [], "similar": []})
    comparable = 0
    for day, traits, price in rows:
        week = day - timedelta(days=day.weekday())
        buckets[week]["prices"].append(price)
        if matches_profile(traits, profile):
            buckets[week]["similar"].append(price)
            comparable += 1
    history = []
    if buckets:
        last = max(buckets)
        week = max(min(buckets), last - timedelta(weeks=103))
        while week <= last:
            bucket = buckets.get(week, {"prices": [], "similar": []})
            history.append({
                "date": week.isoformat(),
                "recorded_price": round(float(np.mean(bucket["prices"])), 2) if bucket["prices"] else None,
                "similar_price": round(float(np.mean(bucket["similar"])), 2) if bucket["similar"] else None,
                "sales": len(bucket["prices"]),
                "similar_sales": len(bucket["similar"]),
            })
            week += timedelta(weeks=1)
    return history, comparable


PRICE_FIELDS = ("transfer_date", "purchase_price", "sex_at_transfer", "age_at_transfer", "breed_at_transfer", "weight_at_transfer_kg", "created_at", "reviewed_at")


def _species_sales(user, source, species):
    # Exact case-insensitive species matching avoids pooling unrelated animals.
    field = "livestock__livestock_type__name" if source == "REGISTERED" else "external_livestock_type"
    return _filtered_sales("ALL", user, source).annotate(_price_species=Trim(field)).filter(
        _price_species__iexact=species.strip(), transfer_date__lte=timezone.localdate()
    )


def _real_sales(qs):
    return qs.exclude(review_remarks__icontains="AI_SEED").exclude(animal_description__icontains="synthetic")


def _demo_sales(qs):
    return qs.filter(Q(review_remarks__icontains="AI_SEED") | Q(animal_description__icontains="synthetic"))


def _uses_demo(mode, has_real, has_demo, real_enough=False):
    if mode == "DEMO":
        return bool(has_demo)
    if mode == "REAL":
        return False
    # AUTO: Prefer real sales if they have sufficient training data; otherwise fall back to demo
    return (not real_enough and bool(has_demo)) if has_real else bool(has_demo)


def _extract_price_sales(records):
    rows = []
    forecast_sales = []
    blocked_weeks = set()
    for r in records:
        age = re.fullmatch(r"(?:(\d+)\s*(?:years?|yrs?|y)\s*)?(?:(\d+)\s*(?:months?|mos?|m))?", r["age_at_transfer"].strip(), re.I)
        if not age or not age.group(0) or r["purchase_price"] is None or r["purchase_price"] <= 0 or r["weight_at_transfer_kg"] is None or r["weight_at_transfer_kg"] <= 0 or not r["breed_at_transfer"].strip():
            blocked_weeks.add(week_of(r["transfer_date"]))
            continue
        sex = r["sex_at_transfer"].strip().upper()
        if sex not in {"MALE", "FEMALE"}:
            blocked_weeks.add(week_of(r["transfer_date"]))
            continue
        traits = [int(age[1] or 0)*12+int(age[2] or 0), float(r["weight_at_transfer_kg"]), sex, r["breed_at_transfer"].strip().casefold()]
        price = float(r["purchase_price"])
        if traits[0] < 1 or not np.isfinite(traits[1]) or not np.isfinite(price):
            blocked_weeks.add(week_of(r["transfer_date"]))
            continue
        rows.append((r["transfer_date"], traits, price))
        # A historical sale becomes usable only after it was submitted AND
        # approved. This prevents a backtest from learning later-entered prices.
        available = (timezone.localdate(max(r["created_at"], r["reviewed_at"]))
                     if r["created_at"] and r["reviewed_at"] else None)
        forecast_sales.append(PriceSale(r["transfer_date"], traits, price, available))
    return rows, forecast_sales, blocked_weeks


def _training_readiness(sales, blocked_weeks):
    origin = week_of(timezone.localdate())
    groups = defaultdict(list)
    for sale in sales:
        if sale.day < origin:
            groups[week_of(sale.day)].append(sale)
    weeks, count = 0, 0
    consecutive_quiet = 0
    week = origin - timedelta(weeks=1)
    while weeks < 104:
        group = groups.get(week, [])
        if week in blocked_weeks or any(s.available is None or s.available >= origin for s in group):
            break
        if not group:
            consecutive_quiet += 1
            if consecutive_quiet > 2:
                break
            if weeks > 0:
                weeks += 1
        else:
            consecutive_quiet = 0
            weeks += 1
            count += len(group)
        week -= timedelta(weeks=1)
    return {"recent_complete_weeks": weeks, "recent_complete_sales": count}


def price_species_readiness(user, source, data_mode="AUTO"):
    """Expose all configured species, plus observed external species, without fitting models."""
    qs = _filtered_sales("ALL", user, source).filter(transfer_date__lte=timezone.localdate())
    rows = qs.values(*PRICE_FIELDS, "livestock__livestock_type__name", "external_livestock_type", "review_remarks", "animal_description")
    # Keep the standard farmer livestock categories visible even before a type
    # or a sale has been entered; this catalog does not create database rows.
    names = {name.casefold(): name for name in ("Cattle", "Carabao", "Goat", "Sheep", "Swine", "Poultry")}
    names.update({name.strip().casefold(): name.strip() for name in LivestockType.objects.values_list("name", flat=True) if name.strip()})
    groups = defaultdict(list)
    for row in rows:
        name = row["livestock__livestock_type__name"] if source == "REGISTERED" else row["external_livestock_type"]
        if not name or not name.strip():
            continue
        key = name.strip().casefold()
        names.setdefault(key, name.strip())
        groups[key].append(row)
    options = []
    for key, name in sorted(names.items(), key=lambda item: item[0]):
        real, demo = [], []
        for row in groups[key]:
            synthetic = "ai_seed" in (row["review_remarks"] or "").lower() or "synthetic" in (row["animal_description"] or "").lower()
            (demo if synthetic else real).append(row)
        complete_real, sales_real, blocked_real = _extract_price_sales(real)
        readiness_real = _training_readiness(sales_real, blocked_real)
        real_enough = readiness_real["recent_complete_weeks"] >= MIN_WEEKS and readiness_real["recent_complete_sales"] >= MIN_SALES and len(complete_real) >= MIN_SALES

        complete_demo, sales_demo, blocked_demo = _extract_price_sales(demo)
        readiness_demo = _training_readiness(sales_demo, blocked_demo)
        demo_enough = readiness_demo["recent_complete_weeks"] >= MIN_WEEKS and readiness_demo["recent_complete_sales"] >= MIN_SALES and len(complete_demo) >= MIN_SALES

        is_demo = _uses_demo(data_mode, bool(real), bool(demo), real_enough=real_enough)
        complete = complete_demo if is_demo else complete_real
        readiness = readiness_demo if is_demo else readiness_real
        enough = demo_enough if is_demo else real_enough
        options.append({"name": name, "data_mode": "DEMO" if is_demo else "REAL", "is_demo": is_demo, "complete_sales": len(complete), **readiness,
                        "status": "PROFILE_REQUIRED" if enough else "INSUFFICIENT_DATA"})
    return {"source": source, "requested_data_mode": data_mode, "unit": "PHP_PER_HEAD", "species": options,
            "required_sales": MIN_SALES, "required_weeks": MIN_WEEKS,
            "message": "Counts use the selected approved-sales dataset. Automatic mode uses recorded real sales when present, otherwise demo sales. Demo and real sales are evaluated separately. A supported animal profile and valid historical model checks are also required."}


def estimate_price(user, profile):
    # The same scoped source feeds the historical chart, point estimate, and
    # hybrid forecast. Transfer snapshots preserve traits as recorded at sale.
    requested_mode = profile.get("data_mode", "AUTO")
    species = profile.get("species", "Cattle")
    qs = _species_sales(user, profile["source"], species)
    real_sales = _real_sales(qs)
    demo_sales = _demo_sales(qs)
    # Automatic fallback applies to every species. Explicit Demo mode also lets
    # users inspect sample history when a sparse real dataset exists.
    if requested_mode == "DEMO":
        is_demo = True
    elif requested_mode == "REAL":
        is_demo = False
    else:  # AUTO
        real_rows, _, _ = _extract_price_sales(real_sales.values(*PRICE_FIELDS))
        real_enough = len(real_rows) >= 80
        is_demo = _uses_demo(requested_mode, real_sales.exists(), demo_sales.exists(), real_enough=real_enough)
    if is_demo:
        # Explicit demo requests read ONLY marked demo records. Never mix synthetic
        # rows into the real model or present their scores as market accuracy.
        qs = demo_sales
    else:
        qs = real_sales
    profile = {**profile, "data_mode": "DEMO" if is_demo else "REAL"}
    qs = qs.order_by("transfer_date", "pk")
    rows, forecast_sales, blocked_weeks = _extract_price_sales(qs.values(*PRICE_FIELDS))
    history, comparable = price_history(rows, profile)
    matching_prices = [row[2] for row in rows if matches_profile(row[1], profile)]
    age_bounds, weight_bounds = profile_bounds(profile)
    is_range = bool(age_bounds and weight_bounds and (age_bounds[0] != age_bounds[1] or weight_bounds[0] != weight_bounds[1]))
    info = {"records": len(rows), "source": profile["source"], "status": "unavailable",
            "data_mode": "DEMO" if is_demo else "REAL", "is_demo": is_demo,
            "requested_data_mode": requested_mode, "species": species, "unit": "PHP_PER_HEAD",
            "data_notice": ("Constructed synthetic seed data. Prices and model checks demonstrate the pipeline; they are not evidence of real market accuracy."
                            if is_demo else "Approved recorded real sales; marked demonstration data is excluded."),
            "history": history, "comparable_records": comparable, "profile": profile,
            "forecast": weekly_profile_forecast(forecast_sales, blocked_weeks, profile, age_bounds, weight_bounds, timezone.localdate()),
            "is_range": is_range,
            "recorded_price_min_php": min(matching_prices) if matching_prices else None,
            "recorded_price_max_php": max(matching_prices) if matching_prices else None,
            "recorded_price_median_php": round(float(np.median(matching_prices)), 2) if matching_prices else None}
    if age_bounds is None or weight_bounds is None:
        return {**info, "status": "history_only", "message": "Showing recorded prices for the selected filters. Choose age and weight ranges or exact values for a model estimate; unknown traits are not guessed."}
    if len(rows) < 80:
        return {**info, "message": f"At least 80 complete {'synthetic demo' if is_demo else 'real'} approved {species} sales are required for an initial model comparison."}
    # Reserve at least 20 later sales while retaining at least 60 earlier ones.
    split_index = min(len(rows) - 20, max(60, int(len(rows) * 0.8)))
    cutoff = rows[split_index][0]
    train = [r for r in rows if r[0] < cutoff]
    test = [r for r in rows if r[0] >= cutoff]
    if len(train) < 60 or len(test) < 20:
        return {**info, "message": "More sales across different dates are needed for a chronological model check."}
    x = [r[1] for r in train]; y = [r[2] for r in train]
    category = [profile["sex"], profile["breed"].strip().casefold()]
    support = [traits for traits in x if traits[2:] == category]
    if len(support) < 5:
        return {**info, "message": "At least five earlier sales of this breed and sex are needed to support a profile estimate. Recorded prices are still shown."}
    if any(bounds[0] < min(a[i] for a in support) or bounds[1] > max(a[i] for a in support)
           for i, bounds in enumerate((age_bounds, weight_bounds))):
        return {**info, "message": "The selected age or weight range, sex, or breed extends beyond the training records. Recorded price history is still shown; narrow the ranges to request an estimate."}
    ages = np.linspace(*age_bounds, num=5) if age_bounds[0] != age_bounds[1] else [age_bounds[0]]
    weights = np.linspace(*weight_bounds, num=5) if weight_bounds[0] != weight_bounds[1] else [weight_bounds[0]]
    targets = [[age, weight, *category] for age in ages for weight in weights]
    results = []
    for name, estimator in [("Ridge Regression", Ridge(alpha=10)), ("Random Forest", RandomForestRegressor(n_estimators=100, min_samples_leaf=5, max_depth=10, random_state=42, n_jobs=1))]:
        features = ColumnTransformer([("numbers", StandardScaler(), [0,1]), ("categories", OneHotEncoder(handle_unknown="ignore", sparse_output=False), [2,3])])
        model = make_pipeline(features, estimator)
        model.fit(x,y)
        actual = np.array([r[2] for r in test])
        scores = regression_scores([(actual, model.predict([r[1] for r in test]))])
        results.append((scores["mae_php"], name, model, scores))
    mae, name, model, selected_scores = min(results, key=lambda v:v[0])
    # Score the median baseline on precisely the same later sale records.
    baseline_scores = regression_scores([(actual, np.full(len(actual), float(np.median(y))))])
    baseline = baseline_scores["mae_php"]
    metrics = {"models": [{"name":n, **rounded_scores(scores)} for _,n,_,scores in results],
               "baseline_mae_php":round(float(baseline),2),
               "trait_baseline": {"name": "Earlier median price", **rounded_scores(baseline_scores)},
               "validation_records":len(test), "training_records":len(train)}
    if mae >= baseline:
        return {**info, **metrics, "message":"The models did not improve on the historical median price. More representative records are needed."}
    predictions = np.maximum(0, model.predict(targets))
    prices = ({"estimated_price_min_php": round(float(predictions.min()), 2),
               "estimated_price_max_php": round(float(predictions.max()), 2)} if is_range
              else {"estimated_price_php": round(float(predictions[0]), 2)})
    message = (f"Estimated span across {len(targets)} sampled age and weight combinations in the selected ranges. This describes profile variation, not a guaranteed price interval."
               if is_range else "Estimate from historical sales. Typical error is measured on later sales; it is not a guaranteed price range.")
    return {**info, **metrics, **prices, "status":"estimated", "model":name, **rounded_scores(selected_scores), "period_start":str(rows[0][0]), "period_end":str(rows[-1][0]), "message":message}

"""Conditional weekly price forecasting: Ridge traits + ARIMA market adjustment.

Learning flow:
    sale-time traits -> Ridge price -> actual minus Ridge price (residual)
    -> weekly mean residuals -> ARIMA -> add future residual to the fixed profile.

Every backtest refits BOTH stages using records available before its cutoff.
The future profile is a scenario supplied by the user, not a prediction of which
animals will be sold. Registered/external sources are scoped before this module.
"""

from collections import defaultdict
from dataclasses import dataclass
from datetime import date, timedelta
import warnings

import numpy as np
from sklearn.compose import ColumnTransformer
from sklearn.linear_model import Ridge
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from statsmodels.tsa.arima.model import ARIMA


# These are conservative application readiness rules, not proof of accuracy.
MIN_SALES = 80
MIN_WEEKS = 26
MIN_CHECKS = 4
MAX_CHECKS = 6


@dataclass(frozen=True)
class PriceSale:
    day: date
    traits: list  # [age in months, weight kg, sex, normalized breed]
    price: float
    available: date | None  # Both submission and approval must be known.


def week_of(day):
    return day - timedelta(days=day.weekday())


def regression_scores(groups):
    """Score later actual/predicted prices, giving each supplied week equal weight.

    MAE = mean absolute error; RMSE squares errors before averaging, so large
    mistakes count more. R² compares squared errors with predicting the weighted
    mean actual price. R² is undefined when all actual prices are identical.
    Passing one group gives ordinary per-sale scores (used by the snapshot model).
    """
    actual_mean = float(np.mean([np.mean(actual) for actual, _ in groups]))
    mae = float(np.mean([np.mean(np.abs(actual - predicted)) for actual, predicted in groups]))
    mse = float(np.mean([np.mean((actual - predicted) ** 2) for actual, predicted in groups]))
    variance = float(np.mean([np.mean((actual - actual_mean) ** 2) for actual, _ in groups]))
    return {"mae_php": mae, "rmse_php": float(np.sqrt(mse)),
            "r2": 1 - mse / variance if variance > 1e-12 else None}


def rounded_scores(scores):
    return {key: round(value, 6 if key == "r2" else 2) if value is not None else None
            for key, value in scores.items()}


def ridge_pipeline():
    # Numbers need scaling so kg does not dominate months. One-hot encoding
    # gives each breed/sex its own column rather than inventing numeric ranks.
    features = ColumnTransformer([
        ("numbers", StandardScaler(), [0, 1]),
        ("categories", OneHotEncoder(handle_unknown="ignore", sparse_output=False), [2, 3]),
    ])
    return make_pipeline(features, Ridge(alpha=10))


def fit_before(sales, blocked_weeks, origin, steps):
    """Fit using the trailing observed weeks strictly before Monday `origin`."""
    groups = defaultdict(list)
    for sale in sales:
        if sale.day < origin:
            groups[week_of(sale.day)].append(sale)

    # A missing or partly measured week is unknown. Do not turn it into zero,
    # and do not bridge gaps by treating nonadjacent weeks as adjacent ARIMA data.
    weeks = []
    consecutive_quiet = 0
    week = origin - timedelta(weeks=1)
    while len(weeks) < 104:
        group = groups.get(week, [])
        if week in blocked_weeks or any(s.available is None or s.available >= origin for s in group):
            break
        if not group:
            consecutive_quiet += 1
            if consecutive_quiet > 2:
                break
        else:
            consecutive_quiet = 0
        weeks.append(week)
        week -= timedelta(weeks=1)
    while weeks and not groups.get(weeks[-1]):
        weeks.pop()
    weeks.reverse()
    if len(weeks) < MIN_WEEKS:
        raise ValueError(f"Need {MIN_WEEKS} consecutive recent weeks of priced sales with complete traits and submission/approval dates.")
    training = [s for week in weeks for s in groups.get(week, [])]
    if len(training) < MIN_SALES:
        raise ValueError(f"Need at least {MIN_SALES} complete approved sales in the recent training history.")

    ridge = ridge_pipeline()
    ridge.fit([s.traits for s in training], [s.price for s in training])
    # Each residual is the part of a sale's price that traits did not explain.
    # Averaging these by week reduces changes caused solely by different cattle
    # being sold each week; ARIMA models the remaining time movement.
    trait_prices = ridge.predict([s.traits for s in training])
    residuals = defaultdict(list)
    for sale, trait_price in zip(training, trait_prices):
        residuals[week_of(sale.day)].append(sale.price - trait_price)
    series_vals = []
    last_residual = 0.0
    for week in weeks:
        if residuals.get(week):
            last_residual = float(np.mean(residuals[week]))
        series_vals.append(last_residual)
    series = np.array(series_vals, dtype=float)
    # A fixed, small ARIMA order avoids searching many models on the same tiny
    # validation set. Seasonal effects require separate evidence and are omitted.
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        arima = ARIMA(series, order=(1, 0, 1), trend="c").fit(method_kwargs={"maxiter": 100})
    if not arima.mle_retvals.get("converged", False):
        raise ValueError("The weekly price adjustment did not converge to a stable ARIMA fit.")
    adjustments = np.asarray(arima.forecast(steps=steps), dtype=float)
    if not np.isfinite(adjustments).all():
        raise ValueError("The weekly model did not return finite price adjustments.")
    return ridge, adjustments, float(series[-1]), training, weeks


def supported(traits, training):
    # Check the joint breed/sex group, rather than accepting a breed seen only
    # in another sex group. Never extrapolate requested ages or weights.
    peers = [s.traits for s in training if s.traits[2:] == traits[2:]]
    return len(peers) >= 5 and all(
        min(p[i] for p in peers) <= traits[i] <= max(p[i] for p in peers)
        for i in (0, 1)
    )


def weekly_profile_forecast(sales, blocked_weeks, profile, age_bounds, weight_bounds, today):
    horizon = profile.get("horizon_weeks", 6)
    current_week = week_of(today)
    result = {
        "status": "unavailable", "model": "Ridge + ARIMA(1,0,1)",
        "horizon_weeks": horizon, "points": [],
        "training_cutoff": current_week.isoformat(),
        "is_demo": profile.get("data_mode") == "DEMO",
        "assumption": "Selected age, weight, sex and breed stay fixed across future weeks.",
        "band_note": "Past-error band uses the 80th percentile of absolute rolling-check errors. It is not a guaranteed coverage interval and does not include uncertainty outside the observed records.",
    }
    if age_bounds is None or weight_bounds is None:
        return {**result, "message": "Choose age and weight ranges or exact values to request a future profile-price forecast."}

    # Forecasts start NEXT Monday. The first ARIMA step is the unfinished current
    # week, so we calculate it but skip it in both production and backtesting.
    try:
        ridge, adjustments, _last_residual, training, weeks = fit_before(
            sales, blocked_weeks, current_week, horizon + 1,
        )
    except (ValueError, np.linalg.LinAlgError) as exc:
        return {**result, "message": str(exc)}

    category = [profile["sex"], profile["breed"].strip().casefold()]
    ages = np.linspace(*age_bounds, 5) if age_bounds[0] != age_bounds[1] else [age_bounds[0]]
    weights = np.linspace(*weight_bounds, 5) if weight_bounds[0] != weight_bounds[1] else [weight_bounds[0]]
    targets = [[float(age), float(weight), *category] for age in ages for weight in weights]
    if not all(supported(target, training) for target in targets):
        return {**result, "message": "The requested profile ranges exceed the recent training history for this breed and sex. Narrow the ranges or collect more matching sales."}

    groups = defaultdict(list)
    for sale in sales:
        groups[week_of(sale.day)].append(sale)
    checks = []
    errors = defaultdict(list)
    scored_groups = {name: [] for name in ("hybrid", "ridge", "persistence")}
    horizon_groups = defaultdict(list)
    unique_sales = set()
    evaluated_weeks = set()
    # Walk backward through historical Monday cutoffs. Refit only on data that
    # had already been submitted AND approved before each historical cutoff.
    # Actual future traits below are conditional scenarios, not predictions of
    # future cattle composition. Their prices never enter either fitted model.
    origin = current_week - timedelta(weeks=horizon + 1)
    for _ in range(24):
        if len(checks) >= MAX_CHECKS:
            break
        truth_weeks = [origin + timedelta(weeks=step) for step in range(1, horizon + 1)]
        if any(week in blocked_weeks or not groups.get(week)
               or any(s.available is None or s.available > today for s in groups[week])
               for week in truth_weeks):
            origin -= timedelta(weeks=1)
            continue
        try:
            past_ridge, past_adjustment, past_last, past_training, _ = fit_before(
                sales, blocked_weeks, origin, horizon + 1,
            )
        except (ValueError, np.linalg.LinAlgError):
            origin -= timedelta(weeks=1)
            continue
        actual = [s for week in truth_weeks for s in groups[week]]
        if not all(supported(s.traits, past_training) for s in actual):
            origin -= timedelta(weeks=1)
            continue
        fold = {name: [] for name in scored_groups}
        for step, week in enumerate(truth_weeks, start=1):
            group = groups[week]
            y = np.array([s.price for s in group])
            base = past_ridge.predict([s.traits for s in group])
            predictions = {
                "hybrid": np.maximum(0, base + past_adjustment[step]),
                "ridge": np.maximum(0, base),
                "persistence": np.maximum(0, base + past_last),
            }
            difference = np.abs(y - predictions["hybrid"])
            errors[step].extend(difference.tolist())
            # Give each week equal weight so busy market weeks do not dominate.
            for name, predicted in predictions.items():
                fold[name].append((y, predicted))
                scored_groups[name].append((y, predicted))
            horizon_groups[step].append((y, predictions["hybrid"]))
            unique_sales.update(id(sale) for sale in group)
            evaluated_weeks.add(week)
        checks.append({
            "cutoff": origin.isoformat(), **regression_scores(fold["hybrid"]),
            "ridge_mae_php": regression_scores(fold["ridge"])["mae_php"],
            "persistence_mae_php": regression_scores(fold["persistence"])["mae_php"],
        })
        origin -= timedelta(weeks=1)
    if len(checks) < MIN_CHECKS:
        return {**result, "validation_windows": len(checks), "message": f"Need at least {MIN_CHECKS} successful historical checks for this {horizon}-week horizon. More dated, complete sales are needed."}

    scores = {name: regression_scores(groups) for name, groups in scored_groups.items()}
    mae = scores["hybrid"]["mae_php"]
    ridge_mae = scores["ridge"]["mae_php"]
    persistence_mae = scores["persistence"]["mae_php"]
    metrics = {
        **rounded_scores(scores["hybrid"]), "ridge_baseline_mae_php": round(ridge_mae, 2),
        "persistence_baseline_mae_php": round(persistence_mae, 2),
        "validation_windows": len(checks), "training_sales": len(training),
        "training_weeks": len(weeks), "cutoffs": checks,
        "model_comparison": [
            {"name": label, **rounded_scores(scores[name])}
            for name, label in (("hybrid", "Ridge + ARIMA"), ("ridge", "Traits only (Ridge)"),
                                ("persistence", "Traits + latest weekly adjustment"))
        ],
        "per_horizon": [{"week_ahead": step, **rounded_scores(regression_scores(groups)),
                         "comparisons": sum(len(actual) for actual, _ in groups)}
                        for step, groups in sorted(horizon_groups.items())],
        "validation_comparisons": sum(len(actual) for actual, _ in scored_groups["hybrid"]),
        "unique_validation_sales": len(unique_sales),
        "validation_period_start": min(evaluated_weeks).isoformat(),
        "validation_period_end": (max(evaluated_weeks) + timedelta(days=6)).isoformat(),
        "evaluation_note": "Scores are source-wide conditional forecasts on later sales. Each evaluated week/check has equal weight. Rolling windows overlap, so comparison counts can include a sale more than once; checks are not independent or a final untouched test set.",
    }
    if mae >= min(ridge_mae, persistence_mae):
        return {**result, **metrics, "message": "The hybrid did not improve on both the trait-only and latest-week-adjustment baselines. Future prices are withheld; recorded history remains available."}

    profile_prices = np.asarray(ridge.predict(targets))
    points = []
    for step in range(1, horizon + 1):
        values = np.maximum(0, profile_prices + adjustments[step])
        margin = float(np.quantile(errors[step], 0.8))
        points.append({
            "date": (current_week + timedelta(weeks=step)).isoformat(),
            "predicted_price": round(float(values.mean()), 2),
            "profile_min": round(float(values.min()), 2),
            "profile_max": round(float(values.max()), 2),
            "lower": round(max(0, float(values.min()) - margin), 2),
            "upper": round(float(values.max()) + margin, 2),
        })
    message = "Conditional weekly prices from recorded sales. Historical checks compare prices for known sales to forecasts trained on earlier records only."
    return {**result, **metrics, "status": "forecast", "points": points, "message": message}

"""Experimental surveillance-informed monthly forecasting.

This on-demand evaluation is separate from production model selection. Historical
inputs require a currently approved row with a review timestamp no later than the
simulated cutoff. Empty surveillance windows remain missing and receive explicit
availability indicators; training-only medians are used when fitting the candidate.
"""

from collections import defaultdict
from datetime import date, datetime, time
import math

import numpy as np
import pandas as pd
from django.db.models import Q
from django.utils import timezone
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LinearRegression

from diseases.models import DiseaseCase, MortalityRecord
from smartlivestock.workflows import scope_reviewer_queryset
from .evaluation import evaluate_rolling_origins
from .models import forecast_candidate
from .surveillance_features import (
    _deduplicated_death_count,
    build_surveillance_features,
    build_target_history_features,
    surveillance_value_features,
)


MIN_TRAIN_MONTHS = 12
MIN_EVALUATION_PERIODS_FOR_SIGNAL = 12
MAX_EVALUATION_PERIODS = 18
MONTHLY_CANDIDATES = [
    "Naive Baseline", "Seasonal Naive", "Linear Regression",
    "Random Forest", "ARIMA", "Holt-Winters",
]
TARGETS = {
    "disease_reports": {"domain": "disease", "unit": "CASES", "value": "report"},
    "disease_affected_heads": {"domain": "disease", "unit": "HEADS", "value": "affected_count"},
    "mortality_deaths": {"domain": "mortality", "unit": "HEADS", "value": "death_count"},
}
CALENDAR_FEATURES = ("time_step", "month_sin", "month_cos")


def _cutoff_datetime(value):
    if isinstance(value, date) and not isinstance(value, datetime):
        value = datetime.combine(value, time.min)
    return timezone.make_aware(value) if timezone.is_naive(value) else value


def _cutoff_day(value):
    return timezone.localtime(_cutoff_datetime(value)).date()


def _month_start(value):
    return date(value.year, value.month, 1)


def _month_timestamp(value):
    return pd.Timestamp(value).to_period("M").to_timestamp()


def _monthly_sum(rows, availability_cutoff, value_key, *, event_before=None):
    """Aggregate observed target rows as known by a cutoff, without filling gaps."""
    cutoff_stamp = _cutoff_datetime(availability_cutoff)
    event_limit = event_before or _cutoff_day(cutoff_stamp)
    totals = defaultdict(float)
    for row in rows:
        event_date = row.get("record_date")
        reviewed_at = row.get("reviewed_at")
        if not event_date or event_date >= event_limit or not reviewed_at or reviewed_at > cutoff_stamp:
            continue
        month = _month_timestamp(event_date)
        totals[month] += 1.0 if value_key == "report" else float(row.get(value_key) or 0)
    return pd.DataFrame(
        [{"month": month, "quantity": value} for month, value in sorted(totals.items())],
        columns=["month", "quantity"],
    )


def _calendar_features(month, origin_month):
    month = pd.Timestamp(month)
    origin = pd.Timestamp(origin_month)
    elapsed = (month.year - origin.year) * 12 + month.month - origin.month
    angle = 2 * np.pi * (month.month - 1) / 12
    return {"time_step": elapsed, "month_sin": float(np.sin(angle)), "month_cos": float(np.cos(angle))}


def _feature_frame(monthly, source_rows, disease_rows, mortality_rows, domain, value_key):
    """Build training examples; each feature row is reconstructed at its own month start."""
    samples = []
    value_features = surveillance_value_features(domain)
    for row in monthly.itertuples(index=False):
        target_month = pd.Timestamp(row.month)
        sample_cutoff = timezone.make_aware(datetime.combine(target_month.date(), time.min))
        target_history = _monthly_sum(source_rows, sample_cutoff, value_key)
        features = build_surveillance_features(sample_cutoff, disease_rows, mortality_rows, domain)
        features.update(build_target_history_features(sample_cutoff, target_history.to_dict("records")))
        samples.append({"month": target_month, "quantity": float(row.quantity), **features})
    return pd.DataFrame(samples), value_features


def _feature_matrix(training_rows, prediction_row, value_features):
    """Fit median imputation from the training frame only; preserve feature indicators."""
    if training_rows.empty:
        return None, None, [], [], {}
    origin_month = training_rows["month"].min()
    train_calendar = pd.DataFrame([
        _calendar_features(row.month, origin_month) for row in training_rows.itertuples(index=False)
    ])
    prediction_calendar = pd.DataFrame([_calendar_features(prediction_row["month"], origin_month)])

    feature_columns = [column for column in training_rows.columns if column not in {"month", "quantity"}]
    indicator_columns = [column for column in feature_columns if column.endswith("_observed")]
    measurement_columns = [column for column in feature_columns if column not in indicator_columns]
    measurement_columns = [
        column for column in measurement_columns
        if training_rows[column].notna().any()
    ]
    used_columns = list(CALENDAR_FEATURES) + measurement_columns + indicator_columns
    if not any(training_rows[column].notna().any() for column in value_features if column in training_rows.columns):
        return None, None, used_columns, [], {}

    train_parts = [train_calendar.reset_index(drop=True)]
    prediction_parts = [prediction_calendar]
    imputation_values = {}
    if measurement_columns:
        imputer = SimpleImputer(strategy="median", keep_empty_features=False)
        train_imputed = imputer.fit_transform(training_rows[measurement_columns].astype(float))
        prediction_imputed = imputer.transform(pd.DataFrame([prediction_row])[measurement_columns].astype(float))
        imputation_values = {name: float(value) for name, value in zip(measurement_columns, imputer.statistics_)}
        train_parts.append(pd.DataFrame(train_imputed, columns=measurement_columns))
        prediction_parts.append(pd.DataFrame(prediction_imputed, columns=measurement_columns))
    if indicator_columns:
        train_parts.append(training_rows[indicator_columns].fillna(0).astype(float).reset_index(drop=True))
        prediction_parts.append(pd.DataFrame([prediction_row])[indicator_columns].fillna(0).astype(float).reset_index(drop=True))
    X_train = pd.concat(train_parts, axis=1).to_numpy(dtype=float)
    X_prediction = pd.concat(prediction_parts, axis=1).to_numpy(dtype=float)
    return X_train, X_prediction, used_columns, measurement_columns, imputation_values


def _fit_enhanced_candidate(training_rows, prediction_row, value_features):
    """Fit a separate experimental LinearRegression candidate with safe readiness states."""
    if len(training_rows) < MIN_TRAIN_MONTHS:
        return {"status": "INSUFFICIENT_TRAINING_DATA", "prediction": None, "training_samples": len(training_rows)}
    X_train, X_prediction, used_columns, imputed_columns, _ = _feature_matrix(
        training_rows, prediction_row, value_features,
    )
    if X_train is None:
        return {
            "status": "MISSING_SURVEILLANCE_DATA",
            "prediction": None,
            "training_samples": len(training_rows),
            "features_used": used_columns,
        }
    target = training_rows["quantity"].astype(float).to_numpy()
    try:
        model = LinearRegression().fit(X_train, target)
        prediction = float(model.predict(X_prediction)[0])
        if not math.isfinite(prediction):
            raise ValueError("The enhanced model returned a non-finite prediction.")
        return {
            "status": "READY",
            "prediction": max(0.0, prediction),
            "training_samples": len(training_rows),
            "features_used": used_columns,
            "imputed_features": imputed_columns,
            "constant_target": bool(np.ptp(target) < 1e-12),
            "quality_note": "Target is constant in training; the fitted linear model returns its learned constant level." if np.ptp(target) < 1e-12 else None,
        }
    except Exception as exc:
        return {
            "status": "MODEL_FIT_FAILED",
            "prediction": None,
            "training_samples": len(training_rows),
            "features_used": used_columns,
            "error": str(exc),
        }


def _best_existing_model(history):
    if len(history) < MIN_TRAIN_MONTHS:
        return None, None, None
    try:
        rolling = evaluate_rolling_origins(history, MONTHLY_CANDIDATES, requested_horizon=6, max_windows=4)
        scores = rolling.get("models") or {}
    except Exception:
        scores = {}
    simple_names = ("Naive Baseline", "Seasonal Naive")
    simple = min((name for name in simple_names if name in scores), key=lambda name: scores[name]["mae"], default="Naive Baseline")
    if not scores:
        return "Naive Baseline", {}, simple
    selected = min(scores, key=lambda name: scores[name]["mae"])
    if selected not in simple_names and scores[selected]["mae"] >= scores.get(simple, {"mae": float("inf")})["mae"]:
        selected = simple
    return selected, scores, simple


def _metric_summary(rows, prediction_key, denominator):
    valid = [row for row in rows if row.get(prediction_key) is not None]
    if not valid:
        return {"mae": None, "rmse": None, "prediction_coverage": 0.0, "periods": 0}
    errors = np.asarray([row["actual"] - row[prediction_key] for row in valid], dtype=float)
    return {
        "mae": round(float(np.mean(np.abs(errors))), 3),
        "rmse": round(float(np.sqrt(np.mean(np.square(errors)))), 3),
        "prediction_coverage": round(len(valid) / denominator, 3) if denominator else 0.0,
        "periods": len(valid),
    }


def _comparison_conclusion(shared_rows, baseline_metrics, enhanced_metrics):
    return classify_comparison(baseline_metrics, enhanced_metrics, shared_rows)


def classify_comparison(baseline, enhanced, periods, baseline_error_key="baseline_absolute_error"):
    """Require both a minimum sample and a consistent 10% aggregate MAE change."""
    if len(periods) < MIN_EVALUATION_PERIODS_FOR_SIGNAL or baseline["mae"] is None or enhanced["mae"] is None:
        return "INCONCLUSIVE"
    reduction = (baseline["mae"] - enhanced["mae"]) / baseline["mae"] if baseline["mae"] else 0
    wins = sum(row.get("enhanced_absolute_error") is not None and row.get(baseline_error_key) is not None
               and row["enhanced_absolute_error"] < row[baseline_error_key] for row in periods)
    share = wins / len(periods)
    if reduction >= 0.10 and share >= 0.70:
        return "IMPROVED_IN_EXPERIMENT"
    if reduction <= -0.10 and share <= 0.30:
        return "WORSENED_IN_EXPERIMENT"
    return "INCONCLUSIVE"


def _load_target_rows(user, domain):
    marker_exclusion = Q(review_remarks__isnull=True) | ~Q(review_remarks__contains="AI_SEED")
    if domain == "disease":
        return list(scope_reviewer_queryset(DiseaseCase.objects.all(), user).filter(
            status=DiseaseCase.DiseaseStatus.APPROVED,
            record_date__isnull=False,
        ).filter(marker_exclusion).values(
            "id", "record_date", "reviewed_at", "name", "affected_count", "livestock_id", "batch_id",
        ))

    rows = list(scope_reviewer_queryset(MortalityRecord.objects.all(), user).filter(
        status=MortalityRecord.MortalityRecordStatus.APPROVED,
        record_date__isnull=False,
    ).filter(marker_exclusion).values(
        "id", "record_date", "reviewed_at", "death_count", "livestock_id", "batch_id",
    ))
    through = MortalityRecord.affected_livestock.through
    record_field, animal_field = [field for field in through._meta.fields if field.name != "id"]
    animal_ids = defaultdict(set)
    if rows:
        for record_id, animal_id in through.objects.filter(
            **{f"{record_field.attname}__in": [row["id"] for row in rows]}
        ).values_list(record_field.attname, animal_field.attname):
            animal_ids[record_id].add(animal_id)
    for row in rows:
        row["animal_ids"] = animal_ids[row["id"]]
        if row["livestock_id"]:
            row["animal_ids"].add(row["livestock_id"])
    return rows


def _load_surveillance_rows(user):
    approved_real = Q(review_remarks__isnull=True) | ~Q(review_remarks__contains="AI_SEED")
    disease = list(scope_reviewer_queryset(DiseaseCase.objects.all(), user).filter(
        status=DiseaseCase.DiseaseStatus.APPROVED,
        record_date__isnull=False,
        reviewed_at__isnull=False,
    ).filter(approved_real).values("id", "record_date", "reviewed_at", "affected_count"))
    mortality = list(scope_reviewer_queryset(MortalityRecord.objects.all(), user).filter(
        status=MortalityRecord.MortalityRecordStatus.APPROVED,
        record_date__isnull=False,
        reviewed_at__isnull=False,
    ).filter(approved_real).values("id", "record_date", "reviewed_at", "death_count", "livestock_id"))
    ids = [row["id"] for row in mortality]
    animal_ids = defaultdict(set)
    through = MortalityRecord.affected_livestock.through
    record_field, animal_field = [field for field in through._meta.fields if field.name != "id"]
    if ids:
        for record_id, animal_id in through.objects.filter(
            **{f"{record_field.attname}__in": ids}
        ).values_list(record_field.attname, animal_field.attname):
            animal_ids[record_id].add(animal_id)
    for row in mortality:
        row["animal_ids"] = animal_ids[row["id"]]
        if row["livestock_id"]:
            row["animal_ids"].add(row["livestock_id"])
    return disease, mortality


def _row_value(rows, month, value_key):
    selected = [row for row in rows if _month_timestamp(row["record_date"]) == month]
    if value_key == "report":
        return float(len(selected))
    return float(sum(row.get(value_key) or 0 for row in selected))


def _predict_existing(history, forecast_month, model_name):
    try:
        values = forecast_candidate(model_name, history, [forecast_month])
        value = float(values[0])
        return max(0.0, value) if math.isfinite(value) else None
    except Exception:
        return None


def _evaluate_target(user, target_key, spec, source_rows, disease_rows, mortality_rows, today, as_of):
    domain = spec["domain"]
    value_key = spec["value"]
    current_month_start = _month_start(today)
    current_history = _monthly_sum(source_rows, as_of, value_key, event_before=current_month_start)
    current_features, value_features = _feature_frame(
        current_history, source_rows, disease_rows, mortality_rows, domain, value_key,
    )
    forecast_cutoff = _cutoff_datetime(as_of)
    future_feature_values = build_surveillance_features(forecast_cutoff, disease_rows, mortality_rows, domain)
    future_target_lags = build_target_history_features(forecast_cutoff, current_history.to_dict("records"))
    current_target_month = pd.Timestamp(
        date(today.year + (today.month == 12), 1 if today.month == 12 else today.month + 1, 1)
    )
    future_row = {"month": current_target_month, **future_feature_values, **future_target_lags}

    current_raw_available = int(any(
        current_features[column].notna().any()
        for column in value_features if column in current_features.columns
    )) if not current_features.empty else 0
    if len(current_history) < MIN_TRAIN_MONTHS:
        candidate = {"status": "INSUFFICIENT_TRAINING_DATA", "prediction": None, "training_samples": len(current_history)}
    elif not current_raw_available:
        candidate = {"status": "MISSING_SURVEILLANCE_DATA", "prediction": None, "training_samples": len(current_history)}
    else:
        candidate = _fit_enhanced_candidate(current_features, future_row, value_features)
        if candidate["status"] == "READY":
            candidate["status"] = "EXPERIMENTAL"
            candidate["prediction_month"] = current_target_month.strftime("%Y-%m")

    current_partial_rows = sum(1 for row in source_rows if _month_start(row["record_date"]) == current_month_start)
    all_observed_outcome_months = sorted({
        _month_timestamp(row["record_date"])
        for row in source_rows
        if row["record_date"] < current_month_start
    })
    observed_outcome_months = all_observed_outcome_months[-MAX_EVALUATION_PERIODS:]

    evaluated_rows = []
    excluded = {
        "insufficient_training_history": 0,
        "missing_surveillance_training_signal": 0,
        "baseline_fit_or_forecast_failure": 0,
        "enhanced_fit_or_forecast_failure": 0,
    }
    eligible_periods = 0
    for forecast_month in observed_outcome_months:
        cutoff = timezone.make_aware(datetime.combine(forecast_month.date(), time.min))
        history = _monthly_sum(source_rows, cutoff, value_key)
        if len(history) < MIN_TRAIN_MONTHS:
            excluded["insufficient_training_history"] += 1
            continue
        eligible_periods += 1
        actual = _row_value(source_rows, forecast_month, value_key)
        # Current final approved outcomes may have been approved after this target month.
        # They are labels only; historical training inputs remain cutoff-filtered.
        future_features = build_surveillance_features(cutoff, disease_rows, mortality_rows, domain)
        future_lags = build_target_history_features(cutoff, history.to_dict("records"))
        prediction_row = {"month": forecast_month, **future_features, **future_lags}
        training_rows, fold_value_features = _feature_frame(
            history, source_rows, disease_rows, mortality_rows, domain, value_key,
        )

        selected_name, _, simple_name = _best_existing_model(history)
        if selected_name is None:
            selected_name = "Naive Baseline"
        baseline_prediction = _predict_existing(history, forecast_month, selected_name)
        simple_prediction = _predict_existing(history, forecast_month, simple_name or "Naive Baseline")
        calendar_prediction = _predict_existing(history, forecast_month, "Linear Regression")
        enhanced_result = _fit_enhanced_candidate(training_rows, prediction_row, fold_value_features)
        enhanced_prediction = enhanced_result.get("prediction")

        if baseline_prediction is None:
            excluded["baseline_fit_or_forecast_failure"] += 1
        if enhanced_result["status"] == "MISSING_SURVEILLANCE_DATA":
            excluded["missing_surveillance_training_signal"] += 1
        if enhanced_prediction is None:
            excluded["enhanced_fit_or_forecast_failure"] += 1
        evaluated_rows.append({
            "cutoff": forecast_month.strftime("%Y-%m-%d"),
            "target_month": forecast_month.strftime("%Y-%m"),
            "target": target_key,
            "unit": spec["unit"],
            "horizon_months": 1,
            "actual": actual,
            "baseline_model": selected_name,
            "baseline_prediction": round(baseline_prediction, 3) if baseline_prediction is not None else None,
            "simple_baseline_model": simple_name or "Naive Baseline",
            "simple_baseline_prediction": round(simple_prediction, 3) if simple_prediction is not None else None,
            "calendar_linear_prediction": round(calendar_prediction, 3) if calendar_prediction is not None else None,
            "enhanced_prediction": round(enhanced_prediction, 3) if enhanced_prediction is not None else None,
            "enhanced_candidate_status": enhanced_result["status"],
            "baseline_absolute_error": round(abs(actual - baseline_prediction), 3) if baseline_prediction is not None else None,
            "baseline_squared_error": round((actual - baseline_prediction) ** 2, 3) if baseline_prediction is not None else None,
            "simple_baseline_absolute_error": round(abs(actual - simple_prediction), 3) if simple_prediction is not None else None,
            "simple_baseline_squared_error": round((actual - simple_prediction) ** 2, 3) if simple_prediction is not None else None,
            "calendar_linear_absolute_error": round(abs(actual - calendar_prediction), 3) if calendar_prediction is not None else None,
            "calendar_linear_squared_error": round((actual - calendar_prediction) ** 2, 3) if calendar_prediction is not None else None,
            "enhanced_absolute_error": round(abs(actual - enhanced_prediction), 3) if enhanced_prediction is not None else None,
            "enhanced_squared_error": round((actual - enhanced_prediction) ** 2, 3) if enhanced_prediction is not None else None,
            "available_surveillance_features": [key for key in fold_value_features if prediction_row.get(key) is not None],
        })

    shared_rows = [
        row for row in evaluated_rows
        if row["baseline_prediction"] is not None and row["enhanced_prediction"] is not None
    ]
    denominator = eligible_periods
    baseline_metrics = _metric_summary(shared_rows, "baseline_prediction", denominator)
    enhanced_metrics = _metric_summary(shared_rows, "enhanced_prediction", denominator)
    simple_metrics = _metric_summary(shared_rows, "simple_baseline_prediction", denominator)
    calendar_metrics = _metric_summary(shared_rows, "calendar_linear_prediction", denominator)
    conclusion = _comparison_conclusion(shared_rows, baseline_metrics, enhanced_metrics)
    if not shared_rows:
        evaluation_status = "INSUFFICIENT_EVALUATION_DATA"
    elif len(shared_rows) < MIN_EVALUATION_PERIODS_FOR_SIGNAL:
        evaluation_status = "EXPERIMENTAL"
    else:
        evaluation_status = "EVALUATED"

    feature_training_samples = sum(
        any(current_features[column].notna()) for column in value_features
    ) if not current_features.empty else 0
    if candidate["status"] in {"INSUFFICIENT_TRAINING_DATA", "MISSING_SURVEILLANCE_DATA"}:
        training_status = candidate["status"]
    elif candidate["status"] == "MODEL_FIT_FAILED":
        training_status = "MODEL_FIT_FAILED"
    else:
        training_status = "READY"

    if candidate["status"] == "INSUFFICIENT_TRAINING_DATA":
        candidate_reason = (
            f"At least {MIN_TRAIN_MONTHS} eligible prior monthly observations are required; "
            f"{len(current_history)} are available."
        )
    elif candidate["status"] == "MISSING_SURVEILLANCE_DATA":
        candidate_reason = "No eligible surveillance feature has an observed value in the training history."
    elif candidate["status"] == "MODEL_FIT_FAILED":
        candidate_reason = candidate.get("error") or "The enhanced candidate could not be fit."
    else:
        candidate_reason = "Experimental candidate only; no production model selection was changed."

    return {
        "target": target_key,
        "domain": domain,
        "unit": spec["unit"],
        "horizon_months": 1,
        "status": evaluation_status,
        "training_status": training_status,
        "candidate_status": candidate["status"],
        "candidate_reason": candidate_reason,
        "baseline_candidate": "Existing selected monthly candidate (chosen independently at each cutoff)",
        "simple_baseline_candidate": "Best of Naive Baseline and Seasonal Naive (selected using pre-cutoff history)",
        "calendar_only_candidate": "Linear Regression",
        "enhanced_candidate": "Experimental Linear Regression with surveillance and target-history features",
        "training_sample_count": len(current_history),
        "feature_training_sample_count": feature_training_samples,
        "minimum_training_samples": MIN_TRAIN_MONTHS,
        "candidate_forecast": candidate.get("prediction"),
        "candidate_forecast_month": candidate.get("prediction_month"),
        "candidate_quality_note": candidate.get("quality_note"),
        "features_used": candidate.get("features_used", []),
        "imputed_features": candidate.get("imputed_features", []),
        "eligible_target_periods": eligible_periods,
        "valid_evaluation_periods": len(shared_rows),
        "evaluation_periods": len(shared_rows),
        "evaluation_start_month": evaluated_rows[0]["target_month"] if evaluated_rows else None,
        "evaluation_end_month": evaluated_rows[-1]["target_month"] if evaluated_rows else None,
        "latest_eligible_target_period": observed_outcome_months[-1].strftime("%Y-%m") if observed_outcome_months else None,
        "excluded_period_counts": excluded,
        "target_months_without_records_not_scored": (
            max(0, len(pd.period_range(all_observed_outcome_months[0], all_observed_outcome_months[-1], freq="M")) - len(all_observed_outcome_months))
            if len(all_observed_outcome_months) > 1 else 0
        ),
        "current_partial_month_rows_excluded": current_partial_rows,
        "target_rows_without_review_time_excluded_from_training": sum(
            1 for row in source_rows if row.get("reviewed_at") is None and row["record_date"] < current_month_start
        ),
        "baseline": baseline_metrics,
        "simple_baseline": simple_metrics,
        "calendar_linear_baseline": calendar_metrics,
        "enhanced": enhanced_metrics,
        "comparison_conclusion": conclusion,
        "periods": evaluated_rows,
        "enhanced_model_adopted": False,
        "reporting_coverage": "unknown; no reporting-coverage ledger exists. Empty windows are imputed only after pairing the training-median value with an observed/missing indicator.",
    }


def evaluate_surveillance_forecast_experiment(*, user=None, today=None):
    """Run an on-demand, role-scoped one-month chronological comparison."""
    today = today or timezone.localdate()
    as_of = timezone.now()
    disease_rows, mortality_rows = _load_surveillance_rows(user)
    targets = {}
    for key, spec in TARGETS.items():
        source_rows = _load_target_rows(user, spec["domain"])
        targets[key] = _evaluate_target(
            user, key, spec, source_rows, disease_rows, mortality_rows, today, as_of,
        )

    valid_periods = sum(target["valid_evaluation_periods"] for target in targets.values())
    if not valid_periods:
        overall_status = "INSUFFICIENT_EVALUATION_DATA"
        reason = "No shared out-of-sample periods had both an existing baseline and a trainable surveillance-informed candidate. No metric is reported as zero."
    elif any(target["status"] == "EXPERIMENTAL" for target in targets.values()):
        overall_status = "EXPERIMENTAL"
        reason = "Some predictions are available, but at least one target has fewer than the configured 12 comparison periods; improvement is not established."
    else:
        overall_status = "EVALUATED"
        reason = "Chronological comparisons completed. An evaluated result is not automatic approval or promotion of the enhanced candidate."

    return {
        "status": overall_status,
        "evaluation_method": "Expanding chronological monthly origins; one-month-ahead forecasts; each cutoff uses earlier target values and cutoff-available surveillance features only.",
        "availability_rule": "Training inputs require current APPROVED status, a dated event, and reviewed_at no later than cutoff. Latest review time/current status are conservative proxies, not immutable approval history.",
        "missing_data_rule": "Unobserved target months are omitted, not zero-filled. Empty surveillance windows are NaN with report-presence indicators; training medians are fit separately inside each historical fold.",
        "feature_rule": "Separate disease report, affected-head, and mortality-death columns; lag values use prior observed target months and expose their calendar age. Optional animal/herd links are omitted as incomplete; no current-inventory rate is used.",
        "minimum_periods_for_directional_signal": MIN_EVALUATION_PERIODS_FOR_SIGNAL,
        "enhanced_model_adopted": False,
        "reason": reason,
        "targets": targets,
    }

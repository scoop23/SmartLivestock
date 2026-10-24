import calendar
from datetime import date, datetime, timezone as datetime_timezone
from unittest.mock import patch

from django.test import SimpleTestCase, TestCase

from analytics.services.predictive.surveillance_experiment import (
    TARGETS,
    _deduplicated_death_count,
    _feature_matrix,
    _fit_enhanced_candidate,
    _metric_summary,
    _monthly_sum,
    build_surveillance_features,
    classify_comparison,
    evaluate_surveillance_forecast_experiment,
)
from analytics.services.predictive.surveillance_features import build_target_history_features


class SurveillanceForecastExperimentTests(SimpleTestCase):
    def setUp(self):
        self.cutoff = datetime(2025, 2, 1, tzinfo=datetime_timezone.utc)

    def test_features_use_only_pre_cutoff_event_and_review_dates(self):
        disease = [
            {"record_date": date(2025, 1, 3), "reviewed_at": datetime(2025, 1, 4, tzinfo=datetime_timezone.utc), "affected_count": 2},
            {"record_date": date(2025, 1, 20), "reviewed_at": datetime(2025, 1, 21, tzinfo=datetime_timezone.utc), "affected_count": 3},
            {"record_date": date(2025, 1, 30), "reviewed_at": datetime(2025, 1, 31, tzinfo=datetime_timezone.utc), "affected_count": 4},
            {"record_date": date(2025, 1, 31), "reviewed_at": datetime(2025, 2, 2, tzinfo=datetime_timezone.utc), "affected_count": 20},
            {"record_date": date(2025, 2, 1), "reviewed_at": datetime(2025, 1, 30, tzinfo=datetime_timezone.utc), "affected_count": 30},
        ]
        features = build_surveillance_features(self.cutoff, disease, [], "disease")

        self.assertEqual(features["disease_reports_7d"], 1)
        self.assertEqual(features["disease_affected_heads_7d"], 4)
        self.assertEqual(features["disease_reports_14d"], 2)
        self.assertEqual(features["disease_reports_30d"], 3)
        self.assertEqual(features["disease_affected_heads_30d"], 9)

    def test_empty_report_window_is_missing_not_zero(self):
        features = build_surveillance_features(self.cutoff, [], [], "disease")
        self.assertIsNone(features["disease_reports_7d"])
        self.assertEqual(features["disease_reports_7d_observed"], 0)
        self.assertIsNone(features["disease_affected_heads_30d"])
        self.assertEqual(features["disease_affected_heads_30d_observed"], 0)

    def test_mortality_feature_keeps_death_counts_and_deduplicates_identified_animals(self):
        disease = [
            {"record_date": date(2025, 1, day), "reviewed_at": datetime(2025, 1, day, tzinfo=datetime_timezone.utc), "affected_count": 1}
            for day in (3, 20, 30)
        ]
        mortality = [
            {"id": 1, "record_date": date(2025, 1, 10), "reviewed_at": datetime(2025, 1, 11, tzinfo=datetime_timezone.utc), "death_count": 1, "animal_ids": {7}},
            {"id": 2, "record_date": date(2025, 1, 11), "reviewed_at": datetime(2025, 1, 12, tzinfo=datetime_timezone.utc), "death_count": 1, "animal_ids": {7}},
            {"id": 3, "record_date": date(2025, 1, 29), "reviewed_at": datetime(2025, 1, 30, tzinfo=datetime_timezone.utc), "death_count": 1, "animal_ids": {8}},
        ]

        features = build_surveillance_features(self.cutoff, disease, mortality, "mortality")
        self.assertEqual(features["mortality_deaths_30d"], 2)
        self.assertEqual(_deduplicated_death_count(mortality), 2)

    def test_monthly_target_does_not_use_later_approval_or_current_month(self):
        rows = [
            {"record_date": date(2024, 12, 31), "reviewed_at": datetime(2025, 1, 5, tzinfo=datetime_timezone.utc), "affected_count": 4},
            {"record_date": date(2025, 1, 20), "reviewed_at": datetime(2025, 2, 2, tzinfo=datetime_timezone.utc), "affected_count": 10},
        ]
        monthly = _monthly_sum(rows, self.cutoff, "affected_count")

        self.assertEqual(len(monthly), 1)
        self.assertEqual(monthly.iloc[0]["quantity"], 4)
        self.assertTrue((monthly["month"].dt.date < self.cutoff.date()).all())

    def test_partial_month_rows_are_excluded_from_forecast_training(self):
        rows = [{
            "record_date": date(2025, 2, 3),
            "reviewed_at": datetime(2025, 2, 4, tzinfo=datetime_timezone.utc),
            "affected_count": 4,
        }]
        complete_history = _monthly_sum(
            rows,
            datetime(2025, 2, 10, tzinfo=datetime_timezone.utc),
            "affected_count",
            event_before=date(2025, 2, 1),
        )
        self.assertTrue(complete_history.empty)

    def test_no_valid_predictions_return_null_metrics_not_zero(self):
        metrics = _metric_summary([], "enhanced_prediction", denominator=0)
        self.assertEqual(metrics["periods"], 0)
        self.assertIsNone(metrics["mae"])
        self.assertIsNone(metrics["rmse"])

    def test_reports_and_heads_are_separate_target_units(self):
        self.assertEqual(TARGETS["disease_reports"]["unit"], "CASES")
        self.assertEqual(TARGETS["disease_affected_heads"]["unit"], "HEADS")
        self.assertEqual(TARGETS["mortality_deaths"]["unit"], "HEADS")
        self.assertNotEqual(TARGETS["disease_reports"]["value"], TARGETS["disease_affected_heads"]["value"])

    def test_small_or_inconsistent_sample_is_not_called_improvement(self):
        baseline = {"mae": 10, "rmse": 12}
        enhanced = {"mae": 4, "rmse": 5}
        two_periods = [{"enhanced_absolute_error": 1, "baseline_absolute_error": 5}] * 2
        self.assertEqual(classify_comparison(baseline, enhanced, two_periods), "INCONCLUSIVE")

    def test_directional_improvement_requires_minimum_periods_and_consistent_wins(self):
        baseline = {"mae": 10, "rmse": 12}
        enhanced = {"mae": 8, "rmse": 9}
        periods = [{"enhanced_absolute_error": 4, "baseline_absolute_error": 10}] * 12
        self.assertEqual(classify_comparison(baseline, enhanced, periods), "IMPROVED_IN_EXPERIMENT")

    def test_monthly_lags_skip_future_rows_and_keep_missing_months_missing(self):
        history = [
            {"month": date(2024, 12, 1), "quantity": 8},
            {"month": date(2025, 1, 1), "quantity": 10},
            {"month": date(2025, 2, 1), "quantity": 500},
        ]
        features = build_target_history_features(self.cutoff, history)
        self.assertEqual(features["target_lag_1"], 10)
        self.assertEqual(features["target_lag_2"], 8)
        self.assertEqual(features["target_lag_3"], None)
        self.assertEqual(features["target_lag_3_observed"], 0)

    def test_imputation_uses_training_median_and_preserves_missing_indicator(self):
        import pandas as pd

        training = pd.DataFrame({
            "month": pd.date_range("2024-01-01", periods=12, freq="MS"),
            "quantity": [float(index + 1) for index in range(12)],
            "disease_reports_7d": [2.0, 4.0, None, 8.0, 10.0, 12.0, 14.0, 16.0, 18.0, 20.0, 22.0, 24.0],
            "disease_reports_7d_observed": [1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        })
        prediction = {
            "month": pd.Timestamp("2025-01-01"), "disease_reports_7d": None,
            "disease_reports_7d_observed": 0,
        }
        X_train, X_future, _, imputed, medians = _feature_matrix(
            training, prediction, ["disease_reports_7d"],
        )
        self.assertEqual(medians["disease_reports_7d"], 14.0)
        self.assertIn("disease_reports_7d", imputed)
        self.assertEqual(X_train.shape[1], X_future.shape[1])
        self.assertEqual(X_future[0, -1], 0)

    def test_insufficient_and_missing_surveillance_training_return_no_prediction(self):
        import pandas as pd

        small = pd.DataFrame({"month": pd.date_range("2024-01-01", periods=4, freq="MS"), "quantity": [1, 2, 3, 4]})
        insufficient = _fit_enhanced_candidate(small, {"month": pd.Timestamp("2024-05-01")}, ["disease_reports_7d"])
        self.assertEqual(insufficient["status"], "INSUFFICIENT_TRAINING_DATA")
        self.assertIsNone(insufficient["prediction"])

        missing = pd.DataFrame({
            "month": pd.date_range("2024-01-01", periods=12, freq="MS"),
            "quantity": [float(index + 1) for index in range(12)],
            "disease_reports_7d": [None] * 12,
            "disease_reports_7d_observed": [0] * 12,
        })
        no_signal = _fit_enhanced_candidate(missing, {
            "month": pd.Timestamp("2025-01-01"), "disease_reports_7d": None,
            "disease_reports_7d_observed": 0,
        }, ["disease_reports_7d"])
        self.assertEqual(no_signal["status"], "MISSING_SURVEILLANCE_DATA")
        self.assertIsNone(no_signal["prediction"])

    def test_constant_targets_fit_as_constant_and_model_errors_are_structured(self):
        import pandas as pd

        training = pd.DataFrame({
            "month": pd.date_range("2024-01-01", periods=12, freq="MS"),
            "quantity": [5.0] * 12,
            "disease_reports_7d": [1.0] * 12,
            "disease_reports_7d_observed": [1] * 12,
        })
        prediction_row = {"month": pd.Timestamp("2025-01-01"), "disease_reports_7d": 1.0, "disease_reports_7d_observed": 1}
        constant = _fit_enhanced_candidate(training, prediction_row, ["disease_reports_7d"])
        self.assertEqual(constant["status"], "READY")
        self.assertTrue(constant["constant_target"])
        self.assertEqual(constant["prediction"], 5.0)
        with patch("analytics.services.predictive.surveillance_experiment.LinearRegression.fit", side_effect=ValueError("fit failed")):
            failed = _fit_enhanced_candidate(training, prediction_row, ["disease_reports_7d"])
        self.assertEqual(failed["status"], "MODEL_FIT_FAILED")
        self.assertIsNone(failed["prediction"])


class ForecastExperimentReadinessTests(SimpleTestCase):
    def test_empty_sources_return_insufficient_evaluation_without_fake_metrics(self):
        with patch("analytics.services.predictive.surveillance_experiment._load_surveillance_rows", return_value=([], [])), patch(
            "analytics.services.predictive.surveillance_experiment._load_target_rows", return_value=[],
        ):
            result = evaluate_surveillance_forecast_experiment(user=None, today=date(2026, 10, 24))

        self.assertEqual(result["status"], "INSUFFICIENT_EVALUATION_DATA")
        for target in result["targets"].values():
            self.assertEqual(target["valid_evaluation_periods"], 0)
            self.assertEqual(target["training_status"], "INSUFFICIENT_TRAINING_DATA")
            self.assertIsNone(target["baseline"]["mae"])
            self.assertIsNone(target["enhanced"]["rmse"])

    @staticmethod
    def _monthly_disease_rows():
        rows = []
        for offset in range(15):
            year = 2024 + offset // 12
            month = offset % 12 + 1
            event_day = calendar.monthrange(year, month)[1]
            event = date(year, month, event_day)
            rows.append({
                "id": offset + 1,
                "record_date": event,
                "reviewed_at": datetime(year, month, event_day, 12, tzinfo=datetime_timezone.utc),
                "affected_count": offset + 1,
                "name": "Recorded report",
                "livestock_id": None,
                "batch_id": None,
            })
        return rows

    def test_target_readiness_is_independent_and_evaluation_is_chronological(self):
        disease_rows = self._monthly_disease_rows()
        with patch("analytics.services.predictive.surveillance_experiment._load_surveillance_rows", return_value=(disease_rows, [])), patch(
            "analytics.services.predictive.surveillance_experiment._load_target_rows",
            side_effect=lambda _user, domain: disease_rows if domain == "disease" else [],
        ), patch(
            "analytics.services.predictive.surveillance_experiment._best_existing_model",
            return_value=("Naive Baseline", {}, "Naive Baseline"),
        ), patch(
            "analytics.services.predictive.surveillance_experiment._predict_existing",
            return_value=4.0,
        ):
            result = evaluate_surveillance_forecast_experiment(user=None, today=date(2026, 10, 24))

        disease = result["targets"]["disease_reports"]
        mortality = result["targets"]["mortality_deaths"]
        self.assertEqual(disease["training_status"], "READY")
        self.assertEqual(disease["candidate_status"], "EXPERIMENTAL")
        self.assertIsNotNone(disease["candidate_forecast"])
        self.assertGreater(disease["valid_evaluation_periods"], 0)
        self.assertEqual(mortality["training_status"], "INSUFFICIENT_TRAINING_DATA")
        self.assertIsNone(mortality["candidate_forecast"])
        self.assertEqual(result["targets"]["disease_affected_heads"]["unit"], "HEADS")
        self.assertEqual(disease["unit"], "CASES")
        for row in disease["periods"]:
            self.assertLess(row["cutoff"], f"{row['target_month']}-99")
            self.assertEqual(row["horizon_months"], 1)
        self.assertFalse(result["enhanced_model_adopted"])

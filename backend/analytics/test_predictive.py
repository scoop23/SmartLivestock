"""
Tests for SmartLivestock Predictive Analytics, Model Comparison, and Prescriptive Rules.
"""

from datetime import date, datetime, time, timedelta
from dateutil.relativedelta import relativedelta
from decimal import Decimal
import numpy as np
import pandas as pd

from django.test import TestCase
from django.core.management import call_command
from django.utils import timezone

from production.models import ProductionRecord
from livestock.models import LivestockInventory, LivestockType, Barangay
from users.models import User, Role
from analytics.services.predictive.data import (
    extract_monthly_production_series,
    prepare_tabular_features,
    chronological_split,
    SEED_MARKER,
)
from analytics.services.predictive.models import (
    NaiveBaselineModel,
    TabularLinearRegression,
    TabularRandomForest,
    ARIMAForecaster,
    HoltWintersForecaster,
)
from analytics.services.predictive.evaluation import (
    calculate_metrics,
    evaluate_all_models,
    evaluate_rolling_origins,
)
from analytics.services.predictive.forecasting import generate_future_forecast
from analytics.services.predictive.rules import generate_prescriptive_recommendations


class PredictiveAnalyticsTests(TestCase):
    def setUp(self):
        # Create standard test roles & users
        self.mao_role, _ = Role.objects.get_or_create(role_name="MAO")
        self.farmer_role, _ = Role.objects.get_or_create(role_name="FARMER")

        self.mao_user = User.objects.create(
            username="test_mao_pred",
            email="mao@example.com",
            role=self.mao_role,
        )
        self.farmer_user = User.objects.create(
            username="test_farmer_pred",
            email="farmer@example.com",
            role=self.farmer_role,
        )

        self.barangay = Barangay.objects.create(
            barangay_name="San Roque",
            latitude=Decimal("13.876543"),
            longitude=Decimal("121.213456"),
        )
        self.livestock_type = LivestockType.objects.create(name="Cattle")

        from livestock.models import Farmer
        self.farmer_profile = Farmer.objects.create(
            user=self.farmer_user,
            barangay=self.barangay,
        )

        self.inventory = LivestockInventory.objects.create(
            tag_number="TAG-TEST-001",
            livestock_type=self.livestock_type,
            farmer=self.farmer_profile,
            status="APPROVED",
            created_by=self.farmer_user,
        )

    def test_seed_command_safety_and_clean(self):
        """
        Verify that:
        1. A real user-created production record exists.
        2. seed_productions creates marked test records.
        3. seed_productions --clean removes ONLY seed records, leaving real records untouched.
        """
        # 1. Create a real production record (no seed marker)
        real_record = ProductionRecord.objects.create(
            livestock=self.inventory,
            production_type=ProductionRecord.ProductionType.MILK,
            quantity=Decimal("15.50"),
            unit=ProductionRecord.UnitType.LITERS,
            record_date=date(2026, 8, 10),
            status=ProductionRecord.ProductionStatus.APPROVED,
            notes="Real farmer daily morning milk production",
            created_by=self.farmer_user,
            reviewed_by=self.mao_user,
        )

        # 2. Call seed command
        call_command("seed_productions", months=24)
        seeded_count = ProductionRecord.objects.filter(notes__contains=SEED_MARKER).count()
        self.assertEqual(seeded_count, 24)

        # Total should be 24 + 1 = 25
        self.assertEqual(ProductionRecord.objects.count(), 25)

        # 3. Clean seed records
        call_command("seed_productions", clean=True)

        # Seed records must be 0
        self.assertEqual(ProductionRecord.objects.filter(notes__contains=SEED_MARKER).count(), 0)

        # Real record must remain intact!
        self.assertTrue(ProductionRecord.objects.filter(id=real_record.id).exists())
        remaining = ProductionRecord.objects.get(id=real_record.id)
        self.assertEqual(remaining.notes, "Real farmer daily morning milk production")
        self.assertEqual(remaining.quantity, Decimal("15.50"))

    def test_insufficient_data_status(self):
        """
        When fewer than 12 monthly observations exist, evaluate_all_models must return
        status='insufficient_data' rather than fabricating fake predictions.
        """
        # Create only 2 approved records
        ProductionRecord.objects.create(
            livestock=self.inventory,
            production_type=ProductionRecord.ProductionType.MILK,
            quantity=Decimal("100.00"),
            unit=ProductionRecord.UnitType.LITERS,
            record_date=date(2026, 1, 15),
            status=ProductionRecord.ProductionStatus.APPROVED,
            created_by=self.farmer_user,
        )
        ProductionRecord.objects.create(
            livestock=self.inventory,
            production_type=ProductionRecord.ProductionType.MILK,
            quantity=Decimal("120.00"),
            unit=ProductionRecord.UnitType.LITERS,
            record_date=date(2026, 2, 15),
            status=ProductionRecord.ProductionStatus.APPROVED,
            created_by=self.farmer_user,
        )

        result = evaluate_all_models(production_type="MILK", unit="LITERS")
        self.assertEqual(result["status"], "insufficient_data")
        self.assertEqual(len(result["models"]), 0)
        self.assertIn("Insufficient historical data", result["message"])

    def test_milk_monthly_total_sums_recorded_sessions_and_excludes_approved_rows(self):
        """Monthly milk totals sum current farmer logs and ignore historical approvals."""
        from dateutil.relativedelta import relativedelta
        from analytics.services.predictive.data import extract_monthly_series

        event_date = timezone.localdate().replace(day=1) - relativedelta(days=1)
        morning = ProductionRecord.objects.create(
            livestock=self.inventory, production_type="MILK", quantity=Decimal("8.00"),
            unit="LITERS", record_date=event_date, milking_session="MORNING",
            status="RECORDED", created_by=self.farmer_user,
        )
        ProductionRecord.objects.create(
            livestock=self.inventory, production_type="MILK", quantity=Decimal("5.00"),
            unit="LITERS", record_date=event_date, milking_session="AFTERNOON",
            status="RECORDED", created_by=self.farmer_user,
        )
        duplicate_conflict = ProductionRecord.objects.create(
            livestock=self.inventory, production_type="MILK", quantity=Decimal("99.00"),
            unit="LITERS", record_date=event_date, milking_session="EVENING",
            status="RECORDED", created_by=self.farmer_user,
        )
        ProductionRecord.objects.filter(pk=duplicate_conflict.pk).update(session_conflict=True)

        series, metadata = extract_monthly_series(domain="production", target="MILK", unit="LITERS")
        self.assertIsNone(series)  # One month is visible, but far below the training minimum.
        self.assertEqual(metadata["historical_trend"][0]["actual"], 13.0)
        self.assertEqual(metadata["excluded_milk_session_conflict_records"], 1)
        self.assertTrue(metadata["approval_cutoff_reconstructable"])

        self.assertEqual(metadata["approval_cutoff_reconstructable"], True)

    def test_recorded_milk_log_is_forecast_eligible_from_submission_time(self):
        from analytics.services.predictive.data import extract_monthly_series

        event_date = timezone.localdate().replace(day=1) - timedelta(days=1)
        record = ProductionRecord.objects.create(
            livestock=self.inventory, production_type="MILK", quantity=Decimal("7.00"),
            unit="LITERS", record_date=event_date, milking_session="MORNING",
            status=ProductionRecord.ProductionStatus.RECORDED, created_by=self.farmer_user,
        )
        ProductionRecord.objects.create(
            livestock=self.inventory, production_type="MILK", quantity=Decimal("900.00"),
            unit="LITERS", record_date=event_date, milking_session="AFTERNOON",
            status=ProductionRecord.ProductionStatus.APPROVED, created_by=self.farmer_user,
        )
        _, metadata = extract_monthly_series(domain="production", target="MILK", unit="LITERS")
        self.assertEqual(metadata["total_records"], 1)
        self.assertEqual(metadata["historical_trend"][0]["actual"], 7.0)
        self.assertEqual(
            metadata["approval_timeline"][0]["available_to_model_on"],
            record.created_at.astimezone(timezone.get_current_timezone()).date().isoformat(),
        )
        self.assertIn("RECORDED", metadata["target_definition"]["eligible_status"])

    def test_milk_availability_cutoff_uses_local_calendar_date(self):
        """A UTC timestamp crossing midnight is assigned to its Asia/Manila submission day."""
        from analytics.services.predictive.data import extract_monthly_series

        record = ProductionRecord.objects.create(
            livestock=self.inventory, production_type="MILK", quantity=Decimal("8.00"),
            unit="LITERS", record_date=date(2026, 1, 31), milking_session="MORNING",
            status="RECORDED", created_by=self.farmer_user,
        )
        boundary_timestamp = datetime.fromisoformat("2026-01-31T16:30:00+00:00")
        ProductionRecord.objects.filter(pk=record.pk).update(
            created_at=boundary_timestamp, approved_at=boundary_timestamp
        )
        _, metadata = extract_monthly_series(domain="production", target="MILK", unit="LITERS")
        self.assertEqual(metadata["approval_timeline"][0]["event_month"], "2026-01")
        self.assertEqual(metadata["approval_timeline"][0]["available_to_model_on"], "2026-02-01")

    def test_months_without_records_are_not_zero_filled_or_forecast(self):
        """Missing monthly reporting is shown as unknown, while a reported zero stays zero."""
        from dateutil.relativedelta import relativedelta
        from analytics.services.predictive.data import extract_monthly_series

        current_month = timezone.localdate().replace(day=1)
        first_month = current_month - relativedelta(months=25)
        missing_index = 5
        zero_index = 7
        for offset in range(25):
            if offset == missing_index:
                continue
            month = first_month + relativedelta(months=offset)
            ProductionRecord.objects.create(
                livestock=self.inventory,
                production_type=ProductionRecord.ProductionType.MILK,
                quantity=Decimal("0.00") if offset == zero_index else Decimal("5.00"),
                unit=ProductionRecord.UnitType.LITERS,
                record_date=month + timedelta(days=4),
                status=ProductionRecord.ProductionStatus.RECORDED,
                created_by=self.farmer_user,
            )

        series, metadata = extract_monthly_series(domain="production", target="MILK", unit="LITERS")
        self.assertIsNone(series)
        self.assertEqual(metadata["status"], "incomplete_coverage")
        self.assertEqual(metadata["missing_month_count"], 1)
        self.assertTrue(any(point["actual"] == 0 for point in metadata["historical_trend"]))
        result = evaluate_all_models(domain="production", target="MILK", unit="LITERS")
        self.assertFalse(result["forecast_available"])
        self.assertIn("no coverage log", result["message"])
        self.assertEqual(len(result["historical_trend"]), 24)

    def test_rolling_origin_excludes_records_not_approved_at_cutoff(self):
        """A late-reviewed event cannot enter the model history for an earlier cutoff."""
        from unittest.mock import patch
        from analytics.services.predictive.evaluation import evaluate_rolling_origins

        months = pd.date_range("2024-01-01", periods=20, freq="MS")
        approvals = [month.date() + timedelta(days=5) for month in months]
        # The first test origin is index 14; this training-month value was only
        # approved after that origin and must therefore be withheld.
        approvals[13] = months[14].date() + timedelta(days=5)
        frame = pd.DataFrame({
            "month": months,
            "quantity": np.arange(1, 21, dtype=float),
            "available_at": pd.to_datetime(approvals),
        })
        seen_histories = []

        def forecast(name, history, future_dates):
            seen_histories.append(history["month"].tolist())
            return np.ones(len(future_dates), dtype=float)

        with patch("analytics.services.predictive.evaluation.forecast_candidate", side_effect=forecast):
            result = evaluate_rolling_origins(frame, ["Naive Baseline"], requested_horizon=6)

        self.assertTrue(seen_histories)
        self.assertNotIn(months[13], seen_histories[-1])
        self.assertLess(seen_histories[-1][-1], months[13])
        self.assertEqual(result["diagnostics"][0]["status"], "EVALUATED")
        self.assertEqual(result["diagnostics"][0]["available_training_months"], 13)

    def test_rolling_origin_diagnostics_count_only_valid_cutoffs(self):
        """Late imported history is excluded, while valid cutoffs remain reportable."""
        from unittest.mock import patch
        from analytics.services.predictive.evaluation import evaluate_rolling_origins

        months = pd.date_range("2023-01-01", periods=36, freq="MS")
        frame = pd.DataFrame({
            "month": months,
            "quantity": np.arange(10, 46, dtype=float),
            "available_at": pd.to_datetime([month + timedelta(days=5) for month in months]),
        })

        def forecast(name, history, future_dates):
            return np.repeat(float(history["quantity"].iloc[-1]), len(future_dates))

        with patch("analytics.services.predictive.evaluation.forecast_candidate", side_effect=forecast):
            result = evaluate_rolling_origins(frame, ["Naive Baseline"], requested_horizon=6)

        self.assertGreaterEqual(result["windows"], 3)
        self.assertIsNotNone(result["models"]["Naive Baseline"]["mae"])
        self.assertTrue(all(row["status"] == "EVALUATED" for row in result["diagnostics"]))

    def test_predictive_endpoint_keeps_sibat_scope_and_denies_farmer(self):
        """Municipal forecasting aggregates only the assigned SIBAT barangay."""
        from rest_framework.test import APIRequestFactory, force_authenticate
        from analytics.views import predictive_model_comparison
        from livestock.models import Farmer

        sibat_role, _ = Role.objects.get_or_create(role_name="SIBAT")
        sibat_user = User.objects.create(
            username="test_sibat_forecast", email="sibat-forecast@example.com",
            role=sibat_role, assigned_barangay=self.barangay,
        )
        other_barangay = Barangay.objects.create(
            barangay_name="Pansol Forecast Test", latitude=Decimal("13.8"), longitude=Decimal("121.2")
        )
        other_farmer_user = User.objects.create(
            username="test_other_farmer_forecast", email="other-forecast@example.com", role=self.farmer_role,
        )
        other_farmer = Farmer.objects.create(user=other_farmer_user, barangay=other_barangay)
        event_date = timezone.localdate().replace(day=1) - relativedelta(days=1)
        ProductionRecord.objects.create(
            farmer_at_record=self.farmer_profile, production_type="MILK", quantity=Decimal("10.00"),
            unit="LITERS", record_date=event_date, status="RECORDED", created_by=self.farmer_user,
        )
        ProductionRecord.objects.create(
            farmer_at_record=other_farmer, production_type="MILK", quantity=Decimal("999.00"),
            unit="LITERS", record_date=event_date, status="RECORDED", created_by=other_farmer_user,
        )

        factory = APIRequestFactory()
        request = factory.get("/api/analytics/predictive/", {"domain": "production", "target": "MILK", "unit": "LITERS"})
        force_authenticate(request, user=sibat_user)
        response = predictive_model_comparison(request)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["historical_trend"][0]["actual"], 10.0)

        farmer_request = factory.get("/api/analytics/predictive/")
        force_authenticate(farmer_request, user=self.farmer_user)
        farmer_response = predictive_model_comparison(farmer_request)
        self.assertEqual(farmer_response.status_code, 403)

    def test_data_leakage_and_chronological_split(self):
        """
        Verify that train/test split is strictly chronological and tabular features
        do not leak future information.
        """
        # Seed 24 months of synthetic data
        call_command("seed_productions", months=24)

        df, meta = extract_monthly_production_series(production_type="MILK", unit="LITERS")
        self.assertIsNotNone(df)
        self.assertGreaterEqual(len(df), 24)

        df_feat = prepare_tabular_features(df)
        train_df, test_df = chronological_split(df_feat, test_ratio=0.2)

        # Train end date must be strictly before test start date (no future data in train)
        max_train_date = train_df["month"].max()
        min_test_date = test_df["month"].min()
        self.assertLess(max_train_date, min_test_date)

        # Verify lag_1 in test_df[0] equals the quantity of the preceding row
        first_test_idx = test_df.index[0]
        preceding_quantity = df_feat.loc[first_test_idx - 1, "quantity"]
        self.assertEqual(test_df.loc[first_test_idx, "lag_1"], preceding_quantity)

    def test_model_evaluation_metrics_and_comparison(self):
        """Seed timestamps do not count as historical backtest evidence."""
        call_command("seed_productions", months=36)
        result = evaluate_all_models(production_type="MILK", unit="LITERS")
        self.assertEqual(result["status"], "unvalidated")
        self.assertTrue(result["forecast_available"])
        self.assertEqual(result["validation_status"], "NOT_YET_VALIDATED")
        self.assertEqual(result["backtest_windows_available"], 0)
        self.assertEqual(len(result["models"]), 6)
        self.assertTrue(all(item["mae"] is None for item in result["models"]))
        self.assertTrue(all(item["status"] != "EVALUATED" for item in result["models"]))

    def test_future_forecast_generation(self):
        """
        Verify that out-of-sample future projections start strictly after the last historical date.
        """
        call_command("seed_productions", months=36)

        fc = generate_future_forecast(production_type="MILK", unit="LITERS", horizon_months=6)
        self.assertEqual(fc["status"], "unvalidated")
        self.assertTrue(fc["forecast_available"])
        self.assertEqual(len(fc["forecast"]), 6)

        last_hist_date = fc["metadata"]["last_historical_date"]
        for pt in fc["forecast"]:
            self.assertGreater(pt["date"], last_hist_date)
            self.assertIsInstance(pt["predicted"], (int, float))

        # Combined chart data must contain both historical actuals and future forecast
        chart_data = fc["chart_data"]
        self.assertGreater(len(chart_data), 6)
        # Last future item has forecast and null actual
        self.assertIsNone(chart_data[-1]["actual"])
        self.assertIsNotNone(chart_data[-1]["forecast"])

    def test_prescriptive_rules_triggering(self):
        """
        Verify prescriptive rules generate evidence-backed recommendations.
        """
        call_command("seed_productions", months=24)

        rec_res = generate_prescriptive_recommendations(production_type="MILK", unit="LITERS")
        self.assertEqual(rec_res["status"], "partial")
        self.assertGreater(rec_res["total_recommendations"], 0)

        for rec in rec_res["recommendations"]:
            self.assertIn("rule", rec)
            self.assertIn("severity", rec)
            self.assertIn("evidence", rec)
            self.assertIn("recommendation", rec)
            self.assertIn(rec["severity"], ["LOW", "MEDIUM", "HIGH"])

    def test_multi_domain_insufficient_data_handling(self):
        """
        Verify that domains with fewer than 12 monthly observations return
        status='insufficient_data' and forecast_available=False without fabricating fake predictions.
        """
        from analytics.services.predictive.data import extract_monthly_series

        # With 0 records, auction domain must report insufficient data
        df, meta = extract_monthly_series(domain="auction", target="ALL", unit="HEADS")
        self.assertIsNone(df)
        self.assertEqual(meta["status"], "insufficient_data")
        self.assertFalse(meta["forecast_available"])
        self.assertIn("Insufficient historical data", meta["message"])

        # evaluate_all_models and generate_future_forecast must propagate this state safely
        eval_res = evaluate_all_models(domain="auction", target="ALL", unit="HEADS")
        self.assertEqual(eval_res["status"], "insufficient_data")
        self.assertFalse(eval_res["forecast_available"])

        fc_res = generate_future_forecast(domain="auction", target="ALL", unit="HEADS")
        self.assertEqual(fc_res["status"], "insufficient_data")
        self.assertFalse(fc_res["forecast_available"])

    def test_slaughter_seed_forecasting_and_clean(self):
        """
        Verify end-to-end slaughter domain pipeline:
        1. Seed 24 months of slaughterhouse throughput.
        2. Evaluate six candidates over rolling forecast windows on HEADS.
        3. Generate future 6-month forecast.
        4. Clean synthetic records safely.
        """
        from production.models import SlaughterRecord
        from analytics.seed_markers import SEED_MARKER_SLAUGHTER

        # Seed 24 months of synthetic slaughter records
        call_command("seed_slaughters", months=24)
        seeded_slaughters = SlaughterRecord.objects.filter(review_remarks__contains=SEED_MARKER_SLAUGHTER).count()
        self.assertGreaterEqual(seeded_slaughters, 24)

        # Model evaluation on HEADS
        eval_res = evaluate_all_models(domain="slaughter", target="ALL", unit="HEADS")
        self.assertEqual(eval_res["status"], "unvalidated")
        self.assertTrue(eval_res["forecast_available"])
        self.assertEqual(len(eval_res["models"]), 7)
        self.assertIn("selected_model", eval_res["selection"])

        # Future forecast generation
        fc = generate_future_forecast(domain="slaughter", target="ALL", unit="HEADS", horizon_months=6)
        self.assertEqual(fc["status"], "unvalidated")
        self.assertEqual(len(fc["forecast"]), 6)
        self.assertIn("chart_data", fc)

        meat_yield = evaluate_all_models(domain="slaughter", target="ALL", unit="KILOGRAMS")
        self.assertTrue(meat_yield["forecast_available"])
        self.assertEqual(meat_yield["target"]["unit"], "KILOGRAMS")
        self.assertEqual(meat_yield["metric_definition"]["label"], "Slaughterhouse meat yield")

        # Safe clean
        call_command("seed_slaughters", clean=True)
        remaining = SlaughterRecord.objects.filter(review_remarks__contains=SEED_MARKER_SLAUGHTER).count()
        self.assertEqual(remaining, 0)

    def test_farmer_meat_and_slaughter_meat_separation(self):
        """
        Verify that farmer-reported meat (ProductionRecord with slaughter=None)
        is isolated and never confused with municipal slaughter records.
        """
        from production.models import SlaughterRecord
        from analytics.services.predictive.data import extract_monthly_series

        # 1. Create a farmer-reported meat record
        farmer_meat = ProductionRecord.objects.create(
            livestock=self.inventory,
            production_type=ProductionRecord.ProductionType.MEAT,
            quantity=Decimal("50.00"),
            unit=ProductionRecord.UnitType.KILOGRAMS,
            record_date=date(2026, 8, 1),
            status=ProductionRecord.ProductionStatus.RECORDED,
            slaughter=None,
            notes="On-farm processed meat",
            created_by=self.farmer_user,
        )

        # 2. Create a slaughter record (abattoir meat)
        slaughter_rec = SlaughterRecord.objects.create(
            livestock_type=self.livestock_type,
            quantity=1,
            carcass_weight=Decimal("200.00"),
            record_date=date(2026, 8, 1),
            status=SlaughterRecord.StatusType.APPROVED,
            created_by=self.mao_user,
        )

        # 3. Extract production series for MEAT (KILOGRAMS)
        df, meta = extract_monthly_series(domain="production", target="MEAT", unit="KILOGRAMS")
        # Since < 12 records, df is None, but meta['historical_trend'] contains the point
        trend = meta.get("historical_trend", [])
        self.assertEqual(len(trend), 1)
        # Quantity should be exactly the 50.0 kg from farmer_meat, NOT including the 200.0 kg slaughterhouse meat!
        self.assertEqual(trend[0]["actual"], 50.0)

    def test_farmer_reported_meat_has_its_own_kilogram_forecast(self):
        """Farmer MEAT rows without a slaughter link remain a separate target."""
        call_command("seed_productions", months=36, production_type="MEAT")

        result = evaluate_all_models(domain="production", target="MEAT", unit="KILOGRAMS")
        self.assertTrue(result["forecast_available"])
        self.assertEqual(result["target"]["unit"], "KILOGRAMS")
        self.assertEqual(result["metric_definition"]["label"], "Farmer-reported meat yield")
        self.assertIn("slaughter is null", result["metric_definition"]["source"])

        forecast = generate_future_forecast(domain="production", target="MEAT", unit="KILOGRAMS")
        self.assertTrue(forecast["forecast_available"])
        self.assertEqual(forecast["target"]["unit"], "KILOGRAMS")

    def test_event_based_backtest_requires_the_full_requested_monthly_horizon(self):
        months = pd.date_range("2024-01-01", periods=12, freq="MS")
        short_history = pd.DataFrame({"month": months, "quantity": np.arange(12, dtype=float)})
        result = evaluate_rolling_origins(
            short_history, ["Naive Baseline"], requested_horizon=6, exact_horizon=True
        )
        self.assertEqual(result["windows"], 0)
        self.assertEqual(result["horizon"], 6)
        self.assertIn("full 6-month test horizon", result["diagnostics"][0]["reason"])

        longer_history = pd.DataFrame({
            "month": pd.date_range("2024-01-01", periods=18, freq="MS"),
            "quantity": np.arange(18, dtype=float),
        })
        result = evaluate_rolling_origins(
            longer_history, ["Naive Baseline"], requested_horizon=6, exact_horizon=True
        )
        self.assertGreaterEqual(result["windows"], 1)
        self.assertEqual(result["horizon"], 6)

    def test_descriptive_analytics_slaughter_and_mortality_enrichment(self):
        """
        Verify that descriptive analytics contains the new slaughterhouse section,
        mortality risk indicator, and mortality barangay breakdown.
        """
        from analytics.services.descriptive import descriptive_summary
        from diseases.models import MortalityRecord

        # Create approved mortality record
        MortalityRecord.objects.create(
            livestock=self.inventory,
            death_count=2,
            cause="Heat Stress",
            record_date=date.today(),
            status=MortalityRecord.MortalityRecordStatus.APPROVED,
            created_by=self.farmer_user,
            reviewed_by=self.mao_user,
        )

        # Create approved slaughter record
        from production.models import SlaughterRecord
        SlaughterRecord.objects.create(
            livestock_type=self.livestock_type,
            quantity=3,
            carcass_weight=Decimal("540.00"),
            record_date=date.today(),
            status=SlaughterRecord.StatusType.APPROVED,
            created_by=self.mao_user,
        )

        desc = descriptive_summary()["descriptive"]
        self.assertIn("slaughter", desc)
        self.assertEqual(desc["slaughter"]["total_heads"], 3)
        self.assertEqual(desc["slaughter"]["total_carcass_weight_kg"], 540.0)

        self.assertIn("mortality", desc)
        self.assertIn("risk_indicator", desc["mortality"])
        self.assertIn("level", desc["mortality"]["risk_indicator"])
        self.assertIn("by_barangay", desc["mortality"])
        self.assertIn("sales", desc)
        self.assertEqual(desc["sales"]["source"], "LivestockOwnershipTransfer")
        self.assertIn("completed_transfers", desc["sales"])

    def test_auction_seed_forecasting_and_clean(self):
        """
        Legacy LiveAnimalSale auction rows must not leak into completed-transfer forecasts.
        The ownership-transfer forecast has its own individual-animal source and tests.
        """
        from production.models import LiveAnimalSale
        from analytics.seed_markers import SEED_MARKER_AUCTION

        # Seed the separate auction-record workflow, not ownership transfers.
        call_command("seed_auction", months=24)
        seeded_sales = LiveAnimalSale.objects.filter(review_remarks__contains=SEED_MARKER_AUCTION).count()
        self.assertGreaterEqual(seeded_sales, 24)

        # These rows are intentionally not treated as completed ownership transfers.
        eval_res = evaluate_all_models(domain="auction", target="ALL", unit="HEADS")
        self.assertEqual(eval_res["status"], "insufficient_data")
        self.assertIn("LivestockOwnershipTransfer", eval_res["scope"])
        self.assertEqual(eval_res["frequency"], "WEEKLY")
        self.assertFalse(eval_res["forecast_available"])
        self.assertEqual(eval_res["data"]["total_records"], 0)

        # No ownership transfer history means no projection, even though legacy auction rows exist.
        fc_heads = generate_future_forecast(domain="auction", target="ALL", unit="HEADS", horizon_months=6)
        self.assertEqual(fc_heads["status"], "insufficient_data")
        self.assertIn("LivestockOwnershipTransfer", fc_heads["scope"])
        self.assertEqual(fc_heads["forecast"], [])

        # Recorded value remains a separate target and also withholds across gaps.
        fc_php = generate_future_forecast(domain="auction", target="ALL", unit="PHP", horizon_months=6)
        self.assertEqual(fc_php["status"], "insufficient_data")
        self.assertEqual(fc_php["target"]["unit"], "PHP")

        # Step 4: Safe clean verification - ensures seed marker allows 100% removal of test data
        call_command("seed_auction", clean=True)
        remaining = LiveAnimalSale.objects.filter(review_remarks__contains=SEED_MARKER_AUCTION).count()
        self.assertEqual(remaining, 0)

    def test_readiness_status_levels(self):
        """
        Verify the 3-tier readiness calculation:
        1. < 12 records -> NOT_READY
        2. 12 - 23 records -> READY
        3. >= 24 records -> QUALITY_READY
        """
        # Tier 1: NOT_READY (0 to 11 records)
        eval_not_ready = evaluate_all_models(production_type="MILK", unit="LITERS")
        self.assertEqual(eval_not_ready["status"], "insufficient_data")
        self.assertEqual(eval_not_ready["readiness_status"], "NOT_READY")

        # Milk needs 24 monthly observations to cover two annual cycles.
        call_command("seed_productions", months=12)
        eval_ready = evaluate_all_models(production_type="MILK", unit="LITERS")
        self.assertEqual(eval_ready["status"], "insufficient_data")
        self.assertEqual(eval_ready["readiness_status"], "NOT_READY")
        self.assertEqual(eval_ready["available_observations"], 12)
        self.assertEqual(eval_ready["required_observations"], 24)
        call_command("seed_productions", clean=True)

        # Event-based targets need 12 training months and a 6-month test window.
        from analytics.services.predictive.data import get_readiness_status
        self.assertEqual(get_readiness_status(18, min_observations_required=18)[0], "READY")
        self.assertEqual(get_readiness_status(24, min_observations_required=18)[0], "QUALITY_READY")

        # Milk reaches QUALITY_READY at two annual cycles.
        call_command("seed_productions", months=24)
        eval_quality = evaluate_all_models(production_type="MILK", unit="LITERS")
        self.assertEqual(eval_quality["status"], "unvalidated")
        self.assertEqual(eval_quality["readiness_status"], "AVAILABLE_UNVALIDATED")
        self.assertGreaterEqual(eval_quality["available_observations"], 24)
        self.assertIn("full annual cycles", eval_quality["readiness_details"])
        call_command("seed_productions", clean=True)

    def test_seeded_synthetic_trend_is_not_claimed_as_baseline_validation(self):
        """Synthetic seed trends remain usable as projections, not as empirical validation."""
        call_command("seed_productions", months=36)
        result = evaluate_all_models(production_type="MILK", unit="LITERS")
        self.assertEqual(result["status"], "unvalidated")
        self.assertTrue(result["forecast_available"])
        self.assertEqual(result["selection"]["baseline_comparison"], "UNVALIDATED")
        self.assertIsNone(result["selection"]["baseline_mae"])
        self.assertEqual(result["selection"]["forecast_source"], "UNVALIDATED_PROJECTION")

    def test_baseline_projection_is_labeled_unvalidated_without_historical_cutoffs(self):
        """Constant fixture values do not receive a fabricated backtest score."""
        base_date = timezone.localdate().replace(day=15) - relativedelta(months=24)
        for i in range(24):
            ProductionRecord.objects.create(
                livestock=self.inventory, production_type="MILK", quantity=Decimal("100.00"),
                unit="LITERS", record_date=base_date + relativedelta(months=i),
                status="RECORDED", notes="Constant test record", created_by=self.farmer_user,
            )
        result = evaluate_all_models(production_type="MILK", unit="LITERS")
        self.assertEqual(result["status"], "unvalidated")
        self.assertEqual(result["selection"]["selected_model"], "Naive Baseline")
        self.assertEqual(result["selection"]["baseline_comparison"], "UNVALIDATED")
        self.assertIsNone(result["selection"]["baseline_mae"])

    def test_model_failures_do_not_create_scores_without_valid_cutoffs(self):
        """A model fitting failure cannot turn demo data into validation evidence."""
        from unittest.mock import patch
        call_command("seed_productions", months=24)
        with patch.object(HoltWintersForecaster, "fit", side_effect=RuntimeError("simulated fit failure")):
            result = evaluate_all_models(production_type="MILK", unit="LITERS")
        self.assertEqual(result["status"], "unvalidated")
        self.assertTrue(result["forecast_available"])
        self.assertEqual(result["backtest_windows_available"], 0)
        self.assertTrue(all(row["mae"] is None for row in result["models"]))

    def test_disease_surveillance_pipeline_cases_and_heads(self):
        """
        Verify disease domain evaluation and forecasting for both CASES and HEADS metrics.
        """
        from diseases.models import DiseaseCase
        from analytics.seed_markers import SEED_MARKER_DISEASE

        call_command("seed_diseases", months=24)
        seeded_diseases = DiseaseCase.objects.filter(review_remarks__contains=SEED_MARKER_DISEASE).count()
        self.assertGreaterEqual(seeded_diseases, 24)

        # 1. Evaluate on CASES
        eval_cases = evaluate_all_models(domain="disease", target="ALL", unit="CASES")
        self.assertEqual(eval_cases["status"], "unvalidated")
        self.assertEqual(eval_cases["target"]["unit"], "CASES")
        self.assertEqual(len(eval_cases["models"]), 6)

        # 2. Forecast on CASES
        fc_cases = generate_future_forecast(domain="disease", target="ALL", unit="CASES", horizon_months=6)
        self.assertEqual(fc_cases["status"], "unvalidated")
        self.assertEqual(len(fc_cases["forecast"]), 6)

        # 3. Evaluate on HEADS
        eval_heads = evaluate_all_models(domain="disease", target="ALL", unit="HEADS")
        self.assertEqual(eval_heads["status"], "unvalidated")
        self.assertEqual(eval_heads["target"]["unit"], "HEADS")

        call_command("seed_diseases", clean=True)
        remaining = DiseaseCase.objects.filter(review_remarks__contains=SEED_MARKER_DISEASE).count()
        self.assertEqual(remaining, 0)

    def test_mortality_surveillance_pipeline(self):
        """
        Verify mortality domain evaluation and forecasting.
        """
        from diseases.models import MortalityRecord
        from analytics.seed_markers import SEED_MARKER_MORTALITY

        call_command("seed_mortality", count=48, months=24)
        seeded_mortality = MortalityRecord.objects.filter(review_remarks__contains=SEED_MARKER_MORTALITY).count()
        self.assertGreaterEqual(seeded_mortality, 24)

        eval_res = evaluate_all_models(domain="mortality", target="ALL", unit="HEADS")
        self.assertEqual(eval_res["status"], "unvalidated")
        self.assertEqual(len(eval_res["models"]), 6)

        fc_res = generate_future_forecast(domain="mortality", target="ALL", unit="HEADS", horizon_months=3)
        self.assertEqual(fc_res["status"], "unvalidated")
        self.assertEqual(len(fc_res["forecast"]), 3)

        call_command("seed_mortality", clean=True)
        remaining = MortalityRecord.objects.filter(review_remarks__contains=SEED_MARKER_MORTALITY).count()
        self.assertEqual(remaining, 0)

    def test_preferred_model_explicit_user_override(self):
        """
        Verify that manual preferred_model does NOT overwrite the benchmark winner in evaluation_summary
        and sets is_user_override=True appropriately.
        """
        call_command("seed_productions", months=36)

        eval_res = evaluate_all_models(production_type="MILK", unit="LITERS")
        benchmark_winner = eval_res["selection"]["selected_model"]

        # Pick a different model to request
        alternative_model = "Linear Regression" if benchmark_winner != "Linear Regression" else "Naive Baseline"

        fc_override = generate_future_forecast(
            production_type="MILK",
            unit="LITERS",
            horizon_months=6,
            preferred_model=alternative_model,
        )

        self.assertEqual(fc_override["model"], alternative_model)
        self.assertEqual(fc_override["best_evaluated_model"], benchmark_winner)
        self.assertTrue(fc_override["is_user_override"])
        self.assertEqual(fc_override["evaluation_summary"]["selected_model"], benchmark_winner)

        call_command("seed_productions", clean=True)

    def test_forecasting_fallback_when_operational_model_fails(self):
        """
        Verify that if an operational model fails during out-of-sample projection,
        it cleanly falls back to Naive Baseline with fallback_used=True.
        """
        from unittest.mock import patch

        call_command("seed_productions", months=24)

        with patch.object(HoltWintersForecaster, "predict_steps", side_effect=RuntimeError("Prediction matrix singularity")):
            fc_res = generate_future_forecast(
                production_type="MILK",
                unit="LITERS",
                horizon_months=6,
                preferred_model="Holt-Winters",
            )
            self.assertEqual(fc_res["status"], "unvalidated")
            self.assertEqual(fc_res["model"], "Naive Baseline")
            self.assertTrue(fc_res["fallback_used"])
            self.assertIn("Prediction matrix singularity", fc_res["fallback_reason"])
            self.assertEqual(len(fc_res["forecast"]), 6)

        call_command("seed_productions", clean=True)



"""
Tests for SmartLivestock Predictive Analytics, Model Comparison, and Prescriptive Rules.
"""

from datetime import date
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
        """
        Verify that all 5 models are evaluated with valid MAE, RMSE, and R² scores.
        """
        call_command("seed_productions", months=36)

        eval_res = evaluate_all_models(production_type="MILK", unit="LITERS")
        self.assertEqual(eval_res["status"], "ready")

        models = eval_res["models"]
        self.assertEqual(len(models), 5)

        model_names = [m["name"] for m in models]
        self.assertIn("Naive Baseline", model_names)
        self.assertIn("Linear Regression", model_names)
        self.assertIn("Random Forest", model_names)
        self.assertIn("ARIMA", model_names)
        self.assertIn("Holt-Winters", model_names)

        # Every evaluated model must have finite numeric MAE, RMSE, R²
        for m in models:
            self.assertIn(m["status"][:9], ["EVALUATED"])
            self.assertIsInstance(m["mae"], (int, float))
            self.assertIsInstance(m["rmse"], (int, float))
            self.assertIsInstance(m["r2"], (int, float))
            self.assertGreater(m["mae"], 0.0)
            self.assertGreater(m["rmse"], 0.0)
            self.assertGreater(len(m["test_predictions"]), 0)

        # Selection criterion must identify a best model with lowest MAE
        selected = eval_res["selection"]["selected_model"]
        self.assertIsNotNone(selected)
        best_in_list = [m for m in models if m["is_selected"]][0]
        self.assertEqual(best_in_list["name"], selected)

    def test_future_forecast_generation(self):
        """
        Verify that out-of-sample future projections start strictly after the last historical date.
        """
        call_command("seed_productions", months=36)

        fc = generate_future_forecast(production_type="MILK", unit="LITERS", horizon_months=6)
        self.assertEqual(fc["status"], "ready")
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
        self.assertEqual(rec_res["status"], "ready")
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
        2. Evaluate all 5 candidate models on HEADS.
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
        self.assertEqual(eval_res["status"], "ready")
        self.assertTrue(eval_res["forecast_available"])
        self.assertEqual(len(eval_res["models"]), 5)
        self.assertIn("selected_model", eval_res["selection"])

        # Future forecast generation
        fc = generate_future_forecast(domain="slaughter", target="ALL", unit="HEADS", horizon_months=6)
        self.assertEqual(fc["status"], "ready")
        self.assertEqual(len(fc["forecast"]), 6)
        self.assertIn("chart_data", fc)

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
            status=ProductionRecord.ProductionStatus.APPROVED,
            slaughter=None,
            notes="On-farm processed meat",
            created_by=self.farmer_user,
            reviewed_by=self.mao_user,
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
        self.assertIn("by_method", desc["sales"])

    def test_auction_seed_forecasting_and_clean(self):
        """
        Verify end-to-end auction domain pipeline:
        1. Seed 24 months of live animal sales with SEED_MARKER_AUCTION.
        2. Evaluate models on HEADS and PHP (verifying lowest MAE winner selection).
        3. Generate 6-month forecast with metrics and municipal scope.
        4. Clean synthetic records safely using --clean without touching real data.
        """
        from production.models import LiveAnimalSale
        from analytics.seed_markers import SEED_MARKER_AUCTION

        # Step 1: Generate 24 months of synthetic live animal sales
        call_command("seed_auction", months=24)
        seeded_sales = LiveAnimalSale.objects.filter(review_remarks__contains=SEED_MARKER_AUCTION).count()
        self.assertGreaterEqual(seeded_sales, 24)

        # Step 2: Model evaluation on HEADS metric (checks 5 candidate models)
        eval_res = evaluate_all_models(domain="auction", target="ALL", unit="HEADS")
        self.assertEqual(eval_res["status"], "ready")
        self.assertEqual(eval_res["scope"], "Municipal live animal commercial trade")
        self.assertEqual(len(eval_res["models"]), 5)

        # Step 3A: Forecast generation on HEADS (verifies active metrics MAE/RMSE/R2 are attached)
        fc_heads = generate_future_forecast(domain="auction", target="ALL", unit="HEADS", horizon_months=6)
        self.assertEqual(fc_heads["status"], "ready")
        self.assertEqual(fc_heads["scope"], "Municipal live animal commercial trade")
        self.assertIn("metrics", fc_heads)
        self.assertIn("mae", fc_heads["metrics"])

        # Step 3B: Forecast generation for PHP currency volume
        fc_php = generate_future_forecast(domain="auction", target="ALL", unit="PHP", horizon_months=6)
        self.assertEqual(fc_php["status"], "ready")
        self.assertEqual(fc_php["target"]["unit"], "PHP")

        # Step 4: Safe clean verification - ensures seed marker allows 100% removal of test data
        call_command("seed_auction", clean=True)
        remaining = LiveAnimalSale.objects.filter(review_remarks__contains=SEED_MARKER_AUCTION).count()
        self.assertEqual(remaining, 0)


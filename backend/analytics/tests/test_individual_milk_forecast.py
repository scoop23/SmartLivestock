"""Focused tests for the synthetic individual-cow forecasting prototype."""

from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import patch

from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import ProgrammingError
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIRequestFactory, force_authenticate

from analytics.models import IndividualMilkDemoCow, IndividualMilkDemoObservation
from analytics.seed_markers import SEED_MARKER_INDIVIDUAL_MILK_DEMO
from analytics.services.predictive.individual_milk import (
    _build_feature_frame,
    get_individual_milk_forecast,
)
from analytics.views import individual_milk_forecast
from livestock.models import Barangay, Farmer, LivestockInventory, LivestockType
from production.models import ProductionRecord
from users.models import Role, User


class IndividualMilkForecastTests(TestCase):
    """Verify the seed boundary, temporal features, readiness, forecast and API access."""

    def setUp(self):
        """Create one real farmer record so demo cleanup can prove it is isolated."""
        self.mao_role = Role.objects.create(role_name="MAO")
        self.farmer_role = Role.objects.create(role_name="FARMER")
        self.mao_user = User.objects.create_user(
            username="demo_forecast_mao", email="demo-mao@example.test", password="test-password", role=self.mao_role
        )
        self.farmer_user = User.objects.create_user(
            username="demo_forecast_farmer", email="demo-farmer@example.test", password="test-password", role=self.farmer_role
        )
        barangay = Barangay.objects.create(
            barangay_name="Forecast Test",
            latitude=Decimal("13.880000"),
            longitude=Decimal("121.210000"),
        )
        farmer = Farmer.objects.create(user=self.farmer_user, barangay=barangay, address="Test farm")
        cattle = LivestockType.objects.create(name="Cattle")
        cow = LivestockInventory.objects.create(
            farmer=farmer,
            livestock_type=cattle,
            tag_number="REAL-COW-001",
            status="APPROVED",
            created_by=self.farmer_user,
        )
        self.real_production = ProductionRecord.objects.create(
            livestock=cow,
            production_type="MILK",
            quantity=Decimal("5.50"),
            unit="LITERS",
            record_date=date(2026, 1, 1),
            status="APPROVED",
            notes="real farmer record",
            created_by=self.farmer_user,
        )
        swine = LivestockType.objects.create(name="Swine")
        self.non_milk_animal = LivestockInventory.objects.create(
            farmer=farmer,
            livestock_type=swine,
            tag_number="REAL-SWINE-001",
            status="APPROVED",
            created_by=self.farmer_user,
        )

    def test_seed_and_clean_touch_only_marked_demo_tables(self):
        """The command creates its 24 x 120 sample rows and clean leaves real yield intact."""
        call_command("seed_individual_milk_forecasting")
        self.assertEqual(IndividualMilkDemoCow.objects.count(), 24)
        self.assertEqual(IndividualMilkDemoObservation.objects.count(), 24 * 120)
        self.assertTrue(
            IndividualMilkDemoObservation.objects.filter(
                seed_marker=SEED_MARKER_INDIVIDUAL_MILK_DEMO
            ).exists()
        )
        self.assertEqual(ProductionRecord.objects.count(), 1)

        call_command("seed_individual_milk_forecasting", clean=True)
        self.assertEqual(IndividualMilkDemoCow.objects.count(), 0)
        self.assertEqual(IndividualMilkDemoObservation.objects.count(), 0)
        self.assertTrue(ProductionRecord.objects.filter(pk=self.real_production.pk).exists())

    def test_seed_reports_missing_migration_before_querying_demo_tables(self):
        """A database without the feature migration gets a clear instruction, not UndefinedTable."""
        with patch(
            "analytics.management.commands.seed_individual_milk_forecasting.connection.introspection.table_names",
            return_value=[],
        ):
            with self.assertRaisesMessage(CommandError, "python manage.py migrate analytics"):
                call_command("seed_individual_milk_forecasting")

            # Cleaning an uncreated table set is a safe no-op and does not issue DELETE SQL.
            call_command("seed_individual_milk_forecasting", clean=True)

    def test_forecast_is_seven_future_dates_and_compares_three_models(self):
        """A seeded cow returns seven ordered dates and the required baseline/ML metrics."""
        call_command("seed_individual_milk_forecasting", cows=4, days=60)
        result = get_individual_milk_forecast("demo-cow-001")
        self.assertEqual(result["status"], "READY")
        self.assertEqual(result["data_source"], "synthetic_demo")
        self.assertEqual(len(result["forecast"]), 7)
        forecast_dates = [date.fromisoformat(item["date"]) for item in result["forecast"]]
        latest_observation = IndividualMilkDemoObservation.objects.filter(
            cow_id="demo-cow-001"
        ).order_by("-record_date").first()
        self.assertEqual(forecast_dates[0], latest_observation.record_date + timedelta(days=1))
        self.assertEqual(forecast_dates, [forecast_dates[0] + timedelta(days=i) for i in range(7)])
        self.assertEqual(
            {item["name"] for item in result["evaluation"]["results"]},
            {"Naive Baseline", "Linear Regression", "Random Forest"},
        )
        self.assertLess(result["evaluation"]["train_end_date"], result["evaluation"]["test_start_date"])
        self.assertGreater(result["evaluation"]["test_samples"], 0)

    def test_insufficient_history_does_not_fabricate_forecast(self):
        """A demo cow below the minimum history threshold receives NOT_READY and no values."""
        cow = IndividualMilkDemoCow.objects.create(
            demo_id="demo-short-history",
            tag_number="DEMO-SHORT-001",
            breed="Jersey Cross",
            birth_date=date(2020, 1, 1),
            weight_kg=Decimal("400.00"),
            calving_date=date(2025, 1, 1),
            seed_marker=SEED_MARKER_INDIVIDUAL_MILK_DEMO,
        )
        for offset in range(3):
            IndividualMilkDemoObservation.objects.create(
                cow=cow,
                record_date=date(2026, 1, 1) + timedelta(days=offset),
                milk_quantity_liters=Decimal("8.00"),
                seed_marker=SEED_MARKER_INDIVIDUAL_MILK_DEMO,
            )
        result = get_individual_milk_forecast(cow.demo_id)
        self.assertEqual(result["status"], "NOT_READY")
        self.assertEqual(result["forecast"], [])
        self.assertIn("Insufficient historical", result["reason"])

    def test_feature_rows_use_only_prior_milk_and_health(self):
        """A target-day health flag and yield do not enter that same day's feature vector."""
        cow = IndividualMilkDemoCow.objects.create(
            demo_id="demo-cutoff-test",
            tag_number="DEMO-CUTOFF-001",
            breed="Jersey Cross",
            birth_date=date(2020, 1, 1),
            weight_kg=Decimal("400.00"),
            calving_date=date(2025, 1, 1),
            seed_marker=SEED_MARKER_INDIVIDUAL_MILK_DEMO,
        )
        start = date(2026, 1, 1)
        rows = [
            IndividualMilkDemoObservation(
                cow=cow,
                record_date=start + timedelta(days=offset),
                milk_quantity_liters=Decimal("8.00"),
                disease_active=offset == 7,
                seed_marker=SEED_MARKER_INDIVIDUAL_MILK_DEMO,
            )
            for offset in range(10)
        ]
        IndividualMilkDemoObservation.objects.bulk_create(rows)
        before = _build_feature_frame([cow]).set_index("date")
        target_day = start + timedelta(days=8)
        original_features = before.loc[target_day, ["lag_1", "health_events_previous_7d"]].tolist()

        target = IndividualMilkDemoObservation.objects.get(cow=cow, record_date=target_day)
        target.milk_quantity_liters = Decimal("99.00")
        target.disease_active = True
        target.save()
        after = _build_feature_frame([cow]).set_index("date")
        self.assertEqual(after.loc[target_day, ["lag_1", "health_events_previous_7d"]].tolist(), original_features)

    def test_synthetic_forecast_can_use_previous_day_open_meteo_features(self):
        """A selected demo forecast receives weather by date without using target-day weather."""
        call_command("seed_individual_milk_forecasting", cows=2, days=60)
        cows = list(IndividualMilkDemoCow.objects.all())
        today = timezone.localdate()
        first_weather_day = today - timedelta(days=60)
        weather_rows = {
            (first_weather_day + timedelta(days=offset)).isoformat(): {
                "temperature_c": 28.0,
                "humidity_pct": 72.0,
                "precipitation_mm": 1.5,
            }
            for offset in range(67)
        }

        frame = _build_feature_frame(cows, weather_rows)
        target_day = today - timedelta(days=59) + timedelta(days=7)
        target_row = frame[(frame["cow_id"] == "demo-cow-001") & (frame["date"] == target_day)].iloc[0]
        self.assertEqual(target_row["prior_day_temperature_c"], 28.0)
        self.assertEqual(target_row["prior_day_precipitation_mm"], 1.5)

        result = get_individual_milk_forecast("demo-cow-001", weather_rows=weather_rows)
        self.assertTrue(result["weather"]["available"])
        self.assertEqual(result["data_source"], "synthetic_demo")

    def test_api_is_scoped_to_mao_or_sibat_and_unknown_real_ids_are_not_returned(self):
        """The demo API follows analytics reviewer access and cannot resolve real inventory IDs."""
        call_command("seed_individual_milk_forecasting", cows=2, days=30)
        factory = APIRequestFactory()

        # Authorized analytics users can list synthetic entries and request one forecast.
        request = factory.get("/api/analytics/predictive/individual-milk/")
        force_authenticate(request, user=self.mao_user)
        listed = individual_milk_forecast(request)
        self.assertEqual(listed.status_code, 200)
        self.assertEqual(len(listed.data["cows"]), 2)

        # A real registry may lack optional age/weight/calving details; the demo pipeline imputes them.
        IndividualMilkDemoCow.objects.filter(demo_id="demo-cow-001").update(
            breed="", birth_date=None, weight_kg=None, calving_date=None
        )

        request = factory.get(
            "/api/analytics/predictive/individual-milk/",
            {"cow_id": "demo-cow-001"},
        )
        force_authenticate(request, user=self.mao_user)
        selected = individual_milk_forecast(request)
        self.assertEqual(selected.status_code, 200)
        self.assertEqual(selected.data["status"], "READY")
        self.assertIsNone(selected.data["livestock"]["weight_kg"])
        self.assertEqual(selected.data["data_source"], "synthetic_demo")
        self.assertEqual(len(selected.data["forecast"]), 7)

        # Farmers cannot use the municipal analytics endpoint, even with a valid demo ID.
        request = factory.get("/api/analytics/predictive/individual-milk/", {"cow_id": str(self.real_production.livestock_id)})
        force_authenticate(request, user=self.farmer_user)
        denied = individual_milk_forecast(request)
        self.assertEqual(denied.status_code, 403)

        # The non-milk-producing swine and all other real inventory IDs cannot enter this synthetic-only endpoint.
        request = factory.get("/api/analytics/predictive/individual-milk/", {"cow_id": "REAL-SWINE-001"})
        force_authenticate(request, user=self.mao_user)
        missing = individual_milk_forecast(request)
        self.assertEqual(missing.status_code, 404)

    def test_api_returns_actionable_service_error_when_demo_schema_is_missing(self):
        """A missing table becomes a safe 503 response that tells the operator to migrate."""
        request = APIRequestFactory().get("/api/analytics/predictive/individual-milk/")
        force_authenticate(request, user=self.mao_user)
        with patch(
            "analytics.services.predictive.individual_milk.list_demo_cows",
            side_effect=ProgrammingError("missing table"),
        ), self.assertLogs("analytics.views", level="ERROR"):
            response = individual_milk_forecast(request)
        self.assertEqual(response.status_code, 503)
        self.assertIn("migrate analytics", response.data["detail"])

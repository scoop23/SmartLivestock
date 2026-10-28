"""Tests for real, current-owner-scoped livestock milk forecasts."""

from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import patch

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIRequestFactory, force_authenticate

from analytics.services.predictive.livestock_milk import _feature_rows
from analytics.views import livestock_milk_forecast
from livestock.models import Barangay, Farmer, LivestockInventory, LivestockType
from production.models import ProductionRecord, WeightRecord
from users.models import Role, User


class LivestockMilkForecastApiTests(TestCase):
    """Keep real forecasts bound to one eligible animal and its current farmer."""

    def setUp(self):
        self.role = Role.objects.create(role_name="FARMER")
        self.user_a = User.objects.create_user(
            username="milk_owner_a", email="milk-a@example.test", password="test-password", role=self.role
        )
        self.user_b = User.objects.create_user(
            username="milk_owner_b", email="milk-b@example.test", password="test-password", role=self.role
        )
        barangay = Barangay.objects.create(
            barangay_name="Milk Forecast Test", latitude=Decimal("13.880000"), longitude=Decimal("121.210000")
        )
        self.farmer_a = Farmer.objects.create(user=self.user_a, barangay=barangay, address="Farm A")
        self.farmer_b = Farmer.objects.create(user=self.user_b, barangay=barangay, address="Farm B")
        cattle = LivestockType.objects.create(name="Cattle")
        self.cow = LivestockInventory.objects.create(
            farmer=self.farmer_a,
            livestock_type=cattle,
            entry_type=LivestockInventory.EntryType.INDIVIDUAL,
            quantity=1,
            tag_number="MILK-COW-001",
            sex="Female",
            breed="Brahman Cross",
            birth_date=date(2020, 1, 1),
            status=LivestockInventory.StatusType.APPROVED,
            operational_status=LivestockInventory.OperationalStatus.ACTIVE,
            created_by=self.user_a,
        )
        self.factory = APIRequestFactory()

    def _request(self, user, cow_id=None):
        request = self.factory.get(f"/analytics/livestock/{self.cow.pk}/milk-forecast/")
        force_authenticate(request, user=user)
        # Keep endpoint tests deterministic and offline; Open-Meteo has its own fallback path.
        with patch(
            "analytics.services.predictive.weather.get_weather_context",
            return_value=({}, False, "Weather unavailable in this test."),
        ):
            return livestock_milk_forecast(request, self.cow.pk)

    def _add_daily_milk_history(self, count=65, farmer=None):
        farmer = farmer or self.farmer_a
        # Keep the latest observation fresh enough to represent a coming-week forecast.
        start = timezone.localdate() - timedelta(days=count - 1)
        ProductionRecord.objects.bulk_create([
            ProductionRecord(
                livestock=self.cow,
                farmer_at_record=farmer,
                production_type=ProductionRecord.ProductionType.MILK,
                quantity=Decimal("8.00") + Decimal(index % 5) / Decimal("10"),
                unit=ProductionRecord.UnitType.LITERS,
                record_date=start + timedelta(days=index),
                status=ProductionRecord.ProductionStatus.RECORDED,
                created_by=farmer.user,
            )
            for index in range(count)
        ])

    def test_insufficient_real_history_never_substitutes_demo_records(self):
        response = self._request(self.user_a)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "NOT_READY")
        self.assertEqual(response.data["data_source"], "farmer_recorded_livestock_logs")
        self.assertEqual(response.data["forecast"], [])
        self.assertEqual(response.data["observation_count"], 0)

    def test_sufficient_history_returns_seven_dates_for_this_cow(self):
        self._add_daily_milk_history()
        response = self._request(self.user_a)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "READY")
        self.assertEqual(response.data["data_source"], "farmer_recorded_livestock_logs")
        self.assertEqual(len(response.data["forecast"]), 7)
        forecast_dates = [date.fromisoformat(row["date"]) for row in response.data["forecast"]]
        self.assertEqual(forecast_dates[0], timezone.localdate() + timedelta(days=1))
        self.assertEqual(forecast_dates, [forecast_dates[0] + timedelta(days=offset) for offset in range(7)])

    def test_farmer_recorded_milk_logs_feed_the_owner_scoped_forecast(self):
        self._add_daily_milk_history()
        response = self._request(self.user_a, self.cow.pk)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["data_source"], "farmer_recorded_livestock_logs")
        self.assertEqual(response.data["observation_count"], 65)
        self.assertGreaterEqual(response.data["evaluation"]["train_samples"], 20)
        self.assertGreaterEqual(response.data["evaluation"]["test_samples"], 10)

    def test_forecast_receives_this_cows_dated_weight_history(self):
        self._add_daily_milk_history()
        weighing_date = timezone.localdate() - timedelta(days=2)
        WeightRecord.objects.create(
            livestock=self.cow,
            weight=Decimal("312.50"),
            weighing_date=weighing_date,
            created_by=self.user_a,
        )

        with patch(
            "analytics.services.predictive.livestock_milk.forecast_livestock_milk",
            return_value={"status": "READY"},
        ) as forecast:
            response = self._request(self.user_a)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(forecast.call_args.kwargs["weight_records"], [{
            "weight_kg": 312.5,
            "weighing_date": weighing_date,
            "recorded_date": timezone.localdate(),
        }])

    def test_training_weight_feature_ignores_same_day_future_and_late_entered_weigh_ins(self):
        start = timezone.localdate() - timedelta(days=10)
        daily_records = [
            {"date": start + timedelta(days=index), "milk_liters": 8.0 + index / 10}
            for index in range(8)
        ]
        target_date = daily_records[-1]["date"]
        weight_records = [
            {"weight_kg": 270, "weighing_date": start + timedelta(days=3), "recorded_date": start + timedelta(days=3)},
            {"weight_kg": 285, "weighing_date": start + timedelta(days=5), "recorded_date": start + timedelta(days=5)},
            # The milk target is a full day's total, so same-day weigh-ins are excluded too.
            {"weight_kg": 290, "weighing_date": start + timedelta(days=7), "recorded_date": start + timedelta(days=7)},
            # Backdated measurements entered after the target were not known then.
            {"weight_kg": 300, "weighing_date": start + timedelta(days=6), "recorded_date": start + timedelta(days=9)},
            {"weight_kg": 400, "weighing_date": start + timedelta(days=9), "recorded_date": start + timedelta(days=9)},
        ]

        frame = _feature_rows(self.cow, daily_records, [], {}, weight_records)

        self.assertEqual(target_date, start + timedelta(days=7))
        self.assertEqual(frame.iloc[0]["weight_kg"], 285)
        self.assertEqual(frame.iloc[0]["days_since_weighing"], 2)

    def test_farmer_cannot_access_another_farmers_cow_or_former_owners_history(self):
        self._add_daily_milk_history()
        self.assertEqual(self._request(self.user_b).status_code, 404)

        # The canonical animal changes farmer on transfer; authorization follows its current owner.
        self.cow.farmer = self.farmer_b
        self.cow.save(update_fields=["farmer"])
        self.assertEqual(self._request(self.user_a).status_code, 404)
        new_owner_response = self._request(self.user_b)
        self.assertEqual(new_owner_response.status_code, 200)
        self.assertEqual(new_owner_response.data["observation_count"], 0)

    def test_non_cattle_and_male_animals_are_rejected(self):
        self.cow.sex = "Male"
        self.cow.save(update_fields=["sex"])
        response = self._request(self.user_a)
        self.assertEqual(response.status_code, 400)

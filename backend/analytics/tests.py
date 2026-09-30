from datetime import date
from decimal import Decimal

from django.test import TestCase
from rest_framework.renderers import JSONRenderer
from rest_framework.test import APIRequestFactory, force_authenticate

from analytics.views import dashboard_summary

from analytics.services.descriptive import descriptive_summary
from diseases.models import DiseaseCase, MortalityRecord
from livestock.models import Barangay, Farmer, LivestockBatch, LivestockInventory, LivestockType
from production.models import LiveAnimalSale, ProductionRecord
from users.models import Role, User


class DescriptiveSummaryTests(TestCase):
    def setUp(self):
        self.today = date(2026, 10, 1)
        role = Role.objects.create(role_name="FARMER")
        user = User.objects.create_user(username="farmer", email="farmer@example.test", password="test-pass", role=role)
        self.user = user
        self.barangay = Barangay.objects.create(barangay_name="San Roque", latitude=Decimal("13.880000"), longitude=Decimal("121.210000"))
        self.farmer = Farmer.objects.create(user=user, barangay=self.barangay, address="Test address")
        self.cattle = LivestockType.objects.create(name="Cattle")
        self.goat = LivestockType.objects.create(name="Goat")

    def animal(self, *, species=None, status="APPROVED", quantity=1, batch=None, operational="ACTIVE", vaccination=None):
        return LivestockInventory.objects.create(
            farmer=self.farmer, livestock_type=species or self.cattle,
            batch=batch, status=status, quantity=quantity,
            operational_status=operational, last_vaccination_date=vaccination,
            created_by=self.user,
        )

    def test_empty_data_has_zero_totals_and_no_division_error(self):
        result = descriptive_summary(self.today)["descriptive"]
        self.assertEqual(result["population"]["total_heads"], 0)
        self.assertEqual(result["vaccination"]["coverage_pct"], 0)
        self.assertEqual(result["production"]["by_type"], [])
        self.assertIsNone(result["sales"]["recorded_value"])

    def test_population_uses_approved_active_quantity_and_batch_children(self):
        self.animal(quantity=3, vaccination=date(2026, 9, 1))
        herd = LivestockBatch.objects.create(
            farmer=self.farmer, livestock_type=self.goat,
            batch_name="Test herd", batch_code="TEST-HERD", created_by=self.user,
        )
        self.animal(species=self.goat, batch=herd)
        self.animal(species=self.goat, batch=herd)
        self.animal(status="VERIFIED", quantity=9)
        self.animal(quantity=4, operational="SOLD")
        result = descriptive_summary(self.today)["descriptive"]
        self.assertEqual(result["population"]["total_heads"], 5)
        self.assertEqual(result["population"]["by_barangay"][0]["barangay_id"], self.barangay.id)
        self.assertEqual({row["species"]: row["heads"] for row in result["population"]["by_species"]}, {"Cattle": 3, "Goat": 2})
        self.assertEqual(result["vaccination"]["vaccinated"], 3)
        self.assertEqual(result["vaccination"]["coverage_pct"], 60.0)

    def test_event_dates_statuses_barangay_and_decimal_output(self):
        animal = self.animal()
        def production(status, when, quantity):
            return ProductionRecord.objects.create(
                livestock=animal, production_type="MILK", unit="LITERS",
                quantity=Decimal(quantity), record_date=when, status=status,
                created_by=self.user,
            )
        production("APPROVED", date(2026, 9, 15), "1.25")
        production("VERIFIED", date(2026, 9, 15), "90.00")
        production("APPROVED", date(2025, 1, 1), "40.00")
        DiseaseCase.objects.create(livestock=animal, name="FMD", affected_count=4, record_date=date(2026, 9, 16), status="APPROVED", created_by=self.user)
        DiseaseCase.objects.create(livestock=animal, name="FMD", affected_count=9, record_date=date(2026, 9, 16), status="VERIFIED", created_by=self.user)
        DiseaseCase.objects.create(livestock=animal, name="FMD", affected_count=7, record_date=None, status="APPROVED", created_by=self.user)
        MortalityRecord.objects.create(livestock=animal, death_count=2, cause="Old age", record_date=date(2026, 9, 17), status="APPROVED", created_by=self.user)
        LiveAnimalSale.objects.create(livestock=animal, quantity=2, sale_date=date(2026, 9, 18), status="APPROVED", total_price=Decimal("123.45"), created_by=self.user)

        result = descriptive_summary(self.today)
        data = result["descriptive"]
        self.assertEqual(data["production"]["records"], 1)
        self.assertEqual(data["production"]["by_type"][0]["quantity"], 1.25)
        self.assertEqual(data["production"]["by_barangay"][0]["barangay_id"], self.barangay.id)
        self.assertEqual(data["production"]["trend"][0]["month"], "2026-09-01")
        self.assertEqual(data["disease"]["cases"], 1)
        self.assertEqual(data["disease"]["affected_heads"], 4)
        self.assertEqual(data["disease"]["by_barangay"][0]["barangay_id"], self.barangay.id)
        self.assertEqual(data["mortality"]["deaths"], 2)
        self.assertEqual(data["sales"]["recorded_value"], 123.45)
        self.assertEqual(len(result["surveillance_series"]), 12)

    def test_dashboard_api_exposes_aggregates_only_to_reviewers(self):
        factory = APIRequestFactory()
        farmer_request = factory.get("/api/analytics/dashboard/")
        force_authenticate(farmer_request, user=self.user)
        self.assertEqual(dashboard_summary(farmer_request).status_code, 403)

        mao_role = Role.objects.create(role_name="MAO")
        mao = User.objects.create_user(username="mao", email="mao@example.test", password="test-pass", role=mao_role)
        mao_request = factory.get("/api/analytics/dashboard/")
        force_authenticate(mao_request, user=mao)
        response = dashboard_summary(mao_request)
        self.assertEqual(response.status_code, 200)
        self.assertIn("descriptive", response.data)
        self.assertEqual(response.data["descriptive"]["population"]["total_heads"], 0)
        self.assertIsInstance(JSONRenderer().render(response.data), bytes)

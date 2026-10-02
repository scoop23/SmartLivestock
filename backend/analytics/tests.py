from datetime import date
from decimal import Decimal

from django.test import TestCase
from rest_framework.renderers import JSONRenderer
from rest_framework.test import APIRequestFactory, force_authenticate

from analytics.views import dashboard_summary, data_overview_summary

from analytics.services.descriptive import descriptive_summary
from analytics.services.population import population_summary
from analytics.services.overview import overview_summary
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
            entry_type="INDIVIDUAL" if quantity == 1 else "BATCH",
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
        september = next(point for point in result["surveillance_series"] if point["month"] == "2026-09-01")
        self.assertEqual(september["reported_heads"], 4)
        self.assertEqual(september["deaths"], 2)
        self.assertEqual(sum(point["reported_heads"] for point in result["surveillance_series"]), data["disease"]["affected_heads"])
        self.assertEqual(sum(point["deaths"] for point in result["surveillance_series"]), data["mortality"]["deaths"])

    def test_batch_event_location_units_and_future_vaccination(self):
        batch = LivestockBatch.objects.create(
            farmer=self.farmer, livestock_type=self.goat,
            batch_name="Batch events", batch_code="BATCH-EVENTS", created_by=self.user,
        )
        self.animal(batch=batch, species=self.goat, vaccination=date(2026, 10, 2))
        for kind, unit, quantity in [("MILK", "LITERS", "2.50"), ("MEAT", "KILOGRAMS", "3.25")]:
            ProductionRecord.objects.create(
                batch=batch, production_type=kind, unit=unit, quantity=Decimal(quantity),
                record_date=self.today, status="APPROVED", created_by=self.user,
            )
        DiseaseCase.objects.create(batch=batch, name="FMD", affected_count=1, record_date=self.today, status="APPROVED", created_by=self.user)
        data = descriptive_summary(self.today)["descriptive"]
        self.assertEqual(data["production"]["records"], 2)
        self.assertEqual({row["unit"]: row["quantity"] for row in data["production"]["by_type"]}, {"LITERS": 2.5, "KILOGRAMS": 3.25})
        self.assertTrue(all(row["barangay_id"] == self.barangay.id for row in data["production"]["by_barangay"]))
        self.assertEqual(data["disease"]["by_barangay"][0]["barangay_id"], self.barangay.id)
        self.assertEqual(data["vaccination"]["vaccinated"], 0)
        self.assertEqual(data["vaccination"]["by_barangay"][0]["barangay_id"], self.barangay.id)

    def test_multiple_barangays_reconcile_population_and_vaccination(self):
        # Equal display names must not merge different barangay FK identities.
        other = Barangay.objects.create(barangay_name="San Roque", latitude=Decimal("13.89"), longitude=Decimal("121.22"))
        user = User.objects.create_user(username="farmer2", email="farmer2@example.test", role=self.user.role)
        farmer = Farmer.objects.create(user=user, barangay=other, address="Other farm")
        self.animal(quantity=3, vaccination=self.today)
        LivestockInventory.objects.create(farmer=farmer, livestock_type=self.goat, entry_type="BATCH", quantity=2, status="APPROVED", created_by=user)
        for status in ("PENDING", "VERIFIED", "SUBJECT_TO_REVISION"):
            self.animal(status=status, quantity=20)
        for operational in ("SOLD", "DECEASED", "SLAUGHTERED", "MOVED_OUT"):
            self.animal(operational=operational, quantity=20)
        data = descriptive_summary(self.today)["descriptive"]
        population = data["population"]
        self.assertEqual(population["total_heads"], 5)
        self.assertEqual(sum(row["heads"] for row in population["by_species"]), 5)
        self.assertEqual(sum(row["heads"] for row in population["by_barangay"]), 5)
        self.assertEqual(len(population["by_barangay"]), 2)
        self.assertEqual({row["barangay_id"]: row["heads"] for row in population["by_barangay"]}, {self.barangay.id: 3, other.id: 2})
        self.assertEqual(data["vaccination"]["coverage_pct"], 60)
        self.assertEqual(sum(row["vaccinated"] for row in data["vaccination"]["by_barangay"]), 3)

    def test_production_window_boundaries_and_missing_months(self):
        animal = self.animal()
        for when, quantity in [(date(2025, 10, 31), "99"), (date(2025, 11, 1), "2"),
                               (date(2026, 1, 15), "3"), (self.today, "4"), (date(2026, 10, 2), "99")]:
            ProductionRecord.objects.create(livestock=animal, production_type="MILK", unit="LITERS",
                                           quantity=Decimal(quantity), record_date=when, status="APPROVED", created_by=self.user)
        result = descriptive_summary(self.today)
        data = result["descriptive"]
        self.assertEqual(data["period"], {"start": "2025-11-01", "end": "2026-10-01"})
        self.assertEqual(data["production"]["records"], 3)
        self.assertEqual(data["production"]["by_type"][0]["quantity"], 9)
        series = result["production_series"]
        self.assertEqual(len(series), 12)
        self.assertEqual(series[0]["month"], "2025-11-01")
        self.assertEqual(series[-1]["month"], "2026-10-01")
        self.assertEqual(series[1]["milk_l"], 0)
        self.assertEqual(sum(row["milk_l"] for row in series), 9)
        self.assertEqual(result["monthly_dairy_yield_l"], 4)
        self.assertEqual(result["year_to_date_l"], 7)
        self.assertEqual(result["records_this_month"], 1)

    def test_health_breakdowns_unmapped_events_and_status_exclusion(self):
        animal = self.animal()
        for name, count, target in [("FMD", 2, animal), ("FMD", 3, animal), ("Other", 4, None)]:
            DiseaseCase.objects.create(livestock=target, name=name, affected_count=count,
                                       record_date=self.today, status="APPROVED", created_by=self.user)
        for cause, deaths in [("Recorded cause A", 2), ("Recorded cause A", 3), ("Recorded cause B", 1)]:
            MortalityRecord.objects.create(livestock=animal, cause=cause, death_count=deaths,
                                           record_date=self.today, status="APPROVED", created_by=self.user)
        for status in ("PENDING", "VERIFIED", "SUBJECT_TO_REVISION"):
            DiseaseCase.objects.create(livestock=animal, name="Excluded", affected_count=50, record_date=self.today, status=status, created_by=self.user)
            MortalityRecord.objects.create(livestock=animal, cause="Excluded", death_count=50, record_date=self.today, status=status, created_by=self.user)
        MortalityRecord.objects.create(livestock=animal, cause="Undated", death_count=50, record_date=None, status="APPROVED", created_by=self.user)
        data = descriptive_summary(self.today)["descriptive"]
        self.assertEqual(data["disease"]["cases"], 3)
        self.assertEqual(data["disease"]["affected_heads"], 9)
        self.assertEqual({row["name"]: (row["cases"], row["affected_heads"]) for row in data["disease"]["by_type"]}, {"FMD": (2, 5), "Other": (1, 4)})
        self.assertEqual({row["barangay_id"]: row["affected_heads"] for row in data["disease"]["by_barangay"]}, {self.barangay.id: 5, None: 4})
        self.assertEqual(data["mortality"]["records"], 3)
        self.assertEqual(data["mortality"]["deaths"], 6)
        self.assertEqual(sum(row["deaths"] for row in data["mortality"]["by_cause"]), 6)
        self.assertEqual({row["cause"]: row["deaths"] for row in data["mortality"]["by_cause"]}, {"Recorded cause A": 5, "Recorded cause B": 1})

    def test_sales_missing_prices_are_distinct_from_recorded_zero(self):
        animal = self.animal()
        def sale(quantity, price=None, status="APPROVED"):
            return LiveAnimalSale.objects.create(livestock=animal, quantity=quantity, total_price=price,
                                                 status=status, sale_date=self.today, created_by=self.user)
        sale(2)
        data = descriptive_summary(self.today)["descriptive"]["sales"]
        self.assertEqual(data, {"sales": 1, "animals": 2, "recorded_value": None, "priced_sales": 0})
        sale(3, Decimal("123.45"))
        sale(1, Decimal("0"))
        for status in ("PENDING", "VERIFIED", "SUBJECT_TO_REVISION"):
            sale(50, Decimal("999"), status)
        data = descriptive_summary(self.today)["descriptive"]["sales"]
        self.assertEqual(data, {"sales": 3, "animals": 6, "recorded_value": 123.45, "priced_sales": 2})

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

    def test_sibat_access_and_anonymous_rejection(self):
        factory = APIRequestFactory()
        self.assertIn(dashboard_summary(factory.get("/analytics/dashboard/")).status_code, (401, 403))
        role = Role.objects.create(role_name="SIBAT")
        user = User.objects.create_user(username="sibat", email="sibat@example.test", role=role)
        request = factory.get("/analytics/dashboard/")
        force_authenticate(request, user=user)
        response = dashboard_summary(request)
        self.assertEqual(response.status_code, 200)
        self.assertIsInstance(JSONRenderer().render(response.data), bytes)


class AdminConsistencyTests(TestCase):
    setUp = DescriptiveSummaryTests.setUp
    animal = DescriptiveSummaryTests.animal
    def test_mixed_population_matches_both_consumers_and_ignores_census(self):
        from livestock.models import CensusSubmission, CensusSubmissionItem
        self.user.account_status = "APPROVED"
        self.user.save(update_fields=["account_status"])
        self.animal(quantity=3)
        poultry = LivestockType.objects.create(name="Poultry")
        self.animal(species=poultry, quantity=7)
        self.animal(status="PENDING", quantity=11)
        self.animal(status="VERIFIED", quantity=13)
        self.animal(status="SUBJECT_TO_REVISION", quantity=17)
        for operational in ["SOLD", "DECEASED", "SLAUGHTERED", "MOVED_OUT"]:
            self.animal(quantity=2, operational=operational)
        herd = LivestockBatch.objects.create(farmer=self.farmer, livestock_type=self.goat,
            batch_name="Herd", batch_code="CONSISTENT-HERD", created_by=self.user)
        self.animal(batch=herd, species=self.goat)
        self.animal(batch=herd, species=self.goat)
        CensusSubmissionItem.objects.create(census_submission=CensusSubmission.objects.create(
            barangay=self.barangay, report_year=2026, report_quarter=3,
            status="APPROVED", submitted_by=self.user), farmer=self.farmer,
            livestock_type=self.cattle, number_of_heads=999)
        expected = population_summary(today=self.today)
        self.assertEqual(expected["total_heads"], 12)
        self.assertEqual(expected["historical_approved_heads"], 20)
        self.assertEqual(expected["active_submitted_heads"], 53)
        self.assertEqual(expected["registered_farmers"], 1)
        self.assertEqual(expected["by_barangay"][0]["active_herds"], 1)
        for result in [descriptive_summary(self.today)["descriptive"]["population"],
                       overview_summary(today=self.today)["population"]]:
            self.assertEqual(result["total_heads"], expected["total_heads"])
            self.assertEqual(sum(row["heads"] for row in result["by_barangay"]), 12)
            self.assertEqual(sum(row["heads"] for row in result["by_species"]), 12)

    def test_overview_current_month_units_and_historical_production_survive_exit(self):
        animal = self.animal(operational="SOLD")
        for kind, unit, when, quantity, status in [
            ("MILK", "LITERS", self.today, "2.50", "APPROVED"),
            ("MILK", "LITERS", date(2026, 9, 30), "99", "APPROVED"),
            ("MILK", "LITERS", self.today, "50", "VERIFIED"),
            ("MEAT", "KILOGRAMS", self.today, "30", "APPROVED")]:
            ProductionRecord.objects.create(livestock=animal, production_type=kind,
                unit=unit, record_date=when, quantity=Decimal(quantity), status=status, created_by=self.user)
        from production.models import SlaughterRecord
        SlaughterRecord.objects.create(barangay=self.barangay, livestock_type=self.cattle,
            quantity=1, carcass_weight=Decimal("5.25"), record_date=self.today,
            status="APPROVED", created_by=self.user)
        dashboard = descriptive_summary(self.today)
        overview = overview_summary(today=self.today)
        self.assertEqual(dashboard["monthly_dairy_yield_l"], 2.5)
        self.assertEqual(overview["population"]["by_barangay"][0]["monthly_milk_l"], 2.5)
        self.assertEqual(overview["population"]["total_heads"], 0)
        self.assertEqual(overview["population"]["by_barangay"][0]["monthly_meat_kg"], 5.25)
        self.assertEqual(dashboard["year_to_date_l"], 101.5)

    def test_repeat_get_navigation_filters_are_read_only_and_scope_correct(self):
        from django.db import connection
        from django.test.utils import CaptureQueriesContext
        self.animal(quantity=3)
        other = Barangay.objects.create(barangay_name="Other", latitude=Decimal("13.89"), longitude=Decimal("121.22"))
        farmer_user = User.objects.create_user(username="other", email="other@test.example", role=self.user.role)
        farmer = Farmer.objects.create(user=farmer_user, barangay=other, address="Other")
        LivestockInventory.objects.create(farmer=farmer, livestock_type=self.cattle,
            entry_type="BATCH", quantity=5, status="APPROVED", created_by=farmer_user)
        factory = APIRequestFactory()
        for role_name, scope, assigned, heads in [
            ("ADMIN", "ASSIGNED_ONLY", self.barangay, 8), ("MAO", "ASSIGNED_ONLY", self.barangay, 8),
            ("SIBAT", "ASSIGNED_ONLY", self.barangay, 3), ("SIBAT", "ALL_BARANGAYS", self.barangay, 8),
            ("SIBAT", "ASSIGNED_ONLY", None, 0)]:
            role, _ = Role.objects.get_or_create(role_name=role_name)
            user = User.objects.create_user(username=f"{role_name}-{scope}-{heads}",
                email=f"{role_name}-{scope}-{heads}@test.example", role=role,
                assigned_barangay=assigned, access_scope=scope)
            for endpoint in [dashboard_summary, data_overview_summary]:
                responses = []
                with CaptureQueriesContext(connection) as queries:
                    for params in [{}, {"page": "2", "barangay": str(other.pk), "status": "PENDING"}, {}]:
                        request = factory.get("/api/analytics/", params)
                        force_authenticate(request, user=user)
                        response = endpoint(request)
                        self.assertEqual(response.status_code, 200)
                        responses.append(response.data)
                self.assertEqual(responses[0], responses[1])
                self.assertEqual(responses[0], responses[2])
                population = responses[0].get("population") or responses[0]["descriptive"]["population"]
                self.assertEqual(population["total_heads"], heads)
                self.assertFalse(any(q["sql"].lstrip().upper().startswith(("INSERT", "UPDATE", "DELETE")) for q in queries))
        for user in [self.user, None]:
            request = factory.get("/api/analytics/overview/")
            if user: force_authenticate(request, user=user)
            self.assertIn(data_overview_summary(request).status_code, (401, 403))

    def test_population_query_count_does_not_grow_with_inventory_rows(self):
        from django.db import connection
        from django.test.utils import CaptureQueriesContext
        with CaptureQueriesContext(connection) as baseline:
            population_summary(today=self.today)
        for _ in range(30): self.animal()
        with CaptureQueriesContext(connection) as populated:
            result = population_summary(today=self.today)
        self.assertEqual(len(baseline), len(populated))
        self.assertEqual(len(populated), 5)
        self.assertEqual(result["total_heads"], 30)

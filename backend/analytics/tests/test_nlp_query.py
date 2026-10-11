import json
from datetime import date
from decimal import Decimal
from pathlib import Path

from django.urls import reverse
from django.test import TestCase
from rest_framework.test import APIClient

from analytics.services.nlp_query import execute_question, parse_question
from diseases.models import DiseaseCase, MortalityRecord
from livestock.models import Barangay, Farmer, LivestockInventory, LivestockType
from production.models import ProductionRecord
from users.models import Role, User


TODAY = date(2026, 6, 30)
EVALUATION_PATH = Path(__file__).parent / "data" / "ask_smartlivestock_eval.json"


class AskSmartLivestockParserTests(TestCase):
    def setUp(self):
        self.barangays = [
            {"id": 1, "name": "San Roque"},
            {"id": 2, "name": "Banaba Ibaba"},
        ]
        self.species = ["Cattle", "Carabao", "Goat", "Sheep", "Swine", "Chicken", "Duck"]

    def test_evaluation_examples_match_expected_intent_and_parameters(self):
        examples = json.loads(EVALUATION_PATH.read_text(encoding="utf-8"))
        self.assertGreaterEqual(len(examples), 30)
        self.assertLessEqual(len(examples), 50)
        exact_status = 0
        exact_intent = 0
        expected_parameter_count = 0
        matched_parameter_count = 0

        for example in examples:
            with self.subTest(question=example["question"]):
                parsed = parse_question(
                    example["question"], today=TODAY, barangays=self.barangays, species_names=self.species,
                )
                status_matches = parsed["status"] == example["status"]
                exact_status += status_matches
                self.assertTrue(status_matches, parsed)
                if example.get("intent"):
                    intent_matches = parsed.get("intent") == example["intent"]
                    exact_intent += intent_matches
                    self.assertTrue(intent_matches, parsed)
                for path, expected in example.get("parameters", {}).items():
                    value = parsed
                    for part in path.split("."):
                        if isinstance(value, dict) and part in value:
                            value = value[part]
                        elif isinstance(value, dict) and part == "period" and "period" in value.get("parameters", {}):
                            value = value["parameters"]["period"]
                        elif isinstance(value, dict) and part in value.get("parameters", {}):
                            value = value["parameters"][part]
                        else:
                            value = None
                    expected_parameter_count += 1
                    matched_parameter_count += value == expected
                    self.assertEqual(value, expected, f"parameter {path}; parsed={parsed}")

        # These counters make the documented evaluation measures easy to inspect in a debugger.
        self.assertEqual(exact_status, len(examples))
        self.assertGreater(exact_intent, 0)
        self.assertEqual(matched_parameter_count, expected_parameter_count)

    def test_invalid_or_ambiguous_dates_are_clarified(self):
        contradictory = parse_question(
            "Show milk production this quarter for the last six months",
            today=TODAY, barangays=self.barangays, species_names=self.species,
        )
        reversed_dates = parse_question(
            "Show milk production from 2026-06-30 to 2026-01-01",
            today=TODAY, barangays=self.barangays, species_names=self.species,
        )
        self.assertEqual(contradictory["status"], "clarification")
        self.assertEqual(reversed_dates["status"], "clarification")

    def test_calendar_period_boundaries_are_deterministic(self):
        cases = {
            "Show milk production this quarter": ("2026-04-01", "2026-06-30"),
            "Show milk production last quarter": ("2026-01-01", "2026-03-31"),
            "Show milk production for the last six months": ("2026-01-01", "2026-06-30"),
            "Show milk production during 2025": ("2025-01-01", "2025-12-31"),
            "Show milk production from 2026-01-01 to 2026-06-30": ("2026-01-01", "2026-06-30"),
        }
        for question, (start, end) in cases.items():
            with self.subTest(question=question):
                parsed = parse_question(
                    question, today=TODAY, barangays=self.barangays, species_names=self.species,
                )
                self.assertEqual(parsed["status"], "parsed", parsed)
                self.assertEqual(parsed["parameters"]["period"]["start"], start)
                self.assertEqual(parsed["parameters"]["period"]["end"], end)


class AskSmartLivestockQueryTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.mao = self.make_user("mao", "MAO")
        self.sibat = self.make_user("sibat", "SIBAT")
        self.farmer_user = self.make_user("farmer_one", "FARMER")
        self.other_farmer_user = self.make_user("farmer_two", "FARMER")
        self.san_roque = Barangay.objects.create(
            barangay_name="San Roque", latitude=Decimal("13.880000"), longitude=Decimal("121.210000"),
        )
        self.banaba = Barangay.objects.create(
            barangay_name="Banaba Ibaba", latitude=Decimal("13.890000"), longitude=Decimal("121.220000"),
        )
        self.sibat.assigned_barangay = self.san_roque
        self.sibat.save(update_fields=["assigned_barangay"])
        self.farmer = Farmer.objects.create(user=self.farmer_user, barangay=self.san_roque, address="San Roque")
        self.other_farmer = Farmer.objects.create(user=self.other_farmer_user, barangay=self.banaba, address="Banaba Ibaba")
        self.cattle = LivestockType.objects.create(name="Cattle")
        self.goat = LivestockType.objects.create(name="Goat")
        self.swine = LivestockType.objects.create(name="Swine")

        self.cattle_record = self.make_inventory(self.farmer, self.cattle, 3, "APPROVED", "ACTIVE")
        self.make_inventory(self.farmer, self.goat, 2, "APPROVED", "ACTIVE")
        self.make_inventory(self.farmer, self.cattle, 8, "PENDING", "ACTIVE")
        self.other_cattle_record = self.make_inventory(self.other_farmer, self.cattle, 11, "APPROVED", "ACTIVE")
        self.make_inventory(self.other_farmer, self.goat, 7, "APPROVED", "SOLD")

        self.make_production(self.cattle_record, self.farmer, "MILK", "LITERS", "20", date(2026, 6, 10), "APPROVED")
        self.make_production(self.cattle_record, self.farmer, "MILK", "LITERS", "5", date(2026, 5, 10), "APPROVED")
        self.make_production(self.cattle_record, self.farmer, "MILK", "LITERS", "99", date(2026, 6, 10), "PENDING")
        self.make_production(self.cattle_record, self.farmer, "EGGS", "PIECES", "12", date(2026, 6, 10), "APPROVED")
        self.make_production(self.cattle_record, self.farmer, "MILK", "LITERS", "3", date(2026, 6, 10), "VERIFIED")

        DiseaseCase.objects.create(
            livestock=self.cattle_record, name="Test illness", affected_count=2,
            record_date=date(2026, 6, 10), status="APPROVED", created_by=self.farmer_user,
        )
        DiseaseCase.objects.create(
            livestock=self.cattle_record, name="Not approved", affected_count=99,
            record_date=date(2026, 6, 10), status="PENDING", created_by=self.farmer_user,
        )
        DiseaseCase.objects.create(
            livestock=self.cattle_record, name="Outside quarter", affected_count=40,
            record_date=date(2026, 3, 31), status="APPROVED", created_by=self.farmer_user,
        )
        DiseaseCase.objects.create(
            livestock=self.other_cattle_record, name="Other barangay", affected_count=4,
            record_date=date(2026, 6, 10), status="APPROVED", created_by=self.other_farmer_user,
        )
        MortalityRecord.objects.create(
            livestock=self.cattle_record, cause="Test cause", death_count=1,
            record_date=date(2026, 6, 12), status="APPROVED", created_by=self.farmer_user,
        )
        MortalityRecord.objects.create(
            livestock=self.other_cattle_record, cause="Other barangay cause", death_count=4,
            record_date=date(2026, 6, 12), status="APPROVED", created_by=self.other_farmer_user,
        )

    @staticmethod
    def make_user(username, role_name):
        role, _ = Role.objects.get_or_create(role_name=role_name)
        return User.objects.create_user(
            username=username, email=f"{username}@example.test", password="pass",
            role=role, account_status=User.AccountStatus.APPROVED,
        )

    def make_inventory(self, farmer, livestock_type, quantity, status, operational_status):
        return LivestockInventory.objects.create(
            farmer=farmer, livestock_type=livestock_type, quantity=quantity,
            entry_type="BATCH" if quantity > 1 else "INDIVIDUAL",
            status=status, operational_status=operational_status, created_by=farmer.user,
        )

    def make_production(self, livestock, farmer, production_type, unit, quantity, record_date, status):
        return ProductionRecord.objects.create(
            livestock=livestock, farmer_at_record=farmer, production_type=production_type,
            unit=unit, quantity=Decimal(quantity), record_date=record_date, status=status,
            created_by=farmer.user,
        )

    def ask(self, user, question):
        return execute_question(question, user=user, today=TODAY)

    def test_population_uses_approved_active_inventory_and_real_species_filter(self):
        result = self.ask(self.mao, "How many cattle are currently registered?")
        self.assertEqual(result["results"], [{"livestock_type": "Cattle", "current_heads": 14}])
        # Approved active heads are 3 in San Roque and 11 in Banaba Ibaba.
        self.assertIn("approved active", result["coverage_note"])

    def test_production_trend_uses_approved_rows_and_keeps_missing_months_absent(self):
        result = self.ask(self.mao, "Show monthly milk production for the last six months.")
        self.assertEqual(sum(row["quantity"] for row in result["results"]), 25)
        self.assertEqual(len(result["results"]), 2)
        self.assertEqual([row["label"] for row in result["results"]], ["May 2026", "Jun 2026"])
        # The result carries the real recorded months; the API does not fill absent months with zero.

    def test_disease_by_barangay_excludes_pending_records_and_out_of_period_events(self):
        result = self.ask(self.mao, "Which barangays reported the most cattle diseases this quarter?")
        self.assertEqual(result["results"], [
            {"barangay": "Banaba Ibaba", "disease_cases": 1, "affected_heads": 4},
            {"barangay": "San Roque", "disease_cases": 1, "affected_heads": 2},
        ])

    def test_mortality_comparison_returns_counts_not_unavailable_rates(self):
        result = self.ask(self.mao, "Compare cattle mortality across barangays this quarter")
        self.assertEqual(result["results"], [
            {"barangay": "Banaba Ibaba", "deaths": 4, "records": 1},
            {"barangay": "San Roque", "deaths": 1, "records": 1},
        ])
        self.assertIn("not a mortality rate", result["answer"])

    def test_production_breakdown_keeps_units_separate(self):
        result = self.ask(self.mao, "Break down production by type")
        values = {row["production_type"]: row["unit"] for row in result["results"]}
        self.assertEqual(values, {"EGGS": "PIECES", "MILK": "LITERS"})
        self.assertEqual(result["visualization"]["type"], "table")

    def test_pending_mao_queue_reuses_workload_service_and_reports_domain_counts(self):
        result = self.ask(self.mao, "Which production records are pending MAO review?")
        self.assertEqual(result["results"], [{"submission_type": "Production", "waiting_for_mao": 1}])
        self.assertIsNotNone(result["as_of"])

    def test_sibat_all_barangays_request_stays_within_assignment(self):
        result = self.ask(self.sibat, "How many active livestock heads by barangay across all barangays?")
        self.assertEqual(result["results"], [{"barangay": "San Roque", "current_heads": 5}])

    def test_sibat_cannot_name_an_unassigned_barangay(self):
        result = self.ask(self.sibat, "Compare cattle mortality in Banaba Ibaba by barangay this quarter")
        self.assertEqual(result["status"], "clarification")
        self.assertEqual(result["results"], [])
        self.assertNotIn("Banaba Ibaba", result["answer"])

    def test_no_matching_inventory_is_empty_not_an_observed_zero(self):
        result = self.ask(self.mao, "How many swine are currently registered?")
        self.assertEqual(result["results"], [])
        self.assertIn("does not confirm", result["answer"])

    def test_api_authentication_and_role_restrictions(self):
        url = reverse("nlp-query")
        anonymous = self.client.post(url, {"question": "How many cattle are currently registered?"}, format="json")
        self.assertIn(anonymous.status_code, (401, 403))

        self.client.force_authenticate(self.farmer_user)
        farmer_response = self.client.post(url, {"question": "How many cattle are currently registered?"}, format="json")
        self.assertEqual(farmer_response.status_code, 403)

        self.client.force_authenticate(self.sibat)
        pending_response = self.client.post(url, {"question": "Which submissions are waiting for MAO approval?"}, format="json")
        self.assertEqual(pending_response.status_code, 403)

        self.client.force_authenticate(self.mao)
        response = self.client.post(url, {"question": "How many cattle are currently registered?"}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["intent"], "population_summary")

    def test_question_length_is_validated_by_api(self):
        self.client.force_authenticate(self.mao)
        response = self.client.post(reverse("nlp-query"), {"question": "x" * 501}, format="json")
        self.assertEqual(response.status_code, 400)

import json
from datetime import date
from decimal import Decimal
from pathlib import Path

from django.urls import reverse
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework.exceptions import PermissionDenied

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
        self.assertLessEqual(len(examples), 40)
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

    def test_unsupported_filters_and_ambiguous_combinations_are_not_ignored(self):
        questions = [
            "Show milk production yesterday",
            "Show milk production since 2025",
            "Show milk production this quarter since 2025",
            "How many cattle and goats are registered?",
            "How many chicken and ducks are registered?",
            "Show swine milk output this month",
            "Compare production and disease by barangay",
            "Show current heads by barangay and by species",
        ]
        for question in questions:
            with self.subTest(question=question):
                result = parse_question(question, today=TODAY,
                                        barangays=self.barangays, species_names=self.species)
                self.assertEqual(result["status"], "clarification", result)

    def test_quarter_rollover_and_leap_month(self):
        for today, wording, start, end in [
            (date(2026, 1, 1), "last quarter", "2025-10-01", "2025-12-31"),
            (date(2024, 3, 1), "last month", "2024-02-01", "2024-02-29"),
        ]:
            result = parse_question(f"Show milk production {wording}", today=today,
                                    barangays=self.barangays, species_names=self.species)
            self.assertEqual(result["parameters"]["period"]["start"], start)
            self.assertEqual(result["parameters"]["period"]["end"], end)

    def test_case_whitespace_and_an_unmarked_owner(self):
        result = parse_question("  HOW   MANY CATTLE ARE REGISTERED?  ", today=TODAY,
                                barangays=self.barangays, species_names=self.species)
        self.assertEqual(result["parameters"]["species"], "Cattle")
        result = parse_question("How many cattle does Alice have?", today=TODAY,
                                barangays=self.barangays, species_names=self.species)
        self.assertEqual(result["status"], "unsupported")


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

    def test_barangay_species_breakdown_does_not_return_municipal_totals(self):
        result = self.ask(self.mao, "Show current heads by species in San Roque")
        self.assertEqual(result["results"], [
            {"livestock_type": "Cattle", "current_heads": 3},
            {"livestock_type": "Goat", "current_heads": 2},
        ])

    def test_individual_owner_queries_do_not_fall_back_to_municipal_inventory(self):
        for user in (self.mao, self.sibat):
            result = self.ask(user, "How many cattle does Farmer A own?")
            self.assertEqual(result["status"], "unsupported")
            self.assertEqual(result["results"], [])
            self.assertIn("capability limitation", result["answer"])
        with self.assertRaises(PermissionDenied):
            self.ask(self.farmer_user, "How many cattle are mine?")

    def test_sibat_production_and_health_scopes_and_missing_assignment(self):
        self.make_production(self.other_cattle_record, self.other_farmer, "MILK", "LITERS",
                             "400", date(2026, 6, 1), "APPROVED")
        result = self.ask(self.sibat, "Show milk production this quarter")
        self.assertEqual(sum(row["quantity"] for row in result["results"]), 25)
        result = self.ask(self.sibat, "Show disease cases across all barangays this quarter")
        self.assertEqual([row["barangay"] for row in result["results"]], ["San Roque"])
        self.sibat.assigned_barangay = None
        self.sibat.save(update_fields=["assigned_barangay"])
        self.assertEqual(self.ask(self.sibat, "Show current heads by barangay")["results"], [])

    def test_all_barangay_sibat_does_not_gain_mao_queue_authority(self):
        self.sibat.access_scope = "ALL_BARANGAYS"
        self.sibat.save(update_fields=["access_scope"])
        result = self.ask(self.sibat, "How many cattle are currently registered?")
        self.assertEqual(result["results"][0]["current_heads"], 14)
        with self.assertRaises(PermissionDenied):
            self.ask(self.sibat, "Which records are pending MAO approval?")

    def test_evaluation_api_is_read_only_and_mao_admin_only(self):
        url = reverse("nlp-evaluation")
        for user in (self.sibat, self.farmer_user):
            self.client.force_authenticate(user)
            self.assertEqual(self.client.get(url).status_code, 403)
            self.assertEqual(self.client.get(url, {"compare": "1"}).status_code, 403)
        for user in (self.mao, self.make_user("admin", "ADMIN")):
            self.client.force_authenticate(user)
            result = self.client.get(url)
            self.assertEqual(result.status_code, 200)
            self.assertEqual(result.data["total"], 40)
            self.assertEqual(result.data["passed"], 40)
            self.assertEqual(self.client.post(url, {}).status_code, 405)
        self.assertEqual(self.client.get(url, {"compare": "invalid"}).status_code, 400)
        self.client.force_authenticate(None)
        self.assertIn(self.client.get(url).status_code, (401, 403))

    def test_blank_and_invalid_question_types_are_rejected(self):
        self.client.force_authenticate(self.mao)
        for payload in ({}, {"question": "   "}, {"question": ["milk"]}, {"question": None}):
            self.assertEqual(self.client.post(reverse("nlp-query"), payload, format="json").status_code, 400)

    def test_mixed_units_are_not_merged_into_a_line_chart(self):
        self.make_production(self.cattle_record, self.farmer, "MILK", "KILOGRAMS",
                             "6", date(2026, 6, 10), "APPROVED")
        result = self.ask(self.mao, "Show monthly milk production this quarter")
        self.assertEqual(result["visualization"]["type"], "table")
        self.assertEqual({row["unit"] for row in result["results"]}, {"LITERS", "KILOGRAMS"})

    def test_production_barangay_filter_follows_owner_at_record(self):
        self.make_production(self.cattle_record, self.other_farmer, "MILK", "LITERS",
                             "400", date(2026, 6, 10), "APPROVED")
        result = self.ask(self.mao, "Show milk production by barangay in San Roque this quarter")
        self.assertEqual(result["results"], [{"production_type": "MILK", "unit": "LITERS",
                                             "quantity": 25.0, "records": 2, "barangay": "San Roque"}])

import json
from pathlib import Path
from unittest.mock import patch

from django.test import SimpleTestCase, TestCase
from django.urls import reverse
from django.contrib.auth.models import Group
from rest_framework.test import APIClient
from decimal import Decimal

from analytics.models import NLPExampleReviewEvent
from analytics.permissions import NLP_DEVELOPER_GROUP
from analytics.services.nlp_dataset import CORPUS_PATH, audit_corpus, build_corpus
from livestock.models import Barangay, LivestockType
from users.models import Role, User


class NLPDatasetContractTests(SimpleTestCase):
    def test_candidate_corpus_is_reproducible_grouped_and_disjoint_from_legacy(self):
        corpus = build_corpus()
        self.assertEqual(json.loads(CORPUS_PATH.read_text(encoding="utf-8")), corpus)
        report = audit_corpus(corpus)
        self.assertEqual(report["errors"], [])
        self.assertEqual(report["total"], 1296)
        self.assertEqual(report["group_counts"], {"train": 306, "validation": 36, "test": 90})
        self.assertEqual(report["training_target_shortfall"]["population_summary"], 0)
        self.assertTrue(all(row["review_status"] == "candidate" for row in corpus["examples"]))


class NLPDatasetReviewAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.users = {role: self.make_user(role.lower(), role) for role in (
            "MAO", "ADMIN", "SIBAT", "CBAT", "FARMER", "AUCTION", "SLAUGHTERHOUSESTAFF",
        )}
        self.users["DEVELOPER"] = self.make_user("nlp_developer", "ADMIN", nlp_developer=True)
        self.barangay = Barangay.objects.create(
            barangay_name="San Roque", latitude=Decimal("13.880000"), longitude=Decimal("121.210000"),
        )
        LivestockType.objects.create(name="Cattle")
        for role in ("SIBAT", "CBAT"):
            self.users[role].assigned_barangay = self.barangay
            self.users[role].save(update_fields=["assigned_barangay"])
        self.corpus = json.loads(CORPUS_PATH.read_text(encoding="utf-8"))
        self.training = next(row for row in self.corpus["examples"] if row["split"] == "train")
        self.frozen = next(row for row in self.corpus["examples"] if row["split"] == "test")

    @staticmethod
    def make_user(username, role_name, *, nlp_developer=False, is_superuser=False):
        role, _ = Role.objects.get_or_create(role_name=role_name)
        user = User.objects.create_user(username=username, email=f"{username}@example.test",
                                        password="pass", role=role,
                                        account_status=User.AccountStatus.APPROVED)
        if nlp_developer:
            group, _ = Group.objects.get_or_create(name=NLP_DEVELOPER_GROUP)
            user.groups.add(group)
        if is_superuser:
            user.is_superuser = True
            user.is_staff = True
            user.save(update_fields=["is_superuser", "is_staff"])
        return user

    def test_dataset_and_review_access_requires_explicit_developer_group(self):
        url = reverse("nlp-dataset")
        self.client.force_authenticate(self.users["DEVELOPER"])
        result = self.client.get(url)
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.data["candidate_count"], 1296)
        self.assertFalse(result.data["production_training_file_changed"])
        self.assertEqual(result.data["evaluation"]["candidate_training_count"], 918)
        self.assertGreaterEqual(result.data["evaluation"]["candidate_classifier_accuracy"],
                                result.data["evaluation"]["baseline_classifier_accuracy"])
        self.assertIn("period.start", result.data["evaluation"]["entity_exact_match"])
        denied_users = [self.users[role] for role in (
            "MAO", "ADMIN", "SIBAT", "CBAT", "FARMER", "AUCTION", "SLAUGHTERHOUSESTAFF",
        )]
        denied_users.append(self.make_user("unassigned_superuser", "ADMIN", is_superuser=True))
        for user in denied_users:
            role = user.role.role_name
            self.client.force_authenticate(user)
            self.assertEqual(self.client.get(url).status_code, 403, role)
            self.assertEqual(self.client.post(reverse("nlp-dataset-review", args=[self.training["example_id"]]),
                                              {"decision": "accepted"}, format="json").status_code, 403, role)

    def test_only_training_candidate_can_be_edited_and_reviews_are_append_only(self):
        self.client.force_authenticate(self.users["DEVELOPER"])
        url = reverse("nlp-dataset-review", args=[self.training["example_id"]])
        payload = {"decision": "accepted", "utterance": "Revised reviewed training question", "intent": "population_summary"}
        self.assertEqual(self.client.post(url, payload, format="json").status_code, 201)
        self.assertEqual(self.client.post(url, {"decision": "rejected", "notes": "Incorrect wording"}, format="json").status_code, 201)
        self.assertEqual(NLPExampleReviewEvent.objects.filter(example_id=self.training["example_id"]).count(), 2)

        frozen_url = reverse("nlp-dataset-review", args=[self.frozen["example_id"]])
        frozen_response = self.client.post(frozen_url, {"decision": "accepted"}, format="json")
        self.assertEqual(frozen_response.status_code, 400)
        self.assertEqual(NLPExampleReviewEvent.objects.count(), 2)

        state = self.client.get(reverse("nlp-dataset"))
        reviewed = next(row for row in state.data["examples"] if row["example_id"] == self.training["example_id"])
        self.assertEqual(reviewed["review"]["decision"], "rejected")
        self.assertEqual(state.data["candidate_count"], 1295)
        self.assertEqual(state.data["rejected_count"], 1)

    def test_invalid_intent_and_unknown_candidate_are_rejected(self):
        self.client.force_authenticate(self.users["DEVELOPER"])
        url = reverse("nlp-dataset-review", args=[self.training["example_id"]])
        self.assertEqual(self.client.post(url, {"decision": "accepted", "intent": "execute_sql"}, format="json").status_code, 400)
        self.assertEqual(self.client.post(reverse("nlp-dataset-review", args=["not-a-candidate"]),
                                          {"decision": "accepted"}, format="json").status_code, 404)
        self.assertEqual(NLPExampleReviewEvent.objects.count(), 0)

    def test_dataset_loads_when_optional_evaluation_report_is_missing(self):
        report_path = CORPUS_PATH.parent / "missing_nlp_expansion_report_for_test.json"
        self.client.force_authenticate(self.users["DEVELOPER"])
        with patch("analytics.services.nlp_dataset.REPORT_PATH", report_path):
            response = self.client.get(reverse("nlp-dataset"))
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.data["evaluation"])
        self.assertEqual(response.data["candidate_count"], 1296)

    def test_role_scenarios_preserve_ask_scope_and_restrictions(self):
        scenarios_path = Path(__file__).parent / "data" / "ask_smartlivestock_roles_eval.json"
        for scenario in json.loads(scenarios_path.read_text(encoding="utf-8")):
            with self.subTest(role=scenario["role"], question=scenario["question"]):
                self.client.force_authenticate(self.users[scenario["role"]])
                response = self.client.post(reverse("nlp-query"), {"question": scenario["question"]}, format="json")
                self.assertEqual(response.status_code, scenario["http_status"])
                if scenario["intent"]:
                    self.assertEqual(response.data["intent"], scenario["intent"])

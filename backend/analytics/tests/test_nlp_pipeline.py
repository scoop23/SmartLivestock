"""Language/decision tests use synthetic questions, not production records."""
import json
from django.test import SimpleTestCase
from analytics.services.nlp_query import normalize_question, parse_question, tokenize_question
from analytics.services.nlp_pipeline import interpret_question
from analytics.services.nlp_evaluation import (
    BARANGAYS, SPECIES, EVALUATION_DATE, EVALUATION_PATH,
    classification_metrics, compare_pipelines, select_rejection_threshold,
)

CONTEXT = {"today": EVALUATION_DATE, "barangays": BARANGAYS, "species_names": SPECIES}


class NLPPipelineTests(SimpleTestCase):
    def test_shared_normalization_and_date_preserving_tokens(self):
        self.assertEqual(normalize_question("  ILANG BAKA ang registered? "), "ilang baka ang registered")
        self.assertEqual(tokenize_question("ILANG BAKA ang registered?"), ["ilang", "baka", "ang", "registered"])
        self.assertEqual(tokenize_question("San-Roque: 2026-06-30, 12 heads"),
                         ["san-roque", "2026-06-30", "12", "heads"])

    def test_production_pipeline_preserves_the_baseline_for_every_example(self):
        examples = json.loads(EVALUATION_PATH.read_text(encoding="utf-8"))
        for example in examples:
            with self.subTest(question=example["question"]):
                result = interpret_question(example["question"], **CONTEXT)
                diagnostics = result.pop("diagnostics")
                self.assertEqual(result, parse_question(example["question"], **CONTEXT))
                self.assertEqual(diagnostics["executable"], result["status"] == "parsed")

    def test_high_model_score_never_overrides_deterministic_safety(self):
        for question in ("How many cattle does Farmer A own?", "Show swine milk output",
                         "How many cattle and goats are registered?", "Show milk output yesterday"):
            with self.subTest(question=question):
                result = interpret_question(question, **CONTEXT,
                    prediction={"intent": "population_summary", "confidence": 0.99}, threshold=0.8)
                self.assertFalse(result["diagnostics"]["executable"])
                self.assertEqual(result["diagnostics"]["decision"], "deterministic_refusal_preserved")

    def test_unvalidated_model_candidate_does_not_make_a_request_executable(self):
        result = interpret_question("cattle movies please", **CONTEXT,
            prediction={"intent": "population_summary", "confidence": 0.99}, threshold=0.8)
        self.assertEqual(result["status"], "unsupported")
        self.assertEqual(result["diagnostics"]["decision"], "unvalidated_ml_candidate_rejected")

    def test_rules_win_conflicts_and_missing_threshold_abstains(self):
        result = interpret_question("How many cattle are registered?", **CONTEXT,
            prediction={"intent": "production_trend", "confidence": 0.99}, threshold=0.8)
        self.assertEqual(result["intent"], "population_summary")
        result = interpret_question("cattle movies please", **CONTEXT,
            prediction={"intent": "population_summary", "confidence": 0.99})
        self.assertEqual(result["diagnostics"]["decision"], "ml_abstained")

    def test_threshold_is_selected_from_validation_errors_not_a_fixed_constant(self):
        result = select_rejection_threshold(["population_summary", "unsupported"], [
            {"intent": "population_summary", "confidence": 0.82},
            {"intent": "population_summary", "confidence": 0.25},
        ])
        self.assertEqual(result["threshold"], 0.82)
        self.assertEqual(result["accepted"], 1)
        result = select_rejection_threshold(["unsupported"], [
            {"intent": "population_summary", "confidence": 0.99},
        ])
        self.assertIsNone(result["threshold"])

    def test_metrics_distinguish_unsafe_acceptance_from_incorrect_rejection(self):
        result = classification_metrics(["unsupported", "population_summary"],
                                        ["population_summary", "unsupported"])
        self.assertEqual(result["false_executable_predictions"], 1)
        self.assertEqual(result["incorrect_rejections"], 1)
        self.assertEqual(result["safe_rejection_rate"], 0)

    def test_comparison_has_separate_fit_validation_and_test_and_no_live_ml(self):
        report = compare_pipelines()
        self.assertEqual(report["training"]["fit"], 64)
        self.assertEqual(report["training"]["validation"], 16)
        self.assertEqual(report["training"]["test"], 40)
        self.assertFalse(report["ml_routing_enabled"])
        self.assertEqual(report["hybrid"]["outcome_accuracy"], report["baseline"]["outcome_accuracy"])
        self.assertIsNone(report["ml"]["parameter_accuracy"])
        self.assertEqual(sum(sum(row) for row in report["ml"]["confusion_matrix"]["rows"]), 40)

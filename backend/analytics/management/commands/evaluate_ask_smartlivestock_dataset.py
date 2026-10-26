"""Compare frozen live artifacts and an offline candidate on grouped examples."""
import json
import subprocess
from datetime import date
from pathlib import Path
from types import ModuleType

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone
from analytics.services.nlp_dataset import (
    CORPUS_PATH, REPORT_PATH, audit_corpus, classifier_rows, load_corpus,
)
from analytics.services.nlp_evaluation import BARANGAYS, classification_metrics, select_rejection_threshold
from analytics.services.nlp_intent_model import ALLOWED_INTENTS, _make_pipeline, evaluate_intent_classifier
from analytics.services.nlp_query import SUPPORTED_INTENTS, parse_question

EVALUATION_DATE = date(2026, 10, 26)
SPECIES = ["Cattle", "Carabao", "Goat", "Sheep", "Swine", "Chicken", "Duck"]


def _label(parsed):
    return parsed.get("intent") if parsed.get("status") == "parsed" else parsed.get("status")


def _baseline_parser():
    """Load the exact committed parser for a same-corpus before/after comparison."""
    repository = Path(__file__).resolve().parents[4]
    result = subprocess.run(
        ["git", "show", "HEAD:backend/analytics/services/nlp_query.py"],
        cwd=repository, capture_output=True, text=True, check=True,
    )
    module = ModuleType("analytics.services._nlp_query_baseline")
    module.__package__ = "analytics.services"
    exec(compile(result.stdout, "nlp_query.py@HEAD", "exec"), module.__dict__)
    return module.parse_question


def _entity_report(examples, parser):
    metrics = {}
    details = []
    for row in examples:
        if row["intent"] not in ALLOWED_INTENTS or row["expected_behavior"] not in {"answer", "clarification", "unsupported"}:
            continue
        parsed = parser(row["utterance"], today=EVALUATION_DATE, barangays=BARANGAYS, species_names=SPECIES)
        actual = parsed.get("parameters", {})
        mismatches = []
        for path, expected in row.get("entities", {}).items():
            value = actual
            for part in path.split("."):
                value = value.get(part) if isinstance(value, dict) else None
            result = metrics.setdefault(path, {"support": 0, "matches": 0, "checks": 0, "tp": 0, "fp": 0, "fn": 0})
            result["checks"] += 1
            result["support"] += expected is not None
            result["matches"] += expected == value
            result["tp"] += expected is not None and expected == value
            result["fn"] += expected is not None and expected != value
            result["fp"] += value is not None and value != expected
            if expected != value:
                mismatches.append({"entity": path, "expected": expected, "actual": value})
        if mismatches:
            details.append({"example_id": row["example_id"], "utterance": row["utterance"], "mismatches": mismatches})
    for result in metrics.values():
        result["precision"] = result["tp"] / (result["tp"] + result["fp"]) if result["tp"] + result["fp"] else 0
        result["recall"] = result["tp"] / (result["tp"] + result["fn"]) if result["tp"] + result["fn"] else None
    # Exact match uses rows that declare the field, including expected nulls.
    for key, result in metrics.items():
        result["exact_match_accuracy"] = result["matches"] / result["checks"] if result["checks"] else None
    return {"per_entity": metrics, "mismatches": details}


def _query_contract_report(examples, parser):
    mismatches, correct = [], 0
    for row in examples:
        parsed = parser(row["utterance"], today=EVALUATION_DATE, barangays=BARANGAYS, species_names=SPECIES)
        actual = _label(parsed)
        intent_ok = actual == row["intent"]
        handler = None
        if parsed.get("status") == "parsed":
            handler = {
                "population_summary": "_population_results",
                "production_trend": "_production_results",
                "production_breakdown": "_production_results",
                "disease_by_barangay": "_disease_results",
                "mortality_comparison": "_mortality_results",
                "pending_reviews": "review_workload_summary",
                "farmer_livestock_count": "_farmer_livestock_count",
            }.get(parsed["intent"])
        expected_handler = row.get("expected_query_handler")
        handler_ok = handler == expected_handler
        correct += intent_ok and handler_ok
        if not (intent_ok and handler_ok):
            mismatches.append({"example_id": row["example_id"], "utterance": row["utterance"],
                               "expected": row["intent"], "actual": actual,
                               "expected_handler": expected_handler, "actual_handler": handler})
    return {"examples": len(examples), "intent_and_handler_matches": correct,
            "exact_correctness": correct / len(examples) if examples else None,
            "mismatches": mismatches}


def _confidence_metrics(model, examples):
    probabilities = model.predict_proba([row["utterance"] for row in examples])
    labels = list(model.classes_)
    y_true = [labels.index(row["intent"]) for row in examples]
    y_one_hot = [[float(index == target) for index in range(len(labels))] for target in y_true]
    brier = sum((float(p) - expected) ** 2 for row, target in zip(probabilities, y_one_hot)
                for p, expected in zip(row, target)) / len(probabilities)
    ece = 0.0
    for bin_index in range(10):
        selected = [(float(row.max()), int(row.argmax()) == target)
                    for row, target in zip(probabilities, y_true)
                    if bin_index / 10 <= row.max() < (bin_index + 1) / 10]
        if selected:
            ece += len(selected) / len(probabilities) * abs(
                sum(score for score, _ in selected) / len(selected)
                - sum(correct for _, correct in selected) / len(selected)
            )
    return {"multiclass_brier_score": brier, "expected_calibration_error_10_bins": ece,
            "warning": "Exploratory calibration metrics on synthetic candidate examples; do not use as production confidence."}


def evaluate():
    data = load_corpus()
    audit = audit_corpus(data)
    if audit["errors"]:
        raise ValueError("Candidate dataset failed its integrity/leakage audit.")
    splits = {split: [row for row in data["examples"] if row["split"] == split] for split in ("train", "validation", "test")}
    if set.intersection(*(set(row["split_group"] for row in splits[split]) for split in splits)):
        raise ValueError("A paraphrase family appears in multiple splits.")
    old_parser = _baseline_parser()
    from analytics.services.nlp_query import parse_question

    test = splits["test"]
    expected = [row["intent"] for row in test]
    baseline_training = json.loads((Path(__file__).resolve().parents[2] / "data/ask_smartlivestock_intent_training.json").read_text(encoding="utf-8"))
    baseline_model_predictions = evaluate_intent_classifier(classifier_rows(test))
    candidate_model = _make_pipeline(classifier_rows(splits["train"]))
    candidate_validation = candidate_model.predict_proba([row["utterance"] for row in splits["validation"]])
    validation_predictions = [{"intent": str(candidate_model.classes_[values.argmax()]), "confidence": float(values.max())}
                             for values in candidate_validation]
    threshold = select_rejection_threshold([row["intent"] for row in splits["validation"]], validation_predictions)
    candidate_probabilities = candidate_model.predict_proba([row["utterance"] for row in test])
    candidate_predictions = [str(candidate_model.classes_[values.argmax()]) for values in candidate_probabilities]

    parser_baseline = [_label(old_parser(row["utterance"], today=EVALUATION_DATE, barangays=BARANGAYS, species_names=SPECIES)) for row in test]
    parser_candidate = [_label(parse_question(row["utterance"], today=EVALUATION_DATE, barangays=BARANGAYS, species_names=SPECIES)) for row in test]
    candidate_confidence = [float(values.max()) for values in candidate_probabilities]
    accepted = [(target, prediction, score) for target, prediction, score in zip(expected, candidate_predictions, candidate_confidence)
                if prediction in SUPPORTED_INTENTS
                and threshold["threshold"] is not None and score >= threshold["threshold"]]
    abstaining_predictions = [prediction if prediction not in SUPPORTED_INTENTS
        or (threshold["threshold"] is not None and score >= threshold["threshold"]) else "__abstain__"
        for prediction, score in zip(candidate_predictions, candidate_confidence)]
    return {
        "dataset": audit,
        "model_evaluation": {
            "same_grouped_test": len(test),
            "split_groups": audit["group_counts"],
            "production_training_count": len(baseline_training),
            "candidate_training_count": len(splits["train"]),
            "baseline_tf_idf_logistic_regression": classification_metrics(expected, baseline_model_predictions),
            "candidate_tf_idf_logistic_regression": classification_metrics(expected, candidate_predictions),
            "candidate_by_language": {language: classification_metrics(
                [row["intent"] for row in test if row["language"] == language],
                [prediction for row, prediction in zip(test, candidate_predictions) if row["language"] == language],
            ) for language in ("en", "tl", "tl_en")},
            "candidate_by_difficulty": {difficulty: classification_metrics(
                [row["intent"] for row in test if row["difficulty"] == difficulty],
                [prediction for row, prediction in zip(test, candidate_predictions) if row["difficulty"] == difficulty],
            ) for difficulty in ("easy", "medium", "hard", "adversarial")},
            "threshold_from_validation_only": threshold,
            "accepted_candidate_errors_at_threshold": sum(expected_label != prediction for expected_label, prediction, _ in accepted),
            "test_count_accepted_at_threshold": len(accepted),
            "candidate_abstaining_test_metrics": classification_metrics(expected, abstaining_predictions),
            "candidate_confidence": _confidence_metrics(candidate_model, test),
            "production_model_changed": False,
        },
        "parser_evaluation": {
            "original_committed_rules_same_test": classification_metrics(expected, parser_baseline),
            "improved_rules_same_test": classification_metrics(expected, parser_candidate),
            "entity_extraction": _entity_report(test, parse_question),
            "end_to_end_static_contract": _query_contract_report(test, parse_question),
        },
        "limitations": "All expansion examples are generated synthetic proposals, not reviewer-accepted labels or a blind study. The fixed test set is developmental; later edits require a new version/split before reuse. Classifier labels never run queries. Database values, role/barangay authorization, official filters and API values are verified separately by deterministic Django tests.",
    }


class Command(BaseCommand):
    help = "Evaluate a grouped synthetic NLP candidate corpus without promoting it to production."

    def handle(self, *args, **options):
        try:
            report = evaluate()
        except (ValueError, OSError, subprocess.SubprocessError) as exc:
            raise CommandError(str(exc)) from exc
        document = {"report_version": 1, "evaluated_corpus": CORPUS_PATH.name,
                    "evaluated_at": timezone.now().isoformat(), **report}
        REPORT_PATH.write_text(json.dumps(document, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        self.stdout.write(json.dumps({
            "report_path": str(REPORT_PATH), "train_validation_test": [
                len([row for row in load_corpus()["examples"] if row["split"] == split])
                for split in ("train", "validation", "test")],
            "baseline_classifier_accuracy": report["model_evaluation"]["baseline_tf_idf_logistic_regression"]["outcome_accuracy"],
            "candidate_classifier_accuracy": report["model_evaluation"]["candidate_tf_idf_logistic_regression"]["outcome_accuracy"],
            "baseline_parser_accuracy": report["parser_evaluation"]["original_committed_rules_same_test"]["outcome_accuracy"],
            "candidate_parser_accuracy": report["parser_evaluation"]["improved_rules_same_test"]["outcome_accuracy"],
            "candidate_entity_exact": {key: value["exact_match_accuracy"] for key, value in report["parser_evaluation"]["entity_extraction"]["per_entity"].items()},
            "end_to_end_rule_matches": report["parser_evaluation"]["end_to_end_static_contract"]["exact_correctness"],
            "per_language": {key: value["outcome_accuracy"] for key, value in report["model_evaluation"]["candidate_by_language"].items()},
            "errors": {key: len(value) for key, value in report["parser_evaluation"]["entity_extraction"].items() if isinstance(value, list)},
            "production_model_changed": False,
        }, indent=2, ensure_ascii=False))

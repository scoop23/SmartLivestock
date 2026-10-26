"""Reproducible language-only evaluation of the actual production parser.

Fixed dates and fictional vocabulary make results independent of production
data. Query values and authorization are tested separately with test records.
"""
import json
from datetime import date
from pathlib import Path
from functools import lru_cache

from .nlp_query import SUPPORTED_INTENTS, normalize_question, parse_question, tokenize_question

EVALUATION_PATH = Path(__file__).resolve().parents[1] / "tests/data/ask_smartlivestock_eval.json"
EVALUATION_DATE = date(2026, 6, 30)
BARANGAYS = [{"id": 1, "name": "San Roque"}, {"id": 2, "name": "Banaba Ibaba"}]
SPECIES = ["Cattle", "Carabao", "Goat", "Sheep", "Swine", "Chicken", "Duck"]


def classification_metrics(expected, predicted):
    """Measure outcome labels, including safe refusals as explicit classes.

    False execution means a rejected example was classified as executable.
    That is more consequential than confusing two kinds of safe refusal.
    """
    labels = sorted(set(expected) | set(predicted))
    performance = []
    for label in labels:
        tp = sum(target == actual == label for target, actual in zip(expected, predicted))
        support = expected.count(label)
        selected = predicted.count(label)
        precision = tp / selected if selected else 0
        recall = tp / support if support else 0
        performance.append({"intent": label, "support": support, "precision": precision,
                            "recall": recall,
                            "f1": 2 * precision * recall / (precision + recall) if precision + recall else 0})
    refusal_count = sum(label not in SUPPORTED_INTENTS for label in expected)
    false_execution = sum(target not in SUPPORTED_INTENTS and actual in SUPPORTED_INTENTS
                          for target, actual in zip(expected, predicted))
    return {
        "outcome_accuracy": sum(a == b for a, b in zip(expected, predicted)) / len(expected),
        "macro_f1": sum(row["f1"] for row in performance) / len(performance),
        "per_intent": performance,
        "confusion_matrix": {"labels": labels, "rows": [
            [sum(a == target and b == actual for a, b in zip(expected, predicted))
             for actual in labels] for target in labels]},
        "false_executable_predictions": false_execution,
        "incorrect_rejections": sum(target in SUPPORTED_INTENTS and actual not in SUPPORTED_INTENTS
                                    for target, actual in zip(expected, predicted)),
        "safe_rejection_rate": (refusal_count - false_execution) / refusal_count if refusal_count else None,
    }


def evaluate_parser(interpreter=parse_question):
    """Check outcome labels AND declared filter expectations; do not train anything."""
    examples = json.loads(EVALUATION_PATH.read_text(encoding="utf-8"))
    rows = []
    parameter_count = parameter_matches = 0
    for example in examples:
        parsed = interpreter(example["question"], today=EVALUATION_DATE,
                                barangays=BARANGAYS, species_names=SPECIES)
        expected = example.get("intent", example["status"])
        actual = parsed.get("intent", parsed["status"])
        mismatches = []
        for path, value in example.get("parameters", {}).items():
            actual_value = parsed.get("parameters", {})
            for key in path.split("."):
                actual_value = actual_value.get(key) if isinstance(actual_value, dict) else None
            parameter_count += 1
            parameter_matches += actual_value == value
            if actual_value != value:
                mismatches.append(path)
        rows.append({"question": example["question"], "expected": expected,
                     "actual": actual, "expected_filters": example.get("parameters", {}),
                     "passed": expected == actual and not mismatches,
                     "parameter_mismatches": mismatches,
                     "normalized_question": normalize_question(example["question"]),
                     "tokens": tokenize_question(example["question"]),
                     "decision": parsed.get("diagnostics", {}).get("decision", "rules"),
                     "explanation": parsed.get("message", "Recognized by the live rule-based parser.")})
    metrics = classification_metrics([row["expected"] for row in rows], [row["actual"] for row in rows])
    return {"engine": "Rule-based live parser", "as_of": EVALUATION_DATE.isoformat(),
            "total": len(rows), "passed": sum(row["passed"] for row in rows),
            **metrics,
            "parameter_accuracy": parameter_matches / parameter_count if parameter_count else None,
            "parameter_checks": parameter_count, "examples": rows,
            "note": "Language interpretation only, using fixed test vocabulary. This does not measure live data completeness or database value correctness. No questions are stored or used to retrain the parser."}


def select_rejection_threshold(expected, predictions):
    """Choose a score cutoff from validation only, never the final test set.

    This exploratory policy maximizes accepted correct executable labels with
    zero validation label errors. With very few examples it is NOT calibrated
    or sufficient evidence to enable production ML. None means abstain.
    """
    best = None
    best_count = 0
    for threshold in sorted({row["confidence"] for row in predictions}):
        accepted = [(target, row) for target, row in zip(expected, predictions)
                    if row["intent"] in SUPPORTED_INTENTS and row["confidence"] >= threshold]
        if accepted and all(target == row["intent"] for target, row in accepted):
            if len(accepted) > best_count:
                best, best_count = threshold, len(accepted)
    return {"threshold": best, "accepted": best_count, "validation_total": len(expected),
            "policy": "Maximum correct executable labels with zero observed validation label errors; exploratory, not calibrated."}


@lru_cache(maxsize=1)
def compare_pipelines():
    """Compare rules, raw ML and rules-first shadow on the checked-in cases.

    Split the separate development corpus into fit / validation examples. The
    model and validation-derived cutoff are frozen before the separate parser
    regression corpus is examined. There is no database access here.
    """
    from sklearn.model_selection import train_test_split
    from .nlp_intent_model import TRAINING_DATA_PATH, _make_pipeline
    from .nlp_pipeline import interpret_question

    development = json.loads(TRAINING_DATA_PATH.read_text(encoding="utf-8"))
    evaluation = json.loads(EVALUATION_PATH.read_text(encoding="utf-8"))
    if ({normalize_question(row["question"]) for row in development}
            & {normalize_question(row["question"]) for row in evaluation}):
        raise ValueError("Training/validation questions overlap the evaluation corpus.")
    fit, validation = train_test_split(development, test_size=0.2, random_state=42,
                                      stratify=[row["intent"] for row in development])
    model = _make_pipeline(fit)

    def predict(examples):
        probabilities = model.predict_proba([row["question"] for row in examples])
        return [{"intent": str(model.classes_[values.argmax()]),
                 "confidence": float(values.max())} for values in probabilities]

    validation_predictions = predict(validation)
    threshold = select_rejection_threshold([row["intent"] for row in validation], validation_predictions)
    predictions = predict(evaluation)
    baseline = evaluate_parser()
    expected = [row["expected"] for row in baseline["examples"]]
    ml_labels = [row["intent"] for row in predictions]
    ml = {"engine": "TF-IDF + logistic regression (raw labels)",
          **classification_metrics(expected, ml_labels),
          "parameter_accuracy": None,
          "note": "The classifier predicts labels only. It has no entity extractor, query values or access authority.",
          "errors": [{"question": row["question"], "expected": target, "actual": actual}
                     for row, target, actual in zip(evaluation, expected, ml_labels) if target != actual]}
    lookup = {row["question"]: prediction for row, prediction in zip(evaluation, predictions)}
    hybrid = evaluate_parser(lambda question, **context: interpret_question(
        question, **context, prediction=lookup[question], threshold=threshold["threshold"]))
    hybrid["engine"] = "Rules-first hybrid shadow"
    return {"baseline": baseline, "ml": ml, "hybrid": hybrid,
            "training": {"fit": len(fit), "validation": len(validation), "test": len(evaluation),
                         "seed": 42, "validation_threshold": threshold,
                         "validation_metrics": classification_metrics(
                             [row["intent"] for row in validation],
                             [row["intent"] for row in validation_predictions])},
            "production_strategy": "rules_first", "ml_routing_enabled": False,
            "decision": "Retain rules. Shadow ML provides no validated new executable requests; this small experiment does not justify live fallback.",
            "limitations": "The regression corpus is developer-maintained, not a blind field study. The stratified validation set is small and probabilities are uncalibrated. End-to-end values and scope are tested separately."}

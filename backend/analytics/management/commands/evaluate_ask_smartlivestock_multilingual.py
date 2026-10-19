"""Compare deterministic rules, TF-IDF and an isolated spaCy model offline."""
import json
import math
import pickle
import statistics
import time
from collections import Counter, defaultdict
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

from analytics.services.nlp_evaluation import (
    BARANGAYS, EVALUATION_DATE, classification_metrics, select_rejection_threshold,
)
from analytics.services.nlp_intent_model import ALLOWED_INTENTS, _make_pipeline
from analytics.services.nlp_query import normalize_question, parse_question
from analytics.services.nlp_spacy_experiment import train_spacy_classifier

DATA_PATH = Path(__file__).resolve().parents[2] / "data" / "ask_smartlivestock_intent_multilingual.json"
SPECIES = ["Cattle", "Carabao", "Goat", "Sheep", "Swine", "Chicken", "Duck"]


def load_corpus():
    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    seen_groups, seen_questions = {}, {}
    rows = {split: [] for split in ("train", "validation", "test")}
    group_counts, language_counts, variant_counts = Counter(), Counter(), Counter()
    intents_by_split = defaultdict(Counter)
    for group in data.get("groups", []):
        split, intent, family = group.get("split"), group.get("intent"), group.get("id")
        if split not in rows or intent not in ALLOWED_INTENTS or not family:
            raise ValueError("Each group needs a known split, allowlisted intent and unique family ID.")
        if family in seen_groups:
            raise ValueError(f"Duplicate paraphrase family ID: {family}")
        seen_groups[family] = split
        if not group.get("examples"):
            raise ValueError(f"Empty paraphrase family: {family}")
        group_counts[split] += 1
        intents_by_split[split][intent] += 1
        for example in group["examples"]:
            language, variant = example.get("language"), example.get("variant")
            question = str(example.get("question", "")).strip()
            if language not in {"en", "tl", "taglish"} or not question:
                raise ValueError(f"Invalid language or empty question in {family}")
            normalized = normalize_question(question)
            if normalized in seen_questions and seen_questions[normalized] != split:
                raise ValueError("Exact normalized question overlaps corpus splits.")
            seen_questions[normalized] = split
            rows[split].append({"question": question, "intent": intent, "language": language,
                                "variant": variant, "family": family})
            language_counts[(split, language)] += 1
            variant_counts[(split, variant)] += 1
    if not rows["train"] or not rows["validation"] or not rows["test"]:
        raise ValueError("Train, validation, and test splits must all contain examples.")
    for split in rows:
        missing = ALLOWED_INTENTS - set(intents_by_split[split])
        if missing:
            raise ValueError(f"{split} split is missing labels: {sorted(missing)}")
    return data, rows, {"groups": dict(group_counts), "languages": {
        split: dict(Counter({language: language_counts[(split, language)] for language in ("en", "tl", "taglish")}))
        for split in rows}, "variants": {split: dict(Counter({variant: variant_counts[(split, variant)] for variant in ("base", "typo")})) for split in rows},
        "intent_groups": {split: dict(intents_by_split[split]) for split in rows}}


def _label_prediction(result):
    return result.get("intent") if result.get("status") == "parsed" else result.get("status")


def _measure_model(predict, examples, expected):
    predictions, latencies = [], []
    for example in examples:
        start = time.perf_counter()
        predictions.append(predict(example["question"]))
        latencies.append((time.perf_counter() - start) * 1000)
    return predictions, {"p50_ms": round(statistics.median(latencies), 4),
                         "p95_ms": round(sorted(latencies)[max(0, math.ceil(.95 * len(latencies)) - 1)], 4)}


def _report_metrics(examples, expected, predicted):
    base = classification_metrics(expected, predicted)
    base.pop("per_intent")
    by_language = {}
    for language in ("en", "tl", "taglish"):
        indexes = [index for index, row in enumerate(examples) if row["language"] == language]
        by_language[language] = classification_metrics([expected[i] for i in indexes], [predicted[i] for i in indexes])
    typo_indexes = [i for i, row in enumerate(examples) if row["variant"] == "typo"]
    base["by_language"] = by_language
    base["typo_variant"] = classification_metrics([expected[i] for i in typo_indexes], [predicted[i] for i in typo_indexes])
    base["intent_metrics"] = classification_metrics(expected, predicted)["per_intent"]
    base["unsupported_clarification_accuracy"] = (
        sum(expected[i] == predicted[i] for i in range(len(expected)) if expected[i] in {"unsupported", "clarification"})
        / sum(label in {"unsupported", "clarification"} for label in expected)
    )
    return base


def _threshold_predictions(raw, cutoff):
    return [row["intent"] if row["intent"] not in {"population_summary", "production_trend",
            "production_breakdown", "disease_by_barangay", "mortality_comparison", "pending_reviews"}
            or (cutoff is not None and row["confidence"] >= cutoff) else "__abstain__" for row in raw]


def evaluate():
    data, splits, distribution = load_corpus()
    fit = splits["train"]
    validation, test = splits["validation"], splits["test"]
    expected_validation = [row["intent"] for row in validation]
    expected_test = [row["intent"] for row in test]
    output = {"dataset": {"source": data.get("source"), "schema_version": data.get("schema_version"),
               "split_method": "paraphrase-family groups are assigned wholly to one split; test was not used for fitting or threshold choice",
               "distribution": distribution}, "seed": 42, "test_count": len(test), "models": {}}

    started = time.perf_counter()
    tfidf = _make_pipeline(fit)
    tfidf_train_seconds = time.perf_counter() - started
    def tfidf_predict(text):
        probs = tfidf.predict_proba([text])[0]
        return {"intent": str(tfidf.classes_[probs.argmax()]), "confidence": float(probs.max())}
    validation_raw, _ = _measure_model(tfidf_predict, validation, expected_validation)
    cutoff = select_rejection_threshold(expected_validation, validation_raw)
    test_raw, latency = _measure_model(tfidf_predict, test, expected_test)
    output["models"]["tfidf_logistic_regression"] = {
        "train_seconds": round(tfidf_train_seconds, 4), "serialized_bytes": len(pickle.dumps(tfidf)),
        "latency": latency, "raw": _report_metrics(test, expected_test, [row["intent"] for row in test_raw]),
        "threshold": cutoff, "abstaining": _report_metrics(test, expected_test, _threshold_predictions(test_raw, cutoff["threshold"])),
    }

    started = time.perf_counter()
    spacy_nlp = train_spacy_classifier(fit)
    spacy_train_seconds = time.perf_counter() - started
    labels = sorted(ALLOWED_INTENTS)
    def spacy_predict(text):
        scores = spacy_nlp(text).cats
        intent = max(labels, key=lambda label: scores.get(label, 0.0))
        return {"intent": intent, "confidence": float(scores.get(intent, 0.0))}
    validation_raw, _ = _measure_model(spacy_predict, validation, expected_validation)
    cutoff = select_rejection_threshold(expected_validation, validation_raw)
    test_raw, latency = _measure_model(spacy_predict, test, expected_test)
    output["models"]["spacy_blank_xx_textcat_bow"] = {
        "version": "3.8.16", "language_pipeline": "blank xx (multilingual tokenizer), no pretrained language model",
        "architecture": "TextCatBOW.v3, word and bigram features", "epochs": 40,
        "train_seconds": round(spacy_train_seconds, 4), "serialized_bytes": len(spacy_nlp.to_bytes()),
        "latency": latency, "raw": _report_metrics(test, expected_test, [row["intent"] for row in test_raw]),
        "threshold": cutoff, "abstaining": _report_metrics(test, expected_test, _threshold_predictions(test_raw, cutoff["threshold"])),
    }

    rules_expected = [row["intent"] for row in test]
    rules_predictions, rule_latency = _measure_model(
        lambda question: _label_prediction(parse_question(question, today=EVALUATION_DATE,
            barangays=BARANGAYS, species_names=SPECIES)), test, rules_expected)
    output["models"]["deterministic_rules"] = {
        "latency": rule_latency, "raw": _report_metrics(test, rules_expected, rules_predictions),
        "note": "Labels reflect parser status/intent using fixed dates and fictional barangays/species; no database query is executed.",
    }
    output["production"] = {"changed": False, "ml_routing_enabled": False,
        "note": "Both classifiers are offline experiments only. Production still relies on deterministic parsing, query allowlists, and backend role/barangay scoping."}
    return output


class Command(BaseCommand):
    help = "Compare the production parser with offline TF-IDF and spaCy multilingual classifiers."

    def handle(self, *args, **options):
        try:
            report = evaluate()
        except (ValueError, RuntimeError, OSError) as exc:
            raise CommandError(str(exc)) from exc
        self.stdout.write(json.dumps(report, indent=2, ensure_ascii=False))

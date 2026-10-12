"""Measure intent classification on the parser's separate held-out questions."""

import json
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix

from analytics.services.nlp_intent_model import (
    ALLOWED_INTENTS,
    TRAINING_DATA_PATH,
    evaluate_intent_classifier,
)
from analytics.services.nlp_query import normalize_question


EVALUATION_DATA_PATH = (
    Path(__file__).resolve().parents[2]
    / "tests"
    / "data"
    / "ask_smartlivestock_eval.json"
)


class Command(BaseCommand):
    help = "Evaluate Ask SmartLivestock intent classification against held-out prompts."

    def handle(self, *args, **options):
        """Report standard classification measures without changing the dataset."""
        examples = json.loads(EVALUATION_DATA_PATH.read_text(encoding="utf-8"))
        training = json.loads(TRAINING_DATA_PATH.read_text(encoding="utf-8"))
        if ({normalize_question(row["question"]) for row in training}
                & {normalize_question(row["question"]) for row in examples}):
            raise CommandError("Training and evaluation contain overlapping questions.")
        expected = [
            example.get("intent") if example["status"] == "parsed" else example["status"]
            for example in examples
        ]
        unsupported_labels = set(expected) - ALLOWED_INTENTS
        if unsupported_labels:
            raise ValueError(f"Evaluation data has unsupported labels: {sorted(unsupported_labels)}")

        self.stdout.write("Offline TF-IDF comparison only; this model does not route live queries.")
        predicted = evaluate_intent_classifier(examples)
        self.stdout.write(f"Held-out questions: {len(examples)}")
        self.stdout.write(f"Intent accuracy: {accuracy_score(expected, predicted):.3f}")
        self.stdout.write("Per-intent precision, recall, and F1:")
        self.stdout.write(classification_report(
            expected,
            predicted,
            labels=sorted(ALLOWED_INTENTS),
            zero_division=0,
        ))
        self.stdout.write("Confusion matrix (labels in alphabetical order):")
        matrix = confusion_matrix(expected, predicted, labels=sorted(ALLOWED_INTENTS))
        self.stdout.write(str(matrix.tolist()))
        self.stdout.write("Misclassified questions (expected -> predicted):")
        for example, target, prediction in zip(examples, expected, predicted):
            if target != prediction:
                self.stdout.write(f"{target} -> {prediction}: {example['question']}")

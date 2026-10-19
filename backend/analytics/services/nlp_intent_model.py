"""Offline TF-IDF + logistic-regression comparison, not the live query engine.

The model chooses only from fixed labels. It never builds ORM queries and it
never grants access; nlp_query.py still validates filters and applies scope.
"""

import json
from functools import lru_cache
from pathlib import Path

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline
from .nlp_query import normalize_question, tokenize_question


TRAINING_DATA_PATH = (
    Path(__file__).resolve().parents[1]
    / "data"
    / "ask_smartlivestock_intent_training.json"
)

# These labels correspond to parser outcomes already backed by real analytics.
ALLOWED_INTENTS = {
    "population_summary",
    "production_trend",
    "production_breakdown",
    "disease_by_barangay",
    "mortality_comparison",
    "pending_reviews",
    "farmer_livestock_count",
    "unsupported",
    "clarification",
}

@lru_cache(maxsize=1)
def _trained_pipeline():
    """Train once per Python process, on the first offline evaluation needing the model.

    TF-IDF learns the vocabulary and word/phrase weights. Logistic regression
    learns how those weighted terms relate to the curated intent labels.
    Caching avoids repeating that small training step during offline evaluation.
    """
    examples = json.loads(TRAINING_DATA_PATH.read_text(encoding="utf-8"))
    return _make_pipeline(examples)


def _make_pipeline(examples):
    """Build a fresh model from one explicitly selected set of reviewed labels."""
    questions = []
    labels = []
    for example in examples:
        question = str(example.get("question", "")).strip()
        intent = example.get("intent")
        if not question or intent not in ALLOWED_INTENTS:
            raise ValueError("Intent training data contains an empty question or unknown label.")
        questions.append(question)
        labels.append(intent)

    # Word unigrams and bigrams let the model learn both single words and
    # useful phrases such as "milk output" or "waiting approval".
    pipeline = make_pipeline(
        TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True,
                        tokenizer=tokenize_question, token_pattern=None,
                        preprocessor=normalize_question, lowercase=False),
        LogisticRegression(max_iter=1000, class_weight="balanced", random_state=42),
    )
    return pipeline.fit(questions, labels)


def classify_intent(question):
    """Return the best label and raw confidence for evaluation and review."""
    model = _trained_pipeline()
    probabilities = model.predict_proba([question])[0]
    ranked = sorted(zip(model.classes_, probabilities), key=lambda item: item[1], reverse=True)
    intent, confidence = ranked[0]
    margin = confidence - ranked[1][1] if len(ranked) > 1 else confidence
    return {
        "intent": intent,
        "confidence": float(confidence),
        "margin": float(margin),
    }


def evaluate_intent_classifier(examples, *, training_examples=None):
    """Predict labels using the baseline file or a caller-supplied reviewed set."""
    model = _trained_pipeline() if training_examples is None else _make_pipeline(training_examples)
    questions = [example["question"] for example in examples]
    predictions = model.predict(questions)
    return [str(prediction) for prediction in predictions]

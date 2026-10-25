"""TF-IDF + logistic regression for question suggestions and offline comparison.

The model chooses only from fixed labels. It never builds ORM queries and it
never grants access; nlp_query.py still validates filters and applies scope.
"""

import json
from functools import lru_cache
from pathlib import Path

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import FeatureUnion, make_pipeline
from threadpoolctl import threadpool_limits
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
    """Train once per process when suggestions or evaluation first need the model.

    TF-IDF learns the vocabulary and word/phrase weights. Logistic regression
    learns how those weighted terms relate to the curated intent labels.
    Caching avoids repeating that small training step during offline evaluation.
    """
    examples = json.loads(TRAINING_DATA_PATH.read_text(encoding="utf-8"))
    return _make_pipeline(examples)


def _make_pipeline(examples, *, use_character_features=True):
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

    # Word features recognize phrases; character fragments tolerate spelling
    # variations without rewriting names, dates, or the user's actual question.
    words = TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True,
                           tokenizer=tokenize_question, token_pattern=None,
                           preprocessor=normalize_question, lowercase=False)
    features = FeatureUnion([
        ("words", words),
        ("characters", TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5),
                                     sublinear_tf=True, preprocessor=normalize_question,
                                     lowercase=False)),
    ]) if use_character_features else words
    pipeline = make_pipeline(
        features,
        LogisticRegression(max_iter=1000, class_weight="balanced", random_state=42),
    )
    # This tiny corpus does not benefit from spawning many BLAS worker threads
    # during the first request in each web process.
    with threadpool_limits(limits=1, user_api="blas"):
        return pipeline.fit(questions, labels)


SUGGESTION_QUESTIONS = {
    "population_summary": ("Livestock population", "Show current livestock population by species."),
    "production_trend": ("Monthly production", "Show monthly milk production for the last six months."),
    "production_breakdown": ("Production breakdown", "Break down production by type."),
    "disease_by_barangay": ("Disease reports", "Show disease cases by barangay this quarter."),
    "mortality_comparison": ("Recorded deaths", "Compare mortality across barangays this quarter."),
    "pending_reviews": ("MAO review queue", "Which submissions are waiting for MAO approval?"),
}


def suggest_questions(question, *, allow_mao_queue=False):
    """Offer up to two draft examples, never execute a classifier prediction.

    The score floor is a UI relevance heuristic, not calibrated confidence or
    a permission check. Every selected draft must be submitted and parsed again.
    """
    model = _trained_pipeline()
    scores = model.predict_proba([question])[0]
    ranked = sorted(zip(model.classes_, scores), key=lambda item: item[1], reverse=True)
    if ranked[0][0] in {"unsupported", "clarification"}:
        return []
    suggestions = []
    for intent, score in ranked:
        if score < 0.20 or intent not in SUGGESTION_QUESTIONS:
            continue
        if intent == "pending_reviews" and not allow_mao_queue:
            continue
        label, example = SUGGESTION_QUESTIONS[intent]
        suggestions.append({"label": label, "question": example})
        if len(suggestions) == 2:
            break
    return suggestions


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

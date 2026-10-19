"""Optional offline spaCy text classifier for multilingual intent experiments.

This module is never imported by the production query path. It trains from
reviewed synthetic examples and predicts only an allowlisted intent label.
"""

SPACY_EXPERIMENT_VERSION = "3.8.16"
RANDOM_SEED = 42
EPOCHS = 40


def train_spacy_classifier(examples):
    try:
        import spacy
        from spacy.training import Example
    except ImportError as exc:
        raise RuntimeError(
            "spaCy experiment dependency is missing; install the optional "
            "analytics/requirements-nlp-experiment.txt file."
        ) from exc

    from .nlp_intent_model import ALLOWED_INTENTS

    spacy.util.fix_random_seed(RANDOM_SEED)
    nlp = spacy.blank("xx")
    textcat = nlp.add_pipe("textcat", config={
        "model": {"@architectures": "spacy.TextCatBOW.v3", "exclusive_classes": True,
                  "ngram_size": 2, "no_output_layer": False},
    })
    for label in sorted(ALLOWED_INTENTS):
        textcat.add_label(label)

    train_examples = []
    for row in examples:
        question, intent = row.get("question", "").strip(), row.get("intent")
        if not question or intent not in ALLOWED_INTENTS:
            raise ValueError("Multilingual training data contains an empty question or unknown label.")
        train_examples.append(Example.from_dict(nlp.make_doc(question), {
            "cats": {label: float(label == intent) for label in sorted(ALLOWED_INTENTS)}
        }))

    optimizer = nlp.initialize(lambda: train_examples)
    for _ in range(EPOCHS):
        losses = {}
        nlp.update(train_examples, sgd=optimizer, drop=0.15, losses=losses)
    return nlp

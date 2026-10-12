"""Rules-first interpretation with optional ML shadow diagnostics.

Production deliberately uses rules. A statistical label is not a validated
request: it cannot supply missing entities, grant permissions or run a query.
The experiment measures whether there is a reason to add a fallback later.
"""
from .nlp_query import SUPPORTED_INTENTS, normalize_question, parse_question, tokenize_question


def interpret_question(question, *, today=None, barangays=(), species_names=(),
                       prediction=None, threshold=None):
    """Run shared language processing, then preserve the validated rule result.

    prediction/threshold are supplied only by offline evaluation. This module
    never imports the ML model, making model failure irrelevant to live queries.
    """
    normalized = normalize_question(question)
    tokens = tokenize_question(normalized)
    parsed = parse_question(question, today=today, barangays=barangays,
                            species_names=species_names)
    diagnostics = {"normalized_question": normalized, "tokens": tokens,
                   "strategy": "rules_first", "decision": "rules",
                   "executable": parsed["status"] == "parsed"}

    if prediction is not None:
        # Shadow mode observes a prediction; it cannot override a rule refusal.
        diagnostics["ml_prediction"] = prediction
        if parsed["status"] == "parsed":
            diagnostics["decision"] = "validated_rules_take_priority"
        elif parsed.get("reason") != "unrecognized_intent":
            diagnostics["decision"] = "deterministic_refusal_preserved"
        elif threshold is None or prediction["confidence"] < threshold:
            diagnostics["decision"] = "ml_abstained"
        elif prediction["intent"] not in SUPPORTED_INTENTS:
            diagnostics["decision"] = "ml_refusal_preserved"
        else:
            # A promising label still has no rule-validated query/filters.
            # Reject instead of manufacturing a request or municipal totals.
            diagnostics["decision"] = "unvalidated_ml_candidate_rejected"
    return {**parsed, "diagnostics": diagnostics}

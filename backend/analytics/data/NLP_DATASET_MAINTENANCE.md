# Ask SmartLivestock NLP dataset workflow

## What is live

`nlp_query.parse_question` remains the authoritative rule-based interpreter.
`nlp_intent_model` is TF-IDF plus Logistic Regression and is used for suggestions
and offline experiments. It does not choose an ORM handler, run user SQL, or
replace backend role/barangay checks. Candidate examples and reviewer events do
not change either production training or routing.

## Add candidate examples

Edit `nlp_candidate_source.py`. Each line is one English / Filipino / Taglish
semantic family, and the explicit train, validation, and test sections must be
kept independent. Use fictional names and locations; do not copy private farm
records. A new corpus version should be created when changing held-out examples
or their labels. Do not reuse a development test set as a final defense result.

Generate and audit the checked-in JSON:

```powershell
pipenv run python manage.py build_ask_smartlivestock_dataset
pipenv run python manage.py build_ask_smartlivestock_dataset --check
```

The audit fails for invalid intents/schema/provenance, duplicate or conflicting
labels, overlap with old corpora, family leakage, or likely near-duplicate
phrasing across splits. Similarities within one split are review flags, not an
automatic relabel. Inspect the report for per-intent/language/split counts and
the 100-example training target shortfall.

## Human review

MAO/Admin users can review training candidates at `/admin/analytics/nlp-example-review`.
Accept/reject actions are append-only `NLPExampleReviewEvent` rows; accepting may
record a corrected utterance and supported intent. Validation and test records
are read-only. A review action is not a training action: the static source and
production training file are untouched. To make a reviewed example part of a
future candidate model, manually curate it into a new versioned source, rerun
the grouped leakage audit, and retain the held-out data untouched.

## Evaluate without promotion

```powershell
pipenv run python manage.py evaluate_ask_smartlivestock_dataset
```

The command trains an offline candidate on the grouped training split, derives
its exploratory rejection threshold from validation only, then compares it
against the current classifier on the same candidate test split. It also reports
per-intent, per-language, difficulty, confidence, parser, entity, and static
handler-contract measures. The JSON report is written to
`nlp_expansion_results.json`. These AI-authored synthetic proposals are not a
blind user study, calibrated probabilities, deployment evidence, or proof of
real-world NLP accuracy. Existing database fixture tests, not this language-only
comparison, establish role restrictions and query values.

## Focused verification

```powershell
pipenv run python manage.py check
pipenv run python manage.py makemigrations --check --dry-run
pipenv run python manage.py test analytics.tests.test_nlp_dataset analytics.tests.test_nlp_query analytics.tests.test_nlp_pipeline analytics.tests.test_nlp_multilingual_data --noinput
```

No command in this workflow promotes the candidate classifier. Production
training/model changes require a separate reviewed change and held-out evidence.

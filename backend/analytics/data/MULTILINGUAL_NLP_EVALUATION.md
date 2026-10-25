# Tagalog and Taglish NLP experiment

## What is running in production

The Ask SmartLivestock component posts an authenticated question to
`POST /api/analytics/nlp-query/`. DRF validates the question and checks its
role permission. `analytics.services.nlp_query.parse_question()` then uses
deterministic rules to recognize a small set of analytics intents, dates,
species, production types, and known barangays. Only fixed analytics handlers
run. Their querysets continue to enforce approved-record and reviewer/barangay
scope. Unrecognized and unsupported requests are rejected or returned for
clarification. TF-IDF can now suggest editable starting questions for unrecognized requests;
its predictions never execute queries. spaCy remains offline only. Neither model creates filters, SQL, ORM expressions, or authority.

The historical measurements below predate the word-plus-character TF-IDF
update; rerun the command for current classifier measurements.

## Synthetic corpus and method

`ask_smartlivestock_intent_multilingual.json` contains 32 paraphrase families
and 128 synthetic questions. Each family contains English, Tagalog, Taglish,
and a Taglish typo. The 16/8/8 family split yields 64 train, 32 validation,
and 32 final-test prompts. All variants stay in their family split. Each split
contains two / one / one paraphrase families per each of the eight allowlisted
labels, respectively. The test set therefore has only one underlying family
per label: results are a small controlled experiment, not a general accuracy
claim. Examples are synthetic and contain no farmer information or livestock
records.

The deterministic parser is run with a fixed date and fictional barangay and
species vocabulary. It performs language interpretation only; this command
does not query the database. TF-IDF + logistic regression and spaCy train only
on the 64 new training prompts. The validation split selects an exploratory
confidence cutoff; test prompts are not used for training or cutoff selection.
The cutoff accepts executable labels only when validation showed no label
errors; the test report also shows low-confidence abstention as a separate
outcome. Small validation data cannot calibrate production confidence.

spaCy uses version 3.8.16, a blank `xx` tokenizer pipeline, and the built-in
`TextCatBOW.v3` bag-of-words/bigram classifier. It downloads no pretrained
language model and is not a Tagalog language model. Training runs for 40 epochs
with seed 42. It is an intent classification baseline, not semantic parsing.
The optional dependency is isolated in `analytics/requirements-nlp-experiment.txt`;
do not add it to the production install unless there is a separate deployment
decision.

## Reproduce

From `backend/` with the project virtual environment and database environment
configured:

```powershell
.\.venv\Scripts\python.exe -m pip install -r analytics/requirements-nlp-experiment.txt
.\.venv\Scripts\python.exe manage.py evaluate_ask_smartlivestock_multilingual
.\.venv\Scripts\python.exe manage.py test analytics.tests.test_nlp_multilingual_data analytics.tests.test_nlp_pipeline analytics.tests.test_nlp_query
```

The JSON output reports accuracy, macro F1, per-label precision/recall/F1,
confusion matrices, English/Tagalog/Taglish and typo slices, refusal handling,
latency, training duration, serialized model size, and the production routing
status. Latency and training duration are local-machine measurements and are
not deployment benchmarks.

## Dataset editing

Add examples under an existing or new paraphrase family. Give every family one
split and one allowlisted label; never move individual variants independently.
Use `unsupported` for a clear request outside implemented analytics and
`clarification` when required meaning or parameters are missing/ambiguous.
Review labels against `nlp_query.py`; do not label illustrative requests as
supported unless the deterministic handler can answer them. Add only synthetic
wording, not copied user questions or personal/production data.

## Results

Measured locally on 2026-10-19 with Python 3.13, scikit-learn 1.9.1, spaCy
3.8.16, and the checked-in 32-question test split:

| Approach | Accuracy | Macro F1 | English | Tagalog | Taglish | Typo variants | Exact unsupported/clarification | False executable labels on 8 refusal cases | Incorrect rejections | p50 / p95 latency | Serialized size |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Deterministic parser | 56% | 0.533 | 75% | 50% | 50% | 50% | 100% | 0/8 | 12 | 0.73 / 1.52 ms | n/a |
| TF-IDF + logistic regression | 78% | 0.749 | 75% | 75% | 81% | 75% | 25% | 3/8 (38%) | 1 | 0.53 / 0.68 ms | 42,845 bytes |
| spaCy blank `xx` + TextCatBOW | 78% | 0.731 | 88% | 75% | 75% | 62% | 25% | 5/8 (63%) | 0 | 0.13 / 0.20 ms | 8,435,453 bytes |

The validation-only confidence policy accepted 12/32 validation examples for
TF-IDF and 9/32 for spaCy. On the final test split, this policy reduced TF-IDF
false executable labels from 3 to 0, while exact accuracy fell from 78% to 66%.
For spaCy, false executable labels fell from 5 to 1 and accuracy fell from 78%
to 62%. Neither is safe to route into production: spaCy still produced a false
executable label on holdout, and the validation set has just one paraphrase
family per class. These are synthetic labels, not measured database answer
quality.

spaCy training took about 2.38 seconds in this local run; TF-IDF took about
0.02 seconds. Model sizes are serialized in-memory representations, not final
wheel or deployment-image sizes. Timing varies by machine and process state.
Do not infer performance from the older 40-question parser regression fixture;
that fixture remains for deterministic regression, while this grouped corpus
is for controlled language comparison.

## Selection and limitations

Production remains rules-only. A predicted label cannot supply validated
filters, determine a user's authorized scope, or bypass query restrictions.
The grouped test is still very small and synthetic, and language labels reflect
the authors' choices rather than a linguist-reviewed benchmark. The blank spaCy
pipeline has no pretrained Tagalog vocabulary or grammar knowledge. The
experiment alone is insufficient evidence to enable classifier fallback.

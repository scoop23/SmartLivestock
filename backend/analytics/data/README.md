# Ask SmartLivestock: interpretation and evaluation

## Actual request flow

`AskSmartLivestock` posts a question through the shared authenticated Axios
client to `POST /api/analytics/nlp-query/`. The DRF serializer limits input to
500 characters. The endpoint and service allow MAO/Admin and SIBAT only.
Rules select an allowlisted operation and validate dates and entities. The
backend applies the existing reviewer scope before aggregating approved
records. The browser displays the returned metadata and values; it does not
calculate municipal totals or generate answers.

Supported operations: current approved-active population (including barangay
and species breakdown), monthly production, production breakdown, disease
cases by barangay, recorded deaths by barangay, and current MAO review queues.
Production categories are milk, meat, eggs and wool; species/category validity
reuses production registration rules. Meat output includes linked slaughter
carcass yield, but there is no separate slaughter-count intent. Sales, owner
counts, individual-animal filters, mortality rates and forecasts are not
implemented here. Owner-query limitations are capabilities, not permissions.
Farmers cannot access this assistant API under its existing policy. SIBAT
scopes remain assigned-barangay or explicit ALL_BARANGAYS; the latter never
grants MAO review-queue authority. Naming all barangays cannot expand scope.

## Review workflow decision

The uncommitted NLP example model, its pending 0002 migration, create/seed/
approve/reject endpoints, and database curation UI have been removed after
checking their dependencies. The read-only MAO/Admin examples page remains at
both `/analytics/nlp-example-review` and `/admin/analytics/nlp-example-review`
for link compatibility. It calls `GET /api/analytics/nlp-evaluation/` and
reports the production parser against checked-in language examples. It does
not review livestock records, collect user questions, grant data access or
train a model. A developer maintains examples with MAO metric guidance and
SIBAT wording feedback.

## Reproducible evaluation

The separate `tests/data/ask_smartlivestock_eval.json` has 40 examples, fixed
at 2026-06-30 with known test vocabulary. It covers the six implemented
intents, English/Taglish, unsupported owner/animal/sales/slaughter requests,
unknown entities, incompatible production types and ambiguous dates/species.
Focused tests add invalid inputs, normalization, rollover/leap boundaries,
missing periods and controlled database results and authorization checks.

From `backend/`:

```powershell
$env:DATABASE_URL = 'sqlite:///:memory:'
.\.venv\Scripts\python.exe manage.py evaluate_ask_smartlivestock
.\.venv\Scripts\python.exe manage.py test analytics.tests.test_nlp_query
```

The first command runs the ACTUAL parser, prints outcomes, filter mismatches,
per-outcome precision/recall and accuracy, and exits unsuccessfully for any
failed expectation. Filter accuracy covers declared expected values, not all
possible entities. The tests use isolated SQLite test records to check the
actual query service and HTTP permissions. Neither establishes completeness
or correctness of live production data. Zero failures on this small curated
regression set is not general natural-language accuracy; maintain separate
unseen questions when comparing future models.

Time uses Django's configured local date. This quarter means the calendar
quarter's start through today; last six months means this month plus the five
preceding calendar months through today. Activity queries with no period
explicitly show a last-12-calendar-months default. Population and queues are
current snapshots. Unrecognized dates request clarification. Missing activity
months are not filled with zero; unlike units are not merged into one chart.

## Offline ML comparison only

`ask_smartlivestock_intent_training.json` has 80 manually labeled language
examples. `nlp_intent_model.py` fits TF-IDF word unigrams/bigrams and logistic
regression only when the offline evaluation command calls it. Live queries
remain rule-based. There is no automatic storage, training, or model routing.

```powershell
.\.venv\Scripts\python.exe manage.py evaluate_ask_smartlivestock_intents
```

This reports raw classifier accuracy, per-label precision/recall/F1 and a
confusion matrix. Labels alone do not evaluate filter extraction, refusals or
query values. Keep training and evaluation questions separate. Do not connect
this prototype to live routing without substantially better independent
validation and safe abstention. Model confidence is not proof of correctness.

## Deployment and manual checks

Fresh evaluation on this revision: the live rules matched 40/40 expected
outcomes and 43/43 declared filters; per-outcome precision and recall were
100% on this curated regression corpus. The offline classifier scored 23/40
(57.5%); clarification recall was only 1/11. It is not ready to route live
queries. The classifier command lists misclassified questions and rejects
exact normalized overlap between training and evaluation examples.

No new schema migration is required by this revision. The removed 0002 was
local and uncommitted; no subsequent migration depends on it. No live Render
migration or data modification was performed. `backend/build.sh` still runs
`manage.py migrate` during deployment, so review deployment changes before
running it. Deploy backend and frontend together for the new evaluation API.
If another environment applied the abandoned 0002, assess that environment
before migration cleanup; this revision does not drop any live table.

Open Advanced Analytics, try cattle population, milk last six months, and
sheep wool. Check the interpreted dates and filters. Try a named farmer,
sold animals, conflicting species and invalid output/species: expect a safe
limitation or clarification. As scoped SIBAT, query all barangays and verify
only authorized rows; MAO queues must be denied. As Farmer, the API remains
denied. On the examples page, check filters, pagination, error retry and
mobile layout. These are manual steps, not claims of browser verification.

## Rules-first pipeline and controlled comparison

See [HYBRID_EVALUATION.md](HYBRID_EVALUATION.md) for the current measured
64-fit / 16-validation / 40-test experiment, methodology and decision. Run
`manage.py evaluate_ask_smartlivestock --compare` for complete JSON metrics.
The older `evaluate_ask_smartlivestock_intents` command is a quick 80-fit
raw-model comparison, not the validation-split experiment. Both use shared
normalization/tokenization and neither enables live ML routing. The evaluation
page now runs the comparison explicitly and shows language-processing steps.

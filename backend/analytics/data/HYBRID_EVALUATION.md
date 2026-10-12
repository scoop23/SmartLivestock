# Ask SmartLivestock hybrid experiment

## Audit and final architecture

The current API accepts MAO/Admin and SIBAT, validates a question of at most 500 characters, resolves vocabulary inside the reviewer scope, and uses existing approved-record query handlers. It supports population_summary, production_trend, production_breakdown, disease_by_barangay, mortality_comparison and pending_reviews. Owner/animal identifiers, sales, separate slaughter counts, rates and forecasts have no assistant handler. Farmer access to this API remains denied; this does not change other Farmer inventory permissions.

Production: question -> shared normalization/tokenization -> rule intent and filter validation -> backend authorization/scoping -> existing analytics handlers -> result metadata -> frontend. The new nlp_pipeline.py wraps the existing parser; it does not duplicate calculations or create a second analytics system. Its executable flag describes interpretation, never permission.

Experiment: the same language stage -> TF-IDF word unigrams/bigrams -> balanced logistic regression -> rules-first shadow decision. Validated rules win conflicts, clarification and capability refusals cannot be overridden, and unvalidated model labels never execute. No ML fallback is enabled. No model confidence is shown in the ordinary Ask panel.

## Methodology

The development corpus has 80 manually labeled language-only examples. A stratified seed-42 split produces 64 fit and 16 validation examples (two per label). Vocabulary and TF-IDF weights fit only the 64 questions. A cutoff is selected using validation predictions, maximizing accepted correct executable labels subject to zero observed label errors. The final 40-question regression corpus is never used to fit this model or select its cutoff. Exact normalized overlap is checked; related paraphrases may remain.

The 40-question corpus was previously used during rule development: it is a regression benchmark, not a blind field study. It contains all six supported intents, English/Taglish, dates, barangays, species, four production types, invalid combinations, ambiguous requests and unsupported owner/animal/sales/slaughter queries. Fixed interpretation date: 2026-06-30. Test fixtures separately cover role restrictions, query values, missing records and periods.

## Measured comparison

| Approach | Outcome accuracy | Macro F1 | Safe refusal rate | Unsafe executable labels | Incorrect rejections |
|---|---:|---:|---:|---:|---:|
| Rules | 100.0% | 1.000 | 100.0% | 0 | 0 |
| Raw ML | 57.5% | 0.576 | 33.3% | 12 | 0 |
| Rules-first shadow | 100.0% | 1.000 | 100.0% | 0 | 0 |

Rules and shadow mode match 43/43 declared filter checks. Raw ML does not extract filters, so its filter accuracy is not applicable. Outcome accuracy includes both supported intents and refusal classes; safe refusal rate counts either clarification or unsupported as a refusal, unlike exact outcome accuracy. Confusion matrices and individual errors are emitted by the JSON command below. These are language results, not verification of live database statistics.

| Outcome | Support | Rules F1 | ML precision | ML recall | ML F1 |
|---|---:|---:|---:|---:|---:|
| clarification | 11 | 1.000 | 1.000 | 0.182 | 0.308 |
| disease_by_barangay | 3 | 1.000 | 0.429 | 1.000 | 0.600 |
| mortality_comparison | 2 | 1.000 | 0.500 | 0.500 | 0.500 |
| pending_reviews | 3 | 1.000 | 0.600 | 1.000 | 0.750 |
| population_summary | 5 | 1.000 | 0.750 | 0.600 | 0.667 |
| production_breakdown | 2 | 1.000 | 0.400 | 1.000 | 0.571 |
| production_trend | 7 | 1.000 | 0.545 | 0.857 | 0.667 |
| unsupported | 7 | 1.000 | 0.750 | 0.429 | 0.545 |

## Decision and limitations

Validation selected cutoff: None; accepted labels: 0/16. None means abstain; no suitable cutoff was found under this policy. These probabilities are uncalibrated. With only two validation examples per label, even a successful cutoff would not establish production reliability.

The shadow pipeline equals rules because it preserves their decisions; that is not evidence that ML improved the system. Raw ML incorrectly assigns executable labels to 12/18 refusal examples. Retain the baseline in production. A future trained fallback needs more independently labeled examples, a separate unseen field test, calibrated or validated abstention, and a reusable rule-validated filter/handler path before routing can be considered.

No individual-farmer handler was added. A farmer-related request reports a capability limitation, while backend roles remain independently enforced. The existing read-only examples page is retained; there is no database approval workflow, stored real query history, or automatic retraining. No migration or production database action is required/performed. scikit-learn was already pinned in backend/requirements.txt; no dependency was added. The installed environment was checked separately; deployment/container execution is not claimed.

## Reproduce and learn

From backend/:

```powershell
$env:DATABASE_URL = 'sqlite:///:memory:'
.\.venv\Scripts\python.exe manage.py evaluate_ask_smartlivestock --compare
.\.venv\Scripts\python.exe manage.py test analytics.tests.test_nlp_query analytics.tests.test_nlp_pipeline
```

The evaluation page offers an explicit Run comparison button and expandable normalization/tokenization steps. Comparison diagnostics are MAO/Admin-only. Reports are cached per process and contain no private farm records. Deploy frontend and backend together; restart the backend after changing versioned datasets. No generated pickle/model artifact is needed.

Learning example: ILANG BAKA ang registered? becomes ilang baka ang registered, then [ilang, baka, ang, registered]. Rules select population_summary and resolve baka to the registered Cattle type. Authorization scopes the approved-active population query; the browser renders returned heads. TF-IDF instead assigns weights to words/phrases; logistic regression predicts a label. That label cannot resolve an owner, approve a record, or grant data access.

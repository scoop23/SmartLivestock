# Ask SmartLivestock NLP and optional explanation audit

> **Historical audit snapshot (26 October 2026).** The request path and permissions described below predate the current Farmer production privacy boundary. Use [the current workflow policy](../../../docs/farmer-production-and-slaughter-workflow.md) and source code for present behavior.

Audit date: 2026-10-26. This report describes the repository at the start of
the optional explanation integration; it does not represent a live-provider
test or a field accuracy study.

## Existing architecture and request flow

`frontend/src/app/components/ask-smartlivestock.tsx` posts the question to
`POST analytics/nlp-query/`. `backend/analytics/views.py:nlp_query` validates
the request and limits access to MAO/Admin and SIBAT/CBAT. It calls
`backend/analytics/services/nlp_query.py:execute_question`, which checks the
role again, resolves only locations visible through `scope_reviewer_queryset`,
and calls `nlp_pipeline.interpret_question`. The live pipeline uses
`parse_question` rules; no classifier prediction can authorize a query. Fixed
ORM handlers produce the answer and chart/table rows.

## Live intents, filters, and access

Live intents in `nlp_query.py:SUPPORTED_INTENTS` are `population_summary`,
`production_trend`, `production_breakdown`, `disease_by_barangay`,
`mortality_comparison`, `pending_reviews`, and `farmer_livestock_count`.
Supported parameters include registered species, production category,
visible barangay, explicit/current/previous calendar periods, grouping, and
some record-status or MAO queue-domain filters. Farmer-specific exact-name or
username counts are MAO/Admin-only. The endpoint itself admits MAO/Admin and
SIBAT/CBAT; farmers and trade roles cannot call it. Activity handlers apply
reviewer scoping and `APPROVED` status. The inventory summary uses the existing
official active-inventory service. Pending-review totals come from the
workflow service and do not expose individual submissions.

## Evaluation and limitations

`nlp_pipeline.py` documents rules-first behavior and keeps experimental ML in
shadow/offline evaluation. Evaluation modules and datasets report language
interpretation and parameter expectations, while `test_nlp_query.py` exercises
real ORM results, approval filters, and role scope. The checked-in examples are
developer-maintained synthetic cases; they are not a blind test or evidence of
field accuracy. The live answer currently uses deterministic text and returns
structured visualization rows. It does not use an LLM.

Measured locally on 2026-10-26 with the checked-in evaluation code:

- Live parser regression corpus: 51/51 expected outcomes and parameter checks
  passed (100% on this small developer-maintained set only).
- Offline TF-IDF + Logistic Regression: 0.529 outcome accuracy and 0.518 macro-F1
  on the same 51 cases; it produced 20 false executable predictions. It remains
  experimental and cannot route production requests.
- Rules-first shadow pipeline: 51/51 on the regression corpus and zero false
  executable predictions because deterministic rules still gate execution.
- Classifier development split: 70 fit / 18 validation / 51 regression cases;
  the validation-derived threshold accepted only 2 of 18 examples and is not
  calibrated evidence of generalization.
- The current live classifier training file has 88 labeled questions with no
  language metadata (10 population, 10 production trend, 10 production
  breakdown, 10 disease, 10 mortality, 9 pending review, 11 clarification,
  10 unsupported, and 8 farmer-count examples). The separate generated
  multilingual candidate corpus has 1,296 unpromoted examples: 144 per label,
  split evenly across `en`, `tl`, and `tl_en`. Candidate examples do not train
  or replace the live rules or model.

These results measure repository fixtures only. They do not establish the
accuracy of real user questions, completeness of municipal records, or the
correctness of every production answer outside the ORM tests.

## Reusable analytics and frontend

The retrieval handlers reuse `population_summary`, `official_inventory`,
`review_workload_summary`, and ORM aggregation for production, disease, and
mortality. The Ask component already displays the factual answer, filters,
period, visualization, and coverage note. The Executive Analytics page embeds
that same component; a second analytics calculation path is unnecessary.

## Change plan and delivered boundary

1. Keep rules, handlers, scope checks, approval filters, and existing response
   fields intact.
2. Add a separate, opt-in Groq explanation call only after a successful,
   non-empty production, disease, or mortality result. Keep personal farmer
   counts and simple population/queue counts on their direct deterministic
   answer.
3. Send only allowlisted aggregate fields, excluding the original question,
   farmer filters, arbitrary result fields, and identifiers. Require a server
   enable flag and explicit data-sharing approval; enforce time and size caps.
4. Reject malformed, long, numeric, or clinical/action-oriented output and
   preserve the database answer on all provider failures.
5. Display the generated paragraph as an explicitly labeled optional
   explanation. No Executive Analytics-specific panel or database migration is
   needed because it shares the Ask component.

The delivered provider adapter was verified with mocked success, malformed
response, ungrounded numeric/clinical output, timeout, and rate-limit cases.
No live provider request was made because no credential or approved deployment
data-sharing configuration was available. The existing database answers stay
usable without an LLM. Generated explanations are currently English-only; the
rules-first parser still accepts the supported English, Filipino, and Taglish
wording independently of this explanation layer.

Verification performed in the local development environment:

- `manage.py test analytics.tests.test_nlp_explanation analytics.tests.test_nlp_query --noinput`: 39 tests passed in the combined run. After adding final numeric-word, incomplete-response, and rate-limit guards, the focused explanation suite passed again: 9 tests.
- `manage.py check`: no issues.
- `manage.py makemigrations --check --dry-run`: no model changes detected.
- Frontend ESLint for Ask SmartLivestock and the NLP example review page: passed.
- `tsc --noEmit`: passed after fixing a union-typed filter label in the NLP
  review page.
- No live API request was issued. Local settings showed the provider disabled,
  data-sharing approval false, and no API key configured.

Groq was selected for the initial adapter because its official docs describe an
OpenAI-compatible chat-completions API, production models, and inference data
that is not retained by default except limited reliability/abuse monitoring.
The reviewed official policy also states that this monitoring can retain data
for up to 30 days unless Zero Data Retention is enabled. Free-tier availability
and quotas can change. Google's Gemini API offers a free tier, but its official
pricing documentation states that free-tier content can be used to improve
products; it is therefore not selected for this aggregate-data integration.
Review provider terms and obtain project/municipal approval before enabling
external transmission. The application default is disabled.

Official references reviewed 2026-10-26:

- Groq OpenAI-compatible API: https://console.groq.com/docs/openai
- Groq data retention: https://console.groq.com/docs/your-data
- Groq rate limits and models: https://console.groq.com/docs/rate-limits and https://console.groq.com/docs/models
- Gemini pricing and data-use tier distinction: https://ai.google.dev/gemini-api/docs/pricing

## Environment variables

Set `SMARTLIVESTOCK_LLM_ENABLED=true`,
`SMARTLIVESTOCK_LLM_DATA_SHARING_APPROVED=true`,
`SMARTLIVESTOCK_LLM_PROVIDER=groq`, `SMARTLIVESTOCK_LLM_MODEL`,
`SMARTLIVESTOCK_LLM_TIMEOUT_SECONDS`, and `GROQ_API_KEY` only after review.
Without these controls and credentials, ordinary database retrieval works and
the optional explanation reports unavailable.

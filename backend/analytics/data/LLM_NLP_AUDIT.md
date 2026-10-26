# Ask SmartLivestock NLP and optional explanation audit

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

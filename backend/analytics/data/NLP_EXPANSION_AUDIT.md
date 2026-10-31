# Ask SmartLivestock baseline (2026-10-26)

> **Historical baseline.** Measurements and implementation details below describe commit `c1ddea7` before the current production privacy changes. They are not current authorization evidence; see [the current Farmer production and slaughter policy](../../../docs/farmer-production-and-slaughter-workflow.md).

Inspected at `c1ddea7`; worktree initially clean. This audit describes source behavior,
not deployed verification or a user study.

## Production path

`AskSmartLivestock` posts `{question}` to `/api/analytics/nlp-query/`.
`AskSmartLivestockSerializer` trims input and limits it to 500 characters.
`execute_question` calls `interpret_question` -> `parse_question`, then fixed ORM
handlers. Rules have final authority. TF-IDF word (1–2) and character (3–5) features
with balanced Logistic Regression (`random_state=42`) supply draft suggestions
and offline classification only. Model fitting is cached per process. No LLM,
spaCy, external service or generated SQL is used to answer requests. The optional
spaCy experiment is a separate blank multilingual text classifier.

## Original datasets and measurements

| Label | Production training | Parser regression |
|---|---:|---:|
| population_summary | 10 | 5 |
| production_trend | 10 | 7 |
| production_breakdown | 10 | 2 |
| disease_by_barangay | 10 | 3 |
| mortality_comparison | 10 | 2 |
| pending_reviews | 9 | 3 |
| farmer_livestock_count | 8 | 8 |
| clarification | 11 | 15 |
| unsupported | 10 | 6 |
| Total | 88 | 51 |

The two original lists have no reliable per-example language/review metadata;
their language distribution is **unannotated**, not inferred as English.
The separate multilingual corpus now contains 144 synthetic questions: 72 train,
36 validation, 36 test, grouped into 18/9/9 families. Each split has 25% English,
25% Filipino (`tl`), 50% Taglish (`taglish`). Farmer-count coverage was added to
each split after the first targeted test run found the label missing. Its small
size still limits estimates.

Executed the unchanged `compare_pipelines`: rules and rules-first shadow matched
51/51 outcomes and declared filters; raw ML accuracy 0.5294117647, macro-F1
0.5184344849. That command randomly stratified 88 rows into 70 fit / 18 validation
and checked only normalized exact overlap against regression. It did not prevent
paraphrase-family leakage. These developer examples are not blind field evidence.

## Intent/query contract

All activity queries require APPROVED status, inclusive `record_date` boundaries,
and `scope_reviewer_queryset`. Timezone: `Asia/Manila`. Missing activity period
defaults visibly to the current month plus the preceding 11 calendar months.
Current month/year/quarter is partial through request date. Missing results mean
no matching stored records, not evidence that no activity occurred.

| Intent / handler | Required / optional parameters | Models and qualifying rows / units | Clarification and limitations |
|---|---|---|---|
| population_summary / _population_results | No required parameter; optional species, one barangay, species/barangay grouping | population_summary -> official_inventory: approved active individual animals, positive quantity; heads | Current snapshot only; no historical population. Unknown/multiple species or locations require clarification. |
| production_trend / _production_results | One production type; optional period, species, barangay | ProductionRecord; quantity, unit, record_date, farmer_at_record; linked slaughter uses carcass_weight | Monthly aggregation; absent months remain absent. Milk LITERS, meat/wool KILOGRAMS, eggs PIECES remain separate. No forecasts, anomaly query or session filter. |
| production_breakdown / _production_results | Breakdown request; optional production type, species, barangay, period, grouping | Same production source; group by type/species/barangay AND unit | Different units never summed into one total; no independent slaughter/auction query. |
| disease_by_barangay / _disease_results | Explicit barangay grouping; optional species, one barangay, period | DiseaseCase: count(id) reports, sum(affected_count) heads | Reports are not diagnoses or forecasts. No disease-name, severity, treatment or clinical-status filter. |
| mortality_comparison / _mortality_results | Explicit barangay grouping; optional species, one barangay, period | MortalityRecord: sum(death_count) deaths, count(id) reports | No rate/individual risk/forecast/cause filter or two-period comparison. |
| pending_reviews / review_workload_summary | Explicit MAO stage; optional one review_domain | Inventory, production, disease, mortality, calving, census, transfers, inspection/clearances, sales per existing workload handoff rules | Current stage-aware counts only; no historical queue, species, production-type or location filter. No automatic approval. |
| farmer_livestock_count / _farmer_livestock_count | Exact farmer full name or username and one registered species; optional registration status | Approved active Farmer account, individual active inventory; default APPROVED, explicit PENDING/VERIFIED/SUBJECT_TO_REVISION allowed | Exact collisions -> ambiguous, partial/unknown -> not_found. No ranking/owner production/animal-ID/history query. |

## Authorization and response contracts

MAO and the supported ADMIN alias can query municipality summaries; SIBAT and CBAT
use assigned barangay unless explicitly configured ALL_BARANGAYS. Missing
assignment yields no scoped rows. Only MAO/Admin may resolve individual farmers
or access MAO queues. FARMER, AUCTION, SLAUGHTERHOUSESTAFF and anonymous requests
are denied by the endpoint and service; no permission expansion is planned.
ADMIN is supported by permission code but is not an enum choice in Role.UserRoles.

Responses use `status`, `question`, `answer`, `results`; answered responses add
`intent`, interpreted filters, period, visualization and coverage_note.
Refusals have empty results. The UI renders clarification/unsupported/ambiguous/
not_found as text and errors for access denial. Conversation context is not sent.
The Admin review page now contains synthetic candidate examples with language,
role, behavior, review-status, intent, and split filters. MAO/Admin decisions
append to `NLPExampleReviewEvent`. Only training candidates can be accepted,
edited, or rejected; validation/test remain frozen. A review event does not
retrain, promote, or modify production training data.

## Main weaknesses and chosen corrections

Sparse examples and missing provenance; no candidate/human review separation;
random comparison split; no near-duplicate checks, language breakdown, calibration
or entity-wise metrics. Date parsing supports months/quarters/years/ISO ranges,
but refuses days/weeks/named months; no silent time inference should be added.
Keyword rules can misinterpret unimplemented filters and override attempts.
## Expansion and offline evaluation (2026-10-26)

`ask_smartlivestock_candidates.json` is deterministically expanded from
`nlp_candidate_source.py`: 1,296 proposed utterances, 9 labels, in 432 semantic
families. Every family has English, Filipino (`tl`) and Taglish (`tl_en`)
siblings. All examples are synthetic candidates pending human review. Training
has 102 utterances per label (918 total), validation 12 per label (108), and
held-out development test 30 per label (270). Each split has equal language
counts. Difficulty totals are 356 easy, 712 medium, 144 hard and 84 adversarial.
No exact, normalized, cross-split near-duplicate, or label-conflict errors were
found against this corpus and the three existing NLP corpora. Seven similar
same-split Filipino pairs are flagged for human review. The 100-per-intent
training minimum is met; all examples remain unreviewed proposals.

`evaluate_ask_smartlivestock_dataset` ran on the same 270 held-out candidate
utterances. Original production TF-IDF + Logistic Regression accuracy was
75.56% (macro-F1 71.88%); a freshly fit offline candidate reached 87.04%
(macro-F1 85.23%). The largest remaining classifier gap was
`clarification` (F1 32.6%); other intent F1 values ranged from 83.1% to 100%.
Candidate classifier accuracy by language was English 84.4%, Filipino 90.0%,
and Taglish 86.7%. This is a developmental, synthetic set whose labels were authored with
knowledge of the rules; it is not a blind or representative field sample and
does not establish generalization.

On that same set, the committed parser had macro-F1 53.87% and matched 51.48%
of the declared intent and handler contracts; current rules after focused
vocabulary fixes had macro-F1 64.72% and matched 62.22%. This remains weak and does not mean the classifier can execute those
questions. Entity exact-match accuracy, scored only where a field is declared,
was species 88.1%, barangay 98.6%, production type 93.8%, grouping 72.9%, period
start 45.0%, period end 47.5%, review domain 43.3%, and approval status 44.4%.
The poor date/domain fields need reviewed examples and/or parser work; the
candidate data and test set must not be used to claim those features work.
End-to-end database values and permissions remain separately covered by the
existing fixture-based Django query tests and new role/review API tests.

The original live production training file and query routing are unchanged.
No classifier is promoted. See `NLP_DATASET_MAINTENANCE.md` for repeatable build,
audit, review, evaluation, tests, and the safe model-promotion boundary.

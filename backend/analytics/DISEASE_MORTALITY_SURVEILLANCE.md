# Disease and mortality surveillance

## Scope and data rules

`GET /api/analytics/surveillance/` returns operational review indicators for authenticated MAO/Admin and SIBAT/CBAT users. Each queryset uses `scope_reviewer_queryset`; field reviewers see only the barangays allowed by their assigned scope. The endpoint is read-only.

Only final `APPROVED` disease and mortality records with an event `record_date` in the analysis window contribute to dated totals. Pending, verified-only, returned, undated, future-dated, and known analytics seed-marked rows do not contribute. Undated approved row counts are returned separately. A disease report is one report; `affected_count` is a reported head count and repeated disease reports are not deduplicated because the model has no episode identifier. Distinct identified livestock are counted separately from affected heads. Mortality `death_count` uses each linked individual animal once across repeated reports; any count not represented by animal IDs remains a reported aggregate count.

Disease `name` is free text, while `clinical_status` means resolution (`NOT_RECORDED`, `OPEN`, `RECOVERED`, or `CLOSED`). Neither field certifies a suspected/confirmed epidemiological case. The dashboard shows labels as recorded and groups clinical resolution separately.

Although `MortalityRecord` has an optional herd field, the current mortality serializer rejects herd-only submissions and requires exact individual animal IDs. A historic/imported aggregate count without IDs cannot be de-duplicated reliably and remains a reported aggregate count.

## Periods and indicators

- The latest complete week is Monday through Sunday immediately before the current week. It is compared with the preceding complete Monday-Sunday week.
- Fourteen-day daily counts and 14/30-day summaries end on the current local date and are labeled partial.
- The weekly history contains the latest 12 complete weeks.
- Counts are approved database reports, not estimated incidence. Reporting completeness is not captured, so zero reports mean no matching records were found, not that no cases or deaths occurred.
- Barangay attribution comes from the current farmer/holder relationship because disease and mortality records do not snapshot their event-time barangay. It is geographic context, not a transmission link.

## Alert rules

Alerts compare approved record counts for the latest complete week with the preceding complete week. A zero-to-positive change is `WATCH`; an increase is `WATCH`; a count at least twice the prior count and at least two records higher is `ELEVATED`; equal/lower recorded activity is `NORMAL`. If both comparison weeks have zero reports, the result is `INSUFFICIENT_DATA`. These defaults are operational heuristics in `services/surveillance.py` (`ELEVATED_MULTIPLIER`, `ELEVATED_MIN_INCREASE`), not veterinary thresholds and not validated outbreak criteria. They identify changes in recorded activity only.

## Mortality rate

For the trailing 30 days:

`estimated mortality rate (%) = approved recorded deaths / current approved active individual inventory heads × 100`

The denominator reuses `official_inventory(user)`: approved, active individual rows with positive quantity. Herd containers and legacy aggregate batch inventory rows are not added on top of individual animals. A zero denominator returns no rate. This is a current-inventory estimate, not a historical population-at-risk rate. The repository has no reliable opening population snapshot or complete immutable event ledger to reconstruct historical population at risk.

## Disease and mortality associations

The service reports disease events dated strictly before an approved death report, within 30 days, when the records share an explicit disease link, the same individual livestock, a herd, or a current barangay. It displays event dates, days between records, recorded disease label, recorded death cause, and relationship type. Same-barangay matches are broad context. No match is interpreted as causation. Association output is capped at 100 event pairs.

## Experimental monthly forecast comparison

`GET /api/analytics/surveillance/forecast-experiment/` runs a separate, on-demand, role-scoped experiment for three distinct targets: disease report counts (`CASES`), disease affected heads (`HEADS`), and mortality deaths (`HEADS`). It forecasts one month ahead. It does not use current inventory as a historical population denominator or produce mortality rates.

### Candidates and features

The response compares the existing monthly candidate selected using only pre-cutoff expanding-window evaluation, a simple naive/seasonal-naive candidate, a calendar-only linear regression, and a separate experimental linear regression. The enhanced candidate adds the existing target's last three observed monthly values, their calendar age, and separate disease-report and affected-head counts for the preceding 7, 14, and 30 days. Mortality forecasts also receive separate mortality-death counts for those windows. Windows are `[cutoff - N days, cutoff)` by local event date. Overlapping windows are independent predictors and are not summed. Affected heads and disease report counts never share a unit.

The model keeps empty event windows missing (`null`/NaN), with a paired report-presence indicator. That indicator means at least one eligible approved report was present; it does not mean reporting was complete. No reporting-coverage ledger exists, so a no-report window is not interpreted as zero activity. When a feature has some observed values in a training fold, median imputation is fit on that fold's training rows only and the missingness indicator remains in the model. Features entirely missing in the fold are omitted. Missing monthly target periods are not filled with zero, and lag features retain the gap age rather than pretending the latest observation was the prior calendar month.

### Availability and leakage controls

Rows must currently be `APPROVED`, have an event date, and not carry an `AI_SEED` marker. Historical training and surveillance inputs additionally require non-null `reviewed_at <= cutoff`, and events must precede the cutoff day. A row without a review timestamp may contribute to an eventual observed outcome only; it cannot be a training input. Current partial-month rows are excluded from target outcomes. Each fold's target history and surveillance features are reconstructed at that fold's cutoff. Only target months with observed records are scored, because an empty month cannot be distinguished from incomplete reporting.

The database's `reviewed_at` stores the latest review time, not immutable approval history. Current status plus `reviewed_at <= cutoff` is a conservative availability proxy; it cannot reconstruct an earlier approval later replaced by revision/review, nor prove exactly when a row first became visible. Record links to animals/herds are incomplete, so animal/herd-level predictors are omitted. Current-inventory mortality rates are not used. These constraints make any measured comparison exploratory rather than proof of real-world predictive value.

### Readiness, evaluation, and interpretation

The endpoint returns readiness per target. `INSUFFICIENT_TRAINING_DATA` means fewer than 12 eligible monthly training observations; `MISSING_SURVEILLANCE_DATA` means no eligible surveillance feature has been observed in the training fold; `MODEL_FIT_FAILED` means fitting failed safely. A candidate forecast appears only if a candidate is trainable. This implementation readiness is separate from having enough history to train, and both are separate from evidence of improved accuracy.

Evaluation uses expanding chronological origins, one-month-ahead predictions, and the same eligible target months for the selected existing model and enhanced candidate. Each row includes cutoff, target month, actual, predictions, and absolute/squared errors. MAE is `mean(abs(actual - prediction))`; RMSE is `sqrt(mean((actual - prediction)^2))`. Metrics are null when there are no shared predictions; zero valid periods returns `INSUFFICIENT_EVALUATION_DATA`, not zero error. Fewer than 12 shared periods is labeled experimental/inconclusive. A directional comparison requires at least 12 periods, a 10% aggregate MAE difference, and a consistent per-period direction; this rule is an experiment heuristic, not a validated model-selection standard. Excluded periods and missing timestamp counts are returned.

Run the comparison by requesting the endpoint from the existing authorized analytics dashboard or directly as an authorized MAO/Admin or scoped SIBAT/CBAT user. It is on demand; it is not triggered by unrelated dashboard requests. The enhanced candidate is never automatically promoted, and its fit or evaluation cannot change production forecasts, model selection, stored forecasts, or recommendation rules. Synthetic demo rows are excluded and are never evidence of model performance. An implemented enhanced model is not necessarily a validated or more accurate model. Establishing improvement requires years or sufficient months of consistent real approved observations, reliable approval history, and reporting-coverage data so that absent records can be interpreted.

## GIS and interpretation

The dashboard links to the existing role-scoped GIS disease and mortality layers. GIS simulation is a separate MAO/Admin capability; this module contains observed approved records only. Alerts and associations are prompts for authorized personnel to verify records and follow local surveillance procedures, not diagnoses or official status changes.

## Dedicated surveillance dashboard demo seed

Apply the migrations first and identify the exact development or staging database before previewing or running the command. For local PostgreSQL, from `backend`:

```powershell
$env:SMARTLIVESTOCK_ENV_FILE = ".env.local"
$env:SMARTLIVESTOCK_DEMO_ENV = "development"
$env:SMARTLIVESTOCK_DEMO_DATABASE_ACK = "development:smart_livestock"
python manage.py migrate
python manage.py seed_surveillance_demo --dry-run
python manage.py seed_surveillance_demo
```

The acknowledgement must match the database name Django actually uses. Development mode refuses non-local PostgreSQL. Production is refused; a remote staging database requires explicit staging identification and the exact database acknowledgement. To remove the fixture without recreating it, cleanup also requires `SMARTLIVESTOCK_DEMO_ALLOW_CLEANUP=YES`:

```powershell
$env:SMARTLIVESTOCK_DEMO_ALLOW_CLEANUP = "YES"
python manage.py seed_surveillance_demo --clean
```

The command reuses four existing barangays (three with generated scenarios and one empty-data scope), an existing livestock type, and an active MAO/Admin reviewer. It creates inactive, password-disabled synthetic farmer accounts, farmer profiles, herds, individual livestock, and disease/mortality reports, all tagged with `AI_SEED::SURVEILLANCE_DEMO::V1`. It does not alter or delete pre-existing users, farmers, livestock, or barangays. It refuses to run if it cannot find four distinct barangays with no approved disease reports in the two comparison weeks. Cleanup checks every dependent row against the ownership ledger and stops without deleting if an unowned row refers to a seed-owned object. Disease and mortality submissions pass through the real serializers and review-transition validator; approved mortality also calls the existing inventory reconciliation service. The models do not retain an immutable verification history, so the seed does not invent one.

The scenarios use the service's exact Monday-Sunday week boundaries:

| Scenario | Previous week | Latest week | Expected disease alert |
| --- | ---: | ---: | --- |
| Normal | 2 reports / 3 affected heads | 1 report / 4 affected heads | `NORMAL` |
| Watch | 2 reports / 3 affected heads | 3 reports / 4 affected heads | `WATCH` |
| Elevated | 2 reports / 3 affected heads | 5 reports / 8 affected heads | `ELEVATED` |
| Insufficient data | no matching reports | no matching reports | `INSUFFICIENT_DATA` |

The association fixture also demonstrates same-animal, same-herd, and same-current-barangay temporal matches, including a 30-day interval. Causes and disease labels are synthetic recorded values; no pair claims disease caused a death. Use a SIBAT/CBAT account assigned to each scenario barangay to see that scenario's alert in isolation. A municipality-wide MAO/Admin view combines records from all scenarios into one alert. Synthetic disease labels start with `DEMO ONLY`, and the ownership marker is retained in review remarks. Seed-owned animals are included in the current-inventory mortality denominator; any resulting rate remains the service's explicitly labeled estimate, not a historical population-at-risk rate.

The model has nullable animal/herd links for legacy aggregate mortality rows, but the current mortality serializer requires identified animals and `reconcile_approved_mortality()` refuses approval without them. The command therefore does not fabricate an approved linkless aggregate row. The existing surveillance tests exercise the zero-denominator behavior without corrupting inventory. Empty weeks still mean only that no matching reports were found; this seed creates no reporting-coverage history and does not prove zero disease or mortality.

These are synthetic operational fixtures for checking dashboard counts and alert rules. They do not validate real-world disease prevalence, outbreak prediction, the alert thresholds, or monthly forecast accuracy. The existing monthly forecasting pipeline remains unchanged, and the service continues to report forecast comparison as not established.

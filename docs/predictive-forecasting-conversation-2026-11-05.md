# Predictive analytics conversation review — 5 November 2026

This is a review summary of the conversation, rather than a verbatim transcript. Implementation and verification details below cover the forecasting and seed work inspected during this session. Earlier topics are recorded as discussion context, not as a new audit of those features.

## Earlier discussion context

The conversation covered descriptive analytics, disease trends, GIS lookback periods, disease follow-up and resolution, cattle prices, livestock sales, ownership transfers, milk forecast eligibility, and predictive-page wording. Preferences included understandable labels, fewer redundant tabs, lighter backgrounds, history-range controls, registered/external cattle price views, and optional external-animal breed and weight information. These earlier topics require their own source/runtime checks before claiming their current implementation is verified.

## What we wanted to understand

The main forecasting question was why disease estimates stayed flat even though completed monthly history contains both quiet months and spikes. We also discussed whether Seasonal Naive, ARIMA, Holt-Winters, Random Forest, or a count model would help.

Complete monthly reporting and historical availability are separate requirements. A month can be fully reported today while its records were unavailable at an earlier simulated forecast date. Backtesting must preserve that distinction.

## Display actual model names

The predictive dashboard previously translated names such as `Naive Baseline` to `Simple forecast`, and `ARIMA` to `Trend and pattern method`. The display now uses the backend's model name directly. A missing selection shows `Not selected`. Generic comparison copy now refers to the baseline.

Source: `frontend/src/app/components/analytics/futuristic-predictive-dashboard.tsx`.

## Quiet months and forecasting

- A confirmed, fully reported zero month is valid history. A missing report is not proof of zero cases.
- Naive Baseline repeats the latest observed value throughout the forecast horizon. A last observation of 5 can therefore produce a flat six-month estimate of 5.
- Seasonal Naive reuses the same calendar month from the previous year, with persistence if that month is absent.
- Seasonal patterns can help estimate recurring quiet periods. Irregular outbreaks cannot be scheduled reliably from monthly totals alone.
- A count forecast estimates an expected quantity; a fractional expected count does not represent part of an animal. It does not guarantee the exact next zero month.
- Disease report totals and affected-head totals are separate targets. A report can involve multiple animals, and repeated episodes can involve the same animals.

## How Random Forest uses time

Random Forest itself is a regression model. The system creates time-related inputs for each monthly training row:

1. Elapsed calendar months from the start of the history.
2. Sine and cosine features representing the annual month cycle.
3. Counts from the previous one, two, and three months.
4. A rolling mean of the previous three counts.

Each target is fitted separately. Future predictions are recursive: once a month has been predicted, that estimate supplies lag information for later forecast months. Evaluation uses the same prediction implementation and hides future actual counts from training. Errors can accumulate over longer horizons.

Source: `backend/analytics/services/predictive/models.py`, `forecast_candidate` and `TabularRandomForest`; feature preparation is in `data.py`.

## Negative Binomial addition

Negative Binomial was added as a candidate for the disease domain, including report counts and affected-head counts. It uses month-of-year sine/cosine features and the logarithm of the previous count. It estimates dispersion from the training data and regularizes the coefficients to limit unstable fits on short histories. Later months use recursively predicted prior counts.

The implementation handles constant and all-zero training histories explicitly. It estimates expected counts; it is not a hidden-transmission detector or an epidemiological simulation. It does not use weather, incubation periods, wastewater, or laboratory information.

Existing candidates remain in the comparison. Negative Binomial is not forced to win. Selection uses chronological validation error and comparison against the existing baselines.

Files changed:

- `backend/analytics/services/predictive/models.py`
- `backend/analytics/services/predictive/evaluation.py`
- `backend/analytics/services/predictive/diagnostics.py`

## Seed problem and cause

The local database contained 24 completed reporting months. However, `seed_disease_mortality_analytics_demo` created synthetic historical disease and mortality events with current creation/review timestamps. Its synthetic monthly coverage confirmations also used current timestamps.

For example, a synthetic event dated November 2024 had creation and approval timestamps on 5 November 2026. At a simulated cutoff of 1 May 2026, those records correctly could not be used. One inspected cutoff excluded all 18 earlier months because their availability dates were on or after that cutoff. This produced no valid historical comparison and left the system using the unvalidated Naive Baseline fallback.

The seed responsible was **not** `seed_forecast_quality_demo`. Ownership was traced through `SurveillanceDemoOwnership`, the `disease-mortality-analytics-v1:` prefix, and the disease/mortality seed markers.

## Seed correction and local repair

The seed now creates an explicit simulated historical timeline:

| Event | Simulated time |
|---|---|
| Submission/creation | Event date, 08:00 |
| CBAT verification | Event date, 14:00 |
| MAO approval | Event date, 17:00 |
| Monthly coverage confirmation | Last day of the month, 23:00 |

Times use the configured Django timezone. `auto_now_add` creation timestamps are restored through explicit updates. Demo inspection details include `SIMULATED_HISTORICAL_AVAILABILITY` so these timestamps are not mistaken for evidence of historical field activity.

An in-place `--repair-timestamps` option avoids deleting and recreating records. It supports `--dry-run`. It requires the ownership-ledger prefix, expected markers, approved status, and synthetic verification metadata. Owned coverage containing unowned or incompatible events is skipped. Existing database safety checks still apply.

Local repair performed:

- 468 synthetic disease reports.
- 216 synthetic mortality records.
- 856 synthetic coverage confirmations.
- No mixed coverage periods needed to be skipped in this run.

The repair ran in a transaction. Before/after snapshots confirmed that unowned disease, mortality, and coverage records were unchanged. Disease counts were not altered to improve the score.

Source: `backend/analytics/management/commands/seed_disease_mortality_analytics_demo.py`.

To preview a future repair, from `backend`, with the repository's local environment and the database acknowledgements required by `smartlivestock/seed_safety.py`:

```powershell
$env:SMARTLIVESTOCK_ENV_FILE = '.env.local'
..\.venv\Scripts\python.exe manage.py seed_disease_mortality_analytics_demo --repair-timestamps --dry-run
```

After reviewing the preview, omit `--dry-run` to apply the repair. Do not use this command to backdate real operational records.

## Observed model comparison after repair

The local administrator-scoped check evaluated one six-month historical window using the 24-month dataset. These are results from synthetic demo history, as observed on 5 November 2026, and may change with data or code changes.

| Candidate | Disease report MAE | Affected-head MAE |
|---|---:|---:|
| Naive Baseline | 19.00 | 19.00 |
| Seasonal Naive | 9.67 | 9.67 |
| Linear Regression | 13.53 | 13.53 |
| **Random Forest** | **7.36** | **7.36** |
| ARIMA | 10.68 | 10.68 |
| Holt-Winters | 11.30 | 11.30 |
| Negative Binomial | 10.08 | 10.08 |

MAE means average absolute error in the target's units. Random Forest was selected because it had the lowest error in this check. Seasonal Naive was the strongest baseline. Neither Seasonal Naive nor Negative Binomial was omitted or automatically selected.

At the time of this initial comparison, the seed used an affected count of one per synthetic disease report, which explains why these two targets produced identical demo scores. This does not imply their real-world quantities are interchangeable. The subsequent enrichment below corrects this demo limitation.

One historical window provides limited evidence. These results demonstrate the workflow; they do not establish real-world outbreak accuracy or prove Random Forest is universally best.

## Verification performed

- Frontend TypeScript check and whitespace check after the method-name change.
- Django system checks after the model and seed changes.
- Focused execution of the Negative Binomial candidate with all-zero, constant, and seasonal spike histories.
- Synthetic chronological comparison of Naive Baseline, Seasonal Naive, and Negative Binomial.
- Local database ownership inspection, repair preview, transactional repair, and unowned-row preservation checks.
- Local disease report and affected-head model evaluation after repair.

No full test suite or browser rendering check was performed for this work.

## Rule to retain for future seeds

Seed a coherent historical workflow, not just historical event dates. Preserve real timestamps and historical-availability safeguards. Mark simulated timelines, repair only owned demo data, retain confirmed zero months, and report actual validation coverage instead of forcing a preferred method or score.

## Subsequent update: distinguish reports from affected heads

The user requested representative multi-head disease demo reports. The seed now automatically enriches disease fixtures with a deterministic mix of individual reports (one affected head) and herd reports (two to six affected heads). Each demo herd has six separately registered, active synthetic animals. The ordinary disease serializer validates ownership and herd population limits before fixture updates.

Existing owned demo reports can be enriched without recreation:

```powershell
..\.venv\Scripts\python.exe manage.py seed_disease_mortality_analytics_demo --enrich-disease-heads --dry-run
..\.venv\Scripts\python.exe manage.py seed_disease_mortality_analytics_demo --enrich-disease-heads
```

Use the same local/staging environment and seed database acknowledgements described above. The enrichment is transactional and repeatable. Herds and members are added to the ownership ledger and included in scoped cleanup. Existing report IDs, monthly report counts, dates, approval status, coverage confirmations, and quiet months are preserved. Original individually registered animals retain their individual one-head quantities.

Applied local demo totals:

- 468 reports: 172 individual reports and 296 herd reports.
- 1,358 affected heads across those reports; this is an episode total, not a unique-animal count.
- 36 synthetic herds, each with six active individual cattle.

Before/after checks confirmed unowned disease, mortality, coverage, inventory, and herd rows were unchanged. All report dates/status and coverage rows were unchanged. Every herd report passed the active-population bound, and a repeat run created no duplicate owned objects.

Backend diagnostics returned distinct histories and forecasts for the two targets. In the administrator-scoped six-month forecast, the first future estimate was 38.4 reports versus 108.8 affected heads. Both still selected Random Forest, with different MAEs (7.36 reports and 23.69 heads) in the single available historical window. These replace the identical-target behavior above; they remain synthetic demonstration results. Django system checks passed; browser rendering and full test suites were not run.

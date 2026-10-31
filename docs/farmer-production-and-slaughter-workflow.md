# Farmer production logs and slaughter reports

New milk, meat-yield, egg, and wool entries in `ProductionRecord` are saved as
`RECORDED`. They belong to the farmer's own production history and do not create
a SIBAT/CBAT verification task or MAO production-approval task. The farmer can
correct a recorded entry. Older `PENDING`, `VERIFIED`, `APPROVED`, and returned
records and their workflow events remain unchanged for historical context. The
legacy review endpoint no longer processes routine production logs. Municipal
record-list endpoints exclude `RECORDED` entries; authorized aggregate summaries
may include their totals under the recorded-data policy.

Milk anomaly assessment is an advisory comparison against the same animal's
earlier recorded sessions. An unusual result does not
block saving, change the queue, or prove inaccurate reporting. The seven-day
forecast predicts daily totals and is not compared with one milking session.
Farmer analytics and authorized municipal production summaries include
`RECORDED` logs only. Historical approval-state, pending, verified, and returned
legacy review states remain outside those totals. Municipal dashboards label
these as farmer-recorded production; they are not official slaughter totals.
The production forecast dataset uses a `RECORDED` log's submission timestamp
(`created_at`) for historical cutoffs. Historical approval-state rows are
excluded; a municipality does not receive Farmer production forecasts.

Ask SmartLivestock applies a stricter access boundary than municipal summary
reports: MAO/Admin, SIBAT, and CBAT cannot query Farmer milk or individual
Farmer meat-yield `ProductionRecord` rows through the NLP assistant, including
totals, trends, groupings, or charts. Those roles also cannot request production
forecasts, forecast-readiness diagnostics, or production recommendations derived
from these private logs. The NLP endpoint returns a permission-aware explanation
without running a production query or sending results to the optional explanation
provider. A Farmer can query only records owned by their Farmer profile (with
the authenticated creator as a legacy fallback); the handler also filters by
`RECORDED` status. Explicit references to another Farmer are denied. Official
slaughter summaries remain a separate workflow and
are not substituted for Farmer meat yield by Ask SmartLivestock.

The rules-first NLP parser can still recognize supported production question
shapes, but recognition does not grant access. Municipal production questions
are refused before a `ProductionRecord` query. Pending MAO review questions use
the review-workload service, whose production source is empty for the routine
Farmer log workflow. Population, disease, mortality, and authorized review
workload intents remain available according to their existing role and barangay
scope. The checked-in NLP language/evaluation examples measure parsing only; they
do not establish that an intent is authorized for every role.

An individual Farmer meat-yield entry submitted with exact selected animal IDs
creates one linked `SlaughterRecord` in `PENDING`. This is a **Farmer-reported,
unverified slaughter notice**, visible to assigned SIBAT/CBAT officers in their
barangay and to MAO/Admin. Field officers have read-only visibility. MAO/Admin
review the official slaughter record in the slaughter queue. Approval reconciles
the exact selected animals once; returning it asks the farmer to correct the
linked meat entry, which resubmits the same slaughter record. The personal
production record stays `RECORDED` throughout, and the animals stay active until
approval. Batch or aggregate Farmer meat-yield entries without exact animal IDs
do not change individual inventory. Facility-entered aggregate slaughter totals
retain their separate workflow and do not change individual inventory.

The `RECORDED` status preserves new farmer entries without marking them as
municipally approved. Historical review statuses and their events are retained;
analytics includes only `RECORDED` production rows. Existing historical approval-state
rows remain stored for audit/history but are excluded from current analytics and forecasts.
Deployments must apply the existing status migration before using code that
writes `RECORDED`. The demo seed refuses to rewrite an old tracked scenario;
clean and reseed **only synthetic demo data** after confirming the intended
local database.

Calving keeps its existing field verification and MAO approval because approval
creates a registered calf in livestock inventory. Weight logs already save
without a production approval stage. Existing breeding and insemination entries
remain farmer-owned and start as `PENDING_CHECK` (exposed/awaiting pregnancy
check). The create form cannot mark an animal pregnant or calved. Only the
dedicated pregnancy-confirmation endpoint, used by the Farmer owner or an
authorized barangay-scoped municipal reviewer, can set `PREGNANT`; a repeat
confirmation preserves the original method/date and does not duplicate the
notification. Pregnancy confirmation fields are not writable through the general
create/update serializer. The `CALVED` state is set when a calving record is
linked to that breeding cycle, not by a manual breeding-status edit.

Breeding analytics count only `PREGNANT` records as active pregnancies and due
soon. `PENDING_CHECK` counts and its due dates are returned separately as
awaiting-check estimates. The Farmer interface labels due dates as estimates and
does not include pending-check entries in pregnancy progress lists or pregnancy
recommendations. Saving a breeding entry notifies the Farmer of its estimated
due date; marking pregnancy confirmed sends another notice. The daily
`send_breeding_due_notifications` command sends one reminder in the 8–30 day
window, one in the 1–7 day window, on the estimated due date, and once up to 30
days afterward. It only sends reminders for entries marked `PREGNANT`; record
locking and a due-window key prevent duplicate sends from overlapping scheduler
runs. Configure the deployment scheduler to run the command daily.

Calving submission and its existing field-verification/MAO workflow are
unchanged.

## Verification performed

Local verification on 31 October 2026 (no live deployment or production database
was accessed):

```powershell
cd backend
.\.venv\Scripts\python.exe manage.py test analytics.tests.test_nlp_query analytics.test_predictive analytics.test_diagnostics analytics.tests.test_aggregate_analytics production.test_farmer_logs production.tests production.test_reproductive_management production.test_breeding_insemination --verbosity 0
```

Result after the final changes: 172 tests passed in 147.185 seconds. Forecast
fixtures emitted statsmodels convergence warnings, and two tests logged
simulated notification/persistence errors; the command completed with `OK`.

The extra Farmer production, slaughter, calving, and reproductive API smoke
checks were run separately:

```powershell
cd backend
.\.venv\Scripts\python.exe manage.py test production.test_breeding_insemination production.test_reproductive_management production.test_farmer_logs livestock.test_freeze_workflows.FreezeWorkflowTests.test_routine_milk_record_is_recorded_and_not_queued_for_review livestock.test_freeze_workflows.FreezeWorkflowTests.test_partial_slaughter_one_projection_and_no_mortality livestock.test_freeze_workflows.FreezeWorkflowTests.test_mortality_and_calving_reconciliation --verbosity 1
```

Result: 33 tests passed in 41.623 seconds.

```powershell
cd backend
.\.venv\Scripts\python.exe manage.py check
.\.venv\Scripts\python.exe manage.py makemigrations --check --dry-run
```

Results: no Django system issues and no model changes requiring migrations.

```powershell
cd frontend
npm run lint -- 'src/app/(admin)/slaughter-record-review/slaughter-review-queue.tsx' 'src/app/(farmer)/production-dashboard/page.tsx' 'src/app/(farmer)/production-dashboard/production-record-dialog.tsx' 'src/app/(farmer)/production-dashboard/production-recent.tsx' 'src/app/(farmer)/production-dashboard/production-wizard.tsx' 'src/app/(farmer)/production-dashboard/components/breeding-registration-dialog.tsx' 'src/app/(farmer)/production-dashboard/production-breeding-tab.tsx' 'src/app/(farmer)/production-dashboard/analytics/page.tsx' 'src/app/components/analytics/forecast-readiness-dashboard.tsx' 'src/app/components/ask-smartlivestock.tsx'
```

Result: ESLint exited with code 0 on all ten affected frontend files, with 27
existing unused-variable / dependency warnings across the two large Farmer
analytics pages.

`npx tsc --noEmit --incremental false` was also run. It reports two existing
TypeScript errors in `src/app/(farmer)/report-observation/components/report-illness-dialog.tsx`
(lines 692 and 709: missing `isLoadingDiseaseCases`); it reports no errors in
the files changed for this workflow.

`git diff --check` passed. `manage.py check` reported no issues, and
`makemigrations --check --dry-run` reported no model changes.

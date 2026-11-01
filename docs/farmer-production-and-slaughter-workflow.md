# Farmer production logs and slaughter reports

New milk, meat-yield, egg, and wool entries in `ProductionRecord` are saved as
`RECORDED`. They belong to the farmer's own production history and do not create
a SIBAT/CBAT verification task or MAO production-approval task. The farmer can
correct a recorded entry. Older `PENDING`, `VERIFIED`, `APPROVED`, and returned
records and their workflow events remain unchanged for historical context. The
legacy review endpoint no longer processes routine production logs. The API
allows only the owning Farmer to list, retrieve, or edit these records; municipal
and field roles are denied before a `ProductionRecord` query.

Milk anomaly assessment is an advisory comparison against the same animal's
earlier recorded sessions. An unusual result does not
block saving, change the queue, or prove inaccurate reporting. Farmer analytics
include only that Farmer's `RECORDED` logs; historical approval-state, pending,
verified, and returned legacy review states remain outside those totals.
Municipal analytics, GIS, reports, exports, and production forecast endpoints
do not query these logs. Official slaughter totals remain a separate municipal
dataset.

Ask SmartLivestock is available only to MAO-role users. Farmer, SIBAT, CBAT,
Admin, Auction, and slaughterhouse accounts have no assistant access through the
interface or API. Even MAO cannot query Farmer milk or individual Farmer
meat-yield `ProductionRecord` rows, including totals, trends, groupings, or
charts. Restricted production questions return a permission-aware explanation
before a production query runs or any result reaches the optional explanation
provider. Municipal users also cannot request production forecasts,
forecast-readiness diagnostics, or recommendations derived from those private
logs. Official slaughter records remain a separate municipal dataset and are
not substituted for Farmer meat yield by Ask SmartLivestock.

The rules-first NLP parser can still recognize supported question shapes, but
recognition does not grant access. Production questions are refused before a
`ProductionRecord` query. Pending MAO review questions use the review-workload
service, whose production source is empty for the routine Farmer log workflow.
MAO can use the assistant for its other supported population, disease,
mortality, and review-workload intents. The checked-in NLP language/evaluation
examples measure parsing and role responses separately; they do not establish
that an intent is authorized for every role.

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

Breeding entries start as `PENDING_CHECK`; this is distinct from `EXPOSED`, which
is derived only when an eligible active female and eligible active bull share
the same active herd. Neither state means pregnant. Breeding analytics count
only evidence-backed `PREGNANT` records as active pregnancies and due soon.
Pending checks are returned separately, and their due dates are estimates only.
Saving a breeding entry notifies the Farmer of its estimated due date; marking
pregnancy confirmed sends another notice. The daily
`send_breeding_due_notifications` command sends one reminder in the 8â€“30 day
window, one in the 1â€“7 day window, on the estimated due date, and once up to 30
days afterward. It only sends reminders for entries marked `PREGNANT`; record
locking and a due-window key prevent duplicate sends from overlapping scheduler
runs. Configure the deployment scheduler to run the command daily.

Calving may be submitted even without a previous pregnancy confirmation. The
submission must still pass dam ownership, identity, age, duplicate, and review
validation. It links the calving event to the dam and, when applicable, the
current breeding cycle. Approval creates one active calf inventory record in an
atomic, retry-safe reconciliation; the calf is initially unassigned to a herd.
Submission, correction, resubmission, verification, return, and approval are
recorded as append-only workflow events. A return does not erase the original
submission history.

## Verification performed

Local verification on 1 November 2026. Django tests used the configured test
database; no live deployment or production database was accessed.

```powershell
cd backend
.\.venv\Scripts\python.exe manage.py test livestock.test_herd_membership production.test_reproductive_management production.test_breeding_insemination production.tests --verbosity 1
```

Result: 85 tests passed. This covers farmer herd membership changes and the
reproductive, calving, and production API regressions in those modules.

The production privacy, analytics/report, Ask SmartLivestock, import, and
cross-role access regressions were also run:

```powershell
cd backend
.\.venv\Scripts\python.exe manage.py test analytics.tests.test_aggregate_analytics analytics.tests.test_reports analytics.tests.test_nlp_query analytics.test_diagnostics data_imports.tests.test_data_imports users.test_access_scope --verbosity 1
```

Result: 128 tests passed in 159.370 seconds. Predictive fixtures seeded and
removed synthetic records in the test database.

```powershell
cd backend
.\.venv\Scripts\python.exe manage.py check
.\.venv\Scripts\python.exe manage.py makemigrations --check --dry-run
```

Results: no Django system issues and no model changes requiring additional
migrations.

```powershell
cd frontend
npx tsc --noEmit --incremental false
```

Result: TypeScript passed with no errors.

A targeted ESLint run across changed frontend files reported three
`react-hooks/set-state-in-effect` errors in the existing URL/highlight
synchronization effects in `src/app/(admin)/data-validation/page.tsx`, plus ten
unused-variable warnings in the affected overview and reproductive components.
The chart component passed lint independently. These lint items are not covered
by the test results.

The full backend suite, frontend production build, and browser/deployment
checks were not run.
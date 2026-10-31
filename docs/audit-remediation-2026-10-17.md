# Audit remediation — 17 October 2026

> **Historical remediation record (17 October 2026).** This records changes and checks from that date only; it is not current workflow, deployment, or test verification.

Applies to the local working tree based on `ddd87bf`. No commit or deployment was
created. Pre-existing Farmer report/header notification edits were preserved;
the Farmer detail dialog received only the shared follow-up panel and a clearer
approval label. Operational records were not modified. The user-approved hosted
schema migrations are recorded below.

## Finding disposition

| Finding | Change | Verification / limit |
|---|---|---|
| A01: prescriptive disease scope | Use the shared reviewer scope and exclude future reports | Disposable local/remote disease fixtures passed |
| A02: refresh replay | Enable SimpleJWT blacklist application | Old refresh rejected after rotation in a disposable migrated database; vendor migrations applied to configured Render database after user approval |
| A03: historical disease labeled active | Keep historical totals; recent surveillance counts use approved reports in the last 90 days without a recorded resolution | Historical/recent separation and explicit recovery exclusion passed |
| A04: Docker/API path mismatch | Origin-only Docker defaults; normalize trailing `/api` in older configured API bases | Mocked client URL checks passed |
| A05: missing dependencies | Correct the audit's interpreter selection; use `backend/.venv` | Forecasting/PDF/R2 packages already exist there; no installation needed |
| A06: CBAT login | Route CBAT to `/sibat`; align token role type | TypeScript and isolated browser sign-in passed |
| A07: weights | Validate positive weight/non-future dates; synchronize from latest dated measurement under an animal lock | Negative/zero/future/backdated probes passed |
| A08: GIS GET writes | Remove reference-data insertion from GIS read service | Captured GIS queries contained no INSERT/UPDATE/DELETE |
| A09: forecast horizon | Validate 1–12 months before model imports; safe 500 responses for service errors | Invalid/nonpositive/excessive inputs returned 400 |
| A10: misleading readiness | Report per-rule readiness and partial results; explicit UI explanation; use scoped React Query server state | Service probe and TypeScript passed |
| A11: vaccination semantics | Label recorded dates and administrative record-review trigger; state that immunity/booster validity is unknown | No unapproved clinical expiry rules added |
| A12: duplicate slaughter race | Lock the species row around the aggregate endpoint's duplicate check and insert | Sequential 201/409 behavior passed; concurrent PostgreSQL verification remains outstanding |
| A13: cross-backend replay | Keep mutations and authenticated reads on their configured backend; honor configured fallback for public reads | Mocked POST/PATCH/DELETE/authenticated GET remained pinned |
| A14: failing existing checks | Repair frontend harness imports/chart expectations; update individual inventory/tag fixtures and Auction/MAO certificate tests | 118 selected backend tests and 28 existing frontend tests passed; broad repository lint backlog remains |
| A15: role/docs/metadata drift | Correct staff notification redirect, CBAT login, title/description, scope/census/transfer documentation; expand scoped CBAT inventory and health alerts as requested | Source/type checks and scoped recipient regression checks passed |

The corrected ownership regression also exposed an actual exception-handling gap:
a duplicate certificate insert could poison an enclosing transaction. The insert
now has an atomic savepoint before its integrity error is handled. Ownership
policy remains unchanged: Auction encodes, MAO/Admin approves, and the seller's
historical animal is marked SOLD. The buyer registers acquired inventory separately.

## Checks performed

- Backend environment: `backend/.venv/Scripts/python.exe`.
- Django system check: passed.
- `makemigrations --check --dry-run` with in-memory SQLite configuration: passed;
  no model changes detected.
- Selected existing suites: **118 tests passed**, using disposable SQLite and an
  in-process fast password hasher. This does not verify PostgreSQL locking.
  Modules: `users.test_access_scope`, `users.test_community_activities`,
  `livestock.test_domain_integrity`, `livestock.test_ownership_transfers`,
  `analytics.tests.test_reports`, `analytics.tests.test_nlp_query`,
  `analytics.tests.test_gis_scoping`.
- Existing frontend checks: **28 tests passed**.
- TypeScript: `npx.cmd tsc --noEmit --incremental false` passed.
- Targeted lint passed for the shared API client, root/admin layouts and
  prescriptive component. The login page still has its pre-existing remembered-email
  initialization lint issue; the repository-wide lint backlog is not cleared.
- Disposable probes verified scoping, readiness, read-only GIS, horizon validation,
  weight validation/order, token replay rejection and aggregate duplicate responses.
- Client probes verified API base normalization, request pinning and configured
  public fallback without making network calls.
- `git diff --check`: passed.

## Deployment action and remaining boundaries

Before starting the updated backend, apply SimpleJWT's blacklist migrations against
the **intended** database. From `backend/` on Windows:

```powershell
.\.venv\Scripts\python.exe manage.py migrate
```

The existing deployment build scripts already run migrations. After explicit
user approval, the configured Render database received diseases.0010 and the
SimpleJWT blacklist migrations successfully. Periodically run
`manage.py flushexpiredtokens` to remove expired token records. Logout still clears
the browser session; this change guarantees rotation revocation, not universal
server-side logout revocation.

Remaining: broad lint cleanup, print verification, concurrent PostgreSQL checks,
cloud storage and deployment verification. Vaccine-specific validity rules still
require approved requirements. Claims about complete scientific validation or
full production readiness remain unsupported.

## Approved disease follow-up workflow and frontend

The user approved Farmer observations followed by official CBAT/MAO resolution,
and requested both inventory and health notifications for scoped CBAT accounts.

- New reports start `OPEN`; historical records retain `NOT_RECORDED` without
  inventing clinical outcomes. `RECOVERED` and `CLOSED` are explicit outcomes.
- After MAO approval, the Farmer can append a dated observation. Only scoped
  CBAT or MAO/Admin can record an official outcome with required remarks.
  SIBAT may read the history but has no resolution authority.
- The endpoint enforces ownership/scope, roles, report state, date bounds and
  immutable history. A transaction locks the case while an outcome is recorded.
  Resolved cases reject further updates; new concerns require a new report.
- One shared panel uses the existing shadcn Card, Badge, Select, Input, Textarea
  and Button components in Farmer, field-officer and MAO report dialogs.
  React Query refreshes history, notifications and affected surveillance data.
- Resolved cases remain historical and leave recent unresolved GIS and
  prescriptive surveillance counts. Counts are reports, not confirmed diagnoses.
- Scoped CBAT now receives inventory creation/resubmission and health alerts.
  Production notification permissions were not broadened.

Additional verification used an isolated local SQLite database and synthetic
accounts only. The configured hosted database was not used for browser fixtures.
The Farmer submitted an observation through the UI, CBAT signed in successfully
and recorded recovery, and both dated entries remained in the read-only history.
MAO also recorded `CLOSED` through the incident detail dialog, with its dated
officer-attributed history visible afterward. At 390px, the dialog and page fit
the viewport without horizontal overflow.
Escape closed the Farmer dialog. Native print preview has not been verified.

The combined selected backend run executed 139 checks: 138 passed and one older
mortality fixture used the obsolete single-animal request format. After changing
that fixture to the current `livestocks` payload, all 21 disease checks passed.
The other 118 checks passed in the combined run. All 28 frontend checks passed,
TypeScript passed, and targeted lint passed for the new shared panel and selected
changed shared components. Full repository lint remains an existing backlog;
this work does not claim a clean full lint run or a verified production build.
The final full lint scan reported 248 errors and 433 warnings, down from this
turn's baseline of 307 errors and 434 warnings. CommonJS test harnesses use a
scoped rule override; application lint rules remain enabled.

The new `diseases.0010_disease_case_follow_ups` migration and SimpleJWT blacklist
migrations must be applied to the intended deployment database before serving
updated code. The migration matched Django's model state and ran successfully
in the isolated QA database. Following user approval, these migrations were also
applied successfully to the configured Render database. Application deployment
has not been performed. No historical migrations were rewritten.

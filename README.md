# SmartLivestock Batangas

SmartLivestock is a capstone livestock information system for municipal operations
in Padre Garcia, Batangas. It connects Farmer submissions, field verification,
municipal approval, inventory monitoring, reporting, GIS and decision support.

This README describes the current source implementation. A feature listed here
is not automatically certified as production-ready or scientifically validated.
See [verification and remediation notes](docs/audit-remediation-2026-10-17.md)
for the checks performed and their limits.

## Roles and responsibilities

| Role | Main responsibilities |
|---|---|
| Farmer | Register owned animals; submit production, health and mortality records; view remarks; book programs; submit case follow-up observations. |
| SIBAT | Verify permitted field submissions within the assigned scope; submit quarterly census; manage scoped programs and review queues. |
| CBAT | View and verify permitted inventory records; receive scoped inventory and health notifications; view health reports; record approved-case resolution. |
| MAO | Manage registration documents/accounts and assignments; make municipal approval decisions; manage programs, reports and analytics; record case resolution. |
| Auction | Encode inspection/intake and ownership certificates; correct returned submissions; use gate/registry tools. |
| Slaughterhouse staff | Submit and correct their aggregate slaughter totals; view permitted records. |

Backend authorization also recognizes `ADMIN` on designated municipal operations
where that role is provisioned. It is not a public registration option. SIBAT/CBAT
scope is an assigned barangay or an explicitly granted `ALL_BARANGAYS` setting.
Expanded scope does not grant MAO final approval authority.

## Record workflows

Most Farmer declarations use these review stages:

```text
PENDING -> SIBAT verification -> VERIFIED -> MAO/Admin approval -> APPROVED
   \                              \
    +-------- SUBJECT_TO_REVISION -+ -> corrected/resubmitted -> PENDING
```

CBAT may verify inventory where the backend grants that action. Health-report
verification remains with SIBAT; final municipal approval remains with MAO/Admin.
Returned records require remarks. Editing and deletion depend on role, ownership
and record state, enforced by the backend.

Current review workflows do not expose a terminal `REJECTED` transition;
corrections use `SUBJECT_TO_REVISION` and can be resubmitted. Some frontend views
still recognize `REJECTED` to display legacy records without treating them as
active review work.

Census is submitted by SIBAT as `VERIFIED`, then approved or returned by MAO/Admin.
Auction inspection and ownership certificates have their own municipal review
paths. Do not assume every domain uses an identical sequence.

### Disease follow-up and resolution

Review approval and clinical resolution are separate:

1. A Farmer submits a health observation through the existing review workflow.
2. After municipal approval, the Farmer can send a dated follow-up observation
   or describe improvement. This does not close or resolve the case.
3. An authorized, scoped CBAT officer or MAO/Admin records `RECOVERED` or `CLOSED`
   with a date and required remarks.
4. Append-only history retains the observation, officer, role, date and notes.
   A resolved case remains in historical reports and leaves recent unresolved
   surveillance counts. A new concern requires a new health report.

Existing/imported cases with no recorded resolution retain `NOT_RECORDED`;
new Farmer-submitted cases start `OPEN`. No automatic clinical recovery period
or vaccine-specific booster validity is assumed. SIBAT can view the history but
cannot perform the new official-resolution action.

See [clinical and notification requirements](docs/clinical-and-notification-requirements.md)
for the approved policy and remaining MAO decisions. Vaccine-specific validity
remains pending an approved schedule.

The shared shadcn follow-up panel is available in Farmer report details, field
health-report details, and MAO incident review/detail dialogs. CBAT receives
inventory and health alerts within its authorized scope, including follow-up
requests. Notification ownership remains enforced server-side.

### Inventory and ownership

- Official current population counts approved, active **individual animals** with
  positive quantity. An individual record represents one head.
- Herd/batch containers group animals; they are not additional heads. Census
  snapshots and legacy aggregate `BATCH` inventory are not added to current population.
- Approval state and operational state are separate. Approved animals can later
  become sold, deceased, slaughtered or moved out through supported workflows.
- Approved calving, mortality and sales reconciliation uses transactions and
  idempotency markers to prevent repeated inventory updates.
- An approved ownership certificate marks the seller's original inventory row
  `SOLD` and preserves its history. A registered buyer submits acquired inventory
  separately; approval does not reassign the seller's original row.
- Birth dates may be unknown. Age is derived from a known date rather than invented
  for legacy animals. Weight logs preserve dated measurements; a backdated entry
  does not replace a newer current weight.

## Implemented modules

| Area | Source modules and interfaces |
|---|---|
| Registration and users | Farmer registration, document review, account status, assignments, JWT login/refresh and password recovery. |
| Livestock | Individual registry, herd membership/photos, QR identity, census, ownership certificates and gate records. |
| Production | Species-appropriate milk/meat/eggs/wool records, weight logs, calving, live sales and supported inventory events. |
| Health | Disease/mortality reporting, verification and approval, evidence, case follow-up and official resolution. |
| Auction and slaughterhouse | Inspection/clearance workflows, approved public clearance verification, aggregate slaughter totals and municipal review. |
| Community | Announcements, published public shares, programs, offered times, bookings, capacity and attendance. |
| Monitoring | Scoped notifications, dashboards, report previews, server-side PDF/XLSX exports and GIS layers. |
| Imports | Role-restricted validation/import stages, templates, batch history and error downloads. |
| Decision support | Aggregate forecasting, real and synthetic individual milk experiments, deterministic recommendations and constrained natural-language queries. |

Facility slaughter totals and Farmer-linked slaughter/production events are
separate data sources. A facility total does not automatically remove animals
from Farmer inventory.

## Analytics and AI boundaries

- **Descriptive:** counts and aggregates derive from stored, authorized records;
  official population follows the individual-animal rules above.
- **Aggregate forecasts:** scoped approved monthly data, baseline comparisons,
  chronological rolling-origin evaluation, and candidate statistical/ML models.
  Forecast horizons are validated from 1 to 12 months. Insufficient history is
  reported explicitly; a forecast output alone does not establish field accuracy.
- **Individual milk:** the real-history path checks animal eligibility and requires
  sufficient approved daily records. Synthetic demo cows/data are a separate,
  explicitly selected source; demo scores are not operational validation results.
- **Prescriptive advice:** transparent administrative rules with evidence and
  per-rule readiness. Partial evaluation is distinct from no alerts.
- **Vaccination:** recorded dates indicate record coverage, not current immunity
  or booster validity. No clinical expiry schedule is inferred.
- **GIS disease layer:** the legacy API key `active_cases` counts approved reports
  in the last 90 days that have no recorded recovered/closed outcome. Historical
  totals remain separate. This is a surveillance proxy, not a diagnosis.
- **GIS simulation:** an illustrative spatial scenario with distance, wind and
  density assumptions. Hypothetical seeds are labeled. Normalized pressure is
  not an infection probability or a scientifically calibrated epidemic forecast.
- **Ask SmartLivestock:** live retrieval uses allowlisted, rules-first parsing and
  scoped ORM queries. A separate TF-IDF/logistic-regression experiment is used for
  offline comparison; it is not the live general-purpose language engine.

## Technology and source layout

Dependency manifests currently declare Django **6.0.7**, DRF **3.17.1**,
SimpleJWT **5.5.1**, Next.js **16.2.4** and React **19.2.4**. The backend uses
Python 3.13; Docker uses Node 24 for the frontend. PostgreSQL is used by the
configured hosted deployment; local development can use PostgreSQL or SQLite.
Frontend server state uses TanStack Query; forms use the existing React/shadcn
patterns, Tailwind, Radix primitives and Sonner.

```text
backend/
  users/           accounts, documents, community and notifications
  livestock/       inventory, herds, census, ownership and reconciliation
  production/      output, weight, birth, sale and slaughter workflows
  diseases/        health/mortality reports and case follow-up
  movements/       inspections and clearances
  analytics/       aggregates, exports, forecasting, GIS and NLP
  data_imports/    validate/import pipeline
  smartlivestock/ settings, routing, storage and shared workflow rules
frontend/
  src/app/         App Router pages and role layouts
  src/components/  shared components, shadcn primitives and GIS
  src/lib/         HTTP client, shared types/utilities and cache helpers
  tests/           existing Node-based frontend regression harnesses
docs/              workflow and verification notes
```

## Local setup on Windows

Run backend commands from `backend/` using its own environment. The repository-root
`.venv` is a different environment and may lack required packages.

```powershell
cd backend
# For a new checkout/environment:
py -3.13 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
# Only if .env does not already exist:
Copy-Item .env.example .env
```

Set a unique long `SECRET_KEY` and the intended `DATABASE_URL` in `backend/.env`.
The example uses `sqlite:///local.sqlite3` for a local development database.
Never overwrite an existing environment file or commit credentials.

```powershell
.\.venv\Scripts\python.exe manage.py check
.\.venv\Scripts\python.exe manage.py migrate --plan
# Confirm the target database before applying:
.\.venv\Scripts\python.exe manage.py migrate
.\.venv\Scripts\python.exe manage.py runserver
```

Migrations include SimpleJWT blacklist tables and the disease follow-up schema.
Refresh rotation rejects the old refresh token after the new one is issued.
Logout currently clears the browser session. Use the built-in
`manage.py flushexpiredtokens` command for periodic expired-token maintenance.

In a second terminal:

```powershell
cd frontend
npm.cmd ci
$env:NEXT_PUBLIC_API_URL='http://localhost:8000'
npm.cmd run dev
```

Open [localhost:3000](http://localhost:3000). Use the backend **origin** as the API
base; clients support `/api/...` authentication and legacy domain paths. Older
trailing `/api` base values are normalized. `NEXT_PUBLIC_*` values are embedded
at frontend build time.

Do not run seed or cleanup commands against operational data. Management commands
under each app's `management/commands` directory include synthetic/demo seeders;
inspect the specific command before using it in an explicitly disposable database.
No assertion is made that every record in an existing database is synthetic.

### Optional services

- Password recovery needs `FRONTEND_URL` and working SMTP settings in production.
  Local DEBUG configuration can use console emails.
- R2 needs real access/secret keys, bucket and endpoint (or account ID). Leave
  optional credentials blank for local filesystem storage. Uploaded identity
  documents use an authenticated streaming endpoint; bucket policy still needs
  deployment verification.
- `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS` and HTTPS/cookie
  settings must match the deployment. Never copy DEBUG development settings into
  production without reviewing them.
- Authenticated reads and mutations stay on the configured backend. Only eligible
  public reads may use the configured fallback. Local cloud fallback is opt-in.

### Docker and deployment

`docker compose up --build` selects development targets and a local PostgreSQL
service. Review root `.env.example` for local overrides. The frontend API base
is `http://localhost:8000` without an extra `/api` suffix.

Production Docker targets use Gunicorn for Django and a Next production build.
The production frontend build requires a public backend URL, for example:
`docker build --build-arg NEXT_PUBLIC_API_URL=https://api.example.org -f frontend/Dockerfile frontend`.
Migration execution, persistent media/R2, SMTP, static files and HTTPS also need
explicit deployment configuration. The existing
`build.sh` scripts install requirements, collect static files and apply migrations;
root `start.sh` starts development processes.

An optional `NEXT_OUTPUT_DIR=.next-qa` can isolate a second local frontend's cache
without stopping an existing developer server. Reset it for ordinary builds.

## API areas

Canonical prefixes are below; many domain routes also retain unprefixed aliases.

| Prefix | Main use |
|---|---|
| `/api/token/`, `/api/token/refresh/` | Login and access-token refresh |
| `/api/users/` | Registration, profile, account/document review and assignment |
| `/api/livestock/` | Inventory, herds, census, ownership and gate operations |
| `/api/production/` | Production, weights, sales, calving and slaughter totals |
| `/api/diseases/` | Disease/mortality submissions and review |
| `/api/diseases/cases/<id>/follow-ups/` | GET authorized case history; POST Farmer update or authorized recovered/closed event |
| `/api/inspections/`, `/api/movements/` | Inspection, resubmission, review and clearance verification |
| `/api/community/` | Announcements, schedules and bookings |
| `/api/notifications/` | User-owned notification list/read/delete |
| `/api/analytics/` | Dashboard, reports, GIS, forecast and NLP services |
| `/api/data-imports/` | Templates, validation, imports and batch results |

## Verification

Use focused checks appropriate to the change rather than a full build after each edit.

```powershell
# From backend/:
.\.venv\Scripts\python.exe manage.py check
.\.venv\Scripts\python.exe manage.py makemigrations --check --dry-run
.\.venv\Scripts\python.exe manage.py test diseases.test_follow_ups users.test_access_scope --noinput

# From frontend/:
npx.cmd tsc --noEmit --incremental false
node --test tests/*.test.cjs
npm.cmd run lint
# For release/build readiness when needed:
npm.cmd run build
```

The Django settings switch `manage.py test` to a disposable in-memory SQLite test
database. This does not establish PostgreSQL concurrency behavior. The optional
ML/weather packages are required for their respective runtime features, even when
Django's baseline system check passes.

[Remediation notes](docs/audit-remediation-2026-10-17.md) distinguish executed checks,
known lint debt, local browser checks and unavailable production/cloud verification.
Remaining limits include broad lint cleanup, true PostgreSQL race checks, live cloud
storage/deployment checks, and any clinical vaccine rules not yet supplied by MAO.

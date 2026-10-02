# SmartLivestock Admin data consistency audit

Audit date: 2026-10-02. Code baseline: `6a75410` on `main`. Source code, relevant Git changes, configured PostgreSQL aggregates, and isolated regression fixtures were examined. No real records were modified, reseeded, deleted, or reapproved.

## Root causes found

1. **Competing population calculations.** Dashboard's main KPI used the backend approved/active quantity sum, but its charts rebuilt counts from raw inventory. Data Overview's barangay matrix used its own calculation. Sharing only the top KPI did not make these other consumers consistent.
2. **Operational status lost in the overview projection.** Overview requested inactive records, then dropped operational status and counted approval alone. Approved SOLD/DECEASED/SLAUGHTERED/MOVED_OUT records could enter its current barangay population. Historical records remain available, with operational status now displayed.
3. **Species lost or relabeled.** Overview summed four familiar categories and used the all-species total only when that sum was zero. A mixed barangay could therefore omit poultry and other species. Dashboard omitted poultry from its donut and mapped unknown species to cattle. Dashboard now retains actual species names; presentation categories preserve all heads.
4. **Stale and independent caches.** Successful review/reconciliation actions invalidated validation lists without invalidating dashboard analytics or overview herd lists. The five-minute inventory cache also differed from other pages' shorter caches. Summaries now refresh after successful mutations; canceled old responses cannot replace refreshed data.
5. **Loading/error fallback totals.** Overview did not wait for its authoritative summary. Its fallback total could appear first and change when another request arrived. Validation fetchers swallowed failed or partial requests as empty arrays. Failed requests now produce errors rather than authoritative zero totals.
6. **Different raiser definitions.** Overview used the maximum of approved directory accounts and distinct farmer display names collected from records. Equal names could merge people, and non-directory record names could inflate registered raisers. Both summaries now count approved FARMER accounts with actual Farmer profiles, grouped by barangay FK.
7. **Wrong period and unit for monthly milk.** Overview added all approved production quantities, including different dates and units. Dashboard's error fallback admitted VERIFIED milk and all dates. Both monthly dairy consumers now use approved MILK/LITERS records dated within the current month through today.
8. **Invented operational figures.** Overview displayed static safety/vaccination/inspection percentages, fixed sales prices, fixed per-unit production valuations, and invented slaughter weights. The affected metrics now use recorded fields, approved aggregates, saved valuation snapshots, or explicit unavailable labels. Review approval is no longer shown as proof of quarantine.
9. **Herd fallback counting.** The farmer dashboard could count a supposedly standalone herd in addition to its inventory representation, including inventing one head for an empty herd. Herds are now excluded as an additional population source.
10. **Backend source mixing was possible.** The shared HTTP client supports request-local fallback to another host. This is a verified code path, not a demonstrated cause of the observed 302-head snapshot. Municipal summary/detail reads now use the existing failover guard so a failed read stays an error rather than switching databases. Concurrent edits to the shared client were preserved.

No mutation-on-GET, automatic seed/startup behavior, MAO barangay restriction, or population-from-current-page bug was found in the traced Admin paths. Seeds/truncation are explicit management commands. Repeated summary GETs were verified to perform no INSERT/UPDATE/DELETE.

## Metric/source map

| Consumer | Source/model | Meaning and filters | Scope |
|---|---|---|---|
| Dashboard current heads and charts | `analytics/dashboard/` -> population service -> LivestockInventory | APPROVED + ACTIVE + quantity > 0; sum quantities | Municipal Admin/MAO; authorized SIBAT jurisdiction |
| Overview current heads and barangay matrix | `analytics/overview/` -> same population service | Same definition; complete aggregates independent of detail pagination | Same authorization |
| Overview monthly milk | overview service -> ProductionRecord | Approved MILK/LITERS, event date in current month through today | Same authorization |
| Overview monthly meat | overview service -> SlaughterRecord | Approved carcass kilograms this month; owner barangay first, recorded barangay fallback for unlinked legacy records | Existing scope rules preserved |
| Registered raisers | Farmer -> User | Actual profile + FARMER role + APPROVED account; grouped by barangay IDs | Same authorization |
| Inventory/validation list count | inventory and herd list APIs | Management rows/submissions; a herd row and animal row are different management entries | Role- and ownership-filtered |
| Herd list active animals | LivestockBatch's inventory children | Active children, including pending/verified; not necessarily official heads | Role- and ownership-filtered |
| Census analytics | analytics/census -> CensusSubmission/items | Reporting-year/quarter snapshots; approval/coverage breakdown | Authorized jurisdiction |
| Dated production/disease/mortality/sales analytics | descriptive service | Approved events in the reported period; not filtered out when the animal later exits | Authorized jurisdiction |
| Pending disease reports | DiseaseCase | PENDING/VERIFIED records awaiting review, all dates | Authorized jurisdiction |

## Canonical definitions

- **Total Livestock / current official heads:** sum positive inventory quantities where approval is APPROVED and operational status is ACTIVE. Each individual or herd child contributes one head; legacy unbatched multi-head inventory contributes its quantity. Parent herd counts and census snapshots are never added.
- **Active submitted livestock:** positive ACTIVE quantities across approval states. This operational figure deliberately differs from official population.
- **Historical approved inventory heads:** positive APPROVED quantities across operational statuses, including recorded exits. This is a total across currently stored records, not an as-of reconstruction of every past population.
- **Barangay population:** the same official inventory calculation grouped by `farmer__barangay_id`. Species and barangay totals reconcile to the same total. Zero-population registered barangays remain present.
- **Farmer count:** approved FARMER accounts with Farmer profiles, identified by database IDs rather than display-name uniqueness. Farmers without animals still count as registered raisers.
- **Vaccination coverage:** official current heads with a recorded vaccination date no later than today. This is a record-coverage proxy, not proof of immunity.
- **Approved sales value:** sum recorded approved sale prices over all stored dates. Missing prices are not invented.

## Dashboard/Overview architecture decision

**The shared backend source was kept; shared frontend population reconstruction was replaced.** Existing SQL herd annotations, slim list serializers, opt-in pagination, history protection, and scoped authorization from recent commits remain intact.

The canonical population service is reused by the existing descriptive dashboard service and a compact purpose-specific overview service. Dashboard loads its summary once and passes that exact result to its charts. Overview loads its compact summary separately from its detailed historical tables. Neither response contains all raw records.

KPIs describe municipal totals. Overview filters apply to the record lists and barangay matrix below them; the UI states this distinction. The dashboard barangay chart explicitly shows only the top seven barangays. Its bars should not be mistaken for the complete municipal total.

Summary cache keys include the authenticated identity and jurisdiction. Successful mutations invalidate the relevant summary/list prefixes (notification-only mutations are excluded). Window focus/navigation can refetch summaries. This is request/cache synchronization, not cross-client real-time push.

## Measured consistency matrix

The following values were measured from a read-only, repeatable-read PostgreSQL snapshot. Previous overview values were reconstructed from its actual prior source rules; these are not captured browser screenshots.

| Metric | Before | After | Interpretation |
|---|---:|---:|---|
| Dashboard official current heads | 302 | 302 | Existing canonical population was correct |
| Overview barangay population sum | 302 | 302 | This dataset did not contain the mixed-species/exit discrepancy; regression fixtures cover it |
| Overview figure labeled monthly milk | 135 | 123 L | Corrected approval/unit/month semantics |
| Active submitted heads | 322 | 322 | Includes non-approved active submissions; expected to differ from 302 |
| Historical approved inventory heads | 302 | 302 | No exited approved heads in this measured snapshot |
| Approved registered raisers | 99 | 99 | Current measured directory/profile total |
| Stored species | Cattle 301, Sheep 1 | Cattle 301, Sheep 1 | Names preserved; no new or deleted animals |
| Sales value with no sale records | 0 display | unavailable aggregate | Avoid claiming a recorded value where none exists |

A mixed regression fixture produces **12 official heads**, **53 active submitted heads**, and **20 historical approved heads**, including poultry, pending/verified/revision records, herd children, exits, and a 999-head census snapshot. The census does not increase live population.

## Security and scopes

- ADMIN and MAO remain municipal; staff barangay assignment does not restrict them.
- SIBAT ASSIGNED_ONLY uses existing reviewer queryset scoping; unassigned SIBAT sees empty scoped summaries.
- SIBAT ALL_BARANGAYS retains authorized municipal visibility.
- FARMER cannot access the municipal summary APIs; farmer inventory isolation stays in existing list permissions.
- No separate CBAT role or permission implementation was found. This audit does not invent CBAT access or bypass the current role matrix.
- No changes were made to review-transition authorization, source ownership, or reconciliation idempotency.

## Performance evidence

The dashboard previously mounted seven data hooks (inventory, census, production, species, barangays, directory, analytics). It now mounts one summary hook and passes its result to the chart component. This is verified in source; authenticated browser network measurement was unavailable.

The population service uses **five SQL queries**, unchanged between empty and 30-row regression fixtures. Aggregates are grouped in SQL without per-animal/profile lookups. No new N+1 fix is claimed for list endpoints: their existing annotations/select_related/pagination remain.

One sequential configured-database sample recorded:

| Service | Queries | Elapsed |
|---|---:|---:|
| Previous dashboard backend | 20 | 17,091.8 ms |
| Current dashboard backend | 23 | 2,757.6 ms |
| Current overview backend | 9 | 5,555.4 ms |

These are single measurements affected by connection/warm-cache/network state, **not evidence of a reliable latency speedup**. The new dashboard has three more SQL queries to supply authoritative directory/operational fields while removing bulk frontend requests. Overall page latency and payload byte reductions have not been benchmarked. No new pagination redesign was introduced; population never depends on the current page's row count.

## Exact files changed for this audit

Backend:
- `backend/analytics/services/population.py`: shared approved/active population, cross-species/barangay groups, profile/herd and operational totals.
- `backend/analytics/services/overview.py`: compact overview, correct month/units, pending review counts, recorded approved sales.
- `backend/analytics/services/descriptive.py`: reuse canonical population; retain dated historical analytics.
- `backend/analytics/views.py`, `backend/analytics/urls.py`: authenticated purpose-specific overview endpoint.
- `backend/analytics/tests.py`: cross-consumer totals, status/event semantics, legacy location, scopes, repeated read-only requests, fixed query growth.

Frontend:
- `frontend/src/lib/population-metrics.ts`: typed canonical response and presentation categories.
- `frontend/src/lib/municipal-cache.ts`: cancel stale responses and invalidate related summary keys.
- `frontend/src/lib/municipal-read.ts`: municipal reads stay on one configured database.
- `frontend/src/app/providers.tsx`: successful mutation cache integration.
- `frontend/src/app/(admin)/admin/admin-charts.ts`: authoritative metrics, scoped cache identity, single dashboard query.
- `frontend/src/app/(admin)/admin/admin-charts-view.tsx`: accept parent summary, all-species chart, top-seven label.
- `frontend/src/app/(admin)/admin/page.tsx`: share loaded summary with charts.
- `frontend/src/app/(admin)/data-overview/page.tsx`: purpose-specific summary, complete-data loading/errors, honest record projections/filter labels.
- `frontend/src/app/(admin)/data-overview/data-overview-types.ts`: response/display contracts and unavailable values.
- `frontend/src/app/(admin)/data-overview/data-overview-kpis.tsx`: accurate period/review labels and removal of fixed claims.
- `frontend/src/app/(admin)/data-overview/data-overview-overall-view.tsx`: recorded summary fields, remaining-species matrix column, removal of invented risk figures.
- `frontend/src/app/(admin)/data-overview/data-overview-table.tsx`, `data-overview-cards.tsx`, `data-overview-detail-modal.tsx`: unavailable valuations and explicit operational status.
- `frontend/src/app/(admin)/data-validation/validation-analytics.ts`: fail incomplete requests, preserve prices and zero quantities, primary-source reads.
- `frontend/src/app/(farmer)/farmer/farmer-analytics.ts`: remove additional herd population fallback.
- `frontend/tests/admin-consistency.test.cjs`: canonical chart/overview consumption, navigation, cancellation, cache/source isolation, stored values.
- `ADMIN_DATA_CONSISTENCY_AUDIT.md`: this report.

Previously added notification deletion and other concurrent community/scheduling/API-client changes were preserved and are not claimed as changes made by this audit.

## Verification

- `python manage.py check`: passed.
- `python manage.py makemigrations --check --dry-run`: no changes detected; no migration required.
- `python manage.py test`: final full isolated suite passed, 163 tests in 235.483 seconds.
- `npx tsc --noEmit`: passed after final UI integration.
- `node --test tests/*.test.cjs`: passed, 21 tests.
- Targeted `git diff --check` for this task's changed files: passed.
- Configured database: aggregate-only queries in READ ONLY transactions; no data edits.

## Remaining limits

1. Actual authenticated browser UI/network inspection could not run: the browser automation kernel failed during Windows sandbox initialization (`orchestrator_helper_report_read_failed`). Visual/navigation behavior is therefore not browser-verified; pure transformation, cache, and API behavior are regression-tested.
2. Overview's slaughter table exposes production-linked slaughter submissions. Standalone legacy SlaughterRecord events remain included in municipal approved meat aggregates, but there is no standalone slaughter list API in the current repository. This historical table coverage differs intentionally from complete event aggregates and needs a separate list workflow if those legacy entries must be browsed.
3. Existing SIBAT scope rules for unlinked legacy slaughter events require an inventory/batch owner path. Municipal summaries can use their recorded barangay fallback; scope was not widened for ambiguous ownership.
4. Performance results are individual samples; no browser end-to-end benchmark or production load test was performed.

## What to learn

Approval status answers whether MAO has accepted a record. Operational status answers whether its animal is still present. A herd is a container of inventory children, while a census is a dated snapshot. Each metric needs its own definition. Django should calculate authoritative totals; React Query should keep their cached responses synchronized, and React should format them without reinterpreting the domain.

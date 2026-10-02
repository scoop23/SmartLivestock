# SmartLivestock — Final Pre-Predictive Analytics Freeze Audit

Audit date: 2 October 2026 (Asia/Manila). Repository: F:/Dev/SmartLivestock, branch main, starting commit 1ffc3f4. No predictive models, packages, schema changes or migrations were added. Real user/domain records were not changed; PostgreSQL workflow fixtures and notifications were rolled back.

## A. SYSTEM STATUS / Executive summary

**READY FOR PREDICTIVE ANALYTICS** — core model/workflow foundation; real model training remains unavailable with current data.

The inspected core uses authoritative ownership, assigned-barangay SIBAT access, MAO final approval and event-controlled operational statuses. The audit found and fixed public registration access, missing SIBAT sales integration, omitted herd-sale serializer fields, protected-herd deletion failures/history detachment and invalid negative sale prices.

Foundation readiness is separate from forecasting data sufficiency: the database currently contains six production records, of which just one is approved: MILK/LITERS in September 2026. One monthly observation cannot support a meaningful trained forecast or model comparison.

## B. TEST RESULTS

| Check | Result |
| --- | --- |
| Django check | PASS |
| makemigrations --check | PASS; no schema changes |
| Applied migrations | No unapplied migrations in configured PostgreSQL database |
| Full backend suite | PASS: 129 total, 129 passed, 0 failures, 0 errors, 0 skipped (120 existing + 9 new) |
| TypeScript | PASS |
| Production frontend build | PASS; all 45 pages generated |
| Frontend lint | FAIL: 235 errors and 396 warnings in the repository-wide run; existing lint debt remains |
| Running-server API smoke | 54 GET requests; 46 HTTP 200 and 8 expected authorization failures; zero HTTP 500 |
| Browser rendering | 13 authenticated Farmer/SIBAT/MAO pages rendered; no page exceptions or failed backend requests |
| Sale browser action | PASS: dialog displayed destination/price, POSTed VERIFIED to the sale review URL and closed; used controlled synthetic API responses |
| PostgreSQL workflows | 9 rollback-only smoke cases passed, including JWT login, registration, revision, approval and reconciliation |
| Concurrent inventory lock | Second database connection rejected with SQLSTATE 55P03; no records changed |
| git diff --check | PASS |

Browser action interception verifies frontend request/response integration; persistence and authoritative transitions were independently tested through the actual PostgreSQL API code. This is not a claim that every form received a full interactive browser test. PostgreSQL smoke tests used the current schema, not a complete separate PostgreSQL test-database suite. Lock exclusion was tested; exhaustive concurrent approval stress tests were not performed.

## C. WORKFLOW STATUS

| Workflow | Status | Scope / limitation |
| --- | --- | --- |
| Farmer registration | WORKING | Public signup now creates pending FARMER only; MAO approval gates login |
| Livestock inventory | WORKING | Individual quantity 1; owner access; assigned reviewer access; inactive history retained |
| Herd/batch | WORKING | Grouping of individual animals; atomic review; deletion preserves event history |
| SIBAT review | WORKING WITH LIMITATION | Assigned account works; four legacy accounts still require explicitly confirmed assignments |
| MAO review | WORKING | Municipal visibility; final decision only after verification |
| Revision | WORKING | Returned farmer records resubmit to PENDING; herd revision remains grouped |
| Production | WORKING | Supported species/product/unit mapping; approved event-date totals |
| Sales | WORKING WITH LIMITATION | Individual sales now complete the UI review path; full-herd sales supported in API; aggregate partial-herd sales blocked |
| Slaughter | WORKING | Exact selection; 3 of 10 slaughtered leaves 7 active; one linked output projection |
| Mortality | WORKING WITH LIMITATION | Exact individual reconciliation; aggregate herd mortality approval unsupported |
| Disease | WORKING | Individual/herd source; affected-head validation; revision and approval |
| Census | WORKING | SIBAT submits VERIFIED snapshot; MAO certifies; no operational inventory overwrite |
| Notifications | WORKING WITH LIMITATION | Submission/review/revision routing tested; no fabricated replay for legacy unassigned accounts |
| Activities | WORKING | Existing publication/audience rules and authorized management tested |
| Scheduling | WORKING | MAO/SIBAT management; farmer own booking privacy; close retains bookings; booked schedule deletion refused |
| Analytics | WORKING WITH LIMITATION | Descriptive approved-record aggregates work; sparse reporting and vaccination-date limitations remain |
| QR | WORKING WITH LIMITATION | Accessible registry matches only; unknown lookup never becomes an approved record; transport permits unavailable and Auction lacks private-inventory API access |
| Inspection | UNIMPLEMENTED | Persistent API/UI submission remains unfinished; existing model rules are tested |
| Movement | UNIMPLEMENTED | MOVED_OUT reconciliation remains unfinished |

## D. Repository / commit audit

Inspected the actual changes associated with these commits and their consumers, not just their messages:

- 1ffc3f4: account assignment context, visibility setup and PostgreSQL row-lock scope. Reproduced live server access and exercised record review on PostgreSQL.
- bea2036: model quantity constraints, protected operational transitions, permissions, notifications and assigned-barangay scope. Verified existing regression coverage and current data.
- d686e9e: slaughter-to-production linkage and approved event dates. Verified exact selected-animal transitions and absence of mortality/meat duplication.
- e00a275: saved PSA valuation snapshots. Verified missing-price NULL, exact/previous historical reference policy and unchanged-reference preservation.
- 7dd922c: activities, booking and descriptive reporting. Checked URLs, serializers, role permissions and existing community tests.
- a884678 and farmer simplification/herd naming commits: checked affected form/review API consumers and production build; preserved current design.

Starting working tree was clean. No commits, pushes, deployment operations or real data cleanup were performed by this audit.

## E. Domain workflow map / role audit

```
Farmer submits -> PENDING -> assigned SIBAT verifies -> VERIFIED
    -> MAO approves -> APPROVED

SIBAT or MAO returns -> SUBJECT_TO_REVISION -> farmer edits
    -> PENDING -> SIBAT verification -> MAO approval

SIBAT census submits -> VERIFIED -> MAO certifies
```

The real core transition choices are VERIFIED, APPROVED and SUBJECT_TO_REVISION as applicable. REJECTED is not a universal backend transition; UI legacy labels do not authorize it.

| Role | Visibility | Mutation/review |
| --- | --- | --- |
| Farmer | Own sources and histories; own notification inbox and bookings | Own pending/returned records; cannot verify or MAO-approve |
| SIBAT | Private domain records whose owner belongs to its assigned barangay | Verify pending records or return them; cannot give MAO final approval |
| MAO | Authorized municipal domain records and user directory | Final approval or revision after verification |
| Auction | Existing sale-reading permission and shared announcements | No private inventory review/approval permission |
| Anonymous | Login, registration and public reference routes where explicitly supported | Protected APIs return 401 |

Unassigned SIBAT remains fail-closed; no arbitrary barangay assignments were guessed. Municipal analytics publish aggregates to the existing authorized MAO/SIBAT roles; they are not private farmer record lists. Independent ADMIN is not a canonical Role choice; existing administrative access is represented by MAO permissions.

## F. API / HTTP error audit

Enumerated 93 non-admin URL patterns including compatibility aliases; resolved 43 distinct literal/templated frontend API paths with zero missing paths. Dynamic endpoint branches for reviews/resubmissions were also inspected. See PRE_PREDICTIVE_API_ROUTES.json and PRE_PREDICTIVE_RUNTIME.json.

Core route families: api/token, api/users (register/me/directory/status), livestock (inventory/batches/reviews/notes/animals/types/barangays/farmers/census), production (records/sales/calving/reviews/weights/dispositions), diseases (cases/mortality/reviews), community (announcements/schedules/bookings), notifications (list/read/mark-all-read), analytics (dashboard/census). Slaughter is consumed through linked production records, not a duplicate standalone review endpoint. Movement/inspection have no persistent route.

| Endpoint / page | Role | Method | Result | Expected? | Root cause / fix |
| --- | --- | --- | --- | --- | --- |
| api/users/register/ | Anonymous | POST | 401 before fix; 201 valid synthetic registration after fix | Before: no | Inherited IsAuthenticated; RegisterView now explicitly AllowAny; serializer forces pending FARMER |
| api/users/register/ | Anonymous | POST empty payload | 400 after fix | Yes | Required registration fields missing |
| api/token/ | Pending synthetic farmer | POST | 400 | Yes | Account approval gate; 200 after MAO approval |
| livestock/batches/<id>/ | Farmer | DELETE linked child history | 500 before fix; 409 after fix | Before: no | Unhandled ProtectedError; protected-history conflict response added |
| livestock/batches/<id>/ | Farmer | DELETE herd-only history | 200 detached history before fix; 409 after fix | Before: no | SET_NULL would remove source ownership; linked events now prevent deletion |
| production/sales/ | Farmer | POST negative price | 201 before fix; 400 after fix | Before: no | Negative financial amounts lacked validation; zero remains valid |
| production/sales/ | Farmer | POST partial aggregate herd sale | 400 | Yes | Exact selected animals unsupported for aggregate partial sale |
| livestock/census/, analytics/dashboard/, analytics/census/, api/users/directory/ | Farmer | GET | 403 | Yes | Reviewer/MAO-only resources |
| api/users/directory/ | SIBAT | GET | 403 | Yes | User management remains MAO-only |
| livestock/inventory/, production/records/, analytics/dashboard/ | Anonymous | GET | 401 | Yes | Authentication required |
| Cross-barangay private detail/review | SIBAT | GET/POST | 404 | Yes | Scoped object unavailable to that reviewer |
| Already inactive sale/slaughter or repeated administrative transition | Authorized user | POST | 400/409 according to endpoint | Yes | Invalid state transition; history and existing status preserved |

The previous nullable-join FOR UPDATE 500 remains fixed by locking the event row with of=("self",). No HTTP 500 was observed in the final core API smoke run. This is a tested-path conclusion, not a guarantee for every possible request payload.

## G. Database integrity audit

| Check | Result |
| --- | --- |
| Duplicate animals | Zero duplicate nonblank tags; this cannot prove untagged animals are distinct |
| Individual quantity = 1 | Zero invalid individual quantities |
| Herd/child integrity | Zero child owner/species mismatches |
| Active population | APPROVED + ACTIVE positive inventory quantities; no additional herd count |
| Sales reconciliation | Approval -> SOLD; revision/resubmission tested; zero approved unreconciled live sales |
| Mortality reconciliation | Approval -> DECEASED; no meat record created; zero approved unreconciled deaths |
| Slaughter reconciliation | Exact 3/10 transition passed; remaining 7 active; zero approved unreconciled slaughter |
| Production duplication | Zero duplicate source/date/type/unit/quantity signatures; zero slaughter events without linked production output |
| Disease affected counts | Submission bounds and individual/herd relationships validated; later herd exits do not retrospectively prove original availability |
| Census separation | Snapshot models remain separate from operational inventory |
| PSA valuation | Missing mapping/reference -> NULL; recorded zero sale price is separately preserved; saved historical snapshots tested |
| Ownership/dates/statuses | Zero approved inventory without owners; zero production without source/date; zero invalid stored core status choices |
| Species/product/unit | Zero current production compatibility failures |
| Inventory/production amounts | Zero nonpositive current quantities |
| Migrations | Four recent migrations applied; constraints/FKs/nullable issuance inspected; no destructive data migration or guessed staff assignment |

Database FKs and unique/check constraints enforce their declared relationships. Six current production rows is a small dataset: no duplicate signature is not proof that every farmer reported all activity. Read-only audit did not repair or delete records.

## H. Notification / audit history

Verified farmer submission -> assigned SIBAT, SIBAT verification -> MAO, and decisions/revisions -> owner through regression tests and rollback-only complete workflows. Private recipients use the owner's barangay, not the creator/reviewer identity. Notification lists/read operations remain recipient-owned.

Herd review notes append timestamp, reviewer, decision and remarks to existing notes. Other domains use their existing review metadata; the project does not implement a universal immutable event journal. Transactional reconciliation/approval probes did not leave notifications or synthetic records behind. Historic notifications were not replayed for accounts assigned later.

## I. Frontend / backend integration

Real headless-browser rendering covered Farmer: farmer dashboard, inventory, production, observations and scheduling; SIBAT: dashboard, herd console, census page and scheduling; MAO: dashboard, validation, descriptive analytics and scheduling. All 13 pages stayed on their intended routes, rendered and had no browser exceptions or failed backend API requests.

Sales now use the existing production review panel: sale API -> typed mapper -> queue -> destination/price dialog -> sales review POST -> query invalidation. Browser action used a real serialized synthetic API fixture and intercepted its mutation to protect live records. The same sale approval and revision logic was independently exercised against PostgreSQL.

Production wizard/slaughter form payloads were checked against the serializers and supported species/unit mapping. Every form branch was not clicked in the browser. A successful production build does not by itself prove those unexercised interactions.

## J. Analytics data integrity / predictive readiness

Descriptive analytics reads approved ProductionRecord, DiseaseCase, MortalityRecord and LiveAnimalSale events using record_date/sale_date. Current population uses approved active inventory quantity. Barangay follows owner FKs, including batch-only sources. Meat output uses its authoritative linked slaughter weight once. Units stay separate. Census reporting is a distinct snapshot/coverage view.

PSA saved snapshots make historical estimates reproducible; unavailable compatible prices stay NULL rather than fabricated PHP 0. Vaccination is recorded-date coverage, not vaccine history/immunity/effectiveness.

Available production: 6 records (3 PENDING, 1 VERIFIED, 1 SUBJECT_TO_REVISION, 1 APPROVED); only one approved MILK/LITERS observation-month, September 2026. Training and model comparison must remain unavailable until a sufficient, consistently dated series exists. Descriptive zero-record months must not automatically become measured-zero observations in future model preparation.

Current predictive/prescriptive tabs still contain demonstration values; they were left unchanged because predictive implementation is outside this task. They are not evaluated forecasts and must not be presented as real model results.

## K. Known unfinished features / limitations

- Inspection persistence and MOVED_OUT reconciliation: known unfinished, outside current production forecasting core.
- Transport/clearance QR lookup and Auction private registry access: not implemented/authorized through the current private record API.
- Aggregate partial-herd sales and aggregate mortality reconciliation: blocked; exact individual operations remain supported.
- Four legacy SIBAT accounts need administrator-confirmed barangay setup; assigned Manggas workflow works.
- Reference prices only cover compatible available PSA products/periods; no estimate is invented for missing products.
- Lint debt remains. No unrelated redesign or lint cleanup was attempted.
- Enough historical approved observations do not yet exist for defensible prediction.

## L. Bugs fixed / files changed

- backend/users/views.py: public pending-farmer registration access.
- backend/production/views.py: preload both sale source relationships and barangays to prevent N+1 queries in the new display metadata.
- backend/production/serializer.py: existing herd sale source exposed; owner/species/barangay display follows either source; negative prices rejected, NULL/zero preserved.
- backend/livestock/views/batch_views.py: protected history returns 409 and herd-only events prevent source detachment.
- frontend/src/app/(sibat)/sibat/sibat-analytics.ts: sales fetch/map/review and cache refresh added to existing submission flow.
- frontend/src/app/(sibat)/sibat/page.tsx: sales included in pending-review count.
- frontend/src/app/(sibat)/sibat/components/sibat-production-queue.tsx: sales included with existing status filters and review action.
- frontend/src/app/(sibat)/sibat/components/sibat-review-dialog.tsx: sale details, destination, recorded price and review labels.
- backend/livestock/test_freeze_workflows.py: 9 real-JWT API workflow regression/smoke cases.
- Audit artifacts: this report, PRE_PREDICTIVE_API_ROUTES.json, PRE_PREDICTIVE_RUNTIME.json, PRE_PREDICTIVE_BROWSER.json.

No dependency/schema/model migration changes. No predictive implementation. Existing tests and working descriptive architecture were preserved.

## M. Tests executed

Full Django suite (129 PASS), then 10 focused sale/list-visibility tests after the final related-query adjustment; check, makemigrations --check; PostgreSQL rollback-only workflow smoke cases; two-connection lock exclusion; actual HTTP JSON GET smoke; anonymous registration validation; headless browser page rendering and controlled sale action; npx tsc --noEmit; npm run build; npm run lint; git diff --check.

## N. Remaining blockers

No known remaining blocker in the tested core workflow and approved-data dependency chain. Lint debt, unassigned legacy accounts and the explicitly unfinished inspection/movement features remain disclosed limitations.

Operational prerequisites: deploy these code changes before using them on Render; assign the four legacy reviewers explicitly before they can review. No additional migration is required by this audit. Dataset sufficiency blocks real forecast training, not beginning implementation of a module that honestly reports insufficient data.

## O. Final GO / NO-GO decision

**GO: The domain can now be frozen and predictive analytics can begin.**

This authorizes implementation of a defensible predictive pipeline, not claims of usable current model accuracy or forecasts. Current approved history is insufficient.

Freeze the current livestock/production/slaughter/sale/mortality/disease/census model foundation and authoritative approval/reconciliation rules. Resume domain changes only for a demonstrated requirement or defect. Preserve approved-only extraction, actual event dates, separate units, missing-report semantics and limited reporting coverage when implementing predictive analytics.

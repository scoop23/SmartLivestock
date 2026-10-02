# Farmer log visibility / SIBAT setup

## Reproduced cause

Read-only API requests confirmed that the four legacy SIBAT accounts have NULL assigned_barangay. Their private lists correctly return zero rows, but the portal did not explain the missing setup. No records were deleted. The assigned Manggas reviewer receives 20 inventory rows, 6 herds, 3 production records, 2 disease reports, 5 mortality reports and 1 census submission. MAO receives municipal records. These are inventory rows, not an active-head population calculation.

No farmer has a missing barangay in the inspected database. The four migrations contain schema changes and constraints, with no record deletion or guessed barangay assignments. All four are applied to the configured database.

## Endpoint / access matrix

| Endpoint | Source | Farmer | Assigned SIBAT | MAO |
| --- | --- | --- | --- | --- |
| livestock/inventory/ | LivestockInventory -> farmer | Own | Owner barangay | Municipal |
| livestock/batches/ | LivestockBatch -> farmer | Own | Owner barangay | Municipal |
| production/records/ | ProductionRecord -> animal/herd -> farmer | Own | Owner barangay | Municipal |
| production/sales/ | LiveAnimalSale -> animal/herd -> farmer | Own | Owner barangay | Municipal |
| production/calving/ | CalvingRecord -> dam -> farmer | Own | Owner barangay | Municipal |
| diseases/cases/ | DiseaseCase -> animal/herd -> farmer | Own | Owner barangay | Municipal |
| diseases/mortality/ | MortalityRecord -> animal/herd -> farmer | Own | Owner barangay | Municipal |
| livestock/census/ | CensusSubmission -> barangay | Forbidden: SIBAT submits census | Assigned barangay | Municipal |
| livestock/farmers/<barangay>/ | Farmer -> barangay | Forbidden | Assigned barangay | Municipal |
| api/notifications/ | Notification -> recipient user | Own inbox | Own inbox | Own inbox |
| api/users/directory/ | User | Forbidden | Forbidden | Municipal |

These log lists retain all valid administrative statuses. Inventory defaults to ACTIVE operational records; include_inactive=true retrieves history, and the SIBAT log fetch already uses it. Details and reviews use the same SIBAT scope; out-of-scope IDs return 404. Approval/mutation locks do not hide approved history. Herd children are intentionally reviewed through the herd, rather than independently.

Slaughter is exposed through its existing linked production record, not a duplicate slaughter review queue. A farmer's mortality source remains an exact animal. Legacy herd-linked health records remain readable through their owner relationships.

Activities/program schedules are shared community workflows. Farmers see their own bookings; existing authorized program managers see program participants. Inspection/field-visit preview records do not have a completed persistent inspection API; they cannot be recovered by changing log scoping.

## Minimal fix

- Current-user API exposes read-only assigned_barangay_id and assigned_barangay_name.
- Auth context maps those fields and preserves them during token refresh/network fallback.
- SIBAT dashboard explains missing assignments and displays the assigned barangay.
- Census selector offers only the assigned barangay for SIBAT.
- Explicit setup command assigns existing SIBAT accounts without changing ownership, logs, notifications or statuses.

From backend, after confirming the correct mapping:

```powershell
.\.venv\Scripts\python.exe manage.py assign_sibat_barangay --username ACCOUNT_USERNAME --barangay "CONFIRMED_BARANGAY"
```

Django admin -> Users -> assigned barangay is also available. Refresh the portal after assignment. No assignments were guessed or changed during this audit. New notifications route to currently assigned reviewers; historical notifications are not fabricated or replayed.

## Genuine remaining gaps

- The legacy account-to-barangay mapping must be supplied by the administrator.
- The existing SIBAT unified production queue consumes production and calving, but not LiveAnimalSale. The sales API remains accessible/scoped; adding a sales review UI is separate from this assignment regression.
- Inspection/movement persistence and MOVED_OUT remain unfinished.
- No browser automation runtime is available in this session; Next.js page responses and TypeScript can be checked, but interactive rendering must not be claimed as verified.

## Validation

- Django check: PASS.
- makemigrations --check: PASS; no new migrations required.
- Full Django suite on isolated SQLite: PASS, 111 existing + 9 new = 120 tests.
- New tests cover ownership, all real model statuses, herd relationships, both SIBAT scopes, MAO access, legacy setup, profile assignment protection, cross-barangay detail/review denial and the submission/verification/revision/resubmission notification chain.
- TypeScript: PASS.
- Next.js GET /sibat and /sibat/census/submit: HTTP 200, no server-error marker.
- Actual configured database APIs: read-only role checks passed. PostgreSQL test-database/concurrency tests were not run against the hosted database.
- Interactive browser behavior remains unverified.
- Domain reconciliation and quantity constraints were not changed; existing regression tests passed.

## Follow-up: PostgreSQL verification HTTP 500

The assigned Manggas account reproduced a separate review failure for production, disease and mortality: PostgreSQL raised `FOR UPDATE cannot be applied to the nullable side of an outer join`. The scoped OR filter joins optional animal and herd sources. Unqualified select_for_update tried to lock nullable joined rows. SQLite tests did not enforce this PostgreSQL restriction.

Review/detail handlers now use select_for_update(of=("self",)) to lock the authoritative record without locking the scope joins. The same explicit row-lock scope is used for inventory, herds, sales and calving. Ownership, barangay filters, transitions and reconciliation are unchanged.

Actual PostgreSQL verification requests for production, disease and mortality returned HTTP 200 after the fix; all changes and notifications were rolled back. All seven model scoped lock queries executed successfully on PostgreSQL. No standalone Manggas inventory or pending herd was available for a successful live review probe; herd requests correctly returned a workflow rejection rather than HTTP 500.

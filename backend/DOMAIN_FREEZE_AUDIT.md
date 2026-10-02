# SmartLivestock domain integrity audit - 2 October 2026

## Scope

Inspected livestock inventory/herd/census models, production/slaughter/sale/calving/weight/disposition models, disease/mortality models, movement inspection/items/clearance/meat models, staff roles and notifications, serializers, role/workflow helpers, reconciliation services, routes, relevant migration history, tests, descriptive/census analytics, valuation snapshots, and the related farmer/inspection/scanner forms.

No real records were seeded, modified, deleted, or migrated. A read-only audit found 322 current inventory rows, all INDIVIDUAL with quantity 1. Tests use an isolated SQLite database. PostgreSQL locking under concurrent load is not runtime-tested here.

## Confirmed problems and corrections

| Problem | Consequence | Correction |
| --- | --- | --- |
| Disease serializer referenced nonexistent inventory_reconciled_at | Disease endpoints failed during serialization; baseline suite had 10 errors | Remove that field from DiseaseCaseSerializer |
| Individual quantity could exceed one; herd children could masquerade as aggregate rows | Ambiguous animal counts | Serializer/model validation plus database constraints for INDIVIDUAL=1 and one individual per herd child |
| Farmer could manually toggle herd SOLD/HARVESTED | Inventory and grouping lifecycle could disagree | Event-controlled transitions; archive only an inactive herd |
| No SIBAT barangay assignment | Private lists/reviews/notifications were municipal-wide | Nullable User.assigned_barangay, shared queryset scoping and scoped private notifications; unassigned staff have no private-record scope |
| Health CRUD admitted unrelated staff; verified cases could be edited/re-reviewed | Unauthorized access or overwritten administrative decisions | Explicit role actions, owned farmer sources, locked verified/approved edits, atomic review checks and valid transitions |
| Mortality accepted unavailable or ambiguous aggregate sources | Declaration could pass submission and fail final reconciliation | Require an approved active one-head animal and a matching optional disease source |
| Herd disease counts were not bounded by active heads | Affected totals could exceed the herd | Sum active child quantities and validate affected_count against that population |
| Sale guards admitted empty/unavailable herds and encoded-owner fallbacks | Invalid sales or private-record ownership leakage | Positive head count, actual ownership, approved active herd members, complete-herd-only reconciliation |
| Returned sales had no working update path | SUBJECT_TO_REVISION was a dead end | Extend the existing sale URL with PATCH and reuse the farmer dialog; same ID/source, resets to PENDING and notifies SIBAT |
| Sale/calving review notifications were incomplete | Farmer/MAO decisions could be missed | Farmer sale decision notifications and MAO alerts after SIBAT verifies sales/calving |
| Weight/disposition source ownership was unchecked | Another farmer's animal could be changed/planned for exit | Owned active source validation and explicit endpoint role permissions |
| Review/edit operations did not consistently lock rows | Concurrent decisions could overwrite state | Atomic inventory/health/sale/calving/census checks; consistent herd-before-child locking for slaughter/sale |
| CHICKEN was outside MeatType | Chicken was not a valid enum choice | Put CHICKEN inside the enum and migrate the choices |
| Clearance origin defaulted to Padre Garcia | Foreign/unknown origins were fabricated | Preserve supplied origin; derive missing registered origin from the actual address; unknown stays blank |
| Clearance required issuance fields before approval | Creation looked like issuance | Nullable issuer/date/time; model validation permits issuance only for approved clearance |
| Inspection items had no optional exact inventory link | Registered animal identity could not be represented | Optional protected inventory FK with ownership/species/eligibility checks; external aggregate items need no inventory |
| QR lookup fabricated approved records after failure | Unknown codes appeared officially certified | Remove the synthetic fallback, default approval, invented origin/counts, and nonpersistent action claims |
| Local inspection form invented origin and issuance time | Preview records contained false official metadata | Preserve entered address/origin, leave issuance null, label the form as a local preview |

## Operational lifecycle

- Approved LiveAnimalSale -> SOLD.
- Approved MortalityRecord -> DECEASED; no meat record is generated.
- MAO-approved slaughter, represented in the existing production review queue -> SLAUGHTERED for exactly its selected animals.
- MOVED_OUT exists as a choice but has no implemented inspection/movement approval reconciliation route. It is not claimed as supported.
- A tested partial slaughter of 3 out of 10 animals leaves 7 ACTIVE and the herd ACTIVE. Historical animals and authoritative event records are retained.
- Live herd sales still require the complete approved active herd. Partial sales and aggregate herd mortality require exact selection support before they can be enabled.

## Inspection semantics

Registered shipper + optional exact inventory item: the animal must belong to the shipper, match species, be approved/active, and represent one head. An outside-municipality address is allowed.

External shipper + aggregate items: no Farmer, User, or LivestockInventory is fabricated. Species, positive quantity, sex and classification remain available.

Clearance preserves an explicit origin. For a registered shipper, a missing origin derives from Farmer.address. External unknown origin remains blank. Destination remains the inspection's supplied destination text.

These rules are verified at the model layer. movements/views.py remains a placeholder and movements has no API URL registration. The current inspection form only updates local React state. No inspection submission/issuance/MOVED_OUT UI-to-database pipeline is claimed.

## Actual relationship map

```text
Farmer -> LivestockBatch -> LivestockInventory (individual children)
LivestockInventory <-> SlaughterRecord (SlaughterAnimal exact selection)
SlaughterRecord -> ProductionRecord (one-to-one queue/output projection)
LivestockInventory OR LivestockBatch -> LiveAnimalSale
LivestockInventory OR LivestockBatch -> DiseaseCase
DiseaseCase -> MortalityRecord (optional source link)
LivestockInventory -> MortalityRecord (implemented reconciliation)
LivestockInspection -> LivestockInspectionItem -> optional LivestockInventory
LivestockInspection -> LivestockInspectionClearance (one-to-one)
SlaughterRecord -> MeatMovementRecord
CensusSubmission -> CensusSubmissionItem -> Farmer + LivestockType
User -> assigned_barangay (SIBAT scope)
```

## Analytics invariants verified

Population uses approved + active inventory quantities; a herd does not add another population counter. Mortality and sales use their own approved event records. Production uses event dates and preserves units. Linked meat output uses authoritative slaughter weight once. Census does not overwrite operational inventory. PSA valuation returns unavailable/null when no compatible reference exists, uses explicit exact/earlier periods, and preserves snapshot identity. No predictive module was introduced.

## Deployment requirements and remaining issues

1. Apply the new livestock, users and movements migrations before running this updated application against an existing database. They were only applied in isolated tests in this task.
2. Assign every SIBAT user to its actual barangay through the existing Django admin. No assignment is guessed or silently populated.
3. BLOCKER for an entire inspection/movement freeze: implement persistent inspection/clearance APIs, authorized issuance/review and exact-animal MOVED_OUT reconciliation, then connect the existing frontend. Current models and aggregate/exact inspection item tests do not substitute for that missing pipeline.
4. IMPORTANT: MeatMovementRecord still requires internal origin/destination barangay FKs. External meat destinations require a deliberate domain decision before that model is frozen.
5. IMPORTANT: aggregate herd mortality and partial herd sales remain unsupported; individual declarations and complete-herd sales are supported. Pending/returned legacy mortality aggregates are rejected rather than silently assigning deaths to arbitrary animals.
6. OPTIONAL/FUTURE: PostgreSQL concurrent transaction testing. SQLite validates behavior/constraints but does not exercise row locks.

## Validation

- Django system check: PASS.
- makemigrations --check: PASS (no ungenerated model changes).
- Full backend suite: PASS, 111 tests in an isolated SQLite database.
- npx tsc --noEmit: PASS.
- git diff --check: PASS.
- Browser interaction and PostgreSQL concurrent locking: not runtime-tested. The baseline ran 95 tests with 10 disease serializer errors. Added regression coverage checks quantity constraints, guarded operational input, sale/death reconciliation, invalid exits, staff scope/privacy, resubmission, external inspections, origin/issuance semantics, and chicken choices. Existing tests cover 3-of-10 slaughter and one-time meat aggregation.

## Files changed

- `backend/analytics/tests.py`
- `backend/diseases/serializer.py`
- `backend/diseases/tests.py`
- `backend/diseases/views.py`
- `backend/livestock/models.py`
- `backend/livestock/reconciliation.py`
- `backend/livestock/serializer.py`
- `backend/livestock/services.py`
- `backend/livestock/test_herd_revision.py`
- `backend/livestock/tests.py`
- `backend/livestock/views/batch_views.py`
- `backend/livestock/views/census_views.py`
- `backend/livestock/views/inventory_views.py`
- `backend/movements/models.py`
- `backend/production/serializer.py`
- `backend/production/services/slaughter.py`
- `backend/production/tests.py`
- `backend/production/views.py`
- `backend/smartlivestock/workflows.py`
- `backend/users/models.py`
- `backend/users/notification_views.py`
- `frontend/src/app/(auction)/auction-inspections/auction-analytics.ts`
- `frontend/src/app/(auction)/auction-inspections/inspection-details-dialog.tsx`
- `frontend/src/app/(auction)/auction-inspections/new-inspection-dialog.tsx`
- `frontend/src/app/(farmer)/production-dashboard/production-sales-tab.tsx`
- `frontend/src/components/universal-qr-scanner-dialog.tsx`
- `backend/livestock/migrations/0014_livestockinventory_individual_inventory_one_head.py`
- `backend/livestock/test_domain_integrity.py`
- `backend/movements/migrations/0004_alter_livestockinspectionclearance_date_issued_and_more.py`
- `backend/movements/migrations/0005_livestockinspectionitem_inventory.py`
- `backend/users/migrations/0010_user_assigned_barangay.py`
- `backend/DOMAIN_FREEZE_AUDIT.md`

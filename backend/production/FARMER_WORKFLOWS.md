# Farmer Production and Slaughter Records

## Routine production logs

Farmer milk, meat-yield, egg, and wool entries are stored as `ProductionRecord` rows with status `RECORDED`. They remain in the farmer's own history and eligible production analytics without entering the municipal approval queue. The API validates that the source animal or batch belongs to the authenticated farmer and is eligible for production logging.

A meat-yield entry is a farmer-submitted personal log and stays `RECORDED` without a production review stage. Individual entries also submit a linked, pending `SlaughterRecord` with the exact selected animal. The farmer log remains separate from the official slaughter decision. SIBAT/CBAT can read the unverified notice within their barangay scope but cannot approve it; MAO/Admin review it through `/production/slaughterhouse/records/`. Inventory changes to `SLAUGHTERED` only after MAO approval and only for the selected animals. The reconciliation marker makes repeated approval calls idempotent. Batch or aggregate Farmer meat-yield logs without exact animal selection do not alter individual inventory.

Returning a linked official notice asks the farmer to correct the same meat-yield entry. Resubmission reuses the same linked `SlaughterRecord` and returns it to `PENDING`. Facility-entered aggregate slaughter submissions remain a separate workflow and never modify individual inventory. `DECEASED` remains reserved for mortality reports.

## Historical records

Existing production rows linked to slaughter reports retain their review and inventory history. Editing those legacy rows continues to update the linked report according to its existing revision workflow.

## Reproductive Management & Conception Analytics

### Authoritative Reproductive Statuses
SmartLivestock resolves reproductive status using a single authoritative service (`production.reproductive_service.resolve_reproductive_status`):
- `NOT_APPLICABLE`: Assigned to all male animals or records outside female breeding stock.
- `UNKNOWN`: Assigned to eligible females with no recorded breeding attempts, herd exposure, or calving records, or whose past pregnancy confirmation exceeded biological gestation + 45 days without a recorded birth.
- `EXPOSED`: Assigned when an animal is bred (AI/Natural) awaiting pregnancy check, or is currently penned in the same active batch with an approved sire bull of compatible species. Herd exposure **never** confirms conception.
- `PREGNANT`: Assigned **only** when pregnancy is explicitly diagnosed and confirmed via transrectal palpation, ultrasound, or verified clinical assay.
- `COMPLETE`: Assigned when a parturition/calving record completes the cycle. When a subsequent breeding attempt is logged, the animal transitions to a new cycle (`EXPOSED` or `PREGNANT`) rather than remaining stuck on Complete.

### Conception Rate Analytics Formula
The system strictly enforces an empirical denominator:
$$\text{Observed Conception Rate} = \frac{\text{Eligible Breeding Events with Confirmed Conception}}{\text{Eligible Breeding Events with Known Outcomes}} \times 100$$
Events with `PENDING_CHECK` status are explicitly excluded from the denominator so unexamined pregnancies are never penalized as failures.

### Individual Conception Prediction Governance
Individual machine learning predictions are gated by an empirical data-readiness threshold (minimum 30 verified field outcomes). In the current dataset (0 verified breeding outcomes), predictions are declared `BLOCKED_PENDING_DATA` to prevent synthetic or fabricated AI claims.


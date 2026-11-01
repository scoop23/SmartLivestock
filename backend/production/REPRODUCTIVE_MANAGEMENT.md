# SmartLivestock-Batangas — Reproductive Management, Conception Analytics, and Pregnancy Prediction Architecture

## 1. Overview and Engineering Objective
The SmartLivestock reproductive management subsystem establishes an authoritative, auditable, and scientifically defensible lifecycle for female livestock in Padre Garcia, Batangas. It unifies:
1. Individual livestock treatment, vaccination, and clinical history.
2. Cycle-aware reproductive status derivation.
3. Bull herd exposure and registered breeding/insemination records.
4. Clinical pregnancy diagnosis and calving registries.
5. Descriptive conception-rate analytics with rigorously defined denominators.
6. Empirical data-readiness governance preventing ungrounded or synthetic AI predictions.

---

## 2. Conceptual Reproductive Status Rules (Phase 3)
SmartLivestock resolves reproductive status using a single authoritative service (`production.reproductive_service.resolve_reproductive_status`). The statuses follow strict cycle-aware precedence:

| Conceptual Status | Technical Key | Badge Variant | Precedence & Clinical Meaning |
|---|---|---|---|
| **Not Applicable** | `NOT_APPLICABLE` | Slate / Muted | Animal is male or unrecorded sex. Outside female reproductive tracking. |
| **Complete** | `COMPLETE` | Blue | Parturition / calving event completed the cycle. Cow is resting or open post-calving. |
| **Pregnant — Confirmed** | `PREGNANT` | Emerald | Pregnancy explicitly confirmed by veterinarian / technician via transrectal palpation, ultrasound, or assay. |
| **Pending check** | `PENDING_CHECK` | Amber | A breeding or insemination record exists, but pregnancy has not been confirmed. The estimated due date is not proof of pregnancy. |
| **Exposed** | `EXPOSED` | Amber | An eligible active female and an eligible active approved male share the same active herd. **Herd exposure alone never confirms pregnancy.** |
| **Unknown / Not Recorded** | `UNKNOWN` | Slate | No breeding, herd bull exposure, or calving records logged in SmartLivestock, OR historical pregnancy confirmation overdue past biological gestation + 45 days without a recorded birth. |

### Cycle-Aware Precedence Rules
1. **Biological Gestation Boundaries**: Standard species gestation periods:
   - Cattle: 283 days
   - Carabao: 310 days
   - Goat: 150 days
   - Sheep: 147 days
   - Swine: 114 days
2. **Post-Parturition Reset**: A recorded calving event completes cycle $N$. If the cow is bred again after that calving date, cycle $N+1$ begins immediately and status transitions to `PENDING_CHECK` (or `PREGNANT` upon authorized confirmation), preventing the cow from being permanently stuck on `COMPLETE`.
3. **Overdue Pregnancy Protection**: If pregnancy was marked confirmed but elapsed time exceeds gestation + 45 grace days without a calving event, the status drops to `UNKNOWN` (`"Overdue / Re-check Required"`), prompting veterinary follow-up.

---

## 3. Herd Bull Exposure vs. Recorded Breeding (Phase 4)
- **Strict Pen Boundaries**: Exposure requires an active herd (`LivestockBatch`) owned by the dam's Farmer and current membership of both animals in that herd.
- **Eligible Animals**: The dam and bull must be active, reviewed individual animals of the same species. The bull must be male and approved.
- **No False Leaps**: Same-farm, owner, or barangay association does not imply exposure when the animals are in different herds.
- **Separate Evidence**: Herd exposure is `EXPOSED`; a breeding record without confirmation is `PENDING_CHECK`. Neither status means pregnant.
- **Inactive Inventory**: Sold, deceased, slaughtered, moved-out, unreviewed, or archived-herd animals do not create current exposure. Historical events remain available in the animal history.

---

## 4. Descriptive Conception-Rate Analytics (Phase 6)
### Mathematical Definition
$$\text{Observed Conception Rate (\%)} = \frac{\text{Eligible Breeding Events with Confirmed Conception Outcomes}}{\text{Eligible Breeding Events with Known Clinical Outcomes}} \times 100$$

Where:
- **Numerator**: Events with a valid pregnancy confirmation or a linked calving event.
- **Denominator**: Confirmed conceptions plus events explicitly checked and recorded as open (`OPEN`).
- **Evidence Requirement**: `PREGNANT` requires confirmation date, confirming actor, and method. `CALVED` requires a calving record linked to the same dam. Stale status strings without that evidence are presented as pending.
- **Explicit Exclusion**: Events with status `PENDING_CHECK` are **excluded** from the denominator so awaiting-check records are never penalized as failures.

### Test Fixture Verification
In a test fixture with 40 eligible breeding events with known outcomes (24 confirmed conceptions, 16 open) and 10 pending checks:
$$\text{Conception Rate} = \frac{24}{24 + 16} \times 100 = \frac{24}{40} \times 100 = 60.0\%$$
(Verified deterministically in `production.test_reproductive_management`).

---

## 5. Pregnancy Confirmation, Due Dates, and Calving Review
- The Farmer owner may confirm pregnancy for their own eligible animal. Scoped SIBAT/CBAT and MAO/Admin reviewers may confirm only where the existing `calving.review` permission and barangay scope allow it.
- Pregnancy confirmation records its date, actor, method, and an audit note. Repeating a confirmed request is idempotent and preserves the original confirmation.
- Expected calving dates are estimates derived from the breeding date and species gestation interval. Due-date notices are sent only for evidence-backed confirmed pregnancies and are deduplicated by due window.
- A calving submission is accepted even without a previous pregnancy confirmation, subject to dam ownership, age, duplicate, and review validation. It links to the dam and an eligible current breeding cycle when present.
- Calf inventory is created only after MAO approval. Reconciliation is atomic and uses a locked calving row plus an inventory marker so retries create one calf. The calf begins unassigned to a herd.
- Calving workflow events retain submission, correction, resubmission, verification, return, and approval history.

## 6. Conception Prediction & AI Governance (Phase 7)
### Data Readiness Audit Findings
- Live database audit (`audit_dataset.py`):
  - Female breeding stock: 149 head.
  - Recorded calving records: 26.
  - Recorded breeding attempts: 0.
  - Verified breeding outcomes: 0.
- **Policy Decision**: Individual ML prediction is marked `BLOCKED_PENDING_DATA` (`"Deferred (Data Collection Phase)"`).
- **Rationale**: Training a classifier (e.g. Logistic Regression or Random Forest) on synthetic or zero-sample field data violates data integrity and academic defensibility standards. A minimum of 30 independent verified breeding outcomes is required before fitting a classification model.

---

## 7. Treatment and Health History Integration (Phase 5)
Treatment history is stored in `LivestockTreatmentRecord` linked directly to individual `LivestockInventory` animals:
- `treatment_date`, `treatment_type`, `medication_name`, `dosage`, `route_of_administration`, `reason`, `administered_by`, `notes`, `follow_up_date`.
- Scoped strictly by user ownership: Farmers can log treatments only on their own animals and view only their own records.
- Accessible via `GET /production/livestock/<pk>/reproductive-summary/` and `GET /production/treatments/?livestock=<id>`.

---

## 8. Verification
Test counts and check results in earlier versions of this document describe the
earlier implementation and are not current verification evidence. Add new
results here only after running them against the current code and environment.

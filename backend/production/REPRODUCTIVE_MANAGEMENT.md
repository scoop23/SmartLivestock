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
| **Exposed** | `EXPOSED` | Amber | Recorded breeding event (AI/Natural) awaiting pregnancy check, OR currently housed in the same active batch with an approved sire bull of the same species. **Herd exposure alone never confirms pregnancy.** |
| **Unknown / Not Recorded** | `UNKNOWN` | Slate | No breeding, herd bull exposure, or calving records logged in SmartLivestock, OR historical pregnancy confirmation overdue past biological gestation + 45 days without a recorded birth. |

### Cycle-Aware Precedence Rules
1. **Biological Gestation Boundaries**: Standard species gestation periods:
   - Cattle: 283 days
   - Carabao: 310 days
   - Goat: 150 days
   - Sheep: 147 days
   - Swine: 114 days
2. **Post-Parturition Reset**: A recorded calving event completes cycle $N$. If the cow is bred again after that calving date, cycle $N+1$ begins immediately and status transitions to `EXPOSED` (or `PREGNANT` upon confirmation), preventing the cow from being permanently stuck on `COMPLETE`.
3. **Overdue Pregnancy Protection**: If pregnancy was marked confirmed but elapsed time exceeds gestation + 45 grace days without a calving event, the status drops to `UNKNOWN` (`"Overdue / Re-check Required"`), prompting veterinary follow-up.

---

## 3. Herd Bull Exposure vs. Recorded Breeding (Phase 4)
- **Strict Pen Boundaries**: Exposure is identified **only** when a female and an active male of the same species share the exact same `LivestockBatch` (`batch` FK).
- **No False Leaps**: Belonging to the same farm, owner, or barangay does **not** infer exposure if animals reside in separate herds or pens.
- **Exposure Guardrail**: Recorded breeding or herd exposure sets status to `EXPOSED`, never `PREGNANT`.

---

## 4. Descriptive Conception-Rate Analytics (Phase 6)
### Mathematical Definition
$$\text{Observed Conception Rate (\%)} = \frac{\text{Eligible Breeding Events with Confirmed Conception Outcomes}}{\text{Eligible Breeding Events with Known Clinical Outcomes}} \times 100$$

Where:
- **Numerator**: Breeding events with status `PREGNANT` or `CALVED`, or having a recorded `pregnancy_confirmed_date`.
- **Denominator**: $\text{Confirmed Conceptions} + \text{Known Unsuccessful Outcomes (status OPEN)}$.
- **Explicit Exclusion**: Events with status `PENDING_CHECK` are **excluded** from the denominator so awaiting-check records are never penalized as failures.

### Test Fixture Verification
In a test fixture with 40 eligible breeding events with known outcomes (24 confirmed conceptions, 16 open) and 10 pending checks:
$$\text{Conception Rate} = \frac{24}{24 + 16} \times 100 = \frac{24}{40} \times 100 = 60.0\%$$
(Verified deterministically in `production.test_reproductive_management`).

---

## 5. Conception Prediction & AI Governance (Phase 7)
### Data Readiness Audit Findings
- Live database audit (`audit_dataset.py`):
  - Female breeding stock: 149 head.
  - Recorded calving records: 26.
  - Recorded breeding attempts: 0.
  - Verified breeding outcomes: 0.
- **Policy Decision**: Individual ML prediction is marked `BLOCKED_PENDING_DATA` (`"Deferred (Data Collection Phase)"`).
- **Rationale**: Training a classifier (e.g. Logistic Regression or Random Forest) on synthetic or zero-sample field data violates data integrity and academic defensibility standards. A minimum of 30 independent verified breeding outcomes is required before fitting a classification model.

---

## 6. Treatment and Health History Integration (Phase 5)
Treatment history is stored in `LivestockTreatmentRecord` linked directly to individual `LivestockInventory` animals:
- `treatment_date`, `treatment_type`, `medication_name`, `dosage`, `route_of_administration`, `reason`, `administered_by`, `notes`, `follow_up_date`.
- Scoped strictly by user ownership: Farmers can log treatments only on their own animals and view only their own records.
- Accessible via `GET /production/livestock/<pk>/reproductive-summary/` and `GET /production/treatments/?livestock=<id>`.

---

## 7. Verification Results (Phase 11)
- **Django System Check**: `python manage.py check` -> 0 issues.
- **Backend Test Suite**:
  - `production.test_reproductive_management`: 15 tests passed in 0.28s.
  - `production.test_breeding_insemination`: 2 tests passed in 0.05s.
  - Combined suite: **17 tests passed, 0 failures, 0 errors**.
- **Frontend Type Check**: `npx tsc --noEmit` -> 0 errors.

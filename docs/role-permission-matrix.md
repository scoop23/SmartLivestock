# SmartLivestock role and workflow matrix

The backend enforces this matrix. Frontend button visibility is only a usability aid.
SIBAT access below means the assigned barangay, or all barangays only when explicitly
granted `ALL_BARANGAYS`. That setting never grants municipal approval authority.
CBAT can view and verify scoped individual inventory, and view scoped health reports;
it is not a substitute for SIBAT health verification or MAO final approval.

CBAT receives scoped inventory and health notifications. For approved disease
reports, the Farmer can add dated follow-up observations without changing the
official outcome. Scoped CBAT or MAO/Admin can record `RECOVERED` or `CLOSED`
with a date and required remarks. SIBAT can read that history but cannot record
an official resolution. Report approval and clinical resolution are separate.
Existing cases start as `NOT_RECORDED`; newly submitted cases start as `OPEN`.
Resolved cases keep their history and reject further updates; a new concern
requires a new report. These outcomes do not certify a laboratory diagnosis.

| Area | Farmer | SIBAT | MAO | Auction |
| --- | --- | --- | --- | --- |
| Production logs | Create/view/edit own farm logs and personal analytics; may query own `RECORDED` logs in Ask SmartLivestock; no review stage | No production verification or NLP access to Farmer milk/meat-yield logs; separate slaughter notices remain visible by barangay | No access to Farmer milk/meat-yield logs through NLP or their forecasts; no farmer-log approval; official slaughter review remains separate | No access |
| Inventory | Create/view own; edit/delete own pending/returned records | View scoped; verify pending or return | View municipal; approve verified or return | No access |
| Sales | Create/view own; delete own pending sales | View scoped; no review authority | View municipal; no approval of completed transfer (Auction ownership transfers finalize sales) | Read only |
| Calving | Create and view own records | View scoped; verify pending or return | View municipal; approve verified or return | No access |
| Batches | Create, view, and manage own groups | View scoped; verify individual members | View municipal; approve verified members | No access |
| Census | No access | Submit within scope; revise own returned submissions | View municipal; approve verified or return | No access |
| Ownership certificates | View related history | No certificate creation or approval | View municipal; approve pending or return | Encode certificates; revise own returned submissions |

## Review state transitions

Inventory, calving, and batch animals follow:

```text
PENDING --SIBAT--> VERIFIED --MAO--> APPROVED
   |                  |
   +--reviewer return-+--> SUBJECT_TO_REVISION
SUBJECT_TO_REVISION --owner edits/resubmits--> PENDING
```

Farmer production logs are saved as `RECORDED`; they do not enter either review transition below. Official slaughter records linked to farmer meat reports keep their separate MAO review.

Sales declarations are not finalized through `LiveAnimalSale` review. Completed transfers use Auction ownership-transfer records and the MAO/Admin approval workflow; SIBAT/CBAT cannot review the legacy declaration endpoint.

Census follows:

```text
VERIFIED --MAO/Admin--> APPROVED
VERIFIED --MAO/Admin returns--> SUBJECT_TO_REVISION
SUBJECT_TO_REVISION --submitting SIBAT revises--> VERIFIED
```

Remarks are required when a reviewer returns a record for revision.

## Batch lifecycle transitions

| Current | Allowed next state |
| --- | --- |
| ACTIVE | ACTIVE, HARVESTED, SOLD |
| HARVESTED | HARVESTED, ARCHIVED |
| SOLD | SOLD, ARCHIVED |
| ARCHIVED | ARCHIVED |

The batch lifecycle is separate from the review status derived from its animals.

## Automatic inventory reconciliation

Validation status and real-world herd status are stored separately. An approved
inventory record can be `ACTIVE`, `SOLD`, `DECEASED`, `SLAUGHTERED`, or
`MOVED_OUT`.

- MAO approval of a calving record creates one approved, active calf inventory record.
- MAO approval of an individual sale marks that animal as sold.
- MAO approval of an individual mortality record marks that animal as deceased.
- A full-batch sale marks every approved active animal as sold and closes the batch.
- Partial batch sales are rejected unless supported by exact-animal handling.
- Grouped mortality identifies the exact affected animals before reconciliation.
- Approved ownership certificates mark the seller's historical animal as sold and
  detach it from its herd. A registered buyer submits acquired inventory separately;
  the certificate does not reassign the seller's original inventory row.

Reconciliation is atomic and idempotent: the event approval and inventory update
succeed together, and the same event cannot update inventory twice.

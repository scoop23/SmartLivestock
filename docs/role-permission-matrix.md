# SmartLivestock role and workflow matrix

The backend enforces this matrix. Frontend button visibility is only a usability aid.

| Area | Farmer | SIBAT | MAO | Auction |
| --- | --- | --- | --- | --- |
| Inventory | Create, view, edit, or delete own pending/returned records | View all; verify pending or return | View all; approve verified or return | No access |
| Sales | Create, view, or delete own pending sales | View all; verify pending or return | View all; approve verified or return | Read only |
| Calving | Create and view own records | View all; verify pending or return | View all; approve verified or return | No access |
| Batches | Create, view, and manage own batches | View all; verify pending animals or return | View all; approve verified animals or return | No access |
| Census | No access | Create, view, and revise own returned submissions | View all; approve pending or return | No access |

## Review state transitions

Inventory, sales, calving, and batch animals follow:

```text
PENDING --SIBAT--> VERIFIED --MAO--> APPROVED
   |                  |
   +--reviewer return-+--> SUBJECT_TO_REVISION
SUBJECT_TO_REVISION --owner edits/resubmits--> PENDING
```

Census follows:

```text
PENDING --MAO--> APPROVED
PENDING --MAO returns--> SUBJECT_TO_REVISION
SUBJECT_TO_REVISION --submitting SIBAT revises--> PENDING
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

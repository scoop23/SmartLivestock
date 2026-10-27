# Farmer production logs and slaughter reports

New milk, meat-yield, egg, and wool entries in `ProductionRecord` are saved as
`RECORDED`. They belong to the farmer's own production history and do not create
a SIBAT/CBAT verification task or MAO production-approval task. The farmer can
correct a recorded entry. Older `PENDING`, `VERIFIED`, `APPROVED`, and returned
records and their workflow events remain unchanged for historical context. The
legacy review endpoint no longer processes production logs; municipal access to
them remains available in authorized read and analytics views.

Milk anomaly assessment is an advisory comparison against the same animal's
earlier recorded or historically approved sessions. An unusual result does not
block saving, change the queue, or prove inaccurate reporting. The seven-day
forecast predicts daily totals and is not compared with one milking session.
Municipal production analytics and predictive training still use approved
records only; personal `RECORDED` entries appear in farmer analytics, not in
official approved totals.

A farmer meat-yield entry creates one linked `SlaughterRecord` in `PENDING`
status. This is a **farmer-reported, unverified slaughter notice**, visible to
assigned SIBAT/CBAT officers in their barangay and to MAO/Admin. Field officers
receive a notice and have read-only visibility. MAO/Admin review the official
slaughter record in the slaughter queue. Approval reconciles the exact selected
animals once; returning it asks the farmer to correct the linked meat entry,
which resubmits the same slaughter record. The personal production record stays
`RECORDED` throughout. Facility-entered aggregate slaughter totals retain
their separate existing workflow and do not change individual inventory.

The `RECORDED` migration only adds a choice to the existing production status
field and changes the anomaly choice label. It does not rewrite historical
records or timestamps. Deployments must apply that migration before using the
new code. The demo seed refuses to rewrite an old tracked scenario; clean and
reseed **only synthetic demo data** after confirming the intended local database.

Calving keeps its existing field verification and MAO approval because approval
creates a registered calf in livestock inventory. Weight logs already save
without a production approval stage. Existing breeding and insemination entries
remain farmer-owned. Saving one notifies the farmer of its estimated due date;
marking pregnancy confirmed sends another notice. The daily
`send_breeding_due_notifications` command sends one reminder in the 8–30 day
window, one in the 1–7 day window, on the estimated due date, and once up to 30
days afterward. It only sends due-date reminders for entries marked
`PREGNANT`, so an insemination awaiting a check is not presented as a confirmed
pregnancy. Configure the deployment scheduler to run the command daily.

Calving submission and its existing field-verification/MAO workflow are
unchanged.

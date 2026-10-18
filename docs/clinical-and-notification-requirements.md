# Clinical and notification requirements — 18 October 2026

This records the user's approved workflow and the decisions still needed from
MAO. A documented requirement is not automatically an implemented feature.

## Approved and implemented

- A Farmer submits a disease observation through SIBAT verification and MAO
  approval. Report approval does not certify recovery or a laboratory diagnosis.
- After approval, the Farmer may append a dated observation or request follow-up.
  The Farmer cannot record an official recovered/closed outcome.
- Scoped CBAT or MAO/Admin may record `RECOVERED` or `CLOSED`, with a date from
  the report date through today and nonblank remarks. SIBAT may read the history.
- History retains the actor, role, observation/resolution date and recording
  timestamp. The API does not edit or delete history. Competing resolutions lock
  the case so only one terminal outcome can be recorded.
- Existing cases remain `NOT_RECORDED` until an outcome is explicitly recorded;
  new submissions start `OPEN`. No historical recovery dates are invented.
- A terminal case remains historical and leaves recent unresolved surveillance
  counts. A new concern requires a new report; reopening is not implemented.
- CBAT receives both inventory and health notifications within its authorized
  barangay scope, including Farmer follow-up requests. Scope expansion does not
  grant municipal approval or SIBAT health-verification authority.

## Vaccine validity: blocked on approved MAO policy

The user confirmed that no approved vaccine schedule is currently available.
Recorded vaccination dates must therefore remain administrative records, not
proof of current immunity or an automatic booster recommendation.

Before implementing vaccine-specific rules, MAO must provide:

| Required decision | Information needed |
|---|---|
| Product and disease | Vaccine product, target disease and applicable species. |
| Eligibility | Required animal age, previous doses and relevant exclusions. |
| Schedule | Dose sequence, minimum interval, booster interval and permitted grace period. |
| Meaning of validity | Whether a rule describes record completeness, a due date or a clinical protection period. |
| Evidence | Approving authority, authoritative reference, effective date and policy version. |
| Missing data | Handling for unknown product, unknown dose/date and imported legacy records. |
| Officer workflow | Who records administration, verifies evidence, corrects errors and acknowledges reminders. |

Future acceptance criteria: distinguish “recorded,” “schedule unknown,” “due” and
“overdue”; retain the rule/version used; calculate dates in the municipal time
zone; never infer a product from an animal's last-vaccination date; enforce
ownership and reviewer scope on reminders and APIs. Clinical intervals remain
unset until approved.

## Future decisions, not enabled automatically

- **Case corrections/reopening:** MAO must define authority, required reason,
  event history and handling when an outcome was entered incorrectly. Historical
  outcomes should not be silently overwritten.
- **Animal versus case outcome:** define whether one case covers multiple animals
  and whether mixed outcomes require animal-specific events. Current resolution
  applies to the reported case, not a blanket certificate for every animal.
- **Clinical evidence:** define when an examination, laboratory result or
  veterinary sign-off is required. The current status alone is not that evidence.
- **Expanded notifications:** production, sales, census, email/SMS, escalation
  timers and recurring reminders require explicit recipients, scope, triggers,
  privacy wording and cancellation/deduplication rules. They are not included in
  the approved CBAT inventory-and-health expansion.

These future policies should be approved before schema/UI changes are presented
as clinical or municipal operating rules.

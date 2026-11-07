# Active registered livestock population forecast

The population card in `/analysis/predictive` and `/analysis/evaluated-forecasts` replaces the former quarterly census prediction. Census reporting remains separate. This forecasts approved, active, individually registered animal records, not every animal physically present in Padre Garcia.

## Balance and workflow

`Closing heads = opening heads + registrations + births - sales - deaths - other removals`.

- Pending and verified applications add nothing. Approval adds one head.
- Approved calving creates one calf and records one birth, not another registration.
- Sale removes the seller's animal from active records. The buyer must register it; approval adds it back.
- Mortality removes specifically identified animals once. Slaughter and other departures from active registration are removals.
- Herd assignments add no heads. Census snapshots and external market transactions are not added to inventory.
- An internal sale can temporarily reduce the registered count until buyer registration. This is not a claim of municipal emigration.

`LivestockInventory.save()` locks the prior row and records count/scope changes atomically in `RegisteredPopulationChange`. Calving, sale, mortality and slaughter reconciliation use this path. Deletions record a removal. Repeated saves without count changes add no events. Historical events retain animal ID references after deletion. Tracking starts with migration `0033_registered_population_balance`; existing inventory is the opening population, not fabricated historical registrations. Bulk/direct database operations bypassing these application paths are outside this tracking coverage.

## Estimates and assumptions

The API remains `GET /api/analytics/predictive/population/`, restricted to MAO/Admin. Filters are `barangay_id`, `species_id`, and monthly `horizon` (1–12).

Automatic estimates need three complete tracked calendar months. The partial deployment month is excluded. The initial method is Recent 3-month average for each of the five components. With sufficient history, identical full-horizon historical windows compare that method with Seasonal Naive; Seasonal Naive is selected only with three usable origins and lower mean component absolute error. Component errors do not establish closing-population accuracy. The balance is then applied successively from today's current count to dates one through twelve months ahead.

The panel also accepts explicit monthly assumptions for all five components, including zeros. They repeat each future month and are labelled MAO monthly scenario, not validated machine-learning output. Counts are validated by the server. A balance that becomes negative is rejected rather than silently clipped. Neither modes changes actual inventory.

The response schema replaces the old quarterly census-history schema. Update API consumers together; no census totals or eight-quarter minimum is used by this card.

Automatic mode is the default and requires no manually entered counts. The chart shows recorded registered population and successive dated monthly forecast points. It labels manual scenarios separately and offers a return-to-automatic control. The API exposes mode, training-through date, forecast period start/end and lead months. Historical month-end populations are reconstructed from today's count and subsequent recorded ledger changes, not independent census observations; inconsistent negative reconstructed counts remain gaps.

## Buyer registration and certificate checks

The farmer registration form lists unused approved purchases belonging to the authenticated buyer. `purchase_transfer_id` is validated server-side and uniquely links a sale to its buyer registration. A renewed certificate is required for a linked purchase. A traced SOLD registration can share its physical tag with its successor; unrelated duplicate tags remain blocked. The seller's historical record is preserved.

An optional certificate image supports review. MAO inventory approval of a record presenting a certificate requires an issuing-office check: office, register/confirmation reference, and officer confirmation. The server stores verifier identity, timestamp and checked certificate number in `certificate_verification`. Clients cannot set that verification metadata. Replacing the number/image clears old evidence. The individual review dialog and inventory validation dialog collect this evidence.

Matching a number or uploading an image does not prove authenticity. This is a recorded human check against the issuer, not an automated connection to an external issuing registry. Existing auction-gate recording remains a separate staff workflow; merely recording a certificate there does not establish issuer verification.

## Deployment and checks

Apply `python manage.py migrate` with the intended environment before running the updated backend. The local migration was applied during implementation. Django system/migration checks and frontend TypeScript checks were performed. Transactional smoke checks exercised the MAO certificate guard, buyer ownership and one-time purchase link, pending/approved counts, sales, idempotent calving and mortality, scenario arithmetic, negative balances and role restrictions. All smoke fixtures were rolled back. No real history was backdated or seeded for this feature.

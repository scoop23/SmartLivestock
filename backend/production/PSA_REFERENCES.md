# PSA production reference values

Production submission is optional and performs no external requests. Missing or ambiguous references produce `valuation_snapshot: null`, not zero currency. The normal Farmer -> SIBAT -> MAO workflow is unchanged.

## Compatibility

Registered types at implementation: Cattle, Swine, Sheep. The existing serializer also supports Carabao, Goat and poultry aliases.

| Species | Valid output | Valuation |
| --- | --- | --- |
| Cattle, Carabao, Goat | Milk / liters | Species-specific PSA dairy reference |
| Cattle, Carabao, Goat, Swine, Sheep, poultry | Meat / kilograms | No verified carcass-yield reference; liveweight prices must not be used |
| Sheep | Wool / kilograms | No verified PSA reference |
| Chicken, Duck | Eggs / pieces | Respective PSA egg commodity |
| Generic Poultry | Eggs / pieces | Ambiguous chicken/duck commodity; unavailable without an explicit defensible mapping |

## Included source observations

Official source: https://psa.gov.ph/sites/default/files/lpsd/Q1%202026%20Livestock%20and%20Poultry,%20May%202026_0.pdf

National, Philippines, January-March 2026, preliminary:
- Table 15: cattle dairy PHP47.05/liter; carabao dairy PHP89.55/liter; goat dairy PHP103.80/liter.
- Table 23: chicken egg average PHP6.89/piece.
- Table 29: duck egg average PHP9.06/piece.

The `PSA_*` commodity keys are internal stable identifiers for these named bulletin commodities, not claims of official OpenSTAT API codes.

## Matching and reproducibility

An explicit database mapping binds a registered livestock type, existing production type and unit to a commodity. Matching requires identical units and product basis and preferably a reference period containing the event date. If none exists, use the most recent completed reference period before the event date and mark the snapshot PREVIOUS_PERIOD. Future periods are never used. Included references are national proxies, not Padre Garcia prices. The UI discloses previous-period estimates and the actual reference period. No unit conversion, liveweight-to-meat conversion, or income estimation occurs. Multiple active matching references yield unavailable values.

Values use Decimal arithmetic, rounded once per report to two decimal places. References cannot be edited in place; add a new revision and deactivate the old record. A report snapshot preserves the price, period, source, geography and input measurement. Notes-only edits preserve the snapshot, including a previous-period price after newer references are loaded. Quantity, date, species or product edits intentionally recalculate it. Read-only API fields prevent clients from setting a valuation.

Municipal analytics aggregate snapshots only for approved, dated reports, identify unvalued reports and sum existing monetary snapshots in SQL. Farmer history displays valuations regardless of review status with the report status intact. These are reference values of recorded production, not realized revenue or total municipal production.

## Deployment and updates

Run `python manage.py migrate` then `python manage.py load_psa_prices`. The offline loader is idempotent, adds references and maps only registered identifiable species. It does not create livestock types or production records. Register additional supported species before re-running it, or configure mappings in Django admin. Non-national reference selection is not implemented.

To intentionally value existing reports without snapshots, run `python manage.py load_psa_prices --backfill`. Existing snapshots, quantities and statuses remain unchanged. Later PSA releases require verified source observations and a deliberate reference-data update; no automatic external fetching occurs.

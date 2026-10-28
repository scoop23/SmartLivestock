# Farmer Production and Slaughter Records

## Routine production logs

Farmer milk, meat-yield, egg, and wool entries are stored as `ProductionRecord` rows with status `RECORDED`. They remain in the farmer's own history and eligible production analytics without entering the municipal approval queue. The API validates that the source animal or batch belongs to the authenticated farmer and is eligible for production logging.

A meat-yield entry is a farmer-reported output measurement. By default, it has no linked `SlaughterRecord`, sends no reviewer notification, and does not change inventory status or quantity.

## Optional official slaughter report

When a farmer also intends to report an actual slaughter for official review, the production form requires an explicit selection and the exact animals. It sends `submit_slaughter_report=true` with the selected animal IDs. The backend then creates the linked pending `SlaughterRecord` and uses the existing scoped notification and review workflow. Inventory reconciliation remains gated on MAO approval. The farmer yield and official slaughter event remain distinct records, and analytics exclude the linked production projection from farmer-yield totals to avoid double counting.

The existing slaughterhouse staff API at `/production/slaughterhouse/records/` remains the separate path for facility aggregate submissions. This change does not alter that role's permissions or review flow.

## Historical records

Existing production rows linked to slaughter reports retain their review and inventory history. Editing those rows continues to update the linked report according to the existing revision workflow. New ordinary meat-yield logs are unlinked unless the farmer explicitly chooses the optional official report.

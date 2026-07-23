from django.shortcuts import render

# TODO: Build CRUD viewsets for:
#   - LivestockInspection (create with nested InspectionItems)
#   - LivestockInspectionItem (nested under inspection)
#   - LivestockInspectionClearance (create after inspection approved)
#   - MeatMovementRecord (create, list — links back to SlaughterRecord)
#
# The inspection → items → clearance flow should be handled together:
#   POST /api/inspections/ with nested items → auto-creates Inspection + Items
#   POST /api/inspections/{id}/clearance/ → issues clearance certificate

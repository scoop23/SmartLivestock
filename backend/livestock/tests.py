from django.test import TestCase

# TODO: Write tests for:
#   - LivestockInventory CRUD (create as farmer, review as SIBAT/MAO)
#   - Status workflow: PENDING → APPROVED/REJECTED transitions with correct permissions
#   - CensusSubmission (quarterly validation — quarter must be 1–4)
#   - Farmer creation is gated by User having valid role=FARMER
#   - Barangay GIS coordinates are valid lat/lng

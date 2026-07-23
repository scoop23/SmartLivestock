from django.shortcuts import render

# TODO: Build CRUD viewsets for:
#   - Barangay (list only — mostly static data)
#   - Farmer (list, retrieve — created by RegisterSerializer)
#   - LivestockType (list only — mostly static)
#   - LivestockInventory (create, list, retrieve, update, destroy — farmer submits, SIBAT/MAO reviews)
#   - CensusSubmission (create, list — SIBAT submits quarterly)
#
# Use DRF ModelViewSet + permission classes for role-based access.
# Example:
#   class LivestockInventoryViewSet(ModelViewSet):
#       queryset = LivestockInventory.objects.all()
#       serializer_class = LivestockInventorySerializer
#       permission_classes = [IsAuthenticated]

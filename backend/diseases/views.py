from django.shortcuts import render

# TODO: Build CRUD viewsets for:
#   - DiseaseCase (create, list by farmer, review by SIBAT/MAO)
#   - MortalityRecord (create, list, optionally linked to a DiseaseCase)
#
# DiseaseCase and MortalityRecord can share a nested route:
#   /api/livestock/{id}/disease-cases/
#   /api/disease-cases/{id}/mortality-records/

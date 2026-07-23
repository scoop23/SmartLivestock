from django.apps import AppConfig


# Disease outbreak (DiseaseCase) and mortality (MortalityRecord) tracking.
# MortalityRecord can optionally link back to a DiseaseCase to trace disease-related deaths.
class DiseasesConfig(AppConfig):
    name = 'diseases'

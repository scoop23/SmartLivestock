from django.apps import AppConfig


# Livestock inspection, clearance, and meat movement tracking.
# Full chain: Inspection → InspectionItems → Clearance → MeatMovementRecord
class MovementsConfig(AppConfig):
    name = 'movements'

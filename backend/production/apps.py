from django.apps import AppConfig


# Production records: milk/eggs/wool output, slaughter (katay), and live animal sales.
# Links back to livestock inventory to track per-animal production metrics.
class ProductionConfig(AppConfig):
    name = 'production'

from django.apps import AppConfig


# Core livestock data: Barangays, Farmers, LivestockTypes, LivestockInventory, and CensusSubmissions.
# This app manages the foundational data layer that all other apps (production, diseases, movements) depend on.
class LivestockConfig(AppConfig):
    name = 'livestock'

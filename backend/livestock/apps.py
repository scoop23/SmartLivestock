from django.apps import AppConfig


# Core livestock data: Barangays, Farmers, LivestockTypes, LivestockInventory, and CensusSubmissions.
# This app manages the foundational data layer that all other apps (production, diseases, movements) depend on.
class LivestockConfig(AppConfig):
    name = 'livestock'

    def ready(self):
        from django.db.models.signals import post_delete
        from .models import LivestockInventory
        from .population_changes import record_change, snapshot

        def inventory_deleted(sender, instance, **kwargs):
            record_change(snapshot(instance), None, instance)
        post_delete.connect(inventory_deleted, sender=LivestockInventory, weak=False, dispatch_uid="registered_population_delete")

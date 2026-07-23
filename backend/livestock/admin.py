from django.contrib import admin
from .models import Barangay, Farmer, LivestockType, LivestockInventory

admin.site.register(Barangay)
admin.site.register(Farmer)
admin.site.register(LivestockType)
admin.site.register(LivestockInventory)
# NOTE: CensusSubmission is not registered in admin yet.
# Import and register it once the model and its workflow are stable.

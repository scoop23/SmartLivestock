from django.contrib import admin
from .models import Barangay, Farmer, LivestockType, LivestockInventory
# Register your models here.

admin.site.register(Barangay)
admin.site.register(Farmer)
admin.site.register(LivestockType)
admin.site.register(LivestockInventory)

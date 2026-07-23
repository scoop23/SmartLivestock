from django.contrib import admin
from .models import (
    LivestockInspection,
    LivestockInspectionItem,
    LivestockInspectionClearance,
    MeatMovementRecord,
)

# Inspection chain: LivestockInspection holds the header with shipper/destination,
# InspectionItem lists the animals being moved,
# LivestockInspectionClearance is the official certificate,
# MeatMovementRecord tracks post-slaughter meat transport.
admin.site.register(LivestockInspection)
admin.site.register(LivestockInspectionItem)
admin.site.register(LivestockInspectionClearance)
admin.site.register(MeatMovementRecord)

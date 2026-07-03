from django.contrib import admin
from .models import (
    LivestockInspection,
    LivestockInspectionItem,
    LivestockInspectionClearance,
    MeatMovementRecord,
)

admin.site.register(LivestockInspection)
admin.site.register(LivestockInspectionItem)
admin.site.register(LivestockInspectionClearance)
admin.site.register(MeatMovementRecord)


# Register your models here.

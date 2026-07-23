from django.contrib import admin
from .models import DiseaseCase, MortalityRecord

# Disease outbreak and mortality records for health monitoring and FMD tracking
admin.site.register(DiseaseCase)
admin.site.register(MortalityRecord)

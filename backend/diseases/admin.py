from django.contrib import admin
from .models import DiseaseCase, MortalityRecord
# Register your models here.

admin.site.register(DiseaseCase)
admin.site.register(MortalityRecord)

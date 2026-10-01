from django.contrib import admin
from .models import PSACommodityMapping, PSAReferencePrice


@admin.register(PSACommodityMapping)
class PSACommodityMappingAdmin(admin.ModelAdmin):
    list_display = ("livestock_type", "production_type", "unit", "commodity_id", "active")


@admin.register(PSAReferencePrice)
class PSAReferencePriceAdmin(admin.ModelAdmin):
    list_display = ("commodity", "price", "unit", "reference_period", "geography", "revision", "active")
    readonly_fields = ("loaded_at",)

    def get_readonly_fields(self, request, obj=None):
        if obj:
            return tuple(field.name for field in self.model._meta.fields if field.name != "active")
        return self.readonly_fields

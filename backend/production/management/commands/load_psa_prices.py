"""Load curated, cited PSA references offline; never fetch while farmers submit."""
from datetime import date
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.db import transaction
from livestock.models import LivestockType
from production.models import PSACommodityMapping, PSAReferencePrice, ProductionRecord
from production.services.valuation import snapshot_for

SOURCE = "https://psa.gov.ph/sites/default/files/lpsd/Q1%202026%20Livestock%20and%20Poultry,%20May%202026_0.pdf"
# National Q1 2026 preliminary observations, not current-price fallbacks.
REFERENCES = [
    ("PSA_DAIRY_CATTLE", "Dairy cattle milk", "MILK", "LITERS", "47.05", "Table 15", ("CATTLE", "BAKA", "BOVINE", "COW")),
    ("PSA_DAIRY_CARABAO", "Dairy carabao milk", "MILK", "LITERS", "89.55", "Table 15", ("CARABAO", "KALABAW", "BUFFALO")),
    ("PSA_DAIRY_GOAT", "Dairy goat milk", "MILK", "LITERS", "103.80", "Table 15", ("GOAT", "KAMBING", "CAPRINE")),
    ("PSA_CHICKEN_EGG", "Chicken egg (average)", "EGGS", "PIECES", "6.89", "Table 23", ("CHICKEN", "MANOK", "HEN")),
    ("PSA_DUCK_EGG", "Duck egg", "EGGS", "PIECES", "9.06", "Table 29", ("DUCK", "ITIK")),
]


class Command(BaseCommand):
    help = "Load verified PSA Q1 2026 national references and mappings for registered species."

    def add_arguments(self, parser):
        parser.add_argument("--backfill", action="store_true", help="Intentionally value existing reports with no snapshot; preserve existing snapshots.")

    @transaction.atomic
    def handle(self, *args, **options):
        species = list(LivestockType.objects.all())
        for commodity_id, commodity, basis, unit, price, table, aliases in REFERENCES:
            reference, _ = PSAReferencePrice.objects.get_or_create(
                commodity_id=commodity_id, period_start=date(2026, 1, 1), period_end=date(2026, 3, 31),
                revision=1, geographic_level="NATIONAL", geography="Philippines",
                defaults={"commodity": commodity, "product_basis": basis, "unit": unit, "price": Decimal(price),
                          "reference_period": "January-March 2026", "source_url": SOURCE,
                          "source_title": "Livestock and Poultry Quarterly Bulletin, January-March 2026", "source_table": table},
            )
            for livestock_type in species:
                if any(alias in livestock_type.name.upper() for alias in aliases) and sum(
                    1 for candidate in REFERENCES if candidate[2] == basis and any(alias in livestock_type.name.upper() for alias in candidate[6])
                ) == 1:
                    mapping, _ = PSACommodityMapping.objects.get_or_create(livestock_type=livestock_type,
                        production_type=basis, unit=unit, defaults={"commodity_id": commodity_id})
                    mapping.full_clean()
        valued = 0
        if options["backfill"]:
            # Explicit backfill changes only missing valuations, never quantities or approval statuses.
            for record in ProductionRecord.objects.filter(valuation_snapshot__isnull=True).select_related("livestock", "batch").iterator():
                snapshot = snapshot_for(record)
                if snapshot:
                    record.valuation_snapshot = snapshot
                    record.save(update_fields=["valuation_snapshot"])
                    valued += 1
        self.stdout.write(self.style.SUCCESS(f"PSA references loaded. Existing reports valued: {valued}."))

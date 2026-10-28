from django.test import SimpleTestCase
from rest_framework.exceptions import ValidationError

from analytics.services.predictive.data import extract_monthly_series
from analytics.services.predictive.diagnostics import CORE_DIAGNOSTIC_TARGETS


class RetiredProductionTests(SimpleTestCase):
    def test_farmer_yields_are_rejected_before_database_access(self):
        for target, unit in (("MILK", "LITERS"), ("MEAT", "KILOGRAMS")):
            with self.subTest(target=target), self.assertRaises(ValidationError):
                extract_monthly_series(domain="production", target=target, unit=unit)

    def test_readiness_catalog_excludes_production(self):
        self.assertTrue(CORE_DIAGNOSTIC_TARGETS)
        self.assertNotIn("production", {target["domain"] for target in CORE_DIAGNOSTIC_TARGETS})

    def test_surveillance_readiness_targets_keep_units_separate(self):
        targets = {(target["domain"], target["unit"]) for target in CORE_DIAGNOSTIC_TARGETS}
        self.assertTrue({("disease", "CASES"), ("disease", "HEADS"), ("mortality", "HEADS")} <= targets)

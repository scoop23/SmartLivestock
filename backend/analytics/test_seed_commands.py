"""
Tests for SmartLivestock Synthetic Analytics Seed Commands and Non-Destructive Clean Safety.

Verifies:
1. Seed commands generate realistic, valid records adhering to domain model constraints.
2. Farmer-reported MEAT production records have slaughter=None (independent of abattoir data).
3. Unit purity is strictly enforced across commodities (Milk: LITERS, Meat: KILOGRAMS, Eggs: PIECES, Wool: KILOGRAMS).
4. Pre-movement inspection clearances strictly adhere to certificate issuance constraints.
5. --clean strictly purges ONLY synthetic records carrying project seed markers, leaving real farmer data untouched.
6. The master command 'seed_analytics_test_data' orchestrates seed and clean across all domains safely.
"""

from datetime import date, time
from decimal import Decimal

from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone

from production.models import ProductionRecord, CalvingRecord
from diseases.models import DiseaseCase, MortalityRecord
from movements.models import (
    LivestockInspection,
    LivestockInspectionItem,
    LivestockInspectionClearance,
)
from livestock.models import Barangay, Farmer, LivestockInventory, LivestockType
from users.models import Role, User
from analytics.seed_markers import (
    SEED_MARKER_PRODUCTION_V2,
    SEED_MARKER_CALVING,
    SEED_MARKER_DISEASE,
    SEED_MARKER_MORTALITY,
    SEED_MARKER_INSPECTION,
)


class SeedCommandsTests(TestCase):
    def setUp(self):
        # Create roles and test users
        self.mao_role, _ = Role.objects.get_or_create(role_name="MAO")
        self.farmer_role, _ = Role.objects.get_or_create(role_name="FARMER")

        self.mao_user = User.objects.create_user(
            username="mao_seed_test",
            email="mao_seed@test.example",
            role=self.mao_role,
        )
        self.farmer_user = User.objects.create_user(
            username="farmer_seed_test",
            email="farmer_seed@test.example",
            role=self.farmer_role,
        )

        self.barangay = Barangay.objects.create(
            barangay_name="San Roque",
            latitude=Decimal("13.880000"),
            longitude=Decimal("121.210000"),
        )
        self.farmer_profile = Farmer.objects.create(
            user=self.farmer_user,
            barangay=self.barangay,
            address="Poblacion, Padre Garcia",
        )

        self.cattle_type = LivestockType.objects.create(name="Cattle")
        self.poultry_type = LivestockType.objects.create(name="Poultry")
        self.sheep_type = LivestockType.objects.create(name="Sheep")

        # Create approved active inventory
        self.cow = LivestockInventory.objects.create(
            tag_number="TAG-SEED-COW-01",
            livestock_type=self.cattle_type,
            farmer=self.farmer_profile,
            status="APPROVED",
            operational_status="ACTIVE",
            quantity=1,
            created_by=self.farmer_user,
        )

    def test_seed_productions_all_commodities_and_unit_purity(self):
        """
        Verify that seed_productions with production_type='ALL' generates
        distinct time series for Milk, Meat, Eggs, and Wool with correct units,
        and farmer meat has slaughter=None.
        """
        call_command("seed_productions", months=12, production_type="ALL")

        # 1. Milk in Liters
        milk_qs = ProductionRecord.objects.filter(
            production_type=ProductionRecord.ProductionType.MILK,
            notes__contains=SEED_MARKER_PRODUCTION_V2,
        )
        self.assertEqual(milk_qs.count(), 12)
        for r in milk_qs:
            self.assertEqual(r.unit, ProductionRecord.UnitType.LITERS)
            self.assertEqual(r.status, ProductionRecord.ProductionStatus.APPROVED)

        # 2. Farmer-Reported Meat in Kilograms (slaughter=None)
        meat_qs = ProductionRecord.objects.filter(
            production_type=ProductionRecord.ProductionType.MEAT,
            notes__contains=SEED_MARKER_PRODUCTION_V2,
        )
        self.assertEqual(meat_qs.count(), 12)
        for r in meat_qs:
            self.assertEqual(r.unit, ProductionRecord.UnitType.KILOGRAMS)
            self.assertIsNone(r.slaughter, "Farmer-reported meat must have slaughter=None!")
            self.assertEqual(r.status, ProductionRecord.ProductionStatus.APPROVED)

        # 3. Eggs in Pieces
        eggs_qs = ProductionRecord.objects.filter(
            production_type=ProductionRecord.ProductionType.EGGS,
            notes__contains=SEED_MARKER_PRODUCTION_V2,
        )
        self.assertEqual(eggs_qs.count(), 12)
        for r in eggs_qs:
            self.assertEqual(r.unit, ProductionRecord.UnitType.PIECES)

        # 4. Wool in Kilograms
        wool_qs = ProductionRecord.objects.filter(
            production_type=ProductionRecord.ProductionType.WOOL,
            notes__contains=SEED_MARKER_PRODUCTION_V2,
        )
        self.assertEqual(wool_qs.count(), 12)
        for r in wool_qs:
            self.assertEqual(r.unit, ProductionRecord.UnitType.KILOGRAMS)

        # Total seeded = 12 * 4 = 48
        self.assertEqual(
            ProductionRecord.objects.filter(notes__contains=SEED_MARKER_PRODUCTION_V2).count(),
            48,
        )

    def test_seed_productions_clean_preserves_real_records(self):
        """Verify that --clean deletes ONLY records with seed markers and preserves real records."""
        # Create a real unseeded record
        real_record = ProductionRecord.objects.create(
            livestock=self.cow,
            production_type=ProductionRecord.ProductionType.MILK,
            quantity=Decimal("12.50"),
            unit=ProductionRecord.UnitType.LITERS,
            record_date=date(2026, 9, 20),
            status=ProductionRecord.ProductionStatus.APPROVED,
            notes="Authoritative farmer daily milk record without seed marker.",
            created_by=self.farmer_user,
        )

        call_command("seed_productions", months=12, production_type="MILK")
        self.assertEqual(ProductionRecord.objects.count(), 13)

        # Clean
        call_command("seed_productions", clean=True)

        self.assertEqual(ProductionRecord.objects.count(), 1)
        self.assertTrue(ProductionRecord.objects.filter(id=real_record.id).exists())

    def test_seed_calving_and_clean(self):
        """Verify synthetic calving creation and non-destructive clean."""
        real_calving = CalvingRecord.objects.create(
            dam=self.cow,
            calf_tag="CALF-REAL-001",
            calf_sex=CalvingRecord.SexType.FEMALE,
            birth_weight=Decimal("30.00"),
            calving_date=date(2026, 8, 1),
            status=CalvingRecord.StatusType.APPROVED,
            notes="Real farmer calving report.",
            created_by=self.farmer_user,
        )

        call_command("seed_calving", count=10)
        self.assertEqual(CalvingRecord.objects.count(), 11)

        seeded_calvings = CalvingRecord.objects.filter(notes__contains=SEED_MARKER_CALVING)
        self.assertEqual(seeded_calvings.count(), 10)
        for c in seeded_calvings:
            self.assertEqual(c.status, CalvingRecord.StatusType.APPROVED)
            self.assertIsNotNone(c.dam)
            self.assertIn(c.calf_sex, [CalvingRecord.SexType.MALE, CalvingRecord.SexType.FEMALE])

        # Clean
        call_command("seed_calving", clean=True)
        self.assertEqual(CalvingRecord.objects.count(), 1)
        self.assertTrue(CalvingRecord.objects.filter(id=real_calving.id).exists())

    def test_seed_diseases_and_clean(self):
        """Verify synthetic disease case generation and clean."""
        real_disease = DiseaseCase.objects.create(
            livestock=self.cow,
            name="Real Foot and Mouth Disease",
            affected_count=2,
            record_date=date(2026, 8, 15),
            status=DiseaseCase.DiseaseStatus.APPROVED,
            review_remarks="Official MAO disease case confirmation.",
            created_by=self.farmer_user,
        )

        call_command("seed_diseases", count=12)
        self.assertEqual(DiseaseCase.objects.count(), 13)

        seeded_cases = DiseaseCase.objects.filter(review_remarks__contains=SEED_MARKER_DISEASE)
        self.assertEqual(seeded_cases.count(), 12)
        for dc in seeded_cases:
            self.assertEqual(dc.status, DiseaseCase.DiseaseStatus.APPROVED)
            self.assertGreater(dc.affected_count, 0)

        # Clean
        call_command("seed_diseases", clean=True)
        self.assertEqual(DiseaseCase.objects.count(), 1)
        self.assertTrue(DiseaseCase.objects.filter(id=real_disease.id).exists())

    def test_seed_mortality_dual_attribution_and_clean(self):
        """
        Verify that mortality seeding creates both disease-linked deaths
        (source_disease_case populated) and independent causes.
        """
        # Seed a few diseases first so mortality can link to them
        call_command("seed_diseases", count=5)
        call_command("seed_mortality", count=10)

        mortalities = MortalityRecord.objects.filter(review_remarks__contains=SEED_MARKER_MORTALITY)
        self.assertEqual(mortalities.count(), 10)

        # Check for both disease-linked deaths and independent deaths
        has_disease_linked = mortalities.filter(source_disease_case__isnull=False).exists()
        has_independent = mortalities.filter(source_disease_case__isnull=True).exists()

        self.assertTrue(has_disease_linked, "Should have disease-linked mortality records.")
        self.assertTrue(has_independent, "Should have independent-cause mortality records.")

        # Clean
        call_command("seed_mortality", clean=True)
        call_command("seed_diseases", clean=True)
        self.assertEqual(MortalityRecord.objects.count(), 0)
        self.assertEqual(DiseaseCase.objects.count(), 0)

    def test_seed_inspections_clearance_issuance_and_clean(self):
        """
        Verify inspection seed satisfies model validation:
        - APPROVED clearance has issued_by, date_issued, time_issued.
        - Non-APPROVED clearance has issuance fields empty.
        - --clean removes clearances and inspections safely.
        """
        call_command("seed_inspections", count=8)

        inspections = LivestockInspection.objects.filter(shipper_name__contains=SEED_MARKER_INSPECTION)
        self.assertEqual(inspections.count(), 8)

        clearances = LivestockInspectionClearance.objects.filter(inspection__in=inspections)
        self.assertEqual(clearances.count(), 8)

        # Verify issuance rules
        for clr in clearances:
            if clr.status == LivestockInspectionClearance.StatusType.APPROVED:
                self.assertIsNotNone(clr.issued_by)
                self.assertIsNotNone(clr.date_issued)
                self.assertIsNotNone(clr.time_issued)
            else:
                self.assertIsNone(clr.issued_by)
                self.assertIsNone(clr.date_issued)
                self.assertIsNone(clr.time_issued)

        # Clean
        call_command("seed_inspections", clean=True)
        self.assertEqual(LivestockInspection.objects.count(), 0)
        self.assertEqual(LivestockInspectionClearance.objects.count(), 0)
        self.assertEqual(LivestockInspectionItem.objects.count(), 0)

    def test_master_seed_analytics_test_data(self):
        """Verify master command executes seed and clean lifecycle across all domains."""
        # Run master seed
        call_command("seed_analytics_test_data", months=12)

        self.assertGreater(ProductionRecord.objects.count(), 0)
        self.assertGreater(CalvingRecord.objects.count(), 0)
        self.assertGreater(DiseaseCase.objects.count(), 0)
        self.assertGreater(MortalityRecord.objects.count(), 0)
        self.assertGreater(LivestockInspection.objects.count(), 0)

        # Run master clean
        call_command("seed_analytics_test_data", clean=True)

        self.assertEqual(ProductionRecord.objects.count(), 0)
        self.assertEqual(CalvingRecord.objects.count(), 0)
        self.assertEqual(DiseaseCase.objects.count(), 0)
        self.assertEqual(MortalityRecord.objects.count(), 0)
        self.assertEqual(LivestockInspection.objects.count(), 0)

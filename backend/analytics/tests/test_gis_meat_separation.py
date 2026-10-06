"""
Test suite for GIS Separation of Farmer Meat Production from Slaughter Yield.

EDUCATIONAL GUIDE FOR CAPSTONE PRESENTATION / DEFENSE:
-----------------------------------------------------
1. Why Separation is Crucial:
   - On-farm meat production comes from farmer-reported declarations (`ProductionRecord`,
     `production_type=MEAT`, `unit=KILOGRAMS`), with `slaughter__isnull=True`.
   - Slaughter yield represents inspected carcass weight processed through the municipal
     slaughterhouse facility (`SlaughterRecord.carcass_weight`).
   - Combining them would cause severe double-counting and data integrity violations
     in official Department of Agriculture reports.

2. Test Coverage:
   - Approved on-farm meat production populates `farmer_meat`, not `slaughter_yield`.
   - Approved slaughterhouse carcass weight populates `slaughter_yield`, not `farmer_meat`.
   - Pending / unapproved records are excluded from official GIS statistics.
   - Backward compatibility: `meat` legacy alias equals `slaughter_yield`.
   - Role-Based Access Control: Farmers only see `farmer_meat` (plus personal stats `my_farmer_meat`),
     while slaughterhouse staff only see `slaughter_yield`.
"""

from decimal import Decimal
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from livestock.models import Barangay, Farmer, LivestockInventory, LivestockType
from production.models import ProductionRecord, SlaughterRecord
from users.models import Role
from analytics.services.gis import get_gis_aggregated_data, get_user_gis_scope

User = get_user_model()


class GISMeatSeparationTestCase(TestCase):
    def setUp(self):
        # Roles
        self.role_admin, _ = Role.objects.get_or_create(role_name="ADMIN")
        self.role_mao, _ = Role.objects.get_or_create(role_name="MAO")
        self.role_farmer, _ = Role.objects.get_or_create(role_name="FARMER")
        self.role_slaughter, _ = Role.objects.get_or_create(role_name="SLAUGHTERHOUSESTAFF")

        # Barangays
        self.b_cawongan, _ = Barangay.objects.get_or_create(
            barangay_name="Cawongan",
            defaults={"latitude": Decimal("13.873038"), "longitude": Decimal("121.220908")}
        )
        self.b_manggas, _ = Barangay.objects.get_or_create(
            barangay_name="Manggas",
            defaults={"latitude": Decimal("13.871999"), "longitude": Decimal("121.246593")}
        )

        # Livestock species
        self.cattle_type, _ = LivestockType.objects.get_or_create(name="Cattle")

        # Admin user
        self.admin_user = User.objects.create_user(
            username="admin_meat_test",
            email="admin.meat@padregarcia.gov.ph",
            password="password123",
            role=self.role_admin,
            is_staff=True,
            is_superuser=True,
        )

        # Farmer user & profile in Cawongan
        self.farmer_user = User.objects.create_user(
            username="farmer_meat_test",
            email="farmer.meat@padregarcia.gov.ph",
            password="password123",
            role=self.role_farmer,
        )
        self.farmer_profile = Farmer.objects.create(
            user=self.farmer_user,
            barangay=self.b_cawongan,
            address="Purok 1, Cawongan",
        )

        # Approved livestock inventory for Farmer
        self.inventory = LivestockInventory.objects.create(
            farmer=self.farmer_profile,
            livestock_type=self.cattle_type,
            entry_type=LivestockInventory.EntryType.BATCH,
            quantity=5,
            status=LivestockInventory.StatusType.APPROVED,
            operational_status=LivestockInventory.OperationalStatus.ACTIVE,
            created_by=self.farmer_user,
        )

        # Slaughterhouse staff user
        self.slaughter_user = User.objects.create_user(
            username="slaughter_meat_test",
            email="slaughter.meat@padregarcia.gov.ph",
            password="password123",
            role=self.role_slaughter,
        )

    def test_farmer_meat_isolated_from_slaughter_yield(self):
        """Approved on-farm meat production appears under farmer_meat, not slaughter_yield."""
        ProductionRecord.objects.create(
            livestock=self.inventory,
            production_type=ProductionRecord.ProductionType.MEAT,
            quantity=Decimal("150.00"),
            unit=ProductionRecord.UnitType.KILOGRAMS,
            record_date=timezone.localdate(),
            status=ProductionRecord.ProductionStatus.APPROVED,
            created_by=self.farmer_user,
        )

        data = get_gis_aggregated_data(user=self.admin_user)
        cawongan = data["barangays_dict"]["Cawongan"]

        self.assertEqual(cawongan["farmer_meat"], 150.0)
        self.assertEqual(cawongan["slaughter_yield"], 0.0)
        self.assertEqual(cawongan["meat"], 0.0)
        self.assertEqual(data["summary"]["total_farmer_meat"], 150.0)
        self.assertEqual(data["summary"]["total_slaughter_yield"], 0.0)

    def test_slaughter_yield_isolated_from_farmer_meat(self):
        """Approved slaughterhouse carcass weight appears under slaughter_yield, not farmer_meat."""
        SlaughterRecord.objects.create(
            barangay=self.b_cawongan,
            livestock_type=self.cattle_type,
            quantity=2,
            carcass_weight=Decimal("380.50"),
            record_date=timezone.localdate(),
            status=SlaughterRecord.StatusType.APPROVED,
            created_by=self.slaughter_user,
        )

        data = get_gis_aggregated_data(user=self.admin_user)
        cawongan = data["barangays_dict"]["Cawongan"]

        self.assertEqual(cawongan["slaughter_yield"], 380.5)
        self.assertEqual(cawongan["slaughter_heads"], 2)
        self.assertEqual(cawongan["meat"], 380.5)  # Legacy alias
        self.assertEqual(cawongan["farmer_meat"], 0.0)
        self.assertEqual(data["summary"]["total_slaughter_yield"], 380.5)
        self.assertEqual(data["summary"]["total_slaughter_heads"], 2)
        self.assertEqual(data["summary"]["total_farmer_meat"], 0.0)

    def test_non_approved_records_excluded(self):
        """Pending or rejected records are never included in official GIS totals."""
        # Pending farmer meat
        ProductionRecord.objects.create(
            livestock=self.inventory,
            production_type=ProductionRecord.ProductionType.MEAT,
            quantity=Decimal("200.00"),
            unit=ProductionRecord.UnitType.KILOGRAMS,
            record_date=timezone.localdate(),
            status=ProductionRecord.ProductionStatus.PENDING,
            created_by=self.farmer_user,
        )
        # Pending slaughter yield
        SlaughterRecord.objects.create(
            barangay=self.b_cawongan,
            livestock_type=self.cattle_type,
            quantity=1,
            carcass_weight=Decimal("190.00"),
            record_date=timezone.localdate(),
            status=SlaughterRecord.StatusType.PENDING,
            created_by=self.slaughter_user,
        )

        data = get_gis_aggregated_data(user=self.admin_user)
        cawongan = data["barangays_dict"]["Cawongan"]

        self.assertEqual(cawongan["farmer_meat"], 0.0)
        self.assertEqual(cawongan["slaughter_yield"], 0.0)
        self.assertEqual(data["summary"]["total_farmer_meat"], 0.0)
        self.assertEqual(data["summary"]["total_slaughter_yield"], 0.0)

    def test_coexistence_never_summed_together(self):
        """Both approved farmer meat and slaughter yield exist; metrics remain strictly separated."""
        ProductionRecord.objects.create(
            livestock=self.inventory,
            production_type=ProductionRecord.ProductionType.MEAT,
            quantity=Decimal("100.00"),
            unit=ProductionRecord.UnitType.KILOGRAMS,
            record_date=timezone.localdate(),
            status=ProductionRecord.ProductionStatus.APPROVED,
            created_by=self.farmer_user,
        )
        SlaughterRecord.objects.create(
            barangay=self.b_cawongan,
            livestock_type=self.cattle_type,
            quantity=1,
            carcass_weight=Decimal("250.00"),
            record_date=timezone.localdate(),
            status=SlaughterRecord.StatusType.APPROVED,
            created_by=self.slaughter_user,
        )

        data = get_gis_aggregated_data(user=self.admin_user)
        cawongan = data["barangays_dict"]["Cawongan"]

        self.assertEqual(cawongan["farmer_meat"], 100.0)
        self.assertEqual(cawongan["slaughter_yield"], 250.0)
        self.assertEqual(data["summary"]["total_farmer_meat"], 100.0)
        self.assertEqual(data["summary"]["total_slaughter_yield"], 250.0)
        # Verify no combined "total meat" summation exists that would conflate the two
        self.assertNotEqual(data["summary"]["total_farmer_meat"], data["summary"]["total_slaughter_yield"])

    def test_role_based_layer_permissions(self):
        """Farmers only see farmer_meat; slaughterhouse staff only see slaughter_yield."""
        ProductionRecord.objects.create(
            livestock=self.inventory,
            production_type=ProductionRecord.ProductionType.MEAT,
            quantity=Decimal("75.00"),
            unit=ProductionRecord.UnitType.KILOGRAMS,
            record_date=timezone.localdate(),
            status=ProductionRecord.ProductionStatus.APPROVED,
            created_by=self.farmer_user,
        )
        SlaughterRecord.objects.create(
            barangay=self.b_cawongan,
            livestock_type=self.cattle_type,
            quantity=1,
            carcass_weight=Decimal("300.00"),
            record_date=timezone.localdate(),
            status=SlaughterRecord.StatusType.APPROVED,
            created_by=self.slaughter_user,
        )

        # 1. Farmer Request
        farmer_data = get_gis_aggregated_data(user=self.farmer_user)
        farmer_scope = farmer_data["user_scope"]
        self.assertIn("farmer_meat", farmer_scope["allowed_layers"])
        self.assertNotIn("slaughter_yield", farmer_scope["allowed_layers"])
        self.assertNotIn("meat", farmer_scope["allowed_layers"])
        # Farmer's own personal stats
        self.assertIsNotNone(farmer_data["farmer_stats"])
        self.assertEqual(farmer_data["farmer_stats"]["my_farmer_meat"], 75.0)
        # Slaughter yield is zeroed out for the farmer
        self.assertEqual(farmer_data["barangays_dict"]["Cawongan"]["slaughter_yield"], 0.0)
        self.assertEqual(farmer_data["barangays_dict"]["Cawongan"]["farmer_meat"], 75.0)

        # 2. Slaughterhouse Staff Request
        slaughter_data = get_gis_aggregated_data(user=self.slaughter_user)
        slaughter_scope = slaughter_data["user_scope"]
        self.assertIn("slaughter_yield", slaughter_scope["allowed_layers"])
        self.assertIn("meat", slaughter_scope["allowed_layers"])
        self.assertNotIn("farmer_meat", slaughter_scope["allowed_layers"])
        # Farmer meat is zeroed out for slaughterhouse staff
        self.assertEqual(slaughter_data["barangays_dict"]["Cawongan"]["farmer_meat"], 0.0)
        self.assertEqual(slaughter_data["barangays_dict"]["Cawongan"]["slaughter_yield"], 300.0)

"""
Test suite for GIS Role-Based Scoping & Data Isolation.

EDUCATIONAL GUIDE FOR CAPSTONE PRESENTATION / DEFENSE:
-----------------------------------------------------
1. Why Backend Testing for GIS Scoping is Mandatory:
   In municipal agriculture and disease surveillance systems, exposing private records
   (e.g., neighbor herd counts or disease outbreaks across municipal boundaries) violates
   data privacy regulations. These tests verify that authorization rules are strictly
   enforced at the database and service layer before JSON responses are transmitted.

2. Test Matrix:
   - Admin / MAO: Full access to all 18 barangays, all layers, and disease simulation.
   - SIBAT (Assigned Only): Only assigned barangay data is returned; unassigned barangay
     counts are zeroed out; simulation is disabled.
   - SIBAT (ALL_BARANGAYS): Receives all 18 barangays but simulation remains disabled.
   - Farmer: Only their own registered barangay data is returned; their personal farm stats
     (`farmer_stats`) are included; simulation and out-of-barangay details are barred.
   - Auction: Receives movement tracking and cattle layers; simulation is disabled.
   - Slaughterhouse: Receives meat yield and movement layers; simulation is disabled.
"""

from decimal import Decimal
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from django.urls import reverse
from rest_framework.test import APIClient

from diseases.models import DiseaseCase
from livestock.models import Barangay, Farmer, LivestockInventory, LivestockType
from users.models import Role
from analytics.services.gis import get_gis_aggregated_data, get_user_gis_scope

User = get_user_model()


class GISRoleScopingTestCase(TestCase):
    def setUp(self):
        # Create standard Roles
        self.role_admin, _ = Role.objects.get_or_create(role_name="ADMIN")
        self.role_mao, _ = Role.objects.get_or_create(role_name="MAO")
        self.role_sibat, _ = Role.objects.get_or_create(role_name="SIBAT")
        self.role_farmer, _ = Role.objects.get_or_create(role_name="FARMER")
        self.role_auction, _ = Role.objects.get_or_create(role_name="AUCTION")
        self.role_slaughter, _ = Role.objects.get_or_create(role_name="SLAUGHTERHOUSESTAFF")

        # Create Barangays
        self.b_cawongan, _ = Barangay.objects.get_or_create(
            barangay_name="Cawongan",
            defaults={"latitude": Decimal("13.873038"), "longitude": Decimal("121.220908")}
        )
        self.b_manggas, _ = Barangay.objects.get_or_create(
            barangay_name="Manggas",
            defaults={"latitude": Decimal("13.871999"), "longitude": Decimal("121.246593")}
        )
        self.b_banaba, _ = Barangay.objects.get_or_create(
            barangay_name="Banaba",
            defaults={"latitude": Decimal("13.885149"), "longitude": Decimal("121.221731")}
        )

        # Livestock species
        self.cattle_type, _ = LivestockType.objects.get_or_create(name="Cattle")

        # 1. Admin User
        self.admin_user = User.objects.create_user(
            username="admin_user",
            email="admin@padregarcia.gov.ph",
            password="password123",
            role=self.role_admin,
            is_staff=True,
            is_superuser=True,
        )

        # 2. SIBAT User assigned strictly to Cawongan
        self.sibat_assigned = User.objects.create_user(
            username="sibat_cawongan",
            email="sibat.cawongan@padregarcia.gov.ph",
            password="password123",
            role=self.role_sibat,
            assigned_barangay=self.b_cawongan,
            access_scope=User.AccessScope.ASSIGNED_ONLY,
        )

        # 3. SIBAT User with ALL_BARANGAYS scope
        self.sibat_all = User.objects.create_user(
            username="sibat_all",
            email="sibat.all@padregarcia.gov.ph",
            password="password123",
            role=self.role_sibat,
            assigned_barangay=self.b_cawongan,
            access_scope=User.AccessScope.ALL_BARANGAYS,
        )

        # 4. Farmer User registered in Cawongan
        self.farmer_user = User.objects.create_user(
            username="farmer_juan",
            email="juan.cawongan@gmail.com",
            password="password123",
            role=self.role_farmer,
        )
        self.farmer_profile = Farmer.objects.create(
            user=self.farmer_user,
            barangay=self.b_cawongan,
            address="Purok 2, Cawongan, Padre Garcia",
        )

        # Approved inventory for Farmer Juan (8 heads of cattle)
        LivestockInventory.objects.bulk_create([LivestockInventory(
            farmer=self.farmer_profile,
            livestock_type=self.cattle_type,
            entry_type=LivestockInventory.EntryType.INDIVIDUAL,
            quantity=1,
            tag_number=f"JUAN-{index:03}",
            status=LivestockInventory.StatusType.APPROVED,
            operational_status=LivestockInventory.OperationalStatus.ACTIVE,
            created_by=self.farmer_user,
        ) for index in range(1, 9)])

        # 5. Farmer 2 in Manggas (15 heads of cattle)
        self.farmer_user_2 = User.objects.create_user(
            username="farmer_pedro",
            email="pedro.manggas@gmail.com",
            password="password123",
            role=self.role_farmer,
        )
        self.farmer_profile_2 = Farmer.objects.create(
            user=self.farmer_user_2,
            barangay=self.b_manggas,
            address="Purok 1, Manggas, Padre Garcia",
        )
        LivestockInventory.objects.bulk_create([LivestockInventory(
            farmer=self.farmer_profile_2,
            livestock_type=self.cattle_type,
            entry_type=LivestockInventory.EntryType.INDIVIDUAL,
            quantity=1,
            tag_number=f"PEDRO-{index:03}",
            status=LivestockInventory.StatusType.APPROVED,
            operational_status=LivestockInventory.OperationalStatus.ACTIVE,
            created_by=self.farmer_user_2,
        ) for index in range(1, 16)])

        # 6. Auction Staff User
        self.auction_user = User.objects.create_user(
            username="auction_user",
            email="auction@padregarcia.gov.ph",
            password="password123",
            role=self.role_auction,
        )

        # 7. Slaughterhouse Staff User
        self.slaughter_user = User.objects.create_user(
            username="slaughter_user",
            email="slaughter@padregarcia.gov.ph",
            password="password123",
            role=self.role_slaughter,
        )

        self.client = APIClient()

    def test_admin_gis_scope(self):
        """Admin has MUNICIPAL scope, all 18 barangays, and simulation enabled."""
        scope = get_user_gis_scope(self.admin_user)
        self.assertEqual(scope["scope"], "MUNICIPAL")
        self.assertTrue(scope["can_view_all_barangays"])
        self.assertTrue(scope["can_use_simulation"])
        self.assertIn("cattle", scope["allowed_layers"])
        self.assertIn("disease", scope["allowed_layers"])

        data = get_gis_aggregated_data(self.admin_user)
        cawongan = data["barangays_dict"]["Cawongan"]
        manggas = data["barangays_dict"]["Manggas"]
        self.assertEqual(cawongan["cattle"], 8)
        self.assertEqual(manggas["cattle"], 15)
        self.assertTrue(cawongan["is_in_scope"])
        self.assertTrue(manggas["is_in_scope"])

    def test_only_approved_reports_marked_suspected_fmd_by_field_review_seed_simulation(self):
        today = timezone.localdate()
        DiseaseCase.objects.create(
            livestock=LivestockInventory.objects.filter(farmer=self.farmer_profile).first(),
            name="Excessive Drooling, Lethargic / Weak",
            affected_count=1,
            record_date=today,
            status=DiseaseCase.DiseaseStatus.APPROVED,
            inspection_details={"fmdAssessment": "SUSPECTED"},
            created_by=self.farmer_user,
        )
        DiseaseCase.objects.create(
            livestock=LivestockInventory.objects.filter(farmer=self.farmer_profile_2).first(),
            name="Foot blisters and drooling",
            affected_count=1,
            record_date=today,
            status=DiseaseCase.DiseaseStatus.APPROVED,
            created_by=self.farmer_user_2,
        )
        DiseaseCase.objects.create(
            livestock=LivestockInventory.objects.filter(farmer=self.farmer_profile_2).first(),
            name="Foot blisters and drooling",
            affected_count=1,
            record_date=today,
            status=DiseaseCase.DiseaseStatus.PENDING,
            inspection_details={"fmdAssessment": "SUSPECTED"},
            created_by=self.farmer_user_2,
        )

        data = get_gis_aggregated_data(self.admin_user)

        self.assertEqual(data["barangays_dict"]["Cawongan"]["active_cases"], 1)
        self.assertEqual(data["barangays_dict"]["Cawongan"]["fmd_active_cases"], 1)
        self.assertEqual(data["barangays_dict"]["Manggas"]["active_cases"], 1)
        self.assertEqual(data["barangays_dict"]["Manggas"]["fmd_active_cases"], 0)

    def test_sibat_assigned_barangay_scope(self):
        """SIBAT assigned only to Cawongan sees Cawongan data; Manggas data is zeroed/masked."""
        scope = get_user_gis_scope(self.sibat_assigned)
        self.assertEqual(scope["scope"], "ASSIGNED_BARANGAYS")
        self.assertFalse(scope["can_view_all_barangays"])
        self.assertFalse(scope["can_use_simulation"])
        self.assertIn("Cawongan", scope["allowed_barangays"])
        self.assertNotIn("Manggas", scope["allowed_barangays"])

        data = get_gis_aggregated_data(self.sibat_assigned)
        cawongan = data["barangays_dict"]["Cawongan"]
        manggas = data["barangays_dict"]["Manggas"]

        self.assertTrue(cawongan["is_in_scope"])
        self.assertEqual(cawongan["cattle"], 8)

        # Manggas must be masked out
        self.assertFalse(manggas["is_in_scope"])
        self.assertEqual(manggas["cattle"], 0)

    def test_sibat_all_barangays_scope(self):
        """SIBAT with ALL_BARANGAYS sees all barangays but simulation remains disabled."""
        scope = get_user_gis_scope(self.sibat_all)
        self.assertEqual(scope["scope"], "MUNICIPAL")
        self.assertTrue(scope["can_view_all_barangays"])
        self.assertFalse(scope["can_use_simulation"])

        data = get_gis_aggregated_data(self.sibat_all)
        self.assertEqual(data["barangays_dict"]["Cawongan"]["cattle"], 8)
        self.assertEqual(data["barangays_dict"]["Manggas"]["cattle"], 15)

    def test_farmer_gis_scope_and_personal_stats(self):
        """Farmer juan is strictly confined to Cawongan; Manggas is masked; receives farmer_stats."""
        scope = get_user_gis_scope(self.farmer_user)
        self.assertEqual(scope["scope"], "OWN_BARANGAY")
        self.assertFalse(scope["can_view_all_barangays"])
        self.assertFalse(scope["can_use_simulation"])
        self.assertIn("Cawongan", scope["allowed_barangays"])
        self.assertNotIn("Manggas", scope["allowed_barangays"])

        data = get_gis_aggregated_data(self.farmer_user)
        cawongan = data["barangays_dict"]["Cawongan"]
        manggas = data["barangays_dict"]["Manggas"]

        self.assertTrue(cawongan["is_in_scope"])
        self.assertEqual(cawongan["cattle"], 8)

        self.assertFalse(manggas["is_in_scope"])
        self.assertEqual(manggas["cattle"], 0)

        # Farmer personal context verified
        self.assertIsNotNone(data["farmer_stats"])
        self.assertEqual(data["farmer_stats"]["my_cattle"], 8)
        self.assertEqual(data["farmer_stats"]["my_barangay"], "Cawongan")

    def test_auction_gis_scope(self):
        """Auction personnel have movement and cattle layers; simulation disabled."""
        scope = get_user_gis_scope(self.auction_user)
        self.assertEqual(scope["scope"], "OPERATIONAL_MOVEMENT")
        self.assertIn("movement", scope["allowed_layers"])
        self.assertIn("cattle", scope["allowed_layers"])
        self.assertNotIn("disease", scope["allowed_layers"])
        self.assertFalse(scope["can_use_simulation"])

    def test_slaughterhouse_gis_scope(self):
        """Slaughterhouse staff have meat, movement, and cattle layers; simulation disabled."""
        scope = get_user_gis_scope(self.slaughter_user)
        self.assertEqual(scope["scope"], "OPERATIONAL_SLAUGHTER")
        self.assertIn("meat", scope["allowed_layers"])
        self.assertIn("movement", scope["allowed_layers"])
        self.assertNotIn("disease", scope["allowed_layers"])
        self.assertFalse(scope["can_use_simulation"])

    def test_api_endpoint_authenticated(self):
        """Endpoint /api/analytics/gis/ responds with 200 OK for authenticated farmer."""
        self.client.force_authenticate(user=self.farmer_user)
        url = reverse("gis-summary")
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["user_scope"]["role"], "FARMER")
        self.assertEqual(response.data["farmer_stats"]["my_cattle"], 8)

    def test_haversine_single_case_outbreak_and_monitoring_radius(self):
        """
        User Scenario Verification:
        1. Single confirmed FMD case in Barangay Bawi -> Bawi becomes Red (disease_risk='high', zone='outbreak').
        2. Neighboring Barangay Manggas has 0 confirmed cases, but is within 3.5 km radius -> Orange (disease_risk='medium', zone='monitoring_radius').
        3. Far barangays (e.g. Tangob, San Miguel) > 3.5 km away remain Green (disease_risk='low', zone='safe').
        4. Suspected unvalidated reports do NOT make a barangay Red.
        """
        today = timezone.localdate()
        # Clean any existing disease cases from setUp
        DiseaseCase.objects.all().delete()

        # Farmer in Bawi
        b_bawi, _ = Barangay.objects.get_or_create(
            barangay_name="Bawi",
            defaults={"latitude": Decimal("13.886475"), "longitude": Decimal("121.232434")}
        )
        bawi_farmer = Farmer.objects.create(
            user=self.admin_user,
            barangay=b_bawi,
            address="Purok 1, Bawi",
        )
        bawi_animal = LivestockInventory.objects.create(
            farmer=bawi_farmer,
            livestock_type=self.cattle_type,
            entry_type=LivestockInventory.EntryType.INDIVIDUAL,
            quantity=1,
            tag_number="BAWI-001",
            status=LivestockInventory.StatusType.APPROVED,
            operational_status=LivestockInventory.OperationalStatus.ACTIVE,
            created_by=self.admin_user,
        )

        # 1 Single Confirmed FMD case in Bawi
        DiseaseCase.objects.create(
            livestock=bawi_animal,
            name="FMD Symptoms",
            affected_count=1,
            record_date=today,
            status=DiseaseCase.DiseaseStatus.APPROVED,
            inspection_details={"fmdAssessment": "SUSPECTED"},
            created_by=self.admin_user,
        )

        # 1 Unvalidated / Suspected case in Manggas (must NOT cause red status)
        DiseaseCase.objects.create(
            livestock=LivestockInventory.objects.filter(farmer=self.farmer_profile_2).first(),
            name="Suspected Lameness",
            affected_count=1,
            record_date=today,
            status=DiseaseCase.DiseaseStatus.PENDING,
            inspection_details={"fmdAssessment": "SUSPECTED"},
            created_by=self.farmer_user_2,
        )

        data = get_gis_aggregated_data(self.admin_user)
        b_dict = data["barangays_dict"]

        # Rule 1: Host barangay with 1 confirmed case is RED
        self.assertEqual(b_dict["Bawi"]["active_cases"], 1)
        self.assertEqual(b_dict["Bawi"]["disease_risk"], "high")
        self.assertEqual(b_dict["Bawi"]["disease_zone"], "outbreak")

        # Rule 2: Manggas has 0 confirmed cases, but is within 3.5 km monitoring radius of Bawi -> ORANGE
        self.assertEqual(b_dict["Manggas"]["active_cases"], 0)
        self.assertEqual(b_dict["Manggas"]["disease_risk"], "medium")
        self.assertEqual(b_dict["Manggas"]["disease_zone"], "monitoring_radius")
        self.assertTrue(b_dict["Manggas"]["is_in_monitoring_radius"])
        self.assertEqual(b_dict["Manggas"]["nearest_outbreak"], "Bawi")

        # Rule 3: Far barangay San Miguel (> 3.5 km from Bawi) has 0 confirmed cases -> GREEN
        self.assertEqual(b_dict["San Miguel"]["active_cases"], 0)
        self.assertEqual(b_dict["San Miguel"]["disease_risk"], "low")
        self.assertEqual(b_dict["San Miguel"]["disease_zone"], "safe")
        self.assertFalse(b_dict["San Miguel"]["is_in_monitoring_radius"])

from rest_framework.test import APITestCase
from rest_framework import status
from users.models import User, Role
from livestock.models import Barangay, Farmer, LivestockType, LivestockInventory
from diseases.models import DiseaseCase, MortalityRecord


class DiseaseAndMortalityAPITests(APITestCase):

    def setUp(self):



        # Roles
        self.mao_role = Role.objects.create(role_name=Role.UserRoles.MAO)
        self.farmer_role = Role.objects.create(role_name=Role.UserRoles.FARMER)
        self.sibat_role = Role.objects.create(role_name=Role.UserRoles.SIBAT)

        # Barangay & Type
        self.barangay = Barangay.objects.create(
            barangay_name="San Roque",
            latitude=13.8821,
            longitude=121.2144,
        )
        self.cattle_type = LivestockType.objects.create(name="Cattle")

        # Users
        self.mao_user = User.objects.create_user(
            username="MAO-001",
            email="mao@padregarcia.gov.ph",
            password="password123",
            role=self.mao_role,
            account_status=User.AccountStatus.APPROVED,
        )
        self.sibat_user = User.objects.create_user(
            username="SIBAT-001",
            email="sibat@padregarcia.gov.ph",
            password="password123",
            role=self.sibat_role,
            account_status=User.AccountStatus.APPROVED,
        )
        self.farmer1_user = User.objects.create_user(
            username="FMR-000001",
            email="farmer1@example.com",
            password="password123",
            role=self.farmer_role,
            account_status=User.AccountStatus.APPROVED,
        )
        self.farmer1_profile = Farmer.objects.create(
            user=self.farmer1_user,
            barangay=self.barangay,
            farm_size=2.0,
            address="Purok 1",
        )

        self.farmer2_user = User.objects.create_user(
            username="FMR-000002",
            email="farmer2@example.com",
            password="password123",
            role=self.farmer_role,
            account_status=User.AccountStatus.APPROVED,
        )
        self.farmer2_profile = Farmer.objects.create(
            user=self.farmer2_user,
            barangay=self.barangay,
            farm_size=3.0,
            address="Purok 2",
        )

        # Farmer 1 Livestock
        self.farmer1_livestock = LivestockInventory.objects.create(
            farmer=self.farmer1_profile,
            livestock_type=self.cattle_type,
            quantity=5,
            tag_number="TAG-001",
            breed="Brahman",
            created_by=self.farmer1_user,
        )

        # Farmer 2 Livestock
        self.farmer2_livestock = LivestockInventory.objects.create(
            farmer=self.farmer2_profile,
            livestock_type=self.cattle_type,
            quantity=3,
            tag_number="TAG-002",
            breed="Angus",
            created_by=self.farmer2_user,
        )

    def test_unauthenticated_requests_blocked(self):
        response = self.client.get("/diseases/cases/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

        response = self.client.get("/diseases/mortality/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_farmer_can_create_disease_case_for_own_livestock(self):
        self.client.force_authenticate(user=self.farmer1_user)
        payload = {
            "livestock": self.farmer1_livestock.pk,
            "name": "Foot and Mouth Symptoms",
            "affected_count": 2,
            "record_date": "2026-09-19",
        }
        response = self.client.post("/diseases/cases/", payload)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["status"], "PENDING")
        self.assertEqual(response.data["farmer_name"], "FMR-000001")

    def test_farmer_cannot_create_disease_case_for_others_livestock(self):
        self.client.force_authenticate(user=self.farmer1_user)
        payload = {
            "livestock": self.farmer2_livestock.pk,
            "name": "Limping",
            "affected_count": 1,
            "record_date": "2026-09-19",
        }
        response = self.client.post("/diseases/cases/", payload)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_disease_case_affected_count_validation(self):
        self.client.force_authenticate(user=self.farmer1_user)
        payload = {
            "livestock": self.farmer1_livestock.pk,
            "name": "High Fever",
            "affected_count": 99,  # exceeds quantity of 5
            "record_date": "2026-09-19",
        }
        response = self.client.post("/diseases/cases/", payload)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_disease_case_2step_review_workflow(self):
        # 1. Farmer creates case
        case = DiseaseCase.objects.create(
            livestock=self.farmer1_livestock,
            name="Pneumonia signs",
            affected_count=1,
            record_date="2026-09-19",
            created_by=self.farmer1_user,
            status=DiseaseCase.DiseaseStatus.PENDING,
        )

        # 2. Farmer cannot review own case
        self.client.force_authenticate(user=self.farmer1_user)
        res = self.client.post(f"/diseases/cases/{case.pk}/review/", {"status": "APPROVED"})
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

        # 3. SIBAT cannot perform final APPROVED
        self.client.force_authenticate(user=self.sibat_user)
        res = self.client.post(f"/diseases/cases/{case.pk}/review/", {"status": "APPROVED"})
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

        # 4. SIBAT can verify (VERIFIED)
        res = self.client.post(
            f"/diseases/cases/{case.pk}/review/",
            {"status": "VERIFIED", "remarks": "On-farm visit verified symptoms."}
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        case.refresh_from_db()
        self.assertEqual(case.status, DiseaseCase.DiseaseStatus.VERIFIED)
        self.assertEqual(case.reviewed_by, self.sibat_user)

        # 5. MAO performs final APPROVED
        self.client.force_authenticate(user=self.mao_user)
        res = self.client.post(
            f"/diseases/cases/{case.pk}/review/",
            {"status": "APPROVED", "remarks": "Official certification issued."}
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        case.refresh_from_db()
        self.assertEqual(case.status, DiseaseCase.DiseaseStatus.APPROVED)
        self.assertEqual(case.reviewed_by, self.mao_user)

    def test_mortality_record_creation_and_review(self):
        self.client.force_authenticate(user=self.farmer1_user)
        payload = {
            "livestock": self.farmer1_livestock.pk,
            "death_count": 1,
            "cause": "Severe Bloat",
            "record_date": "2026-09-19",
        }
        res = self.client.post("/diseases/mortality/", payload)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        mortality_id = res.data["id"]

        # SIBAT verifies
        self.client.force_authenticate(user=self.sibat_user)
        res = self.client.post(
            f"/diseases/mortality/{mortality_id}/review/",
            {"status": "VERIFIED", "remarks": "Carcass verified."}
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        # MAO approves
        self.client.force_authenticate(user=self.mao_user)
        res = self.client.post(
            f"/diseases/mortality/{mortality_id}/review/",
            {"status": "APPROVED", "remarks": "Indemnity claim approved."}
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        record = MortalityRecord.objects.get(pk=mortality_id)
        self.assertEqual(record.status, MortalityRecord.MortalityRecordStatus.APPROVED)


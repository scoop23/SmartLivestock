from rest_framework.test import APITestCase
from rest_framework import status
from users.models import User, Role
from livestock.models import Barangay, Farmer, LivestockType, LivestockInventory, LivestockBatch


class LivestockInventoryReviewTests(APITestCase):

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
        self.farmer_user = User.objects.create_user(
            username="FMR-000001",
            email="farmer1@example.com",
            password="password123",
            role=self.farmer_role,
            account_status=User.AccountStatus.APPROVED,
        )
        self.farmer_profile = Farmer.objects.create(
            user=self.farmer_user,
            barangay=self.barangay,
            farm_size=2.0,
            address="Purok 1",
        )

        self.inventory = LivestockInventory.objects.create(
            farmer=self.farmer_profile,
            livestock_type=self.cattle_type,
            quantity=2,
            tag_number="TAG-101",
            breed="Brahman Cross",
            created_by=self.farmer_user,
            status=LivestockInventory.StatusType.PENDING,
        )

    def test_farmer_cannot_review_inventory(self):
        self.client.force_authenticate(user=self.farmer_user)
        res = self.client.post(f"/livestock/inventory/{self.inventory.pk}/review/", {"status": "APPROVED"})
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_sibat_cannot_grant_final_approval(self):
        self.client.force_authenticate(user=self.sibat_user)
        res = self.client.post(f"/livestock/inventory/{self.inventory.pk}/review/", {"status": "APPROVED"})
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_sibat_can_verify_inventory_item(self):
        self.client.force_authenticate(user=self.sibat_user)
        res = self.client.post(
            f"/livestock/inventory/{self.inventory.pk}/review/",
            {"status": "VERIFIED", "remarks": "Ear tag B-101 inspected and confirmed on-farm."}
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.inventory.refresh_from_db()
        self.assertEqual(self.inventory.status, LivestockInventory.StatusType.VERIFIED)
        self.assertEqual(self.inventory.reviewed_by, self.sibat_user)

    def test_mao_can_grant_final_inventory_approval(self):
        self.client.force_authenticate(user=self.mao_user)
        res = self.client.post(
            f"/livestock/inventory/{self.inventory.pk}/review/",
            {"status": "APPROVED", "remarks": "Official municipal inventory registered."}
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.inventory.refresh_from_db()
        self.assertEqual(self.inventory.status, LivestockInventory.StatusType.APPROVED)
        self.assertEqual(self.inventory.reviewed_by, self.mao_user)


class LivestockBatchAPITests(APITestCase):

    def setUp(self):
        self.farmer_role = Role.objects.create(role_name=Role.UserRoles.FARMER)
        self.barangay = Barangay.objects.create(
            barangay_name="San Roque",
            latitude=13.8821,
            longitude=121.2144,
        )
        self.swine_type = LivestockType.objects.create(name="Swine")
        self.farmer_user = User.objects.create_user(
            username="FARMER-BATCH-TEST",
            email="farmer_batch@padregarcia.gov.ph",
            password="password123",
            role=self.farmer_role,
            account_status=User.AccountStatus.APPROVED,
        )
        self.farmer = Farmer.objects.create(
            user=self.farmer_user,
            barangay=self.barangay,
            address="Poblacion, Padre Garcia",
        )

    def test_create_batch_with_individual_roster(self):
        self.client.force_authenticate(user=self.farmer_user)
        payload = {
            "batch_name": "Pen B Fatteners",
            "batch_code": "BATCH-SWINE-001",
            "livestock_type": self.swine_type.pk,
            "housing_pen": "Pen B North",
            "feed_type": "Grower Mash",
            "target_weight": "95.00",
            "animals": [
                {
                    "tag_number": "SW-01",
                    "breed": "Large White",
                    "sex": "MALE",
                    "weight": "42.50",
                    "avatar_key": "swine-large-white",
                },
                {
                    "tag_number": "SW-02",
                    "breed": "Landrace",
                    "sex": "FEMALE",
                    "weight": "39.00",
                    "avatar_key": "swine-landrace",
                },
            ],
        }

        res = self.client.post("/livestock/batches/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        data = res.json()
        self.assertEqual(data["batch_code"], "BATCH-SWINE-001")
        self.assertEqual(data["total_animals"], 2)

        # Verify child individual inventory items
        animals = LivestockInventory.objects.filter(batch__batch_code="BATCH-SWINE-001")
        self.assertEqual(animals.count(), 2)
        tags = set(animals.values_list("tag_number", flat=True))
        self.assertIn("SW-01", tags)
        self.assertIn("SW-02", tags)

    def test_add_animals_to_existing_batch(self):
        self.client.force_authenticate(user=self.farmer_user)
        batch = LivestockBatch.objects.create(
            farmer=self.farmer,
            livestock_type=self.swine_type,
            batch_name="Starter Pen",
            batch_code="BATCH-STARTER-1",
            created_by=self.farmer_user,
        )

        res = self.client.post(
            f"/livestock/batches/{batch.pk}/animals/",
            {
                "animals": [
                    {
                        "tag_number": "SW-EXTRA-1",
                        "breed": "Duroc",
                        "sex": "MALE",
                        "weight": "25.00",
                    }
                ]
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(batch.animals.count(), 1)
        animal = batch.animals.first()
        self.assertIsNotNone(animal)
        assert animal is not None
        self.assertEqual(animal.tag_number, "SW-EXTRA-1")


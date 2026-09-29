from datetime import date

from rest_framework.test import APITestCase

from livestock.models import Barangay, Farmer, LivestockBatch, LivestockInventory, LivestockType
from production.models import ProductionRecord
from users.models import Notification, Role, User


class CohortRevisionTests(APITestCase):
    def setUp(self):
        farmer_role = Role.objects.create(role_name=Role.UserRoles.FARMER)
        sibat_role = Role.objects.create(role_name=Role.UserRoles.SIBAT)
        mao_role = Role.objects.create(role_name=Role.UserRoles.MAO)
        self.farmer_user = User.objects.create_user(
            username="cohort-farmer", email="cohort-farmer@example.com",
            password="test-password", role=farmer_role,
            account_status=User.AccountStatus.APPROVED,
        )
        self.sibat_user = User.objects.create_user(
            username="cohort-sibat", email="cohort-sibat@example.com",
            password="test-password", role=sibat_role,
            account_status=User.AccountStatus.APPROVED,
        )
        self.mao_user = User.objects.create_user(
            username="cohort-mao", email="cohort-mao@example.com",
            password="test-password", role=mao_role,
            account_status=User.AccountStatus.APPROVED,
        )
        barangay = Barangay.objects.create(
            barangay_name="Cohort Test", latitude=13.8821, longitude=121.2144,
        )
        farmer = Farmer.objects.create(
            user=self.farmer_user, barangay=barangay, farm_size=1, address="Test farm",
        )
        livestock_type = LivestockType.objects.create(name="Cohort test cattle")
        self.batch = LivestockBatch.objects.create(
            farmer=farmer, livestock_type=livestock_type, batch_name="Test cohort",
            batch_code="COHORT-TEST-1", created_by=self.farmer_user,
        )
        self.animals = [
            LivestockInventory.objects.create(
                farmer=farmer, livestock_type=livestock_type, batch=self.batch,
                tag_number=f"COHORT-{number}", created_by=self.farmer_user,
            )
            for number in (1, 2)
        ]

    def test_returned_cohort_stays_together_until_explicit_resubmission(self):
        animal_url = f"/livestock/inventory/{self.animals[0].pk}/"
        review_url = f"/livestock/batches/{self.batch.pk}/review/"
        batch_url = f"/livestock/batches/{self.batch.pk}/"

        self.client.force_authenticate(user=self.sibat_user)
        self.assertEqual(
            self.client.post(
                f"{animal_url}review/", {"status": "SUBJECT_TO_REVISION", "remarks": "Fix tags"}
            ).status_code,
            409,
        )
        self.assertEqual(
            self.client.post(
                review_url, {"status": "SUBJECT_TO_REVISION", "remarks": "Fix tags"}
            ).status_code,
            200,
        )

        self.client.force_authenticate(user=self.farmer_user)
        self.assertEqual(self.client.patch(animal_url, {"breed": "Corrected"}).status_code, 200)
        self.assertEqual(
            set(self.batch.animals.values_list("status", flat=True)),
            {LivestockInventory.StatusType.SUBJECT_TO_REVISION},
        )
        self.assertEqual(self.client.patch(batch_url, {"resubmit": True}).status_code, 200)
        self.assertEqual(
            set(self.batch.animals.values_list("status", flat=True)),
            {LivestockInventory.StatusType.PENDING},
        )

        self.client.force_authenticate(user=self.sibat_user)
        self.assertEqual(self.client.post(review_url, {"status": "VERIFIED"}).status_code, 200)
        self.assertEqual(
            set(self.batch.animals.values_list("status", flat=True)),
            {LivestockInventory.StatusType.VERIFIED},
        )
        self.assertTrue(Notification.objects.filter(
            user=self.mao_user,
            title="Livestock Cohort Awaiting MAO Approval",
            link=f"/data-validation/batches?batchId={self.batch.pk}",
        ).exists())
        self.client.force_authenticate(user=self.mao_user)
        self.assertEqual(self.client.post(review_url, {"status": "APPROVED"}).status_code, 200)
        self.assertEqual(
            set(self.batch.animals.values_list("status", flat=True)),
            {LivestockInventory.StatusType.APPROVED},
        )

    def test_individual_inventory_notifies_mao_after_sibat_verification(self):
        animal = LivestockInventory.objects.create(
            farmer=self.batch.farmer, livestock_type=self.batch.livestock_type,
            tag_number="STANDALONE-1", created_by=self.farmer_user,
        )
        self.client.force_authenticate(user=self.sibat_user)
        self.assertEqual(self.client.post(
            f"/livestock/inventory/{animal.pk}/review/", {"status": "VERIFIED"}
        ).status_code, 200)
        self.assertTrue(Notification.objects.filter(
            user=self.mao_user,
            title="Livestock Entry Awaiting MAO Approval",
            link="/data-validation?domain=inventory",
        ).exists())
        self.client.force_authenticate(user=self.mao_user)
        alerts = self.client.get("/api/notifications/")
        self.assertEqual(alerts.status_code, 200)
        self.assertTrue(any(
            item["title"] == "Livestock Entry Awaiting MAO Approval"
            for item in alerts.data["notifications"]
        ))

    def test_production_return_resubmit_and_mao_notification(self):
        animal = LivestockInventory.objects.create(
            farmer=self.batch.farmer, livestock_type=self.batch.livestock_type,
            tag_number="MILK-1", created_by=self.farmer_user,
            status=LivestockInventory.StatusType.APPROVED,
        )
        self.client.force_authenticate(user=self.farmer_user)
        created = self.client.post("/production/records/", {
            "livestock": animal.pk, "production_type": "MILK", "quantity": "5.00",
            "unit": "LITERS", "record_date": date(2026, 9, 1).isoformat(),
        })
        self.assertEqual(created.status_code, 201)
        record_id = created.data["id"]
        review_url = f"/production/records/{record_id}/review/"
        self.client.force_authenticate(user=self.mao_user)
        self.assertEqual(self.client.post(
            review_url, {"status": "APPROVED"}
        ).status_code, 400)
        self.client.force_authenticate(user=self.sibat_user)
        self.assertEqual(self.client.post(
            review_url, {"status": "SUBJECT_TO_REVISION", "remarks": "Correct amount"}
        ).status_code, 200)
        self.client.force_authenticate(user=self.farmer_user)
        self.assertEqual(self.client.patch(
            f"/production/records/{record_id}/", {"quantity": "6.00"}
        ).status_code, 200)
        self.assertEqual(
            ProductionRecord.objects.get(pk=record_id).status,
            ProductionRecord.ProductionStatus.PENDING,
        )
        self.client.force_authenticate(user=self.sibat_user)
        self.assertEqual(self.client.post(
            review_url, {"status": "VERIFIED"}
        ).status_code, 200)
        self.assertTrue(Notification.objects.filter(
            user=self.mao_user,
            title="Production Record Awaiting MAO Approval",
            link="/data-validation?domain=production",
        ).exists())
        self.client.force_authenticate(user=self.mao_user)
        self.assertEqual(self.client.post(
            review_url, {"status": "APPROVED"}
        ).status_code, 200)

from datetime import date

from rest_framework.test import APITestCase

from livestock.models import Barangay, Farmer, LivestockBatch, LivestockInventory, LivestockType
from analytics.services.population import official_inventory, population_summary
from production.models import ProductionRecord
from users.models import Notification, Role, User


class HerdRevisionTests(APITestCase):
    def setUp(self):
        farmer_role = Role.objects.create(role_name=Role.UserRoles.FARMER)
        sibat_role = Role.objects.create(role_name=Role.UserRoles.SIBAT)
        mao_role = Role.objects.create(role_name=Role.UserRoles.MAO)
        self.farmer_user = User.objects.create_user(
            username="herd-farmer", email="herd-farmer@example.com",
            password="test-password", role=farmer_role,
            account_status=User.AccountStatus.APPROVED,
        )
        self.sibat_user = User.objects.create_user(
            username="herd-sibat", email="herd-sibat@example.com",
            password="test-password", role=sibat_role,
            account_status=User.AccountStatus.APPROVED,
        )
        self.mao_user = User.objects.create_user(
            username="herd-mao", email="herd-mao@example.com",
            password="test-password", role=mao_role,
            account_status=User.AccountStatus.APPROVED,
        )
        barangay = Barangay.objects.create(
            barangay_name="Herd Test", latitude=13.8821, longitude=121.2144,
        )
        self.sibat_user.assigned_barangay = barangay
        self.sibat_user.save(update_fields=["assigned_barangay"])
        farmer = Farmer.objects.create(
            user=self.farmer_user, barangay=barangay, farm_size=1, address="Test farm",
        )
        livestock_type = LivestockType.objects.create(name="Herd test cattle")
        self.batch = LivestockBatch.objects.create(
            farmer=farmer, livestock_type=livestock_type, batch_name="Test herd",
            batch_code="HERD-TEST-1", created_by=self.farmer_user,
        )
        self.animals = [
            LivestockInventory.objects.create(
                farmer=farmer, livestock_type=livestock_type, batch=self.batch,
                tag_number=f"HERD-{number}", created_by=self.farmer_user,
            )
            for number in (1, 2)
        ]

    def test_animal_review_changes_only_that_animal_and_herd_review_is_retired(self):
        first, sibling = self.animals
        self.client.force_authenticate(user=self.sibat_user)
        response = self.client.post(
            f"/livestock/inventory/{first.pk}/review/", {"status": "VERIFIED"}
        )
        self.assertEqual(response.status_code, 200, response.data)
        first.refresh_from_db()
        sibling.refresh_from_db()
        self.assertEqual(first.status, LivestockInventory.StatusType.VERIFIED)
        self.assertEqual(sibling.status, LivestockInventory.StatusType.PENDING)

        # The old endpoint remains present for old clients but can never mutate the herd.
        response = self.client.post(
            f"/livestock/batches/{self.batch.pk}/review/", {"status": "VERIFIED"}
        )
        self.assertEqual(response.status_code, 410)
        sibling.refresh_from_db()
        self.assertEqual(sibling.status, LivestockInventory.StatusType.PENDING)

        self.client.force_authenticate(user=self.mao_user)
        response = self.client.post(
            f"/livestock/inventory/{first.pk}/review/", {"status": "APPROVED"}
        )
        self.assertEqual(response.status_code, 200, response.data)
        first.refresh_from_db()
        sibling.refresh_from_db()
        self.assertEqual(first.status, LivestockInventory.StatusType.APPROVED)
        self.assertEqual(sibling.status, LivestockInventory.StatusType.PENDING)

    def test_returned_animal_resubmission_does_not_change_herd_siblings(self):
        first, sibling = self.animals
        self.client.force_authenticate(user=self.sibat_user)
        response = self.client.post(
            f"/livestock/inventory/{first.pk}/review/",
            {"status": "SUBJECT_TO_REVISION", "remarks": "Fix the animal tag"},
        )
        self.assertEqual(response.status_code, 200, response.data)

        self.client.force_authenticate(user=self.farmer_user)
        response = self.client.patch(
            f"/livestock/inventory/{first.pk}/", {"breed": "Corrected breed"}
        )
        self.assertEqual(response.status_code, 200, response.data)
        first.refresh_from_db()
        sibling.refresh_from_db()
        self.assertEqual(first.status, LivestockInventory.StatusType.PENDING)
        self.assertEqual(sibling.status, LivestockInventory.StatusType.PENDING)
        self.assertEqual(first.breed, "Corrected breed")

    def test_new_animal_in_approved_herd_starts_its_own_review(self):
        approved = self.animals[0]
        approved.status = LivestockInventory.StatusType.APPROVED
        approved.save(update_fields=["status"])

        self.client.force_authenticate(user=self.farmer_user)
        response = self.client.post(
            f"/livestock/batches/{self.batch.pk}/animals/",
            {"animals": [{"tag_number": "HERD-NEW", "breed": "Native", "sex": "Female"}]},
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        new_animal = LivestockInventory.objects.get(tag_number="HERD-NEW")
        self.assertEqual(new_animal.status, LivestockInventory.StatusType.PENDING)
        self.assertTrue(new_animal.is_post_approval_addition)
        approved.refresh_from_db()
        self.assertEqual(approved.status, LivestockInventory.StatusType.APPROVED)

    def test_herd_summary_counts_individual_statuses(self):
        self.animals[0].status = LivestockInventory.StatusType.APPROVED
        self.animals[0].save(update_fields=["status"])
        self.client.force_authenticate(user=self.sibat_user)

        response = self.client.get("/livestock/batches/?summary=true&page_size=100")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["summary"]["approvedAnimals"], 1)
        self.assertEqual(response.data["summary"]["pendingAnimals"], 1)
        herd = next(row for row in response.data["results"] if row["id"] == self.batch.pk)
        self.assertEqual(herd["approved_animals"], 1)
        self.assertEqual(herd["pending_animals"], 1)
        self.assertEqual(herd["review_status"], "MIXED")

    def test_legacy_batch_aggregate_is_not_an_animal_or_approved_population(self):
        approved_animal = self.animals[0]
        approved_animal.status = LivestockInventory.StatusType.APPROVED
        approved_animal.save(update_fields=["status"])
        LivestockInventory.objects.create(
            farmer=approved_animal.farmer,
            livestock_type=approved_animal.livestock_type,
            entry_type=LivestockInventory.EntryType.BATCH,
            quantity=20,
            status=LivestockInventory.StatusType.APPROVED,
            operational_status=LivestockInventory.OperationalStatus.ACTIVE,
            created_by=self.farmer_user,
        )

        self.assertEqual(official_inventory(self.mao_user).count(), 1)
        summary = population_summary(user=self.mao_user)
        self.assertEqual(summary["total_heads"], 1)
        self.assertEqual(summary["historical_approved_heads"], 1)
        self.assertEqual(summary["pending_inventory_records"], 1)

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
            link=f"/data-validation?domain=inventory&recordType=INVENTORY&recordId={animal.pk}",
            related_entity_type="livestock_inventory",
            related_entity_id=animal.pk,
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
            link=f"/data-validation?domain=production&recordType=PRODUCTION&recordId={record_id}",
            related_entity_type="production_record",
            related_entity_id=record_id,
        ).exists())
        self.client.force_authenticate(user=self.mao_user)
        self.assertEqual(self.client.post(
            review_url, {"status": "APPROVED"}
        ).status_code, 200)

    def test_revision_response_identifies_sibat_and_mao_for_individual_inventory(self):
        animal = self.animals[0]
        inventory_url = f"/livestock/inventory/{animal.pk}/"
        self.client.force_authenticate(user=self.sibat_user)
        response = self.client.post(inventory_url + "review/", {
            "status": "SUBJECT_TO_REVISION", "remarks": "Correct entry",
        })
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["reviewed_by_role"], "SIBAT")

        self.client.force_authenticate(user=self.farmer_user)
        response = self.client.patch(inventory_url, {"breed": "Corrected"})
        self.assertEqual(response.status_code, 200, response.data)
        self.assertIsNone(response.data["reviewed_by_role"])

        self.client.force_authenticate(user=self.sibat_user)
        self.assertEqual(self.client.post(
            inventory_url + "review/", {"status": "VERIFIED"}
        ).status_code, 200)
        self.client.force_authenticate(user=self.mao_user)
        response = self.client.post(inventory_url + "review/", {
            "status": "SUBJECT_TO_REVISION", "remarks": "Municipal correction",
        })
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["reviewed_by_role"], "MAO")

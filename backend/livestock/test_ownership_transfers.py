from datetime import date, timedelta
from decimal import Decimal

from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from livestock.models import Barangay, Farmer, LivestockBatch, LivestockInventory, LivestockOwnershipTransfer, LivestockType
from production.models import ProductionRecord
from users.models import Role, User


class OwnershipTransferWorkflowTests(APITestCase):
    def setUp(self):
        self.farmer_role = Role.objects.create(role_name=Role.UserRoles.FARMER)
        self.sibat_role = Role.objects.create(role_name=Role.UserRoles.SIBAT)
        self.mao_role = Role.objects.create(role_name=Role.UserRoles.MAO)
        self.barangay = Barangay.objects.create(barangay_name="Manggas", latitude=13.8, longitude=121.2)
        self.cattle = LivestockType.objects.create(name="Cattle")
        self.owner_a = self.make_farmer("owner-a", "RSBSA-A")
        self.owner_b = self.make_farmer("owner-b", "RSBSA-B")
        self.sibat = User.objects.create_user(username="sibat-transfer", password="test", role=self.sibat_role,
            email="sibat-transfer@example.test", account_status=User.AccountStatus.APPROVED, assigned_barangay=self.barangay)
        self.mao = User.objects.create_user(username="mao-transfer", password="test", role=self.mao_role,
            email="mao-transfer@example.test", account_status=User.AccountStatus.APPROVED)
        self.animal = LivestockInventory.objects.create(
            farmer=self.owner_a, livestock_type=self.cattle, entry_type="INDIVIDUAL", quantity=1,
            tag_number="CAT-102", status="APPROVED", operational_status="ACTIVE", created_by=self.owner_a.user,
        )
        self.retained_animal = LivestockInventory.objects.create(
            farmer=self.owner_a, livestock_type=self.cattle, entry_type="INDIVIDUAL", quantity=1,
            tag_number="CAT-101", status="APPROVED", operational_status="ACTIVE", created_by=self.owner_a.user,
        )
        self.production = ProductionRecord.objects.create(
            livestock=self.animal, production_type="MILK", quantity=Decimal("10"), unit="LITERS",
            record_date=date(2026, 1, 15), status="APPROVED", created_by=self.owner_a.user,
        )

    def make_farmer(self, username, rsbsa):
        user = User.objects.create_user(username=username, password="test", role=self.farmer_role,
            email=f"{username}@example.test", account_status=User.AccountStatus.APPROVED, first_name=username)
        return Farmer.objects.create(user=user, barangay=self.barangay, rsbsa_number=rsbsa, address="Manggas")

    def request_transfer(self):
        self.client.force_authenticate(self.owner_a.user)
        return self.client.post("/livestock/ownership-transfers/", {
            "livestock": self.animal.pk,
            "new_owner_identifier": self.owner_b.rsbsa_number,
            "transfer_certificate_number": "PG-TRANSFER-102",
            "original_certificate_number": "PG-ORIGINAL-102",
            "transfer_date": (timezone.localdate() - timedelta(days=2)).isoformat(),
            "municipality": "Padre Garcia",
            "province": "Batangas",
        }, format="json")

    def test_mao_approval_updates_same_identity_and_retains_former_owner_history(self):
        response = self.request_transfer()
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertIsNone(response.data["purchase_price"])
        self.animal.refresh_from_db()
        self.assertEqual(self.animal.farmer_id, self.owner_a.pk)
        self.assertEqual(self.animal.pk, response.data["livestock"])
        duplicate = self.request_transfer()
        self.assertEqual(duplicate.status_code, status.HTTP_400_BAD_REQUEST)

        self.client.force_authenticate(self.sibat)
        verified = self.client.post(f"/livestock/ownership-transfers/{response.data['id']}/review/", {"status": "VERIFIED"})
        self.assertEqual(verified.status_code, status.HTTP_200_OK, verified.data)
        self.client.force_authenticate(self.mao)
        mao_history = self.client.get("/livestock/ownership-transfers/")
        self.assertEqual(mao_history.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mao_history.data), 1)
        approved = self.client.post(f"/livestock/ownership-transfers/{response.data['id']}/review/", {"status": "APPROVED"})
        self.assertEqual(approved.status_code, status.HTTP_200_OK, approved.data)

        self.animal.refresh_from_db()
        self.assertEqual(self.animal.pk, response.data["livestock"])
        self.assertEqual(self.animal.tag_number, "CAT-102")
        self.assertEqual(self.animal.farmer_id, self.owner_b.pk)
        mao_inventory = self.client.get("/livestock/inventory/")
        mao_animal = next(row for row in mao_inventory.data if row["id"] == self.animal.pk)
        self.assertEqual(mao_animal["farmer"], self.owner_b.pk)
        self.client.force_authenticate(self.owner_a.user)
        old_inventory = self.client.get("/livestock/inventory/")
        old_history = self.client.get("/livestock/ownership-transfers/")
        old_production = self.client.get("/production/records/")
        self.assertEqual(old_inventory.status_code, status.HTTP_200_OK)
        self.assertEqual([row["id"] for row in old_inventory.data], [self.retained_animal.pk])
        self.assertEqual(len(old_history.data), 1)
        self.assertEqual(old_production.data[0]["farmer_name"], "owner-a")

        self.client.force_authenticate(self.owner_b.user)
        new_inventory = self.client.get("/livestock/inventory/")
        new_history = self.client.get("/livestock/ownership-transfers/")
        new_production = self.client.get("/production/records/")
        self.assertTrue(any(row["id"] == self.animal.pk for row in new_inventory.data))
        self.assertEqual(len(new_history.data), 1)
        self.assertFalse(any(row["id"] == self.production.pk for row in new_production.data))
        qr = self.client.get("/api/inspections/livestock-lookup/", {"code": f"SL-LIVESTOCK:{self.animal.pk}"})
        self.assertEqual(qr.status_code, status.HTTP_200_OK)
        self.assertEqual(qr.data["id"], self.animal.pk)

    def test_returned_request_cannot_be_retargeted_to_another_animal(self):
        response = self.request_transfer()
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        other_animal = LivestockInventory.objects.create(
            farmer=self.owner_a, livestock_type=self.cattle, entry_type="INDIVIDUAL", quantity=1,
            tag_number="CAT-103", status="APPROVED", operational_status="ACTIVE", created_by=self.owner_a.user,
        )
        transfer = LivestockOwnershipTransfer.objects.get(pk=response.data["id"])
        transfer.status = "SUBJECT_TO_REVISION"
        transfer.save(update_fields=["status"])
        self.client.force_authenticate(self.owner_a.user)
        patched = self.client.patch(f"/livestock/ownership-transfers/{transfer.pk}/", {
            "livestock": other_animal.pk,
        }, format="json")
        self.assertEqual(patched.status_code, status.HTTP_400_BAD_REQUEST)
        transfer.refresh_from_db()
        self.assertEqual(transfer.livestock_id, self.animal.pk)

    def test_herd_member_transfer_changes_only_that_animal_and_preserves_batch(self):
        herd = LivestockBatch.objects.create(
            farmer=self.owner_a, livestock_type=self.cattle, batch_name="Herd B001",
            batch_code="HERD-B001", created_by=self.owner_a.user,
        )
        self.animal.batch = herd
        self.animal.save(update_fields=["batch"])
        herd_mate = LivestockInventory.objects.create(
            farmer=self.owner_a, livestock_type=self.cattle, batch=herd,
            entry_type="INDIVIDUAL", quantity=1, tag_number="CAT-103",
            status="APPROVED", operational_status="ACTIVE", created_by=self.owner_a.user,
        )
        original_id = self.animal.pk

        response = self.request_transfer()
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.client.force_authenticate(self.sibat)
        verified = self.client.post(f"/livestock/ownership-transfers/{response.data['id']}/review/", {"status": "VERIFIED"})
        self.assertEqual(verified.status_code, status.HTTP_200_OK, verified.data)
        self.client.force_authenticate(self.mao)
        approved = self.client.post(f"/livestock/ownership-transfers/{response.data['id']}/review/", {"status": "APPROVED"})
        self.assertEqual(approved.status_code, status.HTTP_200_OK, approved.data)

        self.animal.refresh_from_db()
        herd_mate.refresh_from_db()
        self.assertEqual(self.animal.pk, original_id)
        self.assertEqual(self.animal.farmer_id, self.owner_b.pk)
        self.assertEqual(self.animal.batch_id, herd.pk)
        self.assertEqual(herd_mate.farmer_id, self.owner_a.pk)
        self.assertEqual(herd_mate.batch_id, herd.pk)
        transfer = LivestockOwnershipTransfer.objects.get(pk=response.data["id"])
        self.assertEqual(transfer.livestock_id, original_id)
        self.assertEqual(transfer.previous_owner_id, self.owner_a.pk)
        self.assertEqual(transfer.new_owner_id, self.owner_b.pk)

    def test_batch_pending_and_inactive_animals_cannot_be_transferred(self):
        batch_record = LivestockInventory.objects.create(
            farmer=self.owner_a, livestock_type=self.cattle, entry_type="BATCH", quantity=3,
            tag_number="CAT-GROUP", status="APPROVED", operational_status="ACTIVE",
            created_by=self.owner_a.user,
        )
        pending_animal = LivestockInventory.objects.create(
            farmer=self.owner_a, livestock_type=self.cattle, entry_type="INDIVIDUAL", quantity=1,
            tag_number="CAT-PENDING", status="PENDING", operational_status="ACTIVE",
            created_by=self.owner_a.user,
        )
        inactive_animal = LivestockInventory.objects.create(
            farmer=self.owner_a, livestock_type=self.cattle, entry_type="INDIVIDUAL", quantity=1,
            tag_number="CAT-SOLD", status="APPROVED", operational_status="SOLD",
            created_by=self.owner_a.user,
        )
        self.client.force_authenticate(self.owner_a.user)
        for animal, certificate in (
            (batch_record, "PG-BATCH-TRANSFER"),
            (pending_animal, "PG-PENDING-TRANSFER"),
            (inactive_animal, "PG-INACTIVE-TRANSFER"),
        ):
            with self.subTest(animal=animal.tag_number):
                response = self.client.post("/livestock/ownership-transfers/", {
                    "livestock": animal.pk,
                    "new_owner_identifier": self.owner_b.rsbsa_number,
                    "transfer_certificate_number": certificate,
                    "original_certificate_number": f"ORIGINAL-{certificate}",
                    "transfer_date": (timezone.localdate() - timedelta(days=2)).isoformat(),
                    "municipality": "Padre Garcia",
                    "province": "Batangas",
                }, format="json")
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_transfer_date_cannot_precede_latest_approved_transfer(self):
        LivestockOwnershipTransfer.objects.create(
            livestock=self.animal, previous_owner=self.owner_b, new_owner=self.owner_a,
            transfer_certificate_number="PG-TRANSFER-101", original_certificate_number="PG-ORIGINAL-101",
            transfer_date=timezone.localdate() - timedelta(days=1), municipality="Padre Garcia", province="Batangas",
            status=LivestockOwnershipTransfer.Status.APPROVED, created_by=self.owner_a.user,
        )
        response = self.request_transfer()
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("transfer_date", response.data)

    def test_same_owner_and_unknown_rsbsa_are_rejected(self):
        self.client.force_authenticate(self.owner_a.user)
        base = {
            "livestock": self.animal.pk,
            "transfer_certificate_number": "PG-TRANSFER-OTHER",
            "original_certificate_number": "PG-ORIGINAL-OTHER",
            "transfer_date": (timezone.localdate() - timedelta(days=2)).isoformat(),
            "municipality": "Padre Garcia",
            "province": "Batangas",
        }
        same_owner = self.client.post("/livestock/ownership-transfers/", {
            **base, "new_owner_identifier": self.owner_a.rsbsa_number,
        }, format="json")
        unknown = self.client.post("/livestock/ownership-transfers/", {
            **base, "new_owner_identifier": "NOT-REGISTERED",
        }, format="json")
        self.assertEqual(same_owner.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(unknown.status_code, status.HTTP_400_BAD_REQUEST)

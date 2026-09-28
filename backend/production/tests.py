from django.test import TestCase

# TODO: Write tests for:
#   - ProductionRecord creation (milk/eggs/wool with correct units)
#   - SlaughterRecord with nullable livestock FK (batch slaughter)
#   - LiveAnimalSale with different sale methods (MATA-MATA vs WEIGHING)
#   - Status workflow: PENDING → VERIFIED → APPROVED/SUBJECT_TO_REVISION

from datetime import date
from rest_framework import status
from rest_framework.test import APITestCase
from users.models import Notification, Role, User
from livestock.models import Barangay, Farmer, LivestockBatch, LivestockInventory, LivestockType
from .models import ProductionRecord


class ProductionRecordAPITests(APITestCase):
    def setUp(self):
        self.farmer_role = Role.objects.create(role_name=Role.UserRoles.FARMER)
        self.mao_role = Role.objects.create(role_name=Role.UserRoles.MAO)
        self.auction_role = Role.objects.create(role_name=Role.UserRoles.AUCTION)
        self.farmer_user = User.objects.create_user(
            username="production-farmer", email="production-farmer@example.com",
            password=None, role=self.farmer_role,
            account_status=User.AccountStatus.APPROVED,
        )
        self.mao_user = User.objects.create_user(
            username="production-mao", email="production-mao@example.com",
            password=None, role=self.mao_role,
            account_status=User.AccountStatus.APPROVED,
        )
        self.auction_user = User.objects.create_user(
            username="production-auction", email="production-auction@example.com",
            password=None, role=self.auction_role,
            account_status=User.AccountStatus.APPROVED,
        )
        barangay = Barangay.objects.create(
            barangay_name="San Roque", latitude=13.8821, longitude=121.2144,
        )
        self.farmer = Farmer.objects.create(
            user=self.farmer_user, barangay=barangay, address="Purok 1",
        )
        self.cattle = LivestockType.objects.create(name="Cattle")
        self.animal = LivestockInventory.objects.create(
            farmer=self.farmer, livestock_type=self.cattle, quantity=1,
            created_by=self.farmer_user,
            status=LivestockInventory.StatusType.APPROVED,
        )
        self.record = ProductionRecord.objects.create(
            livestock=self.animal, production_type=ProductionRecord.ProductionType.MILK,
            quantity=10, unit=ProductionRecord.UnitType.LITERS,
            record_date=date(2026, 1, 1), created_by=self.farmer_user,
        )

    def test_farmer_can_edit_and_delete_pending_record(self):
        self.client.force_authenticate(user=self.farmer_user)
        response = self.client.patch(
            f"/production/records/{self.record.pk}/", {"notes": "Morning milking"},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.record.refresh_from_db()
        self.assertEqual(self.record.notes, "Morning milking")
        response = self.client.delete(f"/production/records/{self.record.pk}/")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(ProductionRecord.objects.filter(pk=self.record.pk).exists())

    def test_auction_role_cannot_review_production(self):
        self.client.force_authenticate(user=self.auction_user)
        response = self.client.post(
            f"/production/records/{self.record.pk}/review/", {"status": "APPROVED"},
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.record.refresh_from_db()
        self.assertEqual(self.record.status, ProductionRecord.ProductionStatus.PENDING)

    def test_mao_review_notifies_record_owner(self):
        self.client.force_authenticate(user=self.mao_user)
        response = self.client.post(
            f"/production/records/{self.record.pk}/review/", {"status": "APPROVED"},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.record.refresh_from_db()
        self.assertEqual(self.record.status, ProductionRecord.ProductionStatus.APPROVED)
        self.assertTrue(Notification.objects.filter(user=self.farmer_user).exists())

    def test_farmer_cannot_log_production_against_another_farmers_batch(self):
        other_user = User.objects.create_user(
            username="other-production-farmer", email="other-production-farmer@example.com",
            password=None, role=self.farmer_role,
            account_status=User.AccountStatus.APPROVED,
        )
        other_farmer = Farmer.objects.create(
            user=other_user, barangay=self.farmer.barangay, address="Purok 2",
        )
        other_batch = LivestockBatch.objects.create(
            farmer=other_farmer, livestock_type=self.cattle,
            batch_name="Other Herd", batch_code="OTHER-HERD",
            created_by=other_user,
        )
        self.client.force_authenticate(user=self.farmer_user)
        response = self.client.post(
            "/production/records/",
            {"batch": other_batch.pk, "production_type": "MILK", "quantity": "5.00",
             "unit": "LITERS", "record_date": "2026-01-01"},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(ProductionRecord.objects.filter(batch=other_batch).exists())

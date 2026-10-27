from datetime import timedelta
from django.utils import timezone
from rest_framework.test import APITestCase
from livestock.models import Barangay, Farmer, LivestockInventory, LivestockType
from production.models import BreedingRecord
from users.models import Role, User


class BreedingInseminationTests(APITestCase):
    def setUp(self):
        self.farmer_role = Role.objects.create(role_name="FARMER")
        self.barangay = Barangay.objects.create(barangay_name="San Roque", latitude=13.88, longitude=121.21)
        self.user = User.objects.create_user(
            username="breeding_farmer",
            email="breeding@example.invalid",
            role=self.farmer_role,
            account_status=User.AccountStatus.APPROVED,
        )
        self.farmer = Farmer.objects.create(user=self.user, barangay=self.barangay, address="Farm 1")
        self.cattle = LivestockType.objects.create(name="Cattle")
        self.dam = LivestockInventory.objects.create(
            farmer=self.farmer,
            livestock_type=self.cattle,
            quantity=1,
            tag_number="DAM-001",
            sex="FEMALE",
            status="APPROVED",
            operational_status="ACTIVE",
            created_by=self.user,
        )
        self.client.force_authenticate(user=self.user)

    def test_create_breeding_record_with_auto_due_date(self):
        today = timezone.localdate()
        res = self.client.post("/production/breeding/", {
            "dam": self.dam.pk,
            "breeding_date": str(today),
            "breeding_type": "ARTIFICIAL_INSEMINATION",
            "sire_tag_or_code": "STRAW-BAT-901",
            "sire_breed": "Brahman",
            "technician_or_inseminator": "Doc Santos",
            "gestation_days": 283,
            "status": "PENDING_CHECK",
            "notes": "First AI service",
        })
        self.assertEqual(res.status_code, 201)
        data = res.json()
        self.assertEqual(data["dam"], self.dam.pk)
        self.assertEqual(data["dam_tag"], "DAM-001")
        self.assertEqual(data["breeding_type"], "ARTIFICIAL_INSEMINATION")
        expected_date = str(today + timedelta(days=283))
        self.assertEqual(data["expected_due_date"], expected_date)
        self.assertIsNotNone(data["days_until_due"])

    def test_breeding_analytics(self):
        today = timezone.localdate()
        BreedingRecord.objects.create(
            dam=self.dam,
            breeding_date=today - timedelta(days=60),
            breeding_type="ARTIFICIAL_INSEMINATION",
            sire_tag_or_code="STRAW-01",
            gestation_days=283,
            expected_due_date=today + timedelta(days=20),  # due soon
            status="PREGNANT",
            created_by=self.user,
        )
        BreedingRecord.objects.create(
            dam=self.dam,
            breeding_date=today - timedelta(days=290),
            breeding_type="NATURAL",
            sire_tag_or_code="BULL-NAT",
            gestation_days=283,
            expected_due_date=today - timedelta(days=7),
            status="CALVED",
            created_by=self.user,
        )

        res = self.client.get("/production/breeding/analytics/")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["total_records"], 2)
        self.assertEqual(data["active_gestations"], 1)
        self.assertEqual(data["due_soon"], 1)
        self.assertEqual(data["calved_count"], 1)
        self.assertEqual(data["by_type"]["artificial_insemination"], 1)
        self.assertEqual(data["by_type"]["natural_service"], 1)

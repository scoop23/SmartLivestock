from datetime import timedelta
from django.utils import timezone
from rest_framework.test import APITestCase
from livestock.models import Barangay, Farmer, LivestockInventory, LivestockType
from production.models import BreedingRecord
from production.services.breeding_notifications import send_breeding_due_reminders
from users.models import Notification, Role, User


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
        BreedingRecord.objects.create(
            dam=self.dam,
            breeding_date=today - timedelta(days=60),
            breeding_type="NATURAL",
            sire_tag_or_code="BULL-EXPOSED",
            gestation_days=283,
            expected_due_date=today + timedelta(days=10),
            status="PENDING_CHECK",
            created_by=self.user,
        )

        res = self.client.get("/production/breeding/analytics/")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["total_records"], 3)
        self.assertEqual(data["active_gestations"], 1)
        self.assertEqual(data["due_soon"], 1)
        self.assertEqual(data["pending_check_count"], 1)
        self.assertEqual(data["estimated_due_soon"], 1)
        self.assertEqual(data["calved_count"], 1)
        self.assertEqual(data["by_type"]["artificial_insemination"], 1)
        self.assertEqual(data["by_type"]["natural_service"], 2)

    def test_breeding_entry_cannot_claim_pregnancy_or_calving_status(self):
        today = timezone.localdate()
        payload = {
            "dam": self.dam.pk,
            "breeding_date": str(today - timedelta(days=45)),
            "breeding_type": "ARTIFICIAL_INSEMINATION",
            "gestation_days": 283,
        }
        for status in ("PREGNANT", "CALVED", "OPEN"):
            with self.subTest(status=status):
                response = self.client.post("/production/breeding/", {**payload, "status": status})
                self.assertEqual(response.status_code, 400)

        response = self.client.post("/production/breeding/", payload)
        self.assertEqual(response.status_code, 201)
        record_id = response.json()["id"]
        self.assertEqual(response.json()["status"], BreedingRecord.BreedingStatus.PENDING_CHECK)

        for status in ("PREGNANT", "CALVED"):
            with self.subTest(update_status=status):
                response = self.client.patch(f"/production/breeding/{record_id}/", {"status": status})
                self.assertEqual(response.status_code, 400)
        self.assertEqual(BreedingRecord.objects.get(pk=record_id).status, BreedingRecord.BreedingStatus.PENDING_CHECK)

    def test_confirm_pregnancy_is_owner_scoped_role_limited_and_idempotent(self):
        today = timezone.localdate()
        record = BreedingRecord.objects.create(
            dam=self.dam,
            breeding_date=today - timedelta(days=45),
            breeding_type=BreedingRecord.BreedingType.ARTIFICIAL_INSEMINATION,
            status=BreedingRecord.BreedingStatus.PENDING_CHECK,
            created_by=self.user,
        )

        neighbor = User.objects.create_user(
            username="breeding_neighbor",
            email="neighbor@example.invalid",
            role=self.farmer_role,
            account_status=User.AccountStatus.APPROVED,
        )
        neighbor_farmer = Farmer.objects.create(user=neighbor, barangay=self.barangay, address="Farm 2")
        LivestockInventory.objects.create(
            farmer=neighbor_farmer,
            livestock_type=self.cattle,
            quantity=1,
            tag_number="DAM-002",
            sex="FEMALE",
            status="APPROVED",
            operational_status="ACTIVE",
            created_by=neighbor,
        )
        self.client.force_authenticate(user=neighbor)
        response = self.client.post(f"/production/breeding/{record.pk}/confirm-pregnancy/", {})
        self.assertEqual(response.status_code, 404)

        auction_role, _ = Role.objects.get_or_create(role_name="AUCTION")
        auction_user = User.objects.create_user(
            username="breeding_auction",
            email="auction@example.invalid",
            role=auction_role,
            account_status=User.AccountStatus.APPROVED,
        )
        self.client.force_authenticate(user=auction_user)
        response = self.client.post(f"/production/breeding/{record.pk}/confirm-pregnancy/", {})
        self.assertEqual(response.status_code, 403)

        self.client.force_authenticate(user=self.user)
        payload = {
            "confirmation_date": str(today),
            "confirmation_method": "Veterinary ultrasound",
            "notes": "Clinical check completed.",
        }
        first = self.client.post(f"/production/breeding/{record.pk}/confirm-pregnancy/", payload)
        self.assertEqual(first.status_code, 200)
        self.assertEqual(first.json()["status"], BreedingRecord.BreedingStatus.PREGNANT)
        self.assertEqual(
            Notification.objects.filter(user=self.user, related_entity_type="breeding_record", related_entity_id=record.pk).count(),
            1,
        )

        retry = self.client.post(
            f"/production/breeding/{record.pk}/confirm-pregnancy/",
            {"confirmation_date": str(today - timedelta(days=1)), "confirmation_method": "Changed on retry"},
        )
        self.assertEqual(retry.status_code, 200)
        self.assertEqual(retry.json()["confirmation_method"], "Veterinary ultrasound")
        self.assertEqual(retry.json()["pregnancy_confirmed_date"], str(today))
        self.assertEqual(
            Notification.objects.filter(user=self.user, related_entity_type="breeding_record", related_entity_id=record.pk).count(),
            1,
        )

    def test_confirm_pregnancy_rejects_open_or_calved_record(self):
        today = timezone.localdate()
        record = BreedingRecord.objects.create(
            dam=self.dam,
            breeding_date=today - timedelta(days=45),
            breeding_type=BreedingRecord.BreedingType.ARTIFICIAL_INSEMINATION,
            status=BreedingRecord.BreedingStatus.OPEN,
            created_by=self.user,
        )
        response = self.client.post(f"/production/breeding/{record.pk}/confirm-pregnancy/", {})
        self.assertEqual(response.status_code, 409)
        self.assertEqual(BreedingRecord.objects.get(pk=record.pk).status, BreedingRecord.BreedingStatus.OPEN)

    def test_due_reminders_are_pregnant_only_and_idempotent_for_each_window(self):
        today = timezone.localdate()
        due_dates = {
            "30": today + timedelta(days=20),
            "7": today + timedelta(days=5),
            "today": today,
            "overdue": today - timedelta(days=5),
        }
        records = []
        for key, due_date in due_dates.items():
            records.append(BreedingRecord.objects.create(
                dam=self.dam,
                breeding_date=today - timedelta(days=60),
                breeding_type=BreedingRecord.BreedingType.ARTIFICIAL_INSEMINATION,
                expected_due_date=due_date,
                status=BreedingRecord.BreedingStatus.PREGNANT,
                created_by=self.user,
            ))
        awaiting_check = BreedingRecord.objects.create(
            dam=self.dam,
            breeding_date=today - timedelta(days=60),
            breeding_type=BreedingRecord.BreedingType.NATURAL,
            expected_due_date=today + timedelta(days=5),
            status=BreedingRecord.BreedingStatus.PENDING_CHECK,
            created_by=self.user,
        )

        self.assertEqual(send_breeding_due_reminders(today=today), 4)
        self.assertEqual(send_breeding_due_reminders(today=today), 0)
        reminders = Notification.objects.filter(user=self.user, related_entity_type__startswith="breeding_due_")
        self.assertEqual(reminders.count(), 4)
        self.assertFalse(reminders.filter(related_entity_id=awaiting_check.pk).exists())
        for key, record in zip(due_dates, records):
            self.assertTrue(reminders.filter(related_entity_id=record.pk, related_entity_type__startswith=f"breeding_due_{key}_").exists())

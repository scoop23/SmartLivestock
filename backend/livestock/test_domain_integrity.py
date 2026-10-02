"""Regression checks for the domain freeze; all records live in the test database."""
from datetime import date, time
from django.core.exceptions import ValidationError as ModelValidationError
from django.db import IntegrityError, transaction
from rest_framework.exceptions import ValidationError
from rest_framework.test import APITestCase
from livestock.models import Barangay, Farmer, LivestockType, LivestockInventory, LivestockBatch
from livestock.reconciliation import reconcile_approved_sale, reconcile_approved_mortality
from production.models import LiveAnimalSale, ProductionRecord, SlaughterRecord
from production.services.slaughter import reconcile_approved_slaughter
from diseases.models import DiseaseCase, MortalityRecord
from movements.models import LivestockInspection, LivestockInspectionItem, LivestockInspectionClearance, MeatMovementRecord
from users.models import User, Role, Notification


class DomainIntegrityTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.barangay = Barangay.objects.create(barangay_name="Test Local", latitude=0, longitude=0)
        cls.other_barangay = Barangay.objects.create(barangay_name="Test Other", latitude=0, longitude=0)
        users = {}
        for role in ("FARMER", "SIBAT", "MAO", "AUCTION"):
            definition = Role.objects.create(role_name=role)
            users[role] = User.objects.create_user(username="test-"+role, email=role+"@example.test",
                password=None, role=definition, account_status="APPROVED",
                assigned_barangay=cls.barangay if role == "SIBAT" else None)
        cls.farmer_user, cls.sibat, cls.mao, cls.auction = (users[r] for r in ("FARMER", "SIBAT", "MAO", "AUCTION"))
        cls.farmer = Farmer.objects.create(user=cls.farmer_user, barangay=cls.barangay, address="Muntinlupa, Metro Manila")
        cls.other_user = User.objects.create_user(username="other", email="other@example.test", password=None, role=cls.farmer_user.role)
        cls.other_farmer = Farmer.objects.create(user=cls.other_user, barangay=cls.other_barangay, address="Pangasinan")
        cls.cattle = LivestockType.objects.create(name="Cattle")

    def animal(self, **kwargs):
        defaults = dict(farmer=self.farmer, livestock_type=self.cattle, status="APPROVED", quantity=1, created_by=self.farmer_user)
        defaults.update(kwargs)
        return LivestockInventory.objects.create(**defaults)

    def test_individual_quantity_is_validated_in_api_and_database(self):
        self.client.force_authenticate(self.farmer_user)
        payload = {"livestock_type": self.cattle.pk, "entry_type": "INDIVIDUAL", "quantity": 10}
        self.assertEqual(self.client.post("/livestock/inventory/", payload).status_code, 400)
        with self.assertRaises(IntegrityError), transaction.atomic():
            self.animal(quantity=10)
        animal = self.animal()
        with self.assertRaises(IntegrityError), transaction.atomic():
            LivestockInventory.objects.filter(pk=animal.pk).update(quantity=10)
        animal.quantity = 10
        with self.assertRaises(ModelValidationError):
            animal.clean()

    def test_herd_child_cannot_be_a_multi_head_aggregate(self):
        herd = LivestockBatch.objects.create(farmer=self.farmer, livestock_type=self.cattle,
            batch_name="Test", batch_code="TEST-SHAPE", created_by=self.farmer_user)
        with self.assertRaises(IntegrityError), transaction.atomic():
            self.animal(batch=herd, entry_type="BATCH", quantity=10)

    def test_operational_status_input_cannot_mark_animal_sold(self):
        self.client.force_authenticate(self.farmer_user)
        response = self.client.post("/livestock/inventory/", {"livestock_type": self.cattle.pk,
            "quantity": 1, "entry_type": "INDIVIDUAL", "operational_status": "SOLD", "status": "APPROVED"})
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["operational_status"], "ACTIVE")
        self.assertEqual(response.data["status"], "PENDING")

    def test_farmer_cannot_toggle_herd_sale_or_harvest(self):
        herd = LivestockBatch.objects.create(farmer=self.farmer, livestock_type=self.cattle,
            batch_name="Test herd", batch_code="TEST-HERD", created_by=self.farmer_user)
        self.client.force_authenticate(self.farmer_user)
        for target in ("SOLD", "HARVESTED"):
            self.assertEqual(self.client.patch(f"/livestock/batches/{herd.pk}/", {"status": target}).status_code, 409)
        herd.refresh_from_db()
        self.assertEqual(herd.status, "ACTIVE")

    def test_sale_and_mortality_reconcile_once_and_preserve_history(self):
        animal = self.animal()
        sale = LiveAnimalSale.objects.create(livestock=animal, quantity=1, status="APPROVED", sale_date=date(2026, 9, 1), created_by=self.farmer_user)
        reconcile_approved_sale(sale)
        reconcile_approved_sale(sale)
        animal.refresh_from_db()
        self.assertEqual(animal.operational_status, "SOLD")
        self.assertEqual(animal.quantity, 1)
        victim = self.animal()
        mortality = MortalityRecord.objects.create(livestock=victim, death_count=1, cause="Test accident",
            status="APPROVED", created_by=self.farmer_user)
        reconcile_approved_mortality(mortality)
        reconcile_approved_mortality(mortality)
        victim.refresh_from_db()
        self.assertEqual(victim.operational_status, "DECEASED")
        self.assertEqual(ProductionRecord.objects.count(), 0)
        self.assertEqual(SlaughterRecord.objects.count(), 0)

    def test_returned_sale_resubmits_same_record_and_notifies_sibat(self):
        sale = LiveAnimalSale.objects.create(livestock=self.animal(), quantity=1, status="SUBJECT_TO_REVISION",
            sale_date=date(2026, 9, 1), created_by=self.farmer_user, review_remarks="Correct the destination.")
        self.client.force_authenticate(self.farmer_user)
        response = self.client.patch(f"/production/sales/{sale.pk}/", {"destination": "Tanauan"})
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["id"], sale.pk)
        self.assertEqual(response.data["status"], "PENDING")
        self.assertTrue(Notification.objects.filter(user=self.sibat, title="Sale Resubmitted for Verification").exists())
        sale.status = "VERIFIED"
        sale.save()
        self.assertEqual(self.client.patch(f"/production/sales/{sale.pk}/", {"destination": "Other"}).status_code, 409)

    def test_inactive_animals_cannot_be_sold_or_slaughtered(self):
        for state in ("SOLD", "DECEASED", "SLAUGHTERED", "MOVED_OUT"):
            animal = self.animal(operational_status=state)
            sale = LiveAnimalSale.objects.create(livestock=animal, quantity=1, status="APPROVED", sale_date=date(2026, 9, 1), created_by=self.farmer_user)
            with self.assertRaises(ValidationError):
                reconcile_approved_sale(sale)
            slaughter = SlaughterRecord.objects.create(livestock=animal, livestock_type=self.cattle, quantity=1,
                carcass_weight=50, record_date=date(2026, 9, 1), status="APPROVED", created_by=self.farmer_user)
            slaughter.selected_animals.add(animal)
            ProductionRecord.objects.create(livestock=animal, slaughter=slaughter, production_type="MEAT", unit="KILOGRAMS",
                quantity=50, record_date=date(2026, 9, 1), status="APPROVED", created_by=self.farmer_user)
            with self.assertRaises(ValidationError):
                reconcile_approved_slaughter(slaughter)

    def test_mortality_rejects_inactive_or_aggregate_sources_before_submission(self):
        self.client.force_authenticate(self.farmer_user)
        inactive = self.animal(operational_status="SOLD")
        self.assertEqual(self.client.post("/diseases/mortality/", {"livestock": inactive.pk, "death_count": 1, "cause": "Test"}).status_code, 400)
        herd = LivestockBatch.objects.create(farmer=self.farmer, livestock_type=self.cattle, batch_name="Test", batch_code="TEST", created_by=self.farmer_user)
        self.assertEqual(self.client.post("/diseases/mortality/", {"batch": herd.pk, "death_count": 1, "cause": "Test"}).status_code, 400)

    def test_health_review_cannot_reopen_approved_case_or_return_without_remarks(self):
        animal = self.animal()
        case = DiseaseCase.objects.create(livestock=animal, name="Test case", affected_count=1, status="APPROVED", created_by=self.farmer_user)
        self.client.force_authenticate(self.sibat)
        self.assertEqual(self.client.post(f"/diseases/cases/{case.pk}/review/", {"status": "VERIFIED"}).status_code, 400)
        case.status = "PENDING"
        case.save()
        self.assertEqual(self.client.post(f"/diseases/cases/{case.pk}/review/", {"status": "SUBJECT_TO_REVISION"}).status_code, 400)

    def test_unrelated_staff_cannot_read_create_or_edit_health(self):
        case = DiseaseCase.objects.create(livestock=self.animal(), name="Test", affected_count=1, created_by=self.farmer_user)
        self.client.force_authenticate(self.auction)
        for path in ("/diseases/cases/", "/diseases/mortality/", f"/diseases/cases/{case.pk}/"):
            self.assertEqual(self.client.get(path).status_code, 403)
        self.assertEqual(self.client.patch(f"/diseases/cases/{case.pk}/", {"name": "Illegal"}).status_code, 403)
        self.assertEqual(self.client.post("/diseases/cases/", {"livestock": case.livestock_id, "name": "Illegal", "affected_count": 1}).status_code, 403)

    def test_sibat_private_records_are_barangay_scoped_and_unassigned_is_closed(self):
        local = self.animal()
        remote = LivestockInventory.objects.create(farmer=self.other_farmer, livestock_type=self.cattle, created_by=self.other_user)
        self.client.force_authenticate(self.sibat)
        self.assertEqual({row["id"] for row in self.client.get("/livestock/inventory/").data}, {local.pk})
        self.assertEqual(self.client.get(f"/livestock/inventory/{remote.pk}/").status_code, 404)
        self.assertEqual(self.client.post(f"/livestock/inventory/{remote.pk}/review/", {"status": "VERIFIED"}).status_code, 404)
        self.assertEqual(self.client.get(f"/livestock/farmers/{self.other_barangay.pk}/").data, [])
        self.sibat.assigned_barangay = None
        self.sibat.save(update_fields=["assigned_barangay"])
        self.assertEqual(self.client.get("/livestock/inventory/").data, [])

    def test_private_submission_notifications_do_not_cross_barangays(self):
        remote_staff = User.objects.create_user(username="remote-reviewer", email="remote@example.test", role=self.sibat.role,
            password=None, account_status="APPROVED", assigned_barangay=self.other_barangay)
        self.client.force_authenticate(self.farmer_user)
        response = self.client.post("/livestock/inventory/", {"livestock_type": self.cattle.pk, "entry_type": "INDIVIDUAL", "quantity": 1})
        self.assertEqual(response.status_code, 201)
        self.assertTrue(Notification.objects.filter(user=self.sibat).exists())
        self.assertFalse(Notification.objects.filter(user=remote_staff).exists())

    def inspection(self, shipper=None):
        return LivestockInspection.objects.create(shipper=shipper, shipper_name="Test shipper", destination="Tanauan, Batangas",
            inspection_date=date(2026, 9, 1), created_by=self.farmer_user)

    def test_external_inspection_has_aggregate_items_and_no_fabricated_inventory(self):
        before = LivestockInventory.objects.count()
        inspection = self.inspection()
        item = LivestockInspectionItem.objects.create(inspection=inspection, livestock_type=self.cattle,
            quantity=7, classification="FATTENING", sex="MIXED")
        self.assertIsNone(item.inventory_id)
        self.assertEqual(LivestockInventory.objects.count(), before)
        clearance = LivestockInspectionClearance.objects.create(inspection=inspection, control_number="TEST-EXT", shipper_address="Pangasinan", origin="Pangasinan")
        self.assertEqual(clearance.origin, "Pangasinan")
        self.assertIsNone(clearance.issued_by_id)
        self.assertIsNone(clearance.date_issued)
        self.assertIsNone(clearance.time_issued)

    def test_registered_external_origin_can_link_own_eligible_inventory(self):
        inspection = self.inspection(self.farmer)
        animal = self.animal()
        LivestockInspectionItem.objects.create(inspection=inspection, inventory=animal, livestock_type=self.cattle, quantity=1, classification="BREEDER")
        clearance = LivestockInspectionClearance.objects.create(inspection=inspection, control_number="TEST-REGISTERED", shipper_address=self.farmer.address)
        self.assertEqual(clearance.origin, "Muntinlupa, Metro Manila")
        foreign = LivestockInventory.objects.create(farmer=self.other_farmer, livestock_type=self.cattle, status="APPROVED", created_by=self.other_user)
        with self.assertRaises(ModelValidationError):
            LivestockInspectionItem.objects.create(inspection=inspection, inventory=foreign, livestock_type=self.cattle, quantity=1, classification="BREEDER")

    def test_unknown_origin_stays_unknown_and_issuance_requires_approval(self):
        clearance = LivestockInspectionClearance.objects.create(inspection=self.inspection(), control_number="TEST-UNKNOWN", shipper_address="")
        self.assertEqual(clearance.origin, "")
        clearance.issued_by = self.mao
        clearance.date_issued = date(2026, 9, 2)
        clearance.time_issued = time(10, 0)
        with self.assertRaises(ModelValidationError):
            clearance.save()
        clearance.status = "APPROVED"
        clearance.save()
        clearance.refresh_from_db()
        self.assertEqual(clearance.date_issued, date(2026, 9, 2))

    def test_chicken_is_a_real_enum_choice(self):
        self.assertEqual(MeatMovementRecord.MeatType.CHICKEN, "CHICKEN")
        self.assertIn(("CHICKEN", "Chicken"), MeatMovementRecord._meta.get_field("meat_type").choices)

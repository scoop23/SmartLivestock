"""Farmer log and independent official slaughter workflow regression checks."""

from datetime import date

from rest_framework.test import APITestCase

from livestock.models import Barangay, Farmer, LivestockInventory, LivestockType
from production.models import AnimalDisposition, CalvingRecord, ProductionRecord, SlaughterRecord, WeightRecord
from users.models import Notification, Role, User


class FarmerLogWorkflowTests(APITestCase):
    def setUp(self):
        self.farmer_role = Role.objects.create(role_name="FARMER")
        self.sibat_role = Role.objects.create(role_name="SIBAT")
        self.cbat_role = Role.objects.create(role_name="CBAT")
        self.mao_role = Role.objects.create(role_name="MAO")
        self.barangay = Barangay.objects.create(barangay_name="San Roque", latitude=13.88, longitude=121.21)
        self.other_barangay = Barangay.objects.create(barangay_name="Tangob", latitude=13.89, longitude=121.22)
        self.farmer_user = self.user("farmer", self.farmer_role)
        self.other_farmer_user = self.user("other-farmer", self.farmer_role)
        self.sibat_user = self.user("field", self.sibat_role, self.barangay)
        self.cbat_user = self.user("cbat", self.cbat_role, self.barangay)
        self.other_cbat = self.user("other-cbat", self.cbat_role, self.other_barangay)
        self.mao_user = self.user("mao", self.mao_role)
        self.farmer = Farmer.objects.create(user=self.farmer_user, barangay=self.barangay, address="Farm 1")
        self.other_farmer = Farmer.objects.create(user=self.other_farmer_user, barangay=self.other_barangay, address="Farm 2")
        self.cattle = LivestockType.objects.create(name="Cattle")
        self.cow = self.animal(self.farmer, "COW-1", "FEMALE")
        self.bull = self.animal(self.farmer, "BULL-1", "MALE")
        self.foreign_cow = self.animal(self.other_farmer, "COW-2", "FEMALE")

    def user(self, name, role, barangay=None):
        user = User.objects.create_user(username=name, email=f"{name}@example.invalid", password=None,
                                        role=role, account_status=User.AccountStatus.APPROVED)
        if barangay:
            user.assigned_barangay = barangay
            user.save(update_fields=["assigned_barangay"])
        return user

    def animal(self, farmer, tag, sex):
        return LivestockInventory.objects.create(
            farmer=farmer, livestock_type=self.cattle, quantity=1, tag_number=tag, sex=sex,
            status="APPROVED", operational_status="ACTIVE", created_by=farmer.user,
        )

    def submit(self, animal, kind, quantity, unit, **extra):
        self.client.force_authenticate(user=self.farmer_user)
        return self.client.post("/production/records/", {
            "livestock": animal.pk, "production_type": kind, "quantity": quantity,
            "unit": unit, "record_date": "2026-01-15", **extra,
        }, format="json")

    def test_milk_is_personal_record_without_reviewer_notification_or_action(self):
        result = self.submit(self.cow, "MILK", "8.00", "LITERS", milking_session="MORNING")
        self.assertEqual(result.status_code, 201, result.data)
        self.assertEqual(result.data["status"], "RECORDED")
        self.assertEqual(result.data["next_review_queue"], "NONE")
        self.assertFalse(result.data["requires_cbat_verification"])
        self.assertFalse(Notification.objects.filter(related_entity_type="production_record", related_entity_id=result.data["id"]).exists())
        self.client.force_authenticate(user=self.sibat_user)
        self.assertEqual(self.client.post(f"/production/records/{result.data['id']}/review/", {"status": "VERIFIED"}).status_code, 404)
        self.assertEqual(len(self.client.get("/production/records/").data), 0)
        self.client.force_authenticate(user=self.mao_user)
        self.assertEqual(self.client.post(f"/production/records/{result.data['id']}/review/", {"status": "APPROVED"}).status_code, 404)
        self.assertEqual(len(self.client.get("/production/records/").data), 0)

    def test_duplicate_milk_session_and_other_owner_are_rejected(self):
        self.assertEqual(self.submit(self.cow, "MILK", "8", "LITERS", milking_session="MORNING").status_code, 201)
        self.assertEqual(self.submit(self.cow, "MILK", "9", "LITERS", milking_session="MORNING").status_code, 400)
        self.assertEqual(self.submit(self.foreign_cow, "MILK", "8", "LITERS", milking_session="MORNING").status_code, 400)
        self.client.force_authenticate(user=self.other_farmer_user)
        self.assertEqual(len(self.client.get("/production/records/").data), 0)

    def test_farmer_meat_yield_links_pending_slaughter_and_reconciles_only_after_mao_approval(self):
        result = self.submit(self.bull, "MEAT", "180.00", "KILOGRAMS",
                             submit_slaughter_report=True, selected_animals=[self.bull.pk])
        self.assertEqual(result.status_code, 201, result.data)
        self.assertEqual(result.data["status"], "RECORDED")
        record = ProductionRecord.objects.get(pk=result.data["id"])
        self.assertIsNotNone(record.slaughter_id)
        slaughter = SlaughterRecord.objects.get(pk=record.slaughter_id)
        self.assertEqual(slaughter.status, SlaughterRecord.StatusType.PENDING)
        self.assertEqual(list(slaughter.selected_animals.values_list("pk", flat=True)), [self.bull.pk])
        self.assertTrue(Notification.objects.filter(
            user=self.sibat_user, related_entity_type="slaughter_record", related_entity_id=slaughter.pk,
        ).exists())
        self.assertTrue(Notification.objects.filter(
            user=self.cbat_user, related_entity_type="slaughter_record", related_entity_id=slaughter.pk,
        ).exists())
        self.assertFalse(Notification.objects.filter(
            user=self.other_cbat, related_entity_type="slaughter_record", related_entity_id=slaughter.pk,
        ).exists())
        self.bull.refresh_from_db()
        self.assertEqual(self.bull.operational_status, "ACTIVE")
        self.assertIsNone(slaughter.inventory_reconciled_at)

        for reviewer in (self.sibat_user, self.cbat_user):
            self.client.force_authenticate(user=reviewer)
            visible = self.client.get("/api/production/slaughterhouse/records/")
            self.assertEqual(visible.status_code, 200)
            self.assertTrue(any(row["id"] == slaughter.pk for row in visible.data))
            self.assertEqual(self.client.post(
                f"/api/production/slaughterhouse/records/{slaughter.pk}/review/",
                {"status": "APPROVED"}, format="json",
            ).status_code, 403)

        self.client.force_authenticate(user=self.mao_user)
        approved = self.client.post(
            f"/api/production/slaughterhouse/records/{slaughter.pk}/review/",
            {"status": "APPROVED"}, format="json",
        )
        self.assertEqual(approved.status_code, 200, approved.data)
        slaughter.refresh_from_db()
        self.assertIsNotNone(slaughter.inventory_reconciled_at)
        reconciled_at = slaughter.inventory_reconciled_at
        self.bull.refresh_from_db()
        self.assertEqual(self.bull.operational_status, "SLAUGHTERED")
        from production.services.slaughter import reconcile_approved_slaughter
        reconcile_approved_slaughter(slaughter)
        slaughter.refresh_from_db()
        self.assertEqual(slaughter.inventory_reconciled_at, reconciled_at)
        self.assertEqual(SlaughterRecord.objects.count(), 1)
        self.assertEqual(
            self.client.post(f"/production/records/{record.pk}/review/", {"status": "APPROVED"}).status_code,
            404,
        )

    def test_returned_slaughter_correction_reuses_same_linked_record(self):
        result = self.submit(self.bull, "MEAT", "180.00", "KILOGRAMS",
                             submit_slaughter_report=True, selected_animals=[self.bull.pk])
        self.assertEqual(result.status_code, 201, result.data)
        production = ProductionRecord.objects.get(pk=result.data["id"])
        slaughter_id = production.slaughter_id
        self.client.force_authenticate(user=self.mao_user)
        returned = self.client.post(
            f"/api/production/slaughterhouse/records/{slaughter_id}/review/",
            {"status": "SUBJECT_TO_REVISION", "remarks": "Correct the reported carcass weight."},
            format="json",
        )
        self.assertEqual(returned.status_code, 200, returned.data)

        self.client.force_authenticate(user=self.farmer_user)
        corrected = self.client.patch(f"/production/records/{production.pk}/", {"quantity": "175.00"}, format="json")
        self.assertEqual(corrected.status_code, 200, corrected.data)
        production.refresh_from_db()
        slaughter = SlaughterRecord.objects.get(pk=slaughter_id)
        self.assertEqual(production.status, ProductionRecord.ProductionStatus.RECORDED)
        self.assertEqual(production.slaughter_id, slaughter_id)
        self.assertEqual(slaughter.status, SlaughterRecord.StatusType.PENDING)
        self.assertEqual(str(slaughter.carcass_weight), "175.00")
        self.assertEqual(SlaughterRecord.objects.count(), 1)
        self.bull.refresh_from_db()
        self.assertEqual(self.bull.operational_status, "ACTIVE")

    def test_calving_keeps_existing_field_review(self):
        self.client.force_authenticate(user=self.farmer_user)
        result = self.client.post("/production/calving/", {
            "dam": self.cow.pk, "calving_date": "2026-01-15", "calf_tag": "CALF-1", "calf_sex": "FEMALE",
        }, format="json")
        self.assertEqual(result.status_code, 201, result.data)
        self.assertEqual(result.data["status"], "PENDING")
        self.assertTrue(Notification.objects.filter(user=self.sibat_user, related_entity_type="calving_record", related_entity_id=result.data["id"]).exists())

    def test_duplicate_calving_and_unauthorized_dam_rejected(self):
        self.client.force_authenticate(user=self.farmer_user)
        # First birth
        res1 = self.client.post("/production/calving/", {
            "dam": self.cow.pk, "calving_date": "2026-01-15", "calf_tag": "CALF-A", "calf_sex": "FEMALE",
        }, format="json")
        self.assertEqual(res1.status_code, 201)
        # Duplicate birth on same date for same dam
        res_dup = self.client.post("/production/calving/", {
            "dam": self.cow.pk, "calving_date": "2026-01-15", "calf_tag": "CALF-A", "calf_sex": "FEMALE",
        }, format="json")
        self.assertEqual(res_dup.status_code, 400)
        # Attempt to record birth against another farmer's cow
        res_other = self.client.post("/production/calving/", {
            "dam": self.foreign_cow.pk, "calving_date": "2026-01-16", "calf_tag": "CALF-B", "calf_sex": "MALE",
        }, format="json")
        self.assertEqual(res_other.status_code, 400)
        # Other farmer cannot access this calving detail by ID
        self.client.force_authenticate(user=self.other_farmer_user)
        self.assertEqual(self.client.get(f"/production/calving/{res1.data['id']}/").status_code, 404)

    def test_weight_monitoring_workflow_and_validation(self):
        self.client.force_authenticate(user=self.farmer_user)
        # Valid weight log updates inventory
        res = self.client.post("/production/weights/", {
            "livestock": self.cow.pk, "weight": "420.50", "weighing_date": "2026-01-15", "notes": "Monthly check",
        }, format="json")
        self.assertEqual(res.status_code, 201, res.data)
        self.cow.refresh_from_db()
        self.assertEqual(float(self.cow.weight), 420.50)

        # Duplicate weight on same date for same animal rejected
        res_dup = self.client.post("/production/weights/", {
            "livestock": self.cow.pk, "weight": "420.50", "weighing_date": "2026-01-15",
        }, format="json")
        self.assertEqual(res_dup.status_code, 400)

        # Future date rejected
        future_date = date.today().replace(year=date.today().year + 1).isoformat()
        res_future = self.client.post("/production/weights/", {
            "livestock": self.cow.pk, "weight": "430.00", "weighing_date": future_date,
        }, format="json")
        self.assertEqual(res_future.status_code, 400)

        # Negative and excessive weight rejected
        self.assertEqual(self.client.post("/production/weights/", {
            "livestock": self.cow.pk, "weight": "-10.00", "weighing_date": "2026-01-16",
        }, format="json").status_code, 400)
        self.assertEqual(self.client.post("/production/weights/", {
            "livestock": self.cow.pk, "weight": "4500.00", "weighing_date": "2026-01-16",
        }, format="json").status_code, 400)

        # Cannot log weight for another farmer's cow
        res_foreign = self.client.post("/production/weights/", {
            "livestock": self.foreign_cow.pk, "weight": "410.00", "weighing_date": "2026-01-16",
        }, format="json")
        self.assertEqual(res_foreign.status_code, 400)

        # Other farmer only sees their own weights in list
        self.client.force_authenticate(user=self.other_farmer_user)
        self.assertEqual(len(self.client.get("/production/weights/").data), 0)

    def test_farmer_can_delete_unlinked_personal_entry_but_not_linked_slaughter(self):
        self.client.force_authenticate(user=self.farmer_user)
        # Create personal milk log
        milk_res = self.submit(self.cow, "MILK", "10.00", "LITERS", milking_session="AFTERNOON")
        self.assertEqual(milk_res.status_code, 201)
        record_id = milk_res.data["id"]

        # Other farmer cannot delete
        self.client.force_authenticate(user=self.other_farmer_user)
        self.assertEqual(self.client.delete(f"/production/records/{record_id}/").status_code, 404)

        # Owner can delete personal RECORDED entry
        self.client.force_authenticate(user=self.farmer_user)
        del_res = self.client.delete(f"/production/records/{record_id}/")
        self.assertEqual(del_res.status_code, 204)
        self.assertFalse(ProductionRecord.objects.filter(pk=record_id).exists())

        # An unlinked farmer meat-yield log is personal data and does not reconcile inventory.
        meat_res = self.submit(self.bull, "MEAT", "190.00", "KILOGRAMS")
        self.assertEqual(meat_res.status_code, 201, meat_res.data)
        meat_id = meat_res.data["id"]
        self.bull.refresh_from_db()
        self.assertEqual(self.bull.operational_status, "ACTIVE")

        self.assertEqual(self.client.delete(f"/production/records/{meat_id}/").status_code, 204)
        self.assertFalse(ProductionRecord.objects.filter(pk=meat_id).exists())

        # A linked official report must be managed through its own workflow, even while pending.
        linked = self.submit(self.bull, "MEAT", "185.00", "KILOGRAMS",
                             submit_slaughter_report=True, selected_animals=[self.bull.pk])
        self.assertEqual(linked.status_code, 201, linked.data)
        linked_id = linked.data["id"]
        self.assertEqual(self.client.delete(f"/production/records/{linked_id}/").status_code, 403)
        self.assertTrue(ProductionRecord.objects.filter(pk=linked_id).exists())

        slaughter = ProductionRecord.objects.get(pk=linked_id).slaughter
        self.client.force_authenticate(user=self.mao_user)
        approved = self.client.post(
            f"/api/production/slaughterhouse/records/{slaughter.pk}/review/",
            {"status": "APPROVED"}, format="json",
        )
        self.assertEqual(approved.status_code, 200, approved.data)
        self.client.force_authenticate(user=self.farmer_user)
        self.assertEqual(self.client.delete(f"/production/records/{linked_id}/").status_code, 403)
        self.assertTrue(ProductionRecord.objects.filter(pk=linked_id).exists())

    def test_animal_disposition_requires_ownership(self):
        self.client.force_authenticate(user=self.farmer_user)
        # Cannot declare disposition for foreign animal
        res = self.client.post("/production/dispositions/", {
            "livestock": self.foreign_cow.pk, "intent": "TRANSFER", "target_destination": "Farm X",
        }, format="json")
        self.assertEqual(res.status_code, 400)

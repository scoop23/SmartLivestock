from datetime import date

from rest_framework.test import APITestCase

from livestock.models import (
    Barangay,
    Farmer,
    LivestockBatch,
    LivestockHerdMembershipHistory,
    LivestockInventory,
    LivestockType,
)
from production.models import BreedingRecord, ProductionRecord, WeightRecord
from production.reproductive_service import (
    check_active_bull_herd_exposure,
    resolve_reproductive_status,
)
from users.models import Role, User


class HerdMembershipManagementTests(APITestCase):
    """
    Comprehensive tests for Farmer Individual Livestock Herd Management:
    - Adding an unassigned individual livestock to a herd
    - Moving an individual livestock from Herd A to Herd B
    - Removing an individual livestock from a herd without deleting it or altering status/history
    - Authorization, species validation, duplicate/conflict rejection, herd counts,
      reproductive bull-exposure updates, and append-only herd membership history.
    """

    def setUp(self):
        self.farmer_role, _ = Role.objects.get_or_create(role_name=Role.UserRoles.FARMER)
        self.sibat_role, _ = Role.objects.get_or_create(role_name=Role.UserRoles.SIBAT)

        self.barangay = Barangay.objects.create(
            barangay_name="Poblacion", latitude=13.8821, longitude=121.2144
        )

        # Primary Farmer
        self.farmer_user = User.objects.create_user(
            username="farmer-one",
            email="farmer-one@example.com",
            password="test-password",
            role=self.farmer_role,
            account_status=User.AccountStatus.APPROVED,
        )
        self.farmer = Farmer.objects.create(
            user=self.farmer_user,
            barangay=self.barangay,
            farm_size=2.5,
            address="Poblacion Farm 1",
        )

        # Second Farmer (for horizontal privilege escalation / IDOR tests)
        self.other_farmer_user = User.objects.create_user(
            username="farmer-two",
            email="farmer-two@example.com",
            password="test-password",
            role=self.farmer_role,
            account_status=User.AccountStatus.APPROVED,
        )
        self.other_farmer = Farmer.objects.create(
            user=self.other_farmer_user,
            barangay=self.barangay,
            farm_size=1.5,
            address="Poblacion Farm 2",
        )

        # Species
        self.cattle_type = LivestockType.objects.create(name="Cattle")
        self.goat_type = LivestockType.objects.create(name="Goat")

        # Farmer 1 Herds
        self.herd_a = LivestockBatch.objects.create(
            farmer=self.farmer,
            livestock_type=self.cattle_type,
            batch_name="Herd A - North Pasture",
            batch_code="HRD-A01",
            housing_pen="North Pasture Pen 1",
            created_by=self.farmer_user,
        )
        self.herd_b = LivestockBatch.objects.create(
            farmer=self.farmer,
            livestock_type=self.cattle_type,
            batch_name="Herd B - South Barn",
            batch_code="HRD-B02",
            housing_pen="South Barn Pen 2",
            created_by=self.farmer_user,
        )
        self.goat_herd = LivestockBatch.objects.create(
            farmer=self.farmer,
            livestock_type=self.goat_type,
            batch_name="Goat Herd 1",
            batch_code="HRD-G01",
            created_by=self.farmer_user,
        )
        self.archived_herd = LivestockBatch.objects.create(
            farmer=self.farmer,
            livestock_type=self.cattle_type,
            batch_name="Archived Herd",
            batch_code="HRD-ARC",
            status=LivestockBatch.StatusType.ARCHIVED,
            created_by=self.farmer_user,
        )

        # Farmer 2 Herd
        self.other_farmer_herd = LivestockBatch.objects.create(
            farmer=self.other_farmer,
            livestock_type=self.cattle_type,
            batch_name="Other Farmer Herd",
            batch_code="HRD-OTH",
            created_by=self.other_farmer_user,
        )

        # Unassigned individual cow owned by Farmer 1
        self.cow_unassigned = LivestockInventory.objects.create(
            farmer=self.farmer,
            livestock_type=self.cattle_type,
            entry_type=LivestockInventory.EntryType.INDIVIDUAL,
            quantity=1,
            tag_number="SL-001",
            breed="Brahman",
            sex="FEMALE",
            status=LivestockInventory.StatusType.APPROVED,
            operational_status=LivestockInventory.OperationalStatus.ACTIVE,
            created_by=self.farmer_user,
        )

        # Individual cow already in Herd A owned by Farmer 1
        self.cow_in_herd_a = LivestockInventory.objects.create(
            farmer=self.farmer,
            livestock_type=self.cattle_type,
            batch=self.herd_a,
            entry_type=LivestockInventory.EntryType.INDIVIDUAL,
            quantity=1,
            tag_number="SL-002",
            breed="Holstein",
            sex="FEMALE",
            status=LivestockInventory.StatusType.APPROVED,
            operational_status=LivestockInventory.OperationalStatus.ACTIVE,
            created_by=self.farmer_user,
        )

        # Individual cow owned by Farmer 2
        self.other_farmer_cow = LivestockInventory.objects.create(
            farmer=self.other_farmer,
            livestock_type=self.cattle_type,
            entry_type=LivestockInventory.EntryType.INDIVIDUAL,
            quantity=1,
            tag_number="SL-999",
            breed="Brahman",
            sex="FEMALE",
            status=LivestockInventory.StatusType.APPROVED,
            operational_status=LivestockInventory.OperationalStatus.ACTIVE,
            created_by=self.other_farmer_user,
        )

    def test_1_and_4_farmer_can_add_unassigned_animal_to_authorized_herd(self):
        self.client.force_authenticate(user=self.farmer_user)
        response = self.client.post(
            f"/livestock/inventory/{self.cow_unassigned.pk}/herd/",
            {
                "action": "ADD",
                "batch_id": self.herd_a.pk,
                "notes": "Assigned to North Pasture for grazing",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.cow_unassigned.refresh_from_db()
        self.assertEqual(self.cow_unassigned.batch_id, self.herd_a.pk)
        self.assertEqual(
            self.cow_unassigned.status, LivestockInventory.StatusType.APPROVED
        )
        self.assertEqual(
            self.cow_unassigned.operational_status,
            LivestockInventory.OperationalStatus.ACTIVE,
        )

        history = LivestockHerdMembershipHistory.objects.filter(
            livestock=self.cow_unassigned
        )
        self.assertEqual(history.count(), 1)
        entry = history.first()
        self.assertEqual(entry.action, LivestockHerdMembershipHistory.ActionType.ADDED)
        self.assertIsNone(entry.previous_batch)
        self.assertEqual(entry.new_batch_id, self.herd_a.pk)
        self.assertEqual(entry.acted_by_id, self.farmer_user.pk)
        self.assertEqual(entry.notes, "Assigned to North Pasture for grazing")

    def test_2_farmer_can_move_animal_from_herd_a_to_herd_b_atomically(self):
        self.client.force_authenticate(user=self.farmer_user)
        response = self.client.patch(
            f"/livestock/inventory/{self.cow_in_herd_a.pk}/herd/",
            {
                "action": "MOVE",
                "batch_id": self.herd_b.pk,
                "notes": "Rotational grazing to South Barn",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.cow_in_herd_a.refresh_from_db()
        self.assertEqual(self.cow_in_herd_a.batch_id, self.herd_b.pk)
        self.assertFalse(
            self.herd_a.animals.filter(pk=self.cow_in_herd_a.pk).exists()
        )
        self.assertTrue(
            self.herd_b.animals.filter(pk=self.cow_in_herd_a.pk).exists()
        )

        entry = LivestockHerdMembershipHistory.objects.filter(
            livestock=self.cow_in_herd_a
        ).latest("created_at")
        self.assertEqual(entry.action, LivestockHerdMembershipHistory.ActionType.MOVED)
        self.assertEqual(entry.previous_batch_id, self.herd_a.pk)
        self.assertEqual(entry.new_batch_id, self.herd_b.pk)

    def test_3_farmer_can_remove_animal_from_herd_without_deleting_inventory_or_records(self):
        # Create historical production & weight records for cow_in_herd_a
        prod_record = ProductionRecord.objects.create(
            livestock=self.cow_in_herd_a,
            production_type=ProductionRecord.ProductionType.MILK,
            quantity=12.5,
            unit=ProductionRecord.UnitType.LITERS,
            record_date=date.today(),
            created_by=self.farmer_user,
        )
        weight_record = WeightRecord.objects.create(
            livestock=self.cow_in_herd_a,
            weight=410.0,
            weighing_date=date.today(),
            created_by=self.farmer_user,
        )

        self.client.force_authenticate(user=self.farmer_user)
        response = self.client.post(
            f"/livestock/inventory/{self.cow_in_herd_a.pk}/herd/",
            {
                "action": "REMOVE",
                "notes": "Moved to individual maternity stall",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)

        # Animal still exists in inventory, remains ACTIVE and APPROVED, and has batch=None
        self.cow_in_herd_a.refresh_from_db()
        self.assertIsNone(self.cow_in_herd_a.batch_id)
        self.assertEqual(
            self.cow_in_herd_a.operational_status,
            LivestockInventory.OperationalStatus.ACTIVE,
        )
        self.assertEqual(
            self.cow_in_herd_a.status,
            LivestockInventory.StatusType.APPROVED,
        )

        # Historical records remain untouched
        self.assertTrue(ProductionRecord.objects.filter(pk=prod_record.pk).exists())
        self.assertTrue(WeightRecord.objects.filter(pk=weight_record.pk).exists())

        # History records REMOVED action with previous_batch=Herd A and new_batch=None
        entry = LivestockHerdMembershipHistory.objects.filter(
            livestock=self.cow_in_herd_a
        ).latest("created_at")
        self.assertEqual(entry.action, LivestockHerdMembershipHistory.ActionType.REMOVED)
        self.assertEqual(entry.previous_batch_id, self.herd_a.pk)
        self.assertIsNone(entry.new_batch)

    def test_5_invalid_inactive_or_species_mismatched_herd_ids_are_rejected(self):
        self.client.force_authenticate(user=self.farmer_user)

        # Non-existent herd ID
        res_nonexistent = self.client.post(
            f"/livestock/inventory/{self.cow_unassigned.pk}/herd/",
            {"action": "ADD", "batch_id": 999999},
            format="json",
        )
        self.assertEqual(res_nonexistent.status_code, 400)
        self.assertIn("batch", res_nonexistent.data)

        # Inactive/archived herd
        res_inactive = self.client.post(
            f"/livestock/inventory/{self.cow_unassigned.pk}/herd/",
            {"action": "ADD", "batch_id": self.archived_herd.pk},
            format="json",
        )
        self.assertEqual(res_inactive.status_code, 400)

        # Species mismatch (Cattle into Goat herd)
        res_mismatch = self.client.post(
            f"/livestock/inventory/{self.cow_unassigned.pk}/herd/",
            {"action": "ADD", "batch_id": self.goat_herd.pk},
            format="json",
        )
        self.assertEqual(res_mismatch.status_code, 400)
        self.assertIn("batch", res_mismatch.data)

        self.cow_unassigned.refresh_from_db()
        self.assertIsNone(self.cow_unassigned.batch_id)

    def test_6_and_7_farmer_cannot_manage_another_farmers_animal_or_herd(self):
        self.client.force_authenticate(user=self.farmer_user)

        # Scenario 6: Farmer 1 tries to assign Farmer 2's cow into Farmer 1's herd
        res_other_animal = self.client.post(
            f"/livestock/inventory/{self.other_farmer_cow.pk}/herd/",
            {"action": "ADD", "batch_id": self.herd_a.pk},
            format="json",
        )
        self.assertEqual(res_other_animal.status_code, 403)
        self.other_farmer_cow.refresh_from_db()
        self.assertIsNone(self.other_farmer_cow.batch_id)

        # Scenario 7: Farmer 1 tries to assign their own cow into Farmer 2's herd
        res_other_herd = self.client.post(
            f"/livestock/inventory/{self.cow_unassigned.pk}/herd/",
            {"action": "ADD", "batch_id": self.other_farmer_herd.pk},
            format="json",
        )
        self.assertEqual(res_other_herd.status_code, 403)
        self.cow_unassigned.refresh_from_db()
        self.assertIsNone(self.cow_unassigned.batch_id)

    def test_8_and_9_duplicate_or_conflicting_operations_rejected_without_partial_state(self):
        self.client.force_authenticate(user=self.farmer_user)

        # Assigning cow_in_herd_a to the same herd_a
        res_same = self.client.post(
            f"/livestock/inventory/{self.cow_in_herd_a.pk}/herd/",
            {"action": "MOVE", "batch_id": self.herd_a.pk},
            format="json",
        )
        self.assertEqual(res_same.status_code, 400)

        # ADD action when animal already belongs to a herd
        res_add_conflict = self.client.post(
            f"/livestock/inventory/{self.cow_in_herd_a.pk}/herd/",
            {"action": "ADD", "batch_id": self.herd_b.pk},
            format="json",
        )
        self.assertEqual(res_add_conflict.status_code, 400)

        # MOVE action when animal has no current herd
        res_move_unassigned = self.client.post(
            f"/livestock/inventory/{self.cow_unassigned.pk}/herd/",
            {"action": "MOVE", "batch_id": self.herd_a.pk},
            format="json",
        )
        self.assertEqual(res_move_unassigned.status_code, 400)

        # REMOVE action when animal is already unassigned
        res_remove_unassigned = self.client.delete(
            f"/livestock/inventory/{self.cow_unassigned.pk}/herd/"
        )
        self.assertEqual(res_remove_unassigned.status_code, 400)

        # Verify no history rows were created by failed operations
        self.assertEqual(
            LivestockHerdMembershipHistory.objects.filter(
                livestock__in=[self.cow_unassigned, self.cow_in_herd_a]
            ).count(),
            0,
        )

    def test_10_herd_counts_and_membership_lists_update_correctly(self):
        self.client.force_authenticate(user=self.farmer_user)

        # Initially Herd A has 1 animal (SL-002), Herd B has 0
        batches_before = self.client.get("/livestock/batches/").data
        herd_a_data = next(b for b in batches_before if b["id"] == self.herd_a.pk)
        herd_b_data = next(b for b in batches_before if b["id"] == self.herd_b.pk)
        self.assertEqual(herd_a_data["total_animals"], 1)
        self.assertEqual(herd_b_data["total_animals"], 0)

        # Add SL-001 to Herd A -> Herd A has 2
        self.client.post(
            f"/livestock/inventory/{self.cow_unassigned.pk}/herd/",
            {"action": "ADD", "batch_id": self.herd_a.pk},
            format="json",
        )
        # Move SL-002 from Herd A to Herd B -> Herd A has 1 (SL-001), Herd B has 1 (SL-002)
        self.client.patch(
            f"/livestock/inventory/{self.cow_in_herd_a.pk}/herd/",
            {"action": "MOVE", "batch_id": self.herd_b.pk},
            format="json",
        )

        batches_after = self.client.get("/livestock/batches/").data
        herd_a_after = next(b for b in batches_after if b["id"] == self.herd_a.pk)
        herd_b_after = next(b for b in batches_after if b["id"] == self.herd_b.pk)
        self.assertEqual(herd_a_after["total_animals"], 1)
        self.assertEqual(herd_b_after["total_animals"], 1)

        herd_a_detail = self.client.get(f"/livestock/batches/{self.herd_a.pk}/").data
        herd_b_detail = self.client.get(f"/livestock/batches/{self.herd_b.pk}/").data
        self.assertEqual(
            [a["tag_number"] for a in herd_a_detail["animals"]], ["SL-001"]
        )
        self.assertEqual(
            [a["tag_number"] for a in herd_b_detail["animals"]], ["SL-002"]
        )

    def test_11_reproductive_bull_exposure_updates_without_altering_breeding_records(self):
        # Place an active bull in Herd B
        bull = LivestockInventory.objects.create(
            farmer=self.farmer,
            livestock_type=self.cattle_type,
            batch=self.herd_b,
            entry_type=LivestockInventory.EntryType.INDIVIDUAL,
            quantity=1,
            tag_number="BULL-100",
            breed="Brahman",
            sex="MALE",
            status=LivestockInventory.StatusType.APPROVED,
            operational_status=LivestockInventory.OperationalStatus.ACTIVE,
            created_by=self.farmer_user,
        )

        # Initially cow_in_herd_a is in Herd A (no bull) -> not exposed
        exposure_before = check_active_bull_herd_exposure(self.cow_in_herd_a)
        self.assertFalse(exposure_before["has_exposure"])

        # Move cow_in_herd_a to Herd B (has active bull) -> now dynamically exposed
        self.client.force_authenticate(user=self.farmer_user)
        self.client.patch(
            f"/livestock/inventory/{self.cow_in_herd_a.pk}/herd/",
            {"action": "MOVE", "batch_id": self.herd_b.pk},
            format="json",
        )
        self.cow_in_herd_a.refresh_from_db()
        exposure_in_herd_b = check_active_bull_herd_exposure(self.cow_in_herd_a)
        self.assertTrue(exposure_in_herd_b["has_exposure"])
        self.assertIn(bull.tag_number, exposure_in_herd_b["bull_tags"])
        repro_status = resolve_reproductive_status(self.cow_in_herd_a)
        self.assertEqual(repro_status["status"], "EXPOSED")

        # If cow has an confirmed PREGNANT BreedingRecord and is removed from Herd B,
        # her PREGNANT status is preserved and not erased.
        BreedingRecord.objects.create(
            dam=self.cow_in_herd_a,
            sire_livestock=bull,
            breeding_date=date.today(),
            breeding_type=BreedingRecord.BreedingType.NATURAL,
            status=BreedingRecord.BreedingStatus.PREGNANT,
            pregnancy_confirmed_date=date.today(),
            created_by=self.farmer_user,
        )
        self.client.delete(
            f"/livestock/inventory/{self.cow_in_herd_a.pk}/herd/"
        )
        self.cow_in_herd_a.refresh_from_db()
        repro_after_removal = resolve_reproductive_status(self.cow_in_herd_a)
        self.assertEqual(repro_after_removal["status"], "PREGNANT")

    def test_12_full_lifecycle_history_serialized_on_inventory_response(self):
        self.client.force_authenticate(user=self.farmer_user)

        # 1. Add SL-001 to Herd A
        self.client.post(
            f"/livestock/inventory/{self.cow_unassigned.pk}/herd/",
            {"action": "ADD", "batch_id": self.herd_a.pk, "notes": "Initial herd"},
            format="json",
        )
        # 2. Move SL-001 to Herd B
        self.client.patch(
            f"/livestock/inventory/{self.cow_unassigned.pk}/herd/",
            {"action": "MOVE", "batch_id": self.herd_b.pk, "notes": "Second herd"},
            format="json",
        )
        # 3. Remove SL-001 from Herd B
        res = self.client.post(
            f"/livestock/inventory/{self.cow_unassigned.pk}/herd/",
            {"action": "REMOVE", "notes": "Removed to individual stall"},
            format="json",
        )
        self.assertEqual(res.status_code, 200, res.data)
        history = res.data["herd_membership_history"]
        self.assertEqual(len(history), 3)
        # Ordered newest first (-created_at)
        self.assertEqual(history[0]["action"], "REMOVED")
        self.assertEqual(history[0]["previous_batch_code"], "HRD-B02")
        self.assertIsNone(history[0]["new_batch_code"])
        self.assertEqual(history[1]["action"], "MOVED")
        self.assertEqual(history[1]["previous_batch_code"], "HRD-A01")
        self.assertEqual(history[1]["new_batch_code"], "HRD-B02")
        self.assertEqual(history[2]["action"], "ADDED")
        self.assertIsNone(history[2]["previous_batch_code"])
        self.assertEqual(history[2]["new_batch_code"], "HRD-A01")

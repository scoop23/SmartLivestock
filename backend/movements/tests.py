from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status

from users.models import User, Role, Notification
from livestock.models import Barangay, Farmer, LivestockType, LivestockInventory
from movements.models import (
    LivestockInspection,
    LivestockInspectionItem,
    LivestockInspectionClearance,
)
from analytics.services.gis import get_user_gis_scope


class LivestockInspectionWorkflowTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Roles
        self.auction_role, _ = Role.objects.get_or_create(role_name="AUCTION")
        self.mao_role, _ = Role.objects.get_or_create(role_name="MAO")
        self.sibat_role, _ = Role.objects.get_or_create(role_name="SIBAT")
        self.farmer_role, _ = Role.objects.get_or_create(role_name="FARMER")

        # Barangays
        self.brgy_poblacion, _ = Barangay.objects.get_or_create(
            barangay_name="Poblacion",
            defaults={"latitude": 13.879, "longitude": 121.212},
        )
        self.brgy_san_felipe, _ = Barangay.objects.get_or_create(
            barangay_name="San Felipe",
            defaults={"latitude": 13.885, "longitude": 121.221},
        )

        # Users
        self.auction_user = User.objects.create_user(
            username="auction_officer",
            email="auction@padregarcia.gov.ph",
            password="password123",
            role=self.auction_role,
            account_status=User.AccountStatus.APPROVED,
        )

        self.mao_user = User.objects.create_user(
            username="mao_officer",
            email="mao@padregarcia.gov.ph",
            password="password123",
            role=self.mao_role,
            account_status=User.AccountStatus.APPROVED,
        )

        self.sibat_user = User.objects.create_user(
            username="sibat_officer",
            email="sibat@padregarcia.gov.ph",
            password="password123",
            role=self.sibat_role,
            assigned_barangay=self.brgy_poblacion,
            account_status=User.AccountStatus.APPROVED,
        )

        self.farmer_user = User.objects.create_user(
            username="farmer_juan",
            email="juan@example.com",
            password="password123",
            role=self.farmer_role,
            account_status=User.AccountStatus.APPROVED,
        )
        self.farmer = Farmer.objects.create(
            user=self.farmer_user,
            barangay=self.brgy_poblacion,
            farm_size=2.5,
            address="Purok 2, Brgy. Poblacion, Padre Garcia",
        )

        # Livestock species
        self.cattle_type = LivestockType.objects.create(name="Cattle (Baka)")
        self.goat_type = LivestockType.objects.create(name="Goat (Kambing)")

        # Approved livestock inventory for Juan
        self.inventory_cow = LivestockInventory.objects.create(
            farmer=self.farmer,
            livestock_type=self.cattle_type,
            tag_number="PG-COW-001",
            quantity=1,
            breed="Brahman",
            status=LivestockInventory.StatusType.APPROVED,
            operational_status=LivestockInventory.OperationalStatus.ACTIVE,
            created_by=self.farmer_user,
        )

    def test_auction_officer_can_create_inspection(self):
        self.client.force_authenticate(user=self.auction_user)
        payload = {
            "shipper": self.farmer.id,
            "shipper_name": "Juan Dela Cruz",
            "shipper_address": "Purok 2, Brgy. Poblacion, Padre Garcia",
            "destination": "Batangas City Slaughterhouse",
            "purpose": "SLAUGHTER",
            "inspection_date": str(timezone.now().date()),
            "vehicle_plate_number": "NDB-8421",
            "livestock_handler_license_no": "LHL-2026-4412",
            "items": [
                {
                    "livestock_type": self.cattle_type.id,
                    "inventory": self.inventory_cow.id,
                    "quantity": 1,
                    "sex": "MALE",
                    "classification": "SLAUGHTER",
                    "remarks": "Antemortem passed, healthy",
                }
            ],
        }
        response = self.client.post("/api/inspections/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["status"], "PENDING")
        self.assertTrue(response.data["control_number"].startswith("CLR-"))

        # Confirm notification sent to MAO
        mao_notif = Notification.objects.filter(
            user=self.mao_user,
            related_entity_type="inspection",
            related_entity_id=response.data["id"],
        ).first()
        self.assertIsNotNone(mao_notif)
        self.assertIn("New Livestock Inspection", mao_notif.title)

    def test_farmer_cannot_create_inspection(self):
        self.client.force_authenticate(user=self.farmer_user)
        payload = {
            "shipper_name": "Juan Dela Cruz",
            "destination": "Lipa City",
            "purpose": "SLAUGHTER",
            "inspection_date": str(timezone.now().date()),
        }
        response = self.client.post("/api/inspections/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_inspection_item_validation_species_mismatch(self):
        self.client.force_authenticate(user=self.auction_user)
        payload = {
            "shipper": self.farmer.id,
            "shipper_name": "Juan Dela Cruz",
            "destination": "Lipa Breeding Center",
            "purpose": "BREEDING",
            "inspection_date": str(timezone.now().date()),
            "items": [
                {
                    "livestock_type": self.goat_type.id,  # Goat type with Cow inventory
                    "inventory": self.inventory_cow.id,
                    "quantity": 1,
                    "sex": "FEMALE",
                    "classification": "BREEDER",
                }
            ],
        }
        response = self.client.post("/api/inspections/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_full_workflow_auction_verify_mao_approve(self):
        # 1. Create inspection as Auction Officer
        self.client.force_authenticate(user=self.auction_user)
        payload = {
            "shipper": self.farmer.id,
            "shipper_name": "Juan Dela Cruz",
            "destination": "Tanauan Meat Processing",
            "purpose": "SLAUGHTER",
            "inspection_date": str(timezone.now().date()),
            "items": [
                {
                    "livestock_type": self.cattle_type.id,
                    "inventory": self.inventory_cow.id,
                    "quantity": 1,
                    "sex": "MALE",
                    "classification": "SLAUGHTER",
                }
            ],
        }
        create_res = self.client.post("/api/inspections/", payload, format="json")
        self.assertEqual(create_res.status_code, status.HTTP_201_CREATED)
        insp_id = create_res.data["id"]

        # 2. Auction Officer attempts to APPROVE directly -> MUST BE REJECTED
        review_res = self.client.post(
            f"/api/inspections/{insp_id}/review/",
            {"status": "APPROVED", "remarks": "Trying to bypass MAO"},
            format="json",
        )
        self.assertIn(review_res.status_code, (status.HTTP_400_BAD_REQUEST, status.HTTP_403_FORBIDDEN))

        # 3. Auction Officer verifies inspection findings (PENDING -> VERIFIED)
        verify_res = self.client.post(f"/api/inspections/{insp_id}/verify/")
        self.assertEqual(verify_res.status_code, status.HTTP_200_OK)
        self.assertEqual(verify_res.data["status"], "VERIFIED")

        # 4. MAO approves inspection (VERIFIED -> APPROVED)
        self.client.force_authenticate(user=self.mao_user)
        approve_res = self.client.post(
            f"/api/inspections/{insp_id}/review/",
            {"status": "APPROVED", "remarks": "Inspected and certified for movement."},
            format="json",
        )
        self.assertEqual(approve_res.status_code, status.HTTP_200_OK)
        self.assertEqual(approve_res.data["status"], "APPROVED")
        self.assertIsNotNone(approve_res.data["date_issued"])

        # Check clearance model
        clearance = LivestockInspectionClearance.objects.get(inspection_id=insp_id)
        self.assertEqual(clearance.status, LivestockInspectionClearance.StatusType.APPROVED)
        self.assertEqual(clearance.issued_by, self.mao_user)

        # 5. Auction Officer receives approval notification
        auction_notif = Notification.objects.filter(
            user=self.auction_user,
            related_entity_type="inspection",
            related_entity_id=insp_id,
        ).first()
        self.assertIsNotNone(auction_notif)
        self.assertIn("Approved", auction_notif.title)

    def test_workflow_mao_subject_to_revision_and_auction_resubmit(self):
        # 1. Create and verify
        self.client.force_authenticate(user=self.auction_user)
        payload = {
            "shipper_name": "Maria Santos",
            "destination": "Batangas City Slaughterhouse",
            "purpose": "SLAUGHTER",
            "inspection_date": str(timezone.now().date()),
            "items": [
                {
                    "livestock_type": self.cattle_type.id,
                    "quantity": 2,
                    "sex": "FEMALE",
                    "classification": "SLAUGHTER",
                }
            ],
        }
        create_res = self.client.post("/api/inspections/", payload, format="json")
        insp_id = create_res.data["id"]
        self.client.post(f"/api/inspections/{insp_id}/verify/")

        # 2. MAO returns for revision
        self.client.force_authenticate(user=self.mao_user)
        revision_res = self.client.post(
            f"/api/inspections/{insp_id}/review/",
            {"status": "SUBJECT_TO_REVISION", "remarks": "Missing vehicle plate number and driver clearance."},
            format="json",
        )
        self.assertEqual(revision_res.status_code, status.HTTP_200_OK)
        self.assertEqual(revision_res.data["status"], "SUBJECT_TO_REVISION")

        # 3. Auction Officer updates and resubmits (SUBJECT_TO_REVISION -> VERIFIED)
        self.client.force_authenticate(user=self.auction_user)
        patch_res = self.client.patch(
            f"/api/inspections/{insp_id}/",
            {"vehicle_plate_number": "CAL-9912"},
            format="json",
        )
        self.assertEqual(patch_res.status_code, status.HTTP_200_OK)

        resubmit_res = self.client.post(f"/api/inspections/{insp_id}/verify/")
        self.assertEqual(resubmit_res.status_code, status.HTTP_200_OK)
        self.assertEqual(resubmit_res.data["status"], "VERIFIED")

    def test_cannot_delete_approved_inspection(self):
        # Create and approve inspection
        self.client.force_authenticate(user=self.auction_user)
        payload = {
            "shipper_name": "Pedro Reyes",
            "destination": "Lipa City",
            "purpose": "FATTENING",
            "inspection_date": str(timezone.now().date()),
            "items": [
                {
                    "livestock_type": self.cattle_type.id,
                    "quantity": 1,
                    "sex": "MALE",
                    "classification": "FATTENING",
                }
            ],
        }
        res = self.client.post("/api/inspections/", payload, format="json")
        insp_id = res.data["id"]
        self.client.post(f"/api/inspections/{insp_id}/verify/")

        self.client.force_authenticate(user=self.mao_user)
        self.client.post(f"/api/inspections/{insp_id}/review/", {"status": "APPROVED", "remarks": "Approved"})

        # Try to delete as Auction
        self.client.force_authenticate(user=self.auction_user)
        del_res = self.client.delete(f"/api/inspections/{insp_id}/")
        self.assertEqual(del_res.status_code, status.HTTP_409_CONFLICT)
        self.assertTrue(LivestockInspection.objects.filter(id=insp_id).exists())


class StaleNotificationDeletionTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.farmer_role, _ = Role.objects.get_or_create(role_name="FARMER")
        self.sibat_role, _ = Role.objects.get_or_create(role_name="SIBAT")

        self.brgy = Barangay.objects.create(
            barangay_name="San Felipe", latitude=13.88, longitude=121.22
        )

        self.sibat = User.objects.create_user(
            username="sibat_test",
            email="sibat_test@example.com",
            password="password123",
            role=self.sibat_role,
            assigned_barangay=self.brgy,
            account_status=User.AccountStatus.APPROVED,
        )

        self.farmer_a_user = User.objects.create_user(
            username="farmer_a",
            email="farmer_a@example.com",
            password="password123",
            role=self.farmer_role,
            account_status=User.AccountStatus.APPROVED,
        )
        self.farmer_a = Farmer.objects.create(
            user=self.farmer_a_user, barangay=self.brgy, farm_size=1.0, address="Purok 1"
        )

        self.farmer_b_user = User.objects.create_user(
            username="farmer_b",
            email="farmer_b@example.com",
            password="password123",
            role=self.farmer_role,
            account_status=User.AccountStatus.APPROVED,
        )
        self.farmer_b = Farmer.objects.create(
            user=self.farmer_b_user, barangay=self.brgy, farm_size=1.5, address="Purok 2"
        )

        self.livestock_type = LivestockType.objects.create(name="Cattle (Baka)")

    def test_stale_notification_cleanup_on_inventory_delete(self):
        # 1. Farmer A registers livestock
        self.client.force_authenticate(user=self.farmer_a_user)
        payload_a = {
            "livestock_type": self.livestock_type.id,
            "entry_type": "INDIVIDUAL",
            "quantity": 1,
            "tag_number": "COW-AAA-01",
            "breed": "Brahman",
            "sex": "FEMALE",
        }
        res_a = self.client.post("/api/livestock/inventory/", payload_a, format="json")
        self.assertEqual(res_a.status_code, status.HTTP_201_CREATED)
        cow_a_id = res_a.data["id"]

        # 2. Farmer B registers livestock
        self.client.force_authenticate(user=self.farmer_b_user)
        payload_b = {
            "livestock_type": self.livestock_type.id,
            "entry_type": "INDIVIDUAL",
            "quantity": 1,
            "tag_number": "COW-BBB-02",
            "breed": "Simmental",
            "sex": "MALE",
        }
        res_b = self.client.post("/api/livestock/inventory/", payload_b, format="json")
        self.assertEqual(res_b.status_code, status.HTTP_201_CREATED)
        cow_b_id = res_b.data["id"]

        # Confirm SIBAT has 2 notifications
        notifs_a = Notification.objects.filter(
            related_entity_type="livestock_inventory", related_entity_id=cow_a_id
        )
        notifs_b = Notification.objects.filter(
            related_entity_type="livestock_inventory", related_entity_id=cow_b_id
        )
        self.assertTrue(notifs_a.exists())
        self.assertTrue(notifs_b.exists())

        # 3. Farmer A deletes pending livestock COW-A
        self.client.force_authenticate(user=self.farmer_a_user)
        del_res = self.client.delete(f"/api/livestock/inventory/{cow_a_id}/")
        self.assertEqual(del_res.status_code, status.HTTP_204_NO_CONTENT)

        # 4. Verify Cow A's notification was removed, but Cow B's notification remains!
        self.assertFalse(
            Notification.objects.filter(
                related_entity_type="livestock_inventory", related_entity_id=cow_a_id
            ).exists()
        )
        self.assertTrue(
            Notification.objects.filter(
                related_entity_type="livestock_inventory", related_entity_id=cow_b_id
            ).exists()
        )


class GisRoleScopingTests(TestCase):
    def setUp(self):
        self.auction_role, _ = Role.objects.get_or_create(role_name="AUCTION")
        self.mao_role, _ = Role.objects.get_or_create(role_name="MAO")
        self.farmer_role, _ = Role.objects.get_or_create(role_name="FARMER")

        self.auction_user = User.objects.create_user(
            username="auction_gis",
            email="auction_gis@example.com",
            password="password123",
            role=self.auction_role,
        )
        self.mao_user = User.objects.create_user(
            username="mao_gis",
            email="mao_gis@example.com",
            password="password123",
            role=self.mao_role,
        )

    def test_auction_gis_scope(self):
        scope = get_user_gis_scope(self.auction_user)
        self.assertEqual(scope["role"], "AUCTION")
        self.assertEqual(scope["scope"], "OPERATIONAL_MOVEMENT")
        self.assertIn("movement", scope["allowed_layers"])
        self.assertIn("cattle", scope["allowed_layers"])
        # Strictly NO simulation
        self.assertFalse(scope["can_use_simulation"])
        self.assertFalse(scope["can_use_advanced_analytics"])

    def test_mao_gis_scope(self):
        scope = get_user_gis_scope(self.mao_user)
        self.assertEqual(scope["role"], "MAO")
        self.assertEqual(scope["scope"], "MUNICIPAL")
        self.assertTrue(scope["can_view_all_barangays"])
        self.assertTrue(scope["can_use_simulation"])
        self.assertTrue(scope["can_use_advanced_analytics"])

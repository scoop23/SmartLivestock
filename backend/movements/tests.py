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
from analytics.services.gis import get_user_gis_scope, get_gis_aggregated_data


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
        self.assertTrue(response.data["control_number"].startswith("INS-"))

        # Confirm notification sent to MAO
        mao_notif = Notification.objects.filter(
            user=self.mao_user,
            related_entity_type="inspection",
            related_entity_id=response.data["id"],
        ).first()
        self.assertIsNotNone(mao_notif)
        self.assertIn("New Livestock Inspection", mao_notif.title)

    def test_registered_shipper_lookup_is_restricted_and_returns_eligible_animals(self):
        self.client.force_authenticate(user=self.auction_user)
        result = self.client.get("/api/inspections/shippers/?search=farmer_juan")
        self.assertEqual(result.status_code, status.HTTP_200_OK)
        self.assertEqual(result.data[0]["id"], self.farmer.id)
        self.assertEqual(result.data[0]["animals"][0]["id"], self.inventory_cow.id)
        self.client.force_authenticate(user=self.farmer_user)
        forbidden = self.client.get("/api/inspections/shippers/?search=farmer_juan")
        self.assertEqual(forbidden.status_code, status.HTTP_403_FORBIDDEN)

    def test_registered_animal_must_belong_to_selected_shipper(self):
        other_user = User.objects.create_user(username="other_shipper", password="password123",
                                              role=self.farmer_role, account_status=User.AccountStatus.APPROVED)
        other_farmer = Farmer.objects.create(user=other_user, barangay=self.brgy_poblacion,
                                             address="San Felipe", farm_size=1)
        self.client.force_authenticate(user=self.auction_user)
        result = self.client.post("/api/inspections/", {
            "shipper": other_farmer.id, "shipper_name": "Other Shipper",
            "origin": "San Felipe, Padre Garcia", "destination": "Tanauan",
            "purpose": "BREEDING", "inspection_date": str(timezone.now().date()),
            "items": [{"livestock_type": self.cattle_type.id,
                       "inventory": self.inventory_cow.id, "quantity": 1,
                       "sex": "MALE", "classification": "BREEDER"}],
        }, format="json")
        self.assertEqual(result.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("items", result.data)

    def test_farmer_can_create_inspection_for_own_livestock(self):
        self.client.force_authenticate(user=self.farmer_user)
        payload = {
            "destination": "San Juan Livestock Market",
            "purpose": "BREEDING",
            "inspection_date": str(timezone.now().date()),
            "vehicle_plate_number": "ABC-1234",
            "livestock_handler_license_no": "LHL-9988",
            "items": [
                {
                    "livestock_type": self.cattle_type.id,
                    "inventory": self.inventory_cow.id,
                    "quantity": 1,
                    "sex": "MALE",
                    "classification": "BREEDER",
                    "remarks": "Vaccinated, ready for transport",
                }
            ],
        }
        response = self.client.post("/api/inspections/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["status"], "PENDING")
        self.assertEqual(response.data["shipper"], self.farmer.id)
        self.assertEqual(response.data["shipper_name"], "farmer_juan")

        # Confirm notification sent to Auction officers
        notif = Notification.objects.filter(
            user=self.auction_user,
            related_entity_type="inspection",
            related_entity_id=response.data["id"],
        ).first()
        self.assertIsNotNone(notif)
        self.assertIn("New Livestock Inspection", notif.title)

    def test_farmer_cannot_create_inspection_with_other_farmers_animal(self):
        # Create second farmer and animal
        other_user = User.objects.create_user(
            username="farmer_maria",
            email="maria@example.com",
            password="password123",
            role=self.farmer_role,
            account_status=User.AccountStatus.APPROVED,
        )
        other_farmer = Farmer.objects.create(
            user=other_user,
            barangay=self.brgy_poblacion,
            farm_size=1.0,
            address="Purok 1",
        )
        other_cow = LivestockInventory.objects.create(
            farmer=other_farmer,
            livestock_type=self.cattle_type,
            tag_number="PG-COW-002",
            quantity=1,
            status=LivestockInventory.StatusType.APPROVED,
            operational_status=LivestockInventory.OperationalStatus.ACTIVE,
            created_by=other_user,
        )

        # Farmer Juan attempts to include Maria's cow
        self.client.force_authenticate(user=self.farmer_user)
        payload = {
            "destination": "Tanauan",
            "purpose": "SLAUGHTER",
            "inspection_date": str(timezone.now().date()),
            "items": [
                {
                    "livestock_type": self.cattle_type.id,
                    "inventory": other_cow.id,
                    "quantity": 1,
                    "sex": "FEMALE",
                    "classification": "SLAUGHTER",
                }
            ],
        }
        response = self.client.post("/api/inspections/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("items", response.data)

    def test_farmer_cannot_approve_own_inspection(self):
        # Create inspection as farmer
        self.client.force_authenticate(user=self.farmer_user)
        payload = {
            "destination": "Batangas City",
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
        res = self.client.post("/api/inspections/", payload, format="json")
        insp_id = res.data["id"]

        verify_res = self.client.post(f"/api/inspections/{insp_id}/verify/")
        self.assertEqual(verify_res.status_code, status.HTTP_403_FORBIDDEN)

        # Attempt to review/approve -> Forbidden
        review_res = self.client.post(
            f"/api/inspections/{insp_id}/review/",
            {"status": "APPROVED", "remarks": "Self approval"},
            format="json",
        )
        self.assertEqual(review_res.status_code, status.HTTP_403_FORBIDDEN)

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

    def test_revision_cannot_detach_shipper_from_linked_animal(self):
        self.client.force_authenticate(user=self.auction_user)
        create = self.client.post("/api/inspections/", {
            "shipper": self.farmer.id, "shipper_name": "Juan",
            "origin": "Poblacion, Padre Garcia", "destination": "Tanauan",
            "purpose": "BREEDING", "inspection_date": str(timezone.now().date()),
            "items": [{"livestock_type": self.cattle_type.id,
                       "inventory": self.inventory_cow.id, "quantity": 1,
                       "sex": "MALE", "classification": "BREEDER"}],
        }, format="json")
        self.assertEqual(create.status_code, status.HTTP_201_CREATED)
        record_id = create.data["id"]
        self.client.force_authenticate(user=self.mao_user)
        self.client.post(f"/api/inspections/{record_id}/review/",
                         {"status": "SUBJECT_TO_REVISION", "remarks": "Correct destination."},
                         format="json")
        self.client.force_authenticate(user=self.auction_user)
        response = self.client.patch(f"/api/inspections/{record_id}/",
                                     {"shipper": None}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("items", response.data)

    def test_duplicate_inventory_in_same_inspection_rejected(self):
        self.client.force_authenticate(user=self.auction_user)
        payload = {
            "shipper": self.farmer.id,
            "shipper_name": "Juan Dela Cruz",
            "destination": "Lipa",
            "purpose": "BREEDING",
            "inspection_date": str(timezone.now().date()),
            "items": [
                {
                    "livestock_type": self.cattle_type.id,
                    "inventory": self.inventory_cow.id,
                    "quantity": 1,
                    "sex": "MALE",
                    "classification": "BREEDER",
                },
                {
                    "livestock_type": self.cattle_type.id,
                    "inventory": self.inventory_cow.id,
                    "quantity": 1,
                    "sex": "MALE",
                    "classification": "BREEDER",
                },
            ],
        }
        response = self.client.post("/api/inspections/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("items", response.data)

    def test_full_workflow_auction_submit_mao_approve(self):
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

        # Submission is already in MAO's queue; Auction cannot self-verify.
        verify_res = self.client.post(f"/api/inspections/{insp_id}/verify/")
        self.assertEqual(verify_res.status_code, status.HTTP_409_CONFLICT)

        # MAO approves the submitted record.
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
            "origin": "Tanauan, Batangas",
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

        # 2. MAO returns for revision
        self.client.force_authenticate(user=self.mao_user)
        revision_res = self.client.post(
            f"/api/inspections/{insp_id}/review/",
            {"status": "SUBJECT_TO_REVISION", "remarks": "Missing vehicle plate number and driver clearance."},
            format="json",
        )
        self.assertEqual(revision_res.status_code, status.HTTP_200_OK)
        self.assertEqual(revision_res.data["status"], "SUBJECT_TO_REVISION")

        # Auction Officer corrects then explicitly resubmits to MAO.
        self.client.force_authenticate(user=self.auction_user)
        patch_res = self.client.patch(
            f"/api/inspections/{insp_id}/",
            {"vehicle_plate_number": "CAL-9912"},
            format="json",
        )
        self.assertEqual(patch_res.status_code, status.HTTP_200_OK)

        resubmit_res = self.client.post(f"/api/inspections/{insp_id}/resubmit/")
        self.assertEqual(resubmit_res.status_code, status.HTTP_200_OK)
        self.assertEqual(resubmit_res.data["status"], "PENDING")
        self.client.force_authenticate(user=self.mao_user)
        approve_res = self.client.post(
            f"/api/inspections/{insp_id}/review/",
            {"status": "APPROVED", "remarks": "Corrections accepted."},
            format="json",
        )
        self.assertEqual(approve_res.status_code, status.HTTP_200_OK)
        self.assertIsNotNone(approve_res.data["date_issued"])

    def test_farmer_resubmit_after_subject_to_revision_resets_to_pending(self):
        # 1. Farmer creates inspection
        self.client.force_authenticate(user=self.farmer_user)
        payload = {
            "destination": "Batangas City",
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
        insp_id = create_res.data["id"]

        # MAO cannot review a Farmer request before Auction submits it.
        self.client.force_authenticate(user=self.mao_user)
        early = self.client.post(f"/api/inspections/{insp_id}/review/",
                                 {"status": "APPROVED"}, format="json")
        self.assertEqual(early.status_code, status.HTTP_409_CONFLICT)
        self.client.force_authenticate(user=self.auction_user)
        forward = self.client.post(f"/api/inspections/{insp_id}/verify/")
        self.assertEqual(forward.status_code, status.HTTP_200_OK)
        self.assertEqual(forward.data["status"], "VERIFIED")

        # MAO returns for revision.
        self.client.force_authenticate(user=self.mao_user)
        self.client.post(
            f"/api/inspections/{insp_id}/review/",
            {"status": "SUBJECT_TO_REVISION", "remarks": "Please provide vehicle plate number."},
            format="json",
        )

        # 4. Farmer edits and resubmits
        self.client.force_authenticate(user=self.farmer_user)
        edit_res = self.client.patch(
            f"/api/inspections/{insp_id}/",
            {"vehicle_plate_number": "NDB-1234"},
            format="json",
        )
        self.assertEqual(edit_res.status_code, status.HTTP_200_OK)
        self.assertEqual(edit_res.data["status"], "SUBJECT_TO_REVISION")

        resubmit_res = self.client.post(f"/api/inspections/{insp_id}/resubmit/")
        self.assertEqual(resubmit_res.status_code, status.HTTP_200_OK)
        self.assertEqual(resubmit_res.data["status"], "PENDING")
        self.client.force_authenticate(user=self.auction_user)
        forward_again = self.client.post(f"/api/inspections/{insp_id}/verify/")
        self.assertEqual(forward_again.status_code, status.HTTP_200_OK)
        self.assertEqual(forward_again.data["status"], "VERIFIED")

    def test_submission_is_not_clearance_or_official_gis_movement(self):
        self.client.force_authenticate(user=self.auction_user)
        response = self.client.post("/api/inspections/", {
            "shipper_name": "Outside Shipper", "origin": "Tanauan, Batangas",
            "destination": "San Juan, Batangas", "purpose": "OTHER",
            "inspection_date": str(timezone.now().date()),
            "items": [{"livestock_type": self.cattle_type.id, "quantity": 3,
                       "sex": "MIXED", "classification": "OTHER"}],
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        inspection_id = response.data["id"]
        self.assertEqual(response.data["origin"], "Tanauan, Batangas")
        self.assertIsNone(response.data["date_issued"])
        self.assertFalse(any(m["id"] == inspection_id for m in get_gis_aggregated_data(self.mao_user)["movements"]))

        self.client.force_authenticate(user=self.mao_user)
        approval = self.client.post(f"/api/inspections/{inspection_id}/review/",
                                    {"status": "APPROVED"}, format="json")
        self.assertEqual(approval.status_code, status.HTTP_200_OK)
        self.assertTrue(any(m["id"] == inspection_id and m["origin"] == "Tanauan, Batangas"
                            for m in get_gis_aggregated_data(self.mao_user)["movements"]))

    def test_auction_cannot_forge_approval_or_edit_another_record(self):
        self.client.force_authenticate(user=self.auction_user)
        response = self.client.post("/api/inspections/", {
            "shipper_name": "Outside Shipper", "origin": "Tanauan",
            "destination": "Lipa City", "purpose": "SLAUGHTER",
            "inspection_date": str(timezone.now().date()),
            "status": "APPROVED",
            "items": [{"livestock_type": self.cattle_type.id, "quantity": 2,
                       "sex": "MIXED", "classification": "SLAUGHTER"}],
        }, format="json")
        self.assertEqual(response.data["status"], "PENDING")
        record_id = response.data["id"]
        patch = self.client.patch(f"/api/inspections/{record_id}/",
                                  {"status": "APPROVED"}, format="json")
        self.assertEqual(patch.status_code, status.HTTP_409_CONFLICT)
        other = User.objects.create_user(username="auction_other", password="password123",
                                         role=self.auction_role, account_status=User.AccountStatus.APPROVED)
        self.client.force_authenticate(user=self.mao_user)
        self.client.post(f"/api/inspections/{record_id}/review/",
                         {"status": "SUBJECT_TO_REVISION", "remarks": "Correct plate."}, format="json")
        self.client.force_authenticate(user=other)
        edit = self.client.patch(f"/api/inspections/{record_id}/",
                                 {"vehicle_plate_number": "FAKE"}, format="json")
        self.assertEqual(edit.status_code, status.HTTP_403_FORBIDDEN)
        resubmit = self.client.post(f"/api/inspections/{record_id}/resubmit/")
        self.assertEqual(resubmit.status_code, status.HTTP_403_FORBIDDEN)
        approve = self.client.post(f"/api/inspections/{record_id}/review/",
                                   {"status": "APPROVED"}, format="json")
        self.assertEqual(approve.status_code, status.HTTP_403_FORBIDDEN)
        delete = self.client.delete(f"/api/inspections/{record_id}/")
        self.assertEqual(delete.status_code, status.HTTP_403_FORBIDDEN)

    def test_cannot_delete_approved_inspection(self):
        # Create and approve inspection
        self.client.force_authenticate(user=self.auction_user)
        payload = {
            "shipper_name": "Pedro Reyes",
            "origin": "San Juan, Batangas",
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

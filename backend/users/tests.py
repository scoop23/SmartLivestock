from django.utils import timezone
from rest_framework.test import APITestCase
from rest_framework import status
from users.models import User, Role
from livestock.models import Barangay, Farmer


class UserApprovalAndManagementAPITests(APITestCase):
    def setUp(self):

        # Roles
        self.mao_role = Role.objects.create(role_name=Role.UserRoles.MAO)
        self.farmer_role = Role.objects.create(role_name=Role.UserRoles.FARMER)
        self.sibat_role = Role.objects.create(role_name=Role.UserRoles.SIBAT)

        # Barangay
        self.barangay = Barangay.objects.create(
            barangay_name="Poblacion",
            latitude=13.8821,
            longitude=121.2144,
        )

        # MAO User
        self.mao_user = User.objects.create_user(
            username="MAO-001",
            email="mao@padregarcia.gov.ph",
            password="password123",
            first_name="Maria",
            last_name="Santos",
            role=self.mao_role,
            account_status=User.AccountStatus.APPROVED,
        )

        # Approved Farmer User
        self.farmer_user = User.objects.create_user(
            username="FMR-000001",
            email="farmer1@example.com",
            password="password123",
            first_name="Juan",
            last_name="Dela Cruz",
            role=self.farmer_role,
            account_status=User.AccountStatus.APPROVED,
        )
        self.farmer_profile = Farmer.objects.create(
            user=self.farmer_user,
            barangay=self.barangay,
            farm_size=2.5,
            address="Purok 1",
        )

        # Pending Farmer User
        self.pending_user = User.objects.create_user(
            username="FMR-000002",
            email="pending_farmer@example.com",
            password="password123",
            first_name="Pedro",
            last_name="Penduko",
            role=self.farmer_role,
            account_status=User.AccountStatus.PENDING,
        )
        self.pending_farmer_profile = Farmer.objects.create(
            user=self.pending_user,
            barangay=self.barangay,
            farm_size=1.0,
            address="Purok 3",
        )

    def test_unauthenticated_requests_blocked(self):
        # Pending endpoint
        response = self.client.get("/api/users/pending/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

        # Status update endpoint
        response = self.client.patch(f"/api/users/{self.pending_user.pk}/status/", {"status": "APPROVED"})
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_farmer_cannot_access_pending_users(self):
        self.client.force_authenticate(user=self.farmer_user)
        response = self.client.get("/api/users/pending/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_farmer_cannot_update_user_status(self):
        self.client.force_authenticate(user=self.farmer_user)
        response = self.client.patch(
            f"/api/users/{self.pending_user.pk}/status/",
            {"status": "APPROVED"}
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_mao_can_list_pending_users(self):
        self.client.force_authenticate(user=self.mao_user)
        response = self.client.get("/api/users/pending/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["email"], "pending_farmer@example.com")
        self.assertEqual(data[0]["barangay"], "Poblacion")
        self.assertNotIn("password", data[0])

    def test_mao_can_approve_user(self):
        self.client.force_authenticate(user=self.mao_user)
        self.assertIsNone(self.pending_user.approved_at)

        response = self.client.patch(
            f"/api/users/{self.pending_user.pk}/status/",
            {"status": "APPROVED"}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.pending_user.refresh_from_db()
        self.assertEqual(self.pending_user.account_status, User.AccountStatus.APPROVED)
        self.assertIsNotNone(self.pending_user.approved_at)

    def test_mao_can_reject_or_suspend_user(self):
        self.client.force_authenticate(user=self.mao_user)

        # Return for revision
        response = self.client.patch(
            f"/api/users/{self.pending_user.pk}/status/",
            {"status": "SUBJECT_TO_REVISION"}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.pending_user.refresh_from_db()
        self.assertEqual(self.pending_user.account_status, User.AccountStatus.SUBJECT_TO_REVISION)

        # Suspend
        response = self.client.patch(
            f"/api/users/{self.pending_user.pk}/status/",
            {"status": "SUSPENDED"}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.pending_user.refresh_from_db()
        self.assertEqual(self.pending_user.account_status, User.AccountStatus.SUSPENDED)

    def test_invalid_status_rejected(self):
        self.client.force_authenticate(user=self.mao_user)
        response = self.client.patch(
            f"/api/users/{self.pending_user.pk}/status/",
            {"status": "INVALID_STATUS"}
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def make_sibat(self, assigned=None):
        return User.objects.create_user(
            username=f"SIBAT-TEST-{User.objects.count()}",
            email=f"sibat-{User.objects.count()}@example.com", password=None,
            role=self.sibat_role, account_status="APPROVED", assigned_barangay=assigned,
        )

    def test_directory_displays_actual_sibat_assignment_and_missing_values(self):
        sibat = self.make_sibat(self.barangay)
        missing = self.make_sibat()
        self.client.force_authenticate(user=self.mao_user)
        data = {u["id"]: u for u in self.client.get("/api/users/directory/").data}
        self.assertEqual(data[sibat.pk]["assigned_barangay_id"], self.barangay.pk)
        self.assertEqual(data[sibat.pk]["barangay"], "Poblacion")
        self.assertIsNone(data[missing.pk]["assigned_barangay_id"])
        self.assertEqual(data[missing.pk]["barangay"], "")
        self.assertEqual(data[self.mao_user.pk]["barangay"], "")
        self.assertEqual(data[self.farmer_user.pk]["barangay_id"], self.barangay.pk)
        self.assertNotIn("password", data[sibat.pk])

    def test_directory_filters_use_the_correct_relationship(self):
        sibat = self.make_sibat(self.barangay)
        missing = self.make_sibat()
        other = Barangay.objects.create(barangay_name="Other", latitude=13, longitude=121)
        unrelated = self.make_sibat(other)
        self.client.force_authenticate(user=self.mao_user)
        data = self.client.get("/api/users/directory/", {"barangay_id": self.barangay.pk}).data
        self.assertEqual({u["id"] for u in data}, {sibat.pk, self.farmer_user.pk, self.pending_user.pk})
        data = self.client.get("/api/users/directory/", {"role": "SIBAT", "account_status": "APPROVED", "search": "Poblacion"}).data
        self.assertEqual([u["id"] for u in data], [sibat.pk])
        data = self.client.get("/api/users/directory/", {"barangay_id": "unassigned"}).data
        self.assertEqual([u["id"] for u in data], [missing.pk])
        self.assertEqual(self.client.get("/api/users/directory/", {"barangay_id": "bad"}).status_code, 400)

    def test_assignment_endpoint_preserves_roles_and_private_scope(self):
        from livestock.models import LivestockInventory, LivestockType
        sibat = self.make_sibat(self.barangay)
        other = Barangay.objects.create(barangay_name="Assignment Other", latitude=13, longitude=121)
        farmer_user = User.objects.create_user(username="other-farmer", email="other-farmer@example.com", password=None, role=self.farmer_role, account_status="APPROVED")
        farmer = Farmer.objects.create(user=farmer_user, barangay=other, address="Test")
        species = LivestockType.objects.create(name="Assignment Test Cattle")
        a = LivestockInventory.objects.create(farmer=self.farmer_profile, livestock_type=species, created_by=self.farmer_user)
        b = LivestockInventory.objects.create(farmer=farmer, livestock_type=species, created_by=farmer_user)
        url = f"/api/users/{sibat.pk}/assignment/"
        self.client.force_authenticate(user=sibat)
        self.assertEqual({x["id"] for x in self.client.get("/livestock/inventory/", {"barangay_id": other.pk}).data}, {a.pk})
        self.assertEqual(self.client.patch(url, {"assigned_barangay_id": other.pk}).status_code, 403)
        self.assertEqual(self.client.get("/api/users/directory/", {"barangay_id": other.pk}).status_code, 403)
        self.client.force_authenticate(user=self.mao_user)
        self.assertEqual(self.client.patch(url, {"assigned_barangay_id": other.pk, "role": "MAO"}).status_code, 400)
        response = self.client.patch(url, {"assigned_barangay_id": other.pk})
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["assigned_barangay_name"], "Assignment Other")
        sibat.refresh_from_db()
        self.assertEqual(sibat.role_id, self.sibat_role.pk)
        self.client.force_authenticate(user=sibat)
        self.assertEqual({x["id"] for x in self.client.get("/livestock/inventory/").data}, {b.pk})
        self.client.force_authenticate(user=self.mao_user)
        self.assertEqual(self.client.patch(url, {"assigned_barangay_id": None}, format="json").status_code, 200)
        sibat.refresh_from_db()
        self.client.force_authenticate(user=sibat)
        self.assertEqual(self.client.get("/livestock/inventory/").data, [])

    def test_farmer_cannot_assign_or_access_directory_and_invalid_targets_fail(self):
        sibat = self.make_sibat()
        self.client.force_authenticate(user=self.farmer_user)
        self.assertEqual(self.client.patch(f"/api/users/{sibat.pk}/assignment/", {"assigned_barangay_id": self.barangay.pk}).status_code, 403)
        self.assertEqual(self.client.get("/api/users/directory/").status_code, 403)
        self.client.force_authenticate(user=self.mao_user)
        self.assertEqual(self.client.patch(f"/api/users/{self.farmer_user.pk}/assignment/", {"assigned_barangay_id": self.barangay.pk}).status_code, 400)
        self.assertEqual(self.client.patch(f"/api/users/{sibat.pk}/assignment/", {"assigned_barangay_id": 999999}).status_code, 400)

    def test_account_status_notifications_and_document_urls(self):
        from users.models import Notification, UserDocument
        UserDocument.objects.create(user=self.pending_user, document_type="GOVERNMENT_ID", document_file="user_documents/test-only.pdf")
        self.client.force_authenticate(user=self.mao_user)
        response = self.client.patch(f"/api/users/{self.pending_user.pk}/status/", {"status": "APPROVED"})
        self.assertTrue(response.data["documents"][0]["document_file"].startswith("http://testserver/"))
        self.assertTrue(Notification.objects.filter(user=self.pending_user, title="Account status updated").exists())

from rest_framework_simplejwt.tokens import RefreshToken


class SuspendedTokenTests(APITestCase):
    def test_existing_token_stops_working_when_account_is_suspended(self):
        role = Role.objects.create(role_name=Role.UserRoles.FARMER)
        user = User.objects.create_user(
            username="suspended-token-test", email="suspended-token@example.com",
            password=None, role=role, account_status=User.AccountStatus.APPROVED,
        )
        token = RefreshToken.for_user(user).access_token
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        self.assertEqual(self.client.get("/api/users/me/").status_code, status.HTTP_200_OK)

        user.account_status = User.AccountStatus.SUSPENDED
        user.save(update_fields=["account_status"])
        self.assertEqual(self.client.get("/api/users/me/").status_code, status.HTTP_401_UNAUTHORIZED)

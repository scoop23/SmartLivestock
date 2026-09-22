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

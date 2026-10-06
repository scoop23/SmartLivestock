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
        self.assertEqual({x["id"] for x in self.client.get("/livestock/inventory/").data}, {a.pk})
        self.assertEqual(self.client.get("/livestock/inventory/", {"barangay_id": other.pk}).data, [])
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
        UserDocument.objects.create(
            user=self.pending_user,
            document_type="GOVERNMENT_ID",
            document_file="user_documents/test-only.pdf",
            verification_status=UserDocument.VerificationStatus.APPROVED,
        )
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


from django.core.files.uploadedfile import SimpleUploadedFile
from users.models import UserDocument, Notification


class FarmerRegistrationAndValidationTests(APITestCase):
    def setUp(self):
        self.farmer_role, _ = Role.objects.get_or_create(role_name=Role.UserRoles.FARMER)
        self.mao_role, _ = Role.objects.get_or_create(role_name=Role.UserRoles.MAO)
        self.barangay = Barangay.objects.create(
            barangay_name="San Felipe",
            latitude=13.88,
            longitude=121.22,
        )


    def test_anonymous_can_register_with_synthetic_documents_and_rsbsa(self):
        gov_id = SimpleUploadedFile("synthetic-government-id.pdf", b"%PDF-1.4 synthetic gov id", content_type="application/pdf")
        rsbsa_doc = SimpleUploadedFile("synthetic-rsbsa.pdf", b"%PDF-1.4 synthetic rsbsa doc", content_type="application/pdf")

        payload = {
            "first_name": "Test",
            "last_name": "Farmer",
            "email": "registration-test@example.com",
            "password": "SecurePassword123!",
            "phone_number": "+639123456789",
            "barangay": self.barangay.pk,
            "farm_size": "2.50",
            "address": "Synthetic Test Farm Sitio 1",
            "rsbsa_number": "RSBSA-2026-0042",
            "government_id": gov_id,
            "rsbsa_document": rsbsa_doc,
        }

        response = self.client.post("/api/users/register/", payload, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        user = User.objects.get(email="registration-test@example.com")
        self.assertEqual(user.account_status, User.AccountStatus.PENDING)
        self.assertEqual(user.role.role_name, "FARMER")

        farmer = Farmer.objects.get(user=user)
        self.assertEqual(farmer.rsbsa_number, "RSBSA-2026-0042")
        self.assertEqual(float(farmer.farm_size), 2.50)

        docs = UserDocument.objects.filter(user=user)
        self.assertEqual(docs.count(), 2)
        for doc in docs:
            self.assertEqual(doc.verification_status, UserDocument.VerificationStatus.PENDING)

    def test_invalid_file_extension_rejected(self):
        bad_file = SimpleUploadedFile("malicious.exe", b"executable bytes", content_type="application/octet-stream")
        payload = {
            "first_name": "Test",
            "last_name": "Farmer",
            "email": "badfile-test@example.com",
            "password": "SecurePassword123!",
            "barangay": self.barangay.pk,
            "farm_size": "1.00",
            "address": "Farm 1",
            "government_id": bad_file,
        }
        response = self.client.post("/api/users/register/", payload, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("government_id", response.data)

    def test_oversized_file_rejected(self):
        huge_file = SimpleUploadedFile("huge.pdf", b"0" * (11 * 1024 * 1024), content_type="application/pdf")
        payload = {
            "first_name": "Test",
            "last_name": "Farmer",
            "email": "hugefile-test@example.com",
            "password": "SecurePassword123!",
            "barangay": self.barangay.pk,
            "farm_size": "1.00",
            "address": "Farm 1",
            "government_id": huge_file,
        }
        response = self.client.post("/api/users/register/", payload, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_duplicate_email_rejected(self):
        User.objects.create_user(
            username="existing-farmer",
            email="duplicate@example.com",
            password="password123",
            role=self.farmer_role,
        )

        payload = {
            "first_name": "Test",
            "last_name": "Farmer",
            "email": "duplicate@example.com",
            "password": "SecurePassword123!",
            "barangay": self.barangay.pk,
            "farm_size": "1.00",
            "address": "Farm 1",
        }
        response = self.client.post("/api/users/register/", payload)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class UserDocumentVerificationAndSecurityTests(APITestCase):
    def setUp(self):
        self.mao_role = Role.objects.create(role_name=Role.UserRoles.MAO)
        self.farmer_role = Role.objects.create(role_name=Role.UserRoles.FARMER)
        self.sibat_role = Role.objects.create(role_name=Role.UserRoles.SIBAT)

        self.barangay = Barangay.objects.create(
            barangay_name="Poblacion", latitude=13.88, longitude=121.21
        )

        self.mao_user = User.objects.create_user(
            username="MAO-VERIFY", email="mao.verify@example.com", password="password123",
            role=self.mao_role, account_status=User.AccountStatus.APPROVED,
        )

        self.farmer1 = User.objects.create_user(
            username="FMR-000010", email="farmer1.verify@example.com", password="password123",
            role=self.farmer_role, account_status=User.AccountStatus.PENDING,
        )
        self.farmer1_profile = Farmer.objects.create(
            user=self.farmer1, barangay=self.barangay, farm_size=1.5, address="Sitio 1",
            rsbsa_number="RSBSA-1001",
        )

        self.farmer2 = User.objects.create_user(
            username="FMR-000011", email="farmer2.verify@example.com", password="password123",
            role=self.farmer_role, account_status=User.AccountStatus.APPROVED,
        )

        self.sibat_user = User.objects.create_user(
            username="SBT-000001", email="sibat.verify@example.com", password="password123",
            role=self.sibat_role, account_status=User.AccountStatus.APPROVED,
        )

        gov_file = SimpleUploadedFile("id.pdf", b"%PDF-1.4 test id content", content_type="application/pdf")
        self.doc1 = UserDocument.objects.create(
            user=self.farmer1,
            document_type=UserDocument.DocumentType.GOVERNMENT_ID,
            document_file=gov_file,
            verification_status=UserDocument.VerificationStatus.PENDING,
        )

    def test_mao_can_approve_document(self):
        self.client.force_authenticate(user=self.mao_user)
        response = self.client.patch(
            f"/api/users/documents/{self.doc1.pk}/verification/",
            {"status": "APPROVED"},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.doc1.refresh_from_db()
        self.assertEqual(self.doc1.verification_status, UserDocument.VerificationStatus.APPROVED)
        self.assertEqual(self.doc1.approved_by, self.mao_user)
        self.assertIsNotNone(self.doc1.reviewed_at)
        self.assertTrue(Notification.objects.filter(user=self.farmer1, title="Document Verified").exists())

    def test_mao_can_return_document_for_revision_with_reason(self):
        self.client.force_authenticate(user=self.mao_user)
        reason = "The submitted ID is unreadable. Please upload a clearer copy."
        response = self.client.patch(
            f"/api/users/documents/{self.doc1.pk}/verification/",
            {"status": "SUBJECT_TO_REVISION", "reason": reason},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.doc1.refresh_from_db()
        self.assertEqual(self.doc1.verification_status, UserDocument.VerificationStatus.SUBJECT_TO_REVISION)
        self.assertEqual(self.doc1.review_remarks, reason)
        self.assertTrue(Notification.objects.filter(user=self.farmer1, title="Document Requires Revision").exists())

    def test_return_for_revision_requires_reason(self):
        self.client.force_authenticate(user=self.mao_user)
        response = self.client.patch(
            f"/api/users/documents/{self.doc1.pk}/verification/",
            {"status": "SUBJECT_TO_REVISION", "reason": ""},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_unauthorized_users_cannot_verify_documents(self):
        # Anonymous
        response = self.client.patch(
            f"/api/users/documents/{self.doc1.pk}/verification/",
            {"status": "APPROVED"},
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

        # Farmer
        self.client.force_authenticate(user=self.farmer1)
        response = self.client.patch(
            f"/api/users/documents/{self.doc1.pk}/verification/",
            {"status": "APPROVED"},
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # SIBAT
        self.client.force_authenticate(user=self.sibat_user)
        response = self.client.patch(
            f"/api/users/documents/{self.doc1.pk}/verification/",
            {"status": "APPROVED"},
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_document_secure_view_authorization(self):
        url = f"/api/users/documents/{self.doc1.pk}/view/"

        # Anonymous -> 401
        self.assertEqual(self.client.get(url).status_code, status.HTTP_401_UNAUTHORIZED)

        # Other farmer -> 403 (IDOR prevention)
        self.client.force_authenticate(user=self.farmer2)
        self.assertEqual(self.client.get(url).status_code, status.HTTP_403_FORBIDDEN)

        # Owner farmer -> 200
        self.client.force_authenticate(user=self.farmer1)
        resp_owner = self.client.get(url)
        self.assertEqual(resp_owner.status_code, status.HTTP_200_OK)
        self.assertEqual(resp_owner["Content-Type"], "application/pdf")

        # MAO -> 200
        self.client.force_authenticate(user=self.mao_user)
        resp_mao = self.client.get(url)
        self.assertEqual(resp_mao.status_code, status.HTTP_200_OK)

    def test_cannot_approve_account_while_documents_pending_or_in_revision(self):
        self.client.force_authenticate(user=self.mao_user)

        # 1. Blocked while document is PENDING
        resp = self.client.patch(f"/api/users/{self.farmer1.pk}/status/", {"status": "APPROVED"})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

        # 2. Blocked while document is SUBJECT_TO_REVISION
        self.doc1.verification_status = UserDocument.VerificationStatus.SUBJECT_TO_REVISION
        self.doc1.save()
        resp = self.client.patch(f"/api/users/{self.farmer1.pk}/status/", {"status": "APPROVED"})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

        # 3. Allowed once document is APPROVED
        self.doc1.verification_status = UserDocument.VerificationStatus.APPROVED
        self.doc1.save()
        resp = self.client.patch(f"/api/users/{self.farmer1.pk}/status/", {"status": "APPROVED"})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.farmer1.refresh_from_db()
        self.assertEqual(self.farmer1.account_status, User.AccountStatus.APPROVED)


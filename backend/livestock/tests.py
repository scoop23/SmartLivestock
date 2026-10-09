from rest_framework.test import APITestCase
from django.test import SimpleTestCase
from datetime import date
from rest_framework import status
from users.models import Notification, Role, User
from livestock.models import (
    Barangay,
    CensusSubmission,
    Farmer,
    LivestockBatch,
    LivestockInventory,
    LivestockType,
)


class LivestockInventoryReviewTests(APITestCase):

    def setUp(self):


        # Roles
        self.mao_role = Role.objects.create(role_name=Role.UserRoles.MAO)
        self.farmer_role = Role.objects.create(role_name=Role.UserRoles.FARMER)
        self.sibat_role = Role.objects.create(role_name=Role.UserRoles.SIBAT)

        # Barangay & Type
        self.barangay = Barangay.objects.create(
            barangay_name="San Roque",
            latitude=13.8821,
            longitude=121.2144,
        )
        self.cattle_type = LivestockType.objects.create(name="Cattle")

        # Users
        self.mao_user = User.objects.create_user(
            username="MAO-001",
            email="mao@padregarcia.gov.ph",
            password="password123",
            role=self.mao_role,
            account_status=User.AccountStatus.APPROVED,
        )
        self.sibat_user = User.objects.create_user(
            username="SIBAT-001",
            email="sibat@padregarcia.gov.ph",
            password="password123",
            role=self.sibat_role,
            account_status=User.AccountStatus.APPROVED,
        )
        self.farmer_user = User.objects.create_user(
            username="FMR-000001",
            email="farmer1@example.com",
            password="password123",
            role=self.farmer_role,
            account_status=User.AccountStatus.APPROVED,
        )
        self.farmer_profile = Farmer.objects.create(
            user=self.farmer_user,
            barangay=self.barangay,
            farm_size=2.0,
            address="Purok 1",
        )

        self.inventory = LivestockInventory.objects.create(
            farmer=self.farmer_profile,
            livestock_type=self.cattle_type,
            quantity=1,
            tag_number="TAG-101",
            breed="Brahman Cross",
            created_by=self.farmer_user,
            status=LivestockInventory.StatusType.PENDING,
        )

        User.objects.filter(role__role_name="SIBAT").update(assigned_barangay=self.barangay)
        for value in vars(self).values():
            if isinstance(value, User) and value.role.role_name == "SIBAT":
                value.assigned_barangay_id = self.barangay.pk

    def test_farmer_cannot_review_inventory(self):
        self.client.force_authenticate(user=self.farmer_user)
        res = self.client.post(f"/livestock/inventory/{self.inventory.pk}/review/", {"status": "APPROVED"})
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_sibat_cannot_grant_final_approval(self):
        self.client.force_authenticate(user=self.sibat_user)
        res = self.client.post(f"/livestock/inventory/{self.inventory.pk}/review/", {"status": "APPROVED"})
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_sibat_can_verify_inventory_item(self):
        self.client.force_authenticate(user=self.sibat_user)
        res = self.client.post(
            f"/livestock/inventory/{self.inventory.pk}/review/",
            {"status": "VERIFIED", "remarks": "Ear tag B-101 inspected and confirmed on-farm."}
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.inventory.refresh_from_db()
        self.assertEqual(self.inventory.status, LivestockInventory.StatusType.VERIFIED)
        self.assertEqual(self.inventory.reviewed_by, self.sibat_user)
        notification = Notification.objects.get(
            user=self.farmer_user,
            title="Verified by SIBAT Inspector",
        )
        self.assertEqual(
            notification.link,
            f"/livestock-inventory/{self.inventory.pk}",
        )


    def test_mao_can_grant_final_inventory_approval(self):
        self.inventory.status = LivestockInventory.StatusType.VERIFIED
        self.inventory.save(update_fields=["status"])
        self.client.force_authenticate(user=self.mao_user)
        res = self.client.post(
            f"/livestock/inventory/{self.inventory.pk}/review/",
            {"status": "APPROVED", "remarks": "Official municipal inventory registered."}
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.inventory.refresh_from_db()
        self.assertEqual(self.inventory.status, LivestockInventory.StatusType.APPROVED)
        self.assertEqual(self.inventory.reviewed_by, self.mao_user)
        notification = Notification.objects.get(
            user=self.farmer_user,
            title="Livestock Record Approved",
        )
        self.assertEqual(
            notification.link,
            f"/livestock-inventory/{self.inventory.pk}",
        )

    def test_mao_cannot_skip_sibat_verification(self):
        self.client.force_authenticate(user=self.mao_user)
        res = self.client.post(
            f"/livestock/inventory/{self.inventory.pk}/review/",
            {"status": "APPROVED"},
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.inventory.refresh_from_db()
        self.assertEqual(self.inventory.status, LivestockInventory.StatusType.PENDING)

    def test_return_for_revision_requires_remarks(self):
        self.client.force_authenticate(user=self.sibat_user)
        res = self.client.post(
            f"/livestock/inventory/{self.inventory.pk}/review/",
            {"status": "SUBJECT_TO_REVISION"},
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_new_farmer_inventory_notifies_sibat(self):
        self.client.force_authenticate(user=self.farmer_user)
        response = self.client.post(
            "/livestock/inventory/",
            {
                "livestock_type": self.cattle_type.pk,
                "entry_type": LivestockInventory.EntryType.INDIVIDUAL,
                "quantity": 1,
                "tag_number": "TAG-NOTIFY-1",
                "breed": "Brahman",
                "sex": "FEMALE",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        notification = Notification.objects.get(user=self.sibat_user)
        self.assertEqual(notification.title, "New Livestock Entry Awaiting Verification")
        self.assertEqual(notification.link, "/sibat-validation")
        self.assertFalse(notification.is_read)

    def test_birth_date_is_optional_and_future_dates_are_rejected(self):
        self.client.force_authenticate(user=self.farmer_user)
        payload = {"livestock_type": self.cattle_type.pk, "entry_type": "INDIVIDUAL", "quantity": 1,
                   "tag_number": "LEGACY-NO-BIRTH", "birth_date": None}
        response = self.client.post("/livestock/inventory/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertIsNone(response.data["birth_date"])
        self.assertIsNone(response.data["age"])
        self.assertEqual(response.data["age_classification"], "UNKNOWN")
        payload["tag_number"] = "KNOWN-BIRTH"
        payload["birth_date"] = "2020-01-15"
        response = self.client.post("/livestock/inventory/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data["birth_date"], "2020-01-15")
        payload["tag_number"] = "FUTURE-BIRTH"
        payload["birth_date"] = "2999-01-01"
        response = self.client.post("/livestock/inventory/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class LivestockAgeCalculationTests(SimpleTestCase):
    def test_completed_calendar_age_and_age_bands(self):
        animal = LivestockInventory(birth_date=date(2025, 7, 8))
        self.assertEqual(animal.age_as_of(date(2026, 10, 8)), {"years": 1, "months": 3, "total_months": 15})
        self.assertEqual(animal.age_classification_as_of(date(2026, 10, 8)), "YEARLING")
        self.assertEqual(animal.age_as_of(date(2025, 12, 7))["total_months"], 4)
        self.assertEqual(animal.age_as_of(date(2026, 7, 8))["total_months"], 12)
        self.assertEqual(animal.age_classification_as_of(date(2027, 7, 8)), "ADULT")

    def test_unknown_and_leap_day_births_are_safe(self):
        unknown = LivestockInventory(birth_date=None)
        self.assertIsNone(unknown.age_as_of(date(2026, 10, 8)))
        self.assertEqual(unknown.age_classification_as_of(date(2026, 10, 8)), "UNKNOWN")
        leap_birth = LivestockInventory(birth_date=date(2024, 2, 29))
        self.assertEqual(leap_birth.age_as_of(date(2025, 2, 28))["total_months"], 12)


class LivestockBatchAPITests(APITestCase):

    def setUp(self):
        self.farmer_role = Role.objects.create(role_name=Role.UserRoles.FARMER)
        self.barangay = Barangay.objects.create(
            barangay_name="San Roque",
            latitude=13.8821,
            longitude=121.2144,
        )
        self.swine_type = LivestockType.objects.create(name="Swine")
        self.farmer_user = User.objects.create_user(
            username="FARMER-BATCH-TEST",
            email="farmer_batch@padregarcia.gov.ph",
            password="password123",
            role=self.farmer_role,
            account_status=User.AccountStatus.APPROVED,
        )
        self.farmer = Farmer.objects.create(
            user=self.farmer_user,
            barangay=self.barangay,
            address="Poblacion, Padre Garcia",
        )

        User.objects.filter(role__role_name="SIBAT").update(assigned_barangay=self.barangay)
        for value in vars(self).values():
            if isinstance(value, User) and value.role.role_name == "SIBAT":
                value.assigned_barangay_id = self.barangay.pk

    def test_create_batch_with_individual_roster(self):
        self.client.force_authenticate(user=self.farmer_user)
        payload = {
            "batch_name": "Pen B Fatteners",
            "batch_code": "BATCH-SWINE-001",
            "livestock_type": self.swine_type.pk,
            "housing_pen": "Pen B North",
            "feed_type": "Grower Mash",
            "target_weight": "95.00",
            "animals": [
                {
                    "tag_number": "SW-01",
                    "breed": "Large White",
                    "sex": "MALE",
                    "weight": "42.50",
                    "avatar_key": "swine-large-white",
                },
                {
                    "tag_number": "SW-02",
                    "breed": "Landrace",
                    "sex": "FEMALE",
                    "weight": "39.00",
                    "avatar_key": "swine-landrace",
                },
            ],
        }

        res = self.client.post("/livestock/batches/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        data = res.json()
        self.assertEqual(data["batch_code"], "BATCH-SWINE-001")
        self.assertEqual(data["total_animals"], 2)

        # Verify child individual inventory items
        animals = LivestockInventory.objects.filter(batch__batch_code="BATCH-SWINE-001")
        self.assertEqual(animals.count(), 2)
        tags = set(animals.values_list("tag_number", flat=True))
        self.assertIn("SW-01", tags)
        self.assertIn("SW-02", tags)

    def test_add_animals_to_existing_batch(self):
        self.client.force_authenticate(user=self.farmer_user)
        batch = LivestockBatch.objects.create(
            farmer=self.farmer,
            livestock_type=self.swine_type,
            batch_name="Starter Pen",
            batch_code="BATCH-STARTER-1",
            created_by=self.farmer_user,
        )

        res = self.client.post(
            f"/livestock/batches/{batch.pk}/animals/",
            {
                "animals": [
                    {
                        "tag_number": "SW-EXTRA-1",
                        "breed": "Duroc",
                        "sex": "MALE",
                        "weight": "25.00",
                    }
                ]
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(batch.animals.count(), 1)
        animal = batch.animals.first()
        self.assertIsNotNone(animal)
        assert animal is not None
        self.assertEqual(animal.tag_number, "SW-EXTRA-1")

    def test_farmer_scope_parameters_do_not_expose_other_batches(self):
        other_user = User.objects.create_user(
            username="other-batch-farmer", email="other-batch@example.com",
            password=None, role=self.farmer_role,
            account_status=User.AccountStatus.APPROVED,
        )
        other_farmer = Farmer.objects.create(
            user=other_user, barangay=self.barangay, address="Purok 2",
        )
        own_batch = LivestockBatch.objects.create(
            farmer=self.farmer, livestock_type=self.swine_type,
            batch_name="My Batch", batch_code="OWN-BATCH", created_by=self.farmer_user,
        )
        LivestockBatch.objects.create(
            farmer=other_farmer, livestock_type=self.swine_type,
            batch_name="Other Batch", batch_code="OTHER-BATCH", created_by=other_user,
        )
        self.client.force_authenticate(user=self.farmer_user)
        for suffix in ("?all=true", "?scope=all"):
            response = self.client.get(f"/livestock/batches/{suffix}")
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            self.assertEqual([item["id"] for item in response.json()], [own_batch.pk])

    def test_farmer_can_load_owned_batches_with_real_animal_roster(self):
        batch = LivestockBatch.objects.create(
            farmer=self.farmer,
            livestock_type=self.swine_type,
            batch_name="Roster Batch",
            batch_code="ROSTER-BATCH",
            created_by=self.farmer_user,
        )
        animal = LivestockInventory.objects.create(
            farmer=self.farmer,
            batch=batch,
            livestock_type=self.swine_type,
            entry_type=LivestockInventory.EntryType.INDIVIDUAL,
            quantity=1,
            tag_number="SW-ROSTER-01",
            sex="FEMALE",
            created_by=self.farmer_user,
        )
        self.client.force_authenticate(user=self.farmer_user)

        response = self.client.get("/livestock/batches/?include_roster=true")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["id"], batch.pk)
        self.assertEqual(response.data[0]["animals"][0]["id"], animal.pk)
        self.assertEqual(response.data[0]["animals"][0]["tag_number"], "SW-ROSTER-01")
        self.assertIsNone(response.data[0]["photo_url"])


class CensusPermissionWorkflowTests(APITestCase):
    def setUp(self):
        self.sibat_role = Role.objects.create(role_name=Role.UserRoles.SIBAT)
        self.mao_role = Role.objects.create(role_name=Role.UserRoles.MAO)
        self.barangay = Barangay.objects.create(
            barangay_name="Banaybanay",
            latitude=13.88,
            longitude=121.21,
        )
        self.sibat_user = User.objects.create_user(
            username="SIBAT-CENSUS-1",
            email="sibat-census-1@example.com",
            password="password123",
            role=self.sibat_role,
            account_status=User.AccountStatus.APPROVED,
        )
        self.other_sibat_user = User.objects.create_user(
            username="SIBAT-CENSUS-2",
            email="sibat-census-2@example.com",
            password="password123",
            role=self.sibat_role,
            account_status=User.AccountStatus.APPROVED,
        )
        self.mao_user = User.objects.create_user(
            username="MAO-CENSUS",
            email="mao-census@example.com",
            password="password123",
            role=self.mao_role,
            account_status=User.AccountStatus.APPROVED,
        )
        self.submission = CensusSubmission.objects.create(
            barangay=self.barangay,
            report_year=2026,
            report_quarter=3,
            submitted_by=self.sibat_user,
        )

        User.objects.filter(role__role_name="SIBAT").update(assigned_barangay=self.barangay)
        for value in vars(self).values():
            if isinstance(value, User) and value.role.role_name == "SIBAT":
                value.assigned_barangay_id = self.barangay.pk

    def test_mao_can_approve_pending_census(self):
        self.client.force_authenticate(user=self.mao_user)
        response = self.client.post(
            f"/livestock/census/{self.submission.pk}/review/",
            {"status": "APPROVED", "remarks": "Quarterly totals checked."},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.submission.refresh_from_db()
        self.assertEqual(self.submission.status, CensusSubmission.StatusType.APPROVED)
        self.assertEqual(self.submission.reviewed_by, self.mao_user)
        self.assertIsNotNone(self.submission.reviewed_at)
        notification = Notification.objects.get(
            user=self.sibat_user,
            title="Census Submission Approved by MAO",
        )
        self.assertEqual(notification.link, "/sibat?tab=census")

    def test_new_census_submission_notifies_mao(self):
        self.client.force_authenticate(user=self.sibat_user)
        response = self.client.post(
            "/livestock/census/",
            {
                "barangay": self.barangay.pk,
                "report_year": 2026,
                "report_quarter": 4,
                "remarks": "Fourth-quarter field census.",
                "items": [],
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["barangay"], self.barangay.pk)
        self.assertEqual(
            CensusSubmission.objects.get(pk=response.data["id"]).barangay_id,
            self.barangay.pk,
        )
        notification = Notification.objects.get(
            user=self.mao_user,
            title="Census Submission Awaiting MAO Approval",
        )
        self.assertEqual(notification.link, "/data-validation?domain=census")

    def test_census_period_is_unique_per_barangay_but_history_is_allowed(self):
        self.client.force_authenticate(user=self.sibat_user)

        # Existing Q3 and a new Q1/Q4 are separate historical snapshots.
        for quarter in (1, 4):
            response = self.client.post(
                "/livestock/census/",
                {
                    "barangay": self.barangay.pk,
                    "report_year": 2026,
                    "report_quarter": quarter,
                    "items": [],
                },
                format="json",
            )
            self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        duplicate_response = self.client.post(
            "/livestock/census/",
            {
                "barangay": self.barangay.pk,
                "report_year": 2026,
                "report_quarter": 3,
                "items": [],
            },
            format="json",
        )
        self.assertEqual(duplicate_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("already exists for this census period", str(duplicate_response.data))

        # The period is unique across authorized staff, not per SIBAT account.
        self.client.force_authenticate(user=self.other_sibat_user)
        other_user_response = self.client.post(
            "/livestock/census/",
            {
                "barangay": self.barangay.pk,
                "report_year": 2026,
                "report_quarter": 3,
                "items": [],
            },
            format="json",
        )
        self.assertEqual(other_user_response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_same_census_period_is_allowed_for_different_barangays(self):
        other_barangay = Barangay.objects.create(
            barangay_name="Cawongan",
            latitude=13.89,
            longitude=121.22,
        )
        self.sibat_user.access_scope = User.AccessScope.ALL_BARANGAYS
        self.sibat_user.save(update_fields=["access_scope"])
        self.client.force_authenticate(user=self.sibat_user)

        response = self.client.post(
            "/livestock/census/",
            {
                "barangay": other_barangay.pk,
                "report_year": 2026,
                "report_quarter": 3,
                "items": [],
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_census_revision_cannot_move_into_an_existing_period(self):
        CensusSubmission.objects.create(
            barangay=self.barangay,
            report_year=2026,
            report_quarter=1,
            submitted_by=self.sibat_user,
        )
        self.submission.status = CensusSubmission.StatusType.SUBJECT_TO_REVISION
        self.submission.save(update_fields=["status"])
        self.client.force_authenticate(user=self.sibat_user)

        response = self.client.patch(
            f"/livestock/census/{self.submission.pk}/",
            {"report_year": 2026, "report_quarter": 1},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("already exists for this census period", str(response.data))

    def test_barangay_options_follow_sibat_scope(self):
        other_barangay = Barangay.objects.create(
            barangay_name="San Felipe",
            latitude=13.89,
            longitude=121.22,
        )
        self.client.force_authenticate(user=self.sibat_user)

        assigned_response = self.client.get("/livestock/barangays/")
        self.assertEqual(assigned_response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            [row["id"] for row in assigned_response.data],
            [self.barangay.pk],
        )

        self.sibat_user.access_scope = User.AccessScope.ALL_BARANGAYS
        self.sibat_user.save(update_fields=["access_scope"])
        all_response = self.client.get("/livestock/barangays/")
        self.assertEqual(
            {row["id"] for row in all_response.data},
            {self.barangay.pk, other_barangay.pk},
        )

        create_response = self.client.post(
            "/livestock/census/",
            {
                "barangay": other_barangay.pk,
                "report_year": 2026,
                "report_quarter": 4,
                "items": [],
            },
            format="json",
        )
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(
            CensusSubmission.objects.get(pk=create_response.data["id"]).barangay_id,
            other_barangay.pk,
        )

        self.sibat_user.access_scope = User.AccessScope.ASSIGNED_ONLY
        self.sibat_user.assigned_barangay = None
        self.sibat_user.save(update_fields=["access_scope", "assigned_barangay"])
        unassigned_response = self.client.get("/livestock/barangays/")
        self.assertEqual(unassigned_response.status_code, status.HTTP_200_OK)
        self.assertEqual(unassigned_response.data, [])

    def test_mao_revision_request_notifies_submitting_sibat(self):
        self.client.force_authenticate(user=self.mao_user)
        response = self.client.post(
            f"/livestock/census/{self.submission.pk}/review/",
            {"status": "SUBJECT_TO_REVISION", "remarks": "Correct the cattle total."},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        notification = Notification.objects.get(
            user=self.sibat_user,
            title="Revision Required on Census Submission",
        )
        self.assertEqual(notification.priority, Notification.Priority.HIGH)
        self.assertIn("Correct the cattle total.", notification.message)
        self.assertEqual(notification.link, "/sibat?tab=census")

    def test_corrected_census_resubmission_notifies_mao(self):
        self.submission.status = CensusSubmission.StatusType.SUBJECT_TO_REVISION
        self.submission.review_remarks = "Correct the cattle total."
        self.submission.save(update_fields=["status", "review_remarks"])

        self.client.force_authenticate(user=self.sibat_user)
        response = self.client.patch(
            f"/livestock/census/{self.submission.pk}/",
            {"remarks": "Cattle total corrected."},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.submission.refresh_from_db()
        self.assertEqual(self.submission.status, CensusSubmission.StatusType.VERIFIED)
        notification = Notification.objects.get(
            user=self.mao_user,
            title="Census Submission Resubmitted",
        )
        self.assertEqual(notification.link, "/data-validation?domain=census")

    def test_mao_cannot_review_an_already_approved_census(self):
        self.submission.status = CensusSubmission.StatusType.APPROVED
        self.submission.save(update_fields=["status"])
        self.client.force_authenticate(user=self.mao_user)
        response = self.client.post(
            f"/livestock/census/{self.submission.pk}/review/",
            {"status": "SUBJECT_TO_REVISION", "remarks": "Reopen submission."},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_census_revision_requires_remarks(self):
        self.client.force_authenticate(user=self.mao_user)
        response = self.client.post(
            f"/livestock/census/{self.submission.pk}/review/",
            {"status": "SUBJECT_TO_REVISION"},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_sibat_cannot_edit_another_users_submission(self):
        self.client.force_authenticate(user=self.other_sibat_user)
        response = self.client.patch(
            f"/livestock/census/{self.submission.pk}/",
            {"remarks": "Attempted change"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

class LivestockBatchQrLookupTests(APITestCase):
    def setUp(self):
        self.sibat_role = Role.objects.create(role_name=Role.UserRoles.SIBAT)
        self.farmer_role = Role.objects.create(role_name=Role.UserRoles.FARMER)
        self.barangay = Barangay.objects.create(barangay_name="QR Scope Barangay", latitude=13.88, longitude=121.21)
        self.other_barangay = Barangay.objects.create(barangay_name="Outside QR Scope", latitude=13.89, longitude=121.22)
        self.cattle = LivestockType.objects.create(name="QR Lookup Cattle")
        self.sibat = User.objects.create_user(
            username="qr_sibat", email="qr_sibat@example.com", password="password123",
            role=self.sibat_role, account_status=User.AccountStatus.APPROVED,
            assigned_barangay=self.barangay,
        )
        self.farmer_user = User.objects.create_user(
            username="qr_farmer", email="qr_farmer@example.com", password="password123",
            role=self.farmer_role, account_status=User.AccountStatus.APPROVED,
        )
        self.farmer = Farmer.objects.create(user=self.farmer_user, barangay=self.barangay)
        self.batch = LivestockBatch.objects.create(
            farmer=self.farmer,
            livestock_type=self.cattle,
            batch_name="QR Test Herd",
            batch_code="QR-HERD-001",
            created_by=self.farmer_user,
        )

    def test_canonical_batch_qr_resolves_a_batch_in_the_assigned_scope(self):
        self.client.force_authenticate(user=self.sibat)
        response = self.client.get(
            "/api/livestock/batches/lookup/", {"code": f"SL-BATCH:{self.batch.pk}"}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["id"], self.batch.pk)
        self.assertEqual(response.data["batch_code"], self.batch.batch_code)
        self.assertEqual(response.data["livestock_type_name"], self.cattle.name)

    def test_batch_lookup_does_not_expose_a_herd_outside_sibat_scope(self):
        other_user = User.objects.create_user(
            username="qr_other_farmer", email="qr_other@example.com", password="password123",
            role=self.farmer_role, account_status=User.AccountStatus.APPROVED,
        )
        other_farmer = Farmer.objects.create(user=other_user, barangay=self.other_barangay)
        outside_batch = LivestockBatch.objects.create(
            farmer=other_farmer,
            livestock_type=self.cattle,
            batch_name="Outside Herd",
            batch_code="QR-HERD-OUTSIDE",
            created_by=other_user,
        )
        self.client.force_authenticate(user=self.sibat)
        response = self.client.get(
            "/api/livestock/batches/lookup/", {"code": f"SL-BATCH:{outside_batch.pk}"}
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_farmer_can_only_resolve_their_own_batch(self):
        self.client.force_authenticate(user=self.farmer_user)
        response = self.client.get(
            "/api/livestock/batches/lookup/", {"code": self.batch.batch_code}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["id"], self.batch.pk)

    def test_unknown_batch_is_not_reported_as_found(self):
        self.client.force_authenticate(user=self.sibat)
        response = self.client.get("/api/livestock/batches/lookup/", {"code": "NO-SUCH-BATCH"})
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_empty_batch_identifier_is_rejected(self):
        self.client.force_authenticate(user=self.sibat)
        response = self.client.get("/api/livestock/batches/lookup/", {"code": " "})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIRequestFactory, force_authenticate

from analytics.views import review_workload
from livestock.models import Barangay, Farmer, LivestockInventory, LivestockType
from users.models import Role, User


class SibatReviewWorkloadScopeTests(TestCase):
    def setUp(self):
        self.assigned = Barangay.objects.create(
            barangay_name="Assigned Barangay",
            latitude=Decimal("13.880000"),
            longitude=Decimal("121.210000"),
        )
        other = Barangay.objects.create(
            barangay_name="Other Barangay",
            latitude=Decimal("13.890000"),
            longitude=Decimal("121.220000"),
        )
        farmer_role = Role.objects.create(role_name="FARMER")
        sibat_role = Role.objects.create(role_name="SIBAT")
        self.cattle = LivestockType.objects.create(name="Cattle")
        self.local_farmer_user = User.objects.create_user(
            username="local-farmer", email="local-farmer@example.test", role=farmer_role,
        )
        self.remote_farmer_user = User.objects.create_user(
            username="remote-farmer", email="remote-farmer@example.test", role=farmer_role,
        )
        self.local_farmer = Farmer.objects.create(
            user=self.local_farmer_user, barangay=self.assigned, address="Local",
        )
        self.remote_farmer = Farmer.objects.create(
            user=self.remote_farmer_user, barangay=other, address="Remote",
        )
        self.sibat = User.objects.create_user(
            username="assigned-sibat", email="sibat@example.test", role=sibat_role,
            account_status="APPROVED", assigned_barangay=self.assigned,
            access_scope="ASSIGNED_ONLY",
        )

    def _inventory(self, farmer, user, status):
        return LivestockInventory.objects.create(
            farmer=farmer, livestock_type=self.cattle, status=status, created_by=user,
        )

    def test_workload_endpoint_limits_all_stages_to_assigned_barangay(self):
        for status in ("PENDING", "VERIFIED", "SUBJECT_TO_REVISION"):
            self._inventory(self.local_farmer, self.local_farmer_user, status)
            self._inventory(self.remote_farmer, self.remote_farmer_user, status)

        request = APIRequestFactory().get("/api/analytics/review-workload/")
        force_authenticate(request, user=self.sibat)
        response = review_workload(request)

        self.assertEqual(response.status_code, 200)
        inventory = next(row for row in response.data["by_domain"] if row["key"] == "inventory")
        self.assertEqual(inventory["sibat_count"], 1)
        self.assertEqual(inventory["mao_count"], 1)
        self.assertEqual(inventory["returned_count"], 1)
        self.assertEqual(response.data["overall"]["sibat"]["count"], 1)
        self.assertEqual(response.data["overall"]["mao"]["count"], 1)
        self.assertEqual(response.data["overall"]["returned"], 1)
        sibat_keys = {row["key"] for row in response.data["by_domain"]}
        self.assertNotIn("sales", sibat_keys)
        self.assertNotIn("slaughter", sibat_keys)
        self.assertNotIn("ownership_transfers", sibat_keys)
        self.assertNotIn("inspection_clearances", sibat_keys)
        self.assertNotIn("production", sibat_keys)

    def test_all_barangay_scope_includes_other_barangays(self):
        for status in ("PENDING", "VERIFIED", "SUBJECT_TO_REVISION"):
            self._inventory(self.local_farmer, self.local_farmer_user, status)
            self._inventory(self.remote_farmer, self.remote_farmer_user, status)

        self.sibat.access_scope = "ALL_BARANGAYS"
        self.sibat.save(update_fields=["access_scope"])
        request = APIRequestFactory().get("/api/analytics/review-workload/")
        force_authenticate(request, user=self.sibat)
        response = review_workload(request)

        self.assertEqual(response.status_code, 200)
        inventory = next(row for row in response.data["by_domain"] if row["key"] == "inventory")
        self.assertEqual(inventory["sibat_count"], 2)
        self.assertEqual(inventory["mao_count"], 2)
        self.assertEqual(inventory["returned_count"], 2)
        self.assertNotIn("sales", {row["key"] for row in response.data["by_domain"]})

        from analytics.services.review_workload import review_workload_summary
        mao_role = Role.objects.create(role_name="MAO")
        mao = User.objects.create_user(
            username="mao", email="mao@example.test", role=mao_role,
        )
        mao_summary = review_workload_summary(user=mao)
        self.assertIn("sales", {row["key"] for row in mao_summary["by_domain"]})

    def test_cbat_workload_excludes_disease_domain(self):
        cbat_role = Role.objects.create(role_name="CBAT")
        cbat = User.objects.create_user(
            username="assigned-cbat", email="cbat@example.test", role=cbat_role,
            account_status="APPROVED", assigned_barangay=self.assigned,
            access_scope="ASSIGNED_ONLY",
        )
        request = APIRequestFactory().get("/api/analytics/review-workload/")
        force_authenticate(request, user=cbat)
        response = review_workload(request)

        self.assertEqual(response.status_code, 200)
        domain_keys = {row["key"] for row in response.data["by_domain"]}
        self.assertNotIn("disease", domain_keys)
        self.assertNotIn("slaughter", domain_keys)
        self.assertNotIn("sales", domain_keys)
        self.assertNotIn("ownership_transfers", domain_keys)
        self.assertNotIn("inspection_clearances", domain_keys)
        self.assertNotIn("production", domain_keys)
        self.assertIn("inventory", domain_keys)

from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIRequestFactory, force_authenticate

from analytics.views import census_summary
from livestock.models import Barangay, CensusSubmission, CensusSubmissionItem, Farmer, LivestockType
from users.models import Role, User


class CensusSummaryHistoryTests(TestCase):
    def test_default_summary_uses_latest_quarter_instead_of_adding_history(self):
        sibat_role = Role.objects.create(role_name="SIBAT")
        farmer_role = Role.objects.create(role_name="FARMER")
        barangay = Barangay.objects.create(
            barangay_name="Cawongan",
            latitude=Decimal("13.880000"),
            longitude=Decimal("121.210000"),
        )
        sibat = User.objects.create_user(
            username="census-sibat",
            email="census-sibat@example.test",
            password="test-pass",
            role=sibat_role,
            assigned_barangay=barangay,
        )
        farmer_user = User.objects.create_user(
            username="census-farmer",
            email="census-farmer@example.test",
            password="test-pass",
            role=farmer_role,
        )
        farmer = Farmer.objects.create(user=farmer_user, barangay=barangay, address="Test")
        livestock_type = LivestockType.objects.create(name="Cattle")
        for quarter, heads in ((1, 100), (3, 135)):
            submission = CensusSubmission.objects.create(
                barangay=barangay,
                report_year=2026,
                report_quarter=quarter,
                submitted_by=sibat,
                status=CensusSubmission.StatusType.APPROVED,
            )
            CensusSubmissionItem.objects.create(
                census_submission=submission,
                farmer=farmer,
                livestock_type=livestock_type,
                number_of_heads=heads,
            )

        request = APIRequestFactory().get("/analytics/census/")
        force_authenticate(request, user=sibat)
        response = census_summary(request)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.data["period"],
            {"year": 2026, "quarter": 3, "label": "Q3 2026"},
        )
        self.assertEqual(response.data["totals"]["heads"], 135)
        self.assertEqual(
            response.data["available_periods"],
            [{"year": 2026, "quarter": 3}, {"year": 2026, "quarter": 1}],
        )

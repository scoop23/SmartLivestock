"""
Tests for SmartLivestock Forecast Readiness & Validation Diagnostics Endpoint and Service.
"""

from datetime import date, timedelta
from decimal import Decimal

from django.test import TestCase
from django.core.management import call_command
from django.utils.timezone import localdate
from rest_framework.test import APIClient
from rest_framework import status

from production.models import ProductionRecord, SlaughterRecord
from livestock.models import LivestockInventory, LivestockType, Barangay, Farmer
from users.models import User, Role
from analytics.services.predictive.diagnostics import (
    get_forecast_readiness_diagnostics,
    get_all_forecast_readiness_diagnostics,
    CORE_DIAGNOSTIC_TARGETS,
)


class ForecastReadinessDiagnosticsTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Roles
        self.mao_role, _ = Role.objects.get_or_create(role_name="MAO")
        self.sibat_role, _ = Role.objects.get_or_create(role_name="SIBAT")
        self.farmer_role, _ = Role.objects.get_or_create(role_name="FARMER")

        # Users
        self.mao_user = User.objects.create(
            username="diag_mao",
            email="diag_mao@example.com",
            role=self.mao_role,
        )
        self.sibat_user = User.objects.create(
            username="diag_sibat",
            email="diag_sibat@example.com",
            role=self.sibat_role,
        )
        self.farmer_user = User.objects.create(
            username="diag_farmer",
            email="diag_farmer@example.com",
            role=self.farmer_role,
        )

        self.barangay = Barangay.objects.create(
            barangay_name="San Roque",
            latitude=Decimal("13.876543"),
            longitude=Decimal("121.213456"),
        )
        self.livestock_type = LivestockType.objects.create(name="Cattle")
        self.farmer_profile = Farmer.objects.create(
            user=self.farmer_user,
            barangay=self.barangay,
        )
        self.inventory = LivestockInventory.objects.create(
            tag_number="TAG-DIAG-001",
            livestock_type=self.livestock_type,
            farmer=self.farmer_profile,
            status="APPROVED",
            created_by=self.farmer_user,
        )

    def test_permission_access_control(self):
        """MAO and SIBAT can access diagnostics; Farmer and unauthenticated users are denied."""
        url = "/api/analytics/predictive/diagnostics/"

        # Unauthenticated -> 401
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

        # Farmer -> 403
        self.client.force_authenticate(user=self.farmer_user)
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

        # SIBAT -> 200
        self.client.force_authenticate(user=self.sibat_user)
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        # MAO -> 200
        self.client.force_authenticate(user=self.mao_user)
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_all_targets_overview_endpoint(self):
        """Overview returns summary cards for the 4 core targets."""
        self.client.force_authenticate(user=self.mao_user)
        res = self.client.get("/api/analytics/predictive/diagnostics/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.json()

        self.assertEqual(data["status"], "success")
        self.assertIn("summary_cards", data)
        self.assertIn("diagnostics", data)
        self.assertEqual(len(data["summary_cards"]), 4)

        card_ids = [c["id"] for c in data["summary_cards"]]
        self.assertIn("milk", card_ids)
        self.assertIn("farmer_meat", card_ids)
        self.assertIn("slaughter_meat", card_ids)
        self.assertIn("livestock_sales", card_ids)

        for card in data["summary_cards"]:
            self.assertIn("forecast_status", card)
            self.assertIn("usable_observations", card)
            self.assertIn("required_observations", card)
            self.assertIn("blocker_summary", card)
            self.assertIn("next_step", card)

    def test_insufficient_data_checklist(self):
        """When database is empty, checklist items accurately report BLOCKED/WARNING."""
        diag = get_forecast_readiness_diagnostics("production", "MILK", "LITERS", user=self.mao_user)
        self.assertEqual(diag["forecast_status"], "INSUFFICIENT_DATA")
        self.assertFalse(diag["forecast_available"])
        self.assertEqual(diag["validation_status"], "INSUFFICIENT_DATA")

        checklist = {item["id"]: item for item in diag["checklist"]}
        self.assertEqual(checklist["records_found"]["status"], "BLOCKED")
        self.assertEqual(checklist["approved_records"]["status"], "BLOCKED")
        self.assertEqual(checklist["monthly_observations"]["status"], "BLOCKED")
        self.assertEqual(checklist["forecast_generation"]["status"], "BLOCKED")
        milk = diag["progress"]["milk_diagnostics"]
        self.assertEqual(milk["usable_records"], 0)
        self.assertEqual(milk["usable_production_days"], 0)
        self.assertEqual(milk["pending_records"], 0)

    def test_approval_status_breakdown_counts_target_rows_without_double_counting(self):
        event_date = localdate().replace(day=1) - timedelta(days=1)
        for status_value in (
            ProductionRecord.ProductionStatus.APPROVED,
            ProductionRecord.ProductionStatus.PENDING,
            ProductionRecord.ProductionStatus.VERIFIED,
            ProductionRecord.ProductionStatus.SUBJECT_TO_REVISION,
        ):
            ProductionRecord.objects.create(
                production_type=ProductionRecord.ProductionType.MILK,
                unit=ProductionRecord.UnitType.LITERS,
                quantity=Decimal("4.00"),
                record_date=event_date,
                status=status_value,
                farmer_at_record=self.farmer_profile,
                created_by=self.farmer_user,
            )
        # A different commodity is excluded from milk's status denominator.
        ProductionRecord.objects.create(
            production_type=ProductionRecord.ProductionType.MEAT,
            unit=ProductionRecord.UnitType.KILOGRAMS,
            quantity=Decimal("8.00"), record_date=event_date,
            status=ProductionRecord.ProductionStatus.APPROVED,
            farmer_at_record=self.farmer_profile, created_by=self.farmer_user,
        )

        breakdown = get_forecast_readiness_diagnostics(
            "production", "MILK", "LITERS", user=self.mao_user
        )["progress"]["approval_status_breakdown"]
        self.assertEqual(breakdown["total_records"], 4)
        self.assertEqual(
            {item["status"]: item["count"] for item in breakdown["statuses"]},
            {"PENDING": 1, "VERIFIED": 1, "APPROVED": 1, "SUBJECT_TO_REVISION": 1},
        )
        self.assertNotIn("farmer", breakdown)
        self.assertNotIn("name", breakdown)

    def test_approval_status_breakdown_respects_sibat_barangay_scope_and_empty_state(self):
        breakdown = get_forecast_readiness_diagnostics(
            "production", "MILK", "LITERS", user=self.sibat_user
        )["progress"]["approval_status_breakdown"]
        self.assertEqual(breakdown["total_records"], 0)
        self.assertEqual(
            {item["status"]: item["count"] for item in breakdown["statuses"]},
            {"PENDING": 0, "VERIFIED": 0, "APPROVED": 0, "SUBJECT_TO_REVISION": 0},
        )

        self.sibat_user.assigned_barangay = self.barangay
        self.sibat_user.save(update_fields=["assigned_barangay"])
        event_date = localdate().replace(day=1) - timedelta(days=1)
        ProductionRecord.objects.create(
            production_type=ProductionRecord.ProductionType.MILK,
            unit=ProductionRecord.UnitType.LITERS, quantity=Decimal("3.00"),
            record_date=event_date, status=ProductionRecord.ProductionStatus.PENDING,
            farmer_at_record=self.farmer_profile, created_by=self.farmer_user,
        )
        breakdown = get_forecast_readiness_diagnostics(
            "production", "MILK", "LITERS", user=self.sibat_user
        )["progress"]["approval_status_breakdown"]
        self.assertEqual(breakdown["total_records"], 1)
        self.assertEqual(next(row["count"] for row in breakdown["statuses"] if row["status"] == "PENDING"), 1)

    def test_decoupled_unvalidated_forecast(self):
        """
        When 24 monthly records exist but have modern creation dates (not reconstructable in the past),
        forecast availability is decoupled: forecast_available=True, validation_status='NOT_YET_VALIDATED'.
        """
        # Seed 24 months for Milk without backdating approval timestamps
        call_command("seed_productions", months=24)
        try:
            diag = get_forecast_readiness_diagnostics("production", "MILK", "LITERS", user=self.mao_user)
            self.assertTrue(diag["forecast_available"])
            self.assertEqual(diag["forecast_status"], "AVAILABLE_UNVALIDATED")
            self.assertEqual(diag["validation_status"], "NOT_YET_VALIDATED")
            self.assertIn("cutoffs", diag["backtesting"])
            self.assertGreaterEqual(len(diag["forecast"]["forecast_points"]), 1)

            checklist = {item["id"]: item for item in diag["checklist"]}
            self.assertEqual(checklist["records_found"]["status"], "PASSED")
            self.assertEqual(checklist["approved_records"]["status"], "PASSED")
            self.assertEqual(checklist["monthly_observations"]["status"], "PASSED")
            self.assertEqual(checklist["qualifying_cutoffs"]["status"], "WARNING")
            self.assertEqual(checklist["forecast_generation"]["status"], "PASSED")
        finally:
            call_command("seed_productions", clean=True)

    def test_synthetic_seed_timestamps_do_not_create_backtest_evidence(self):
        """
        Synthetic seed rows retain their real insertion timestamps, so they cannot
        manufacture historical approval windows.
        """
        call_command("seed_productions", months=36)
        try:
            diag = get_forecast_readiness_diagnostics("production", "MILK", "LITERS", user=self.mao_user)
            self.assertTrue(diag["forecast_available"])
            self.assertEqual(diag["forecast_status"], "AVAILABLE_UNVALIDATED")
            self.assertEqual(diag["validation_status"], "NOT_YET_VALIDATED")
            self.assertEqual(diag["backtesting"]["valid_cutoffs_count"], 0)
            self.assertGreater(diag["progress"]["milk_diagnostics"]["usable_records"], 0)

            checklist = {item["id"]: item for item in diag["checklist"]}
            self.assertEqual(checklist["monthly_observations"]["status"], "PASSED")
            self.assertEqual(checklist["qualifying_cutoffs"]["status"], "WARNING")
        finally:
            call_command("seed_productions", clean=True)

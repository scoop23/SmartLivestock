from datetime import time
from decimal import Decimal

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from diseases.models import DiseaseCase, MortalityRecord
from livestock.models import Barangay, Farmer, LivestockInventory, LivestockType
from movements.models import LivestockInspection, LivestockInspectionClearance, LivestockInspectionItem
from production.models import ProductionRecord, SlaughterRecord
from users.models import Role, User


class OfficialReportApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.mao_role, _ = Role.objects.get_or_create(role_name="MAO")
        self.farmer_role, _ = Role.objects.get_or_create(role_name="FARMER")
        self.mao = User.objects.create_user(username="report_mao", email="report_mao@example.test",
                                            password="pass", role=self.mao_role,
                                            account_status=User.AccountStatus.APPROVED)
        self.farmer_user = User.objects.create_user(username="report_farmer", email="report_farmer@example.test",
                                                    password="pass", role=self.farmer_role,
                                                    first_name="Juan", last_name="Dela Cruz",
                                                    account_status=User.AccountStatus.APPROVED)
        self.barangay = Barangay.objects.create(barangay_name="Poblacion", latitude=Decimal("13.88"),
                                               longitude=Decimal("121.21"))
        self.farmer = Farmer.objects.create(user=self.farmer_user, barangay=self.barangay,
                                            address="Purok 1, Poblacion", farm_size=Decimal("1.00"))
        self.cattle = LivestockType.objects.create(name="Cattle")
        self.goat = LivestockType.objects.create(name="Goat")
        self.animal = LivestockInventory.objects.create(
            farmer=self.farmer, livestock_type=self.cattle, tag_number="COW-001", quantity=1,
            status=LivestockInventory.StatusType.APPROVED,
            operational_status=LivestockInventory.OperationalStatus.ACTIVE, created_by=self.farmer_user,
        )
        self.today = timezone.localdate()
        self.client.force_authenticate(self.mao)

        ProductionRecord.objects.create(livestock=self.animal, production_type="MILK", quantity=Decimal("12.5"),
                                        unit="LITERS", record_date=self.today, status="APPROVED", created_by=self.farmer_user)
        ProductionRecord.objects.create(livestock=self.animal, production_type="EGGS", quantity=Decimal("8"),
                                        unit="PIECES", record_date=self.today, status="APPROVED", created_by=self.farmer_user)
        ProductionRecord.objects.create(livestock=self.animal, production_type="MILK", quantity=Decimal("99"),
                                        unit="LITERS", record_date=self.today, status="PENDING", created_by=self.farmer_user)
        DiseaseCase.objects.create(livestock=self.animal, name="Foot and mouth disease", affected_count=2,
                                   record_date=self.today, status="APPROVED", created_by=self.farmer_user)
        DiseaseCase.objects.create(livestock=self.animal, name="Unreviewed", affected_count=20,
                                   record_date=self.today, status="SUBJECT_TO_REVISION", created_by=self.farmer_user)
        MortalityRecord.objects.create(livestock=self.animal, cause="Other", death_count=1,
                                       record_date=self.today, status="APPROVED", created_by=self.farmer_user)
        SlaughterRecord.objects.create(livestock=self.animal, livestock_type=self.cattle, barangay=self.barangay,
                                       quantity=1, carcass_weight=Decimal("180.5"), record_date=self.today,
                                       status="APPROVED", created_by=self.farmer_user)
        SlaughterRecord.objects.create(livestock=self.animal, livestock_type=self.cattle, quantity=9,
                                       carcass_weight=Decimal("999"), record_date=self.today,
                                       status="PENDING", created_by=self.farmer_user)

        self.inspection = LivestockInspection.objects.create(
            shipper=self.farmer, shipper_name="Juan Dela Cruz", destination="Padre Garcia Auction",
            purpose="SLAUGHTER", inspection_date=self.today, created_by=self.mao,
        )
        LivestockInspectionItem.objects.create(inspection=self.inspection, livestock_type=self.cattle,
                                               inventory=self.animal, quantity=1, classification="SLAUGHTER")
        LivestockInspectionItem.objects.create(inspection=self.inspection, livestock_type=self.goat,
                                               quantity=2, classification="OTHER")
        LivestockInspectionClearance.objects.create(
            inspection=self.inspection, control_number="CLR-REPORT-1", shipper_address=self.farmer.address,
            origin="Poblacion, Padre Garcia", status="APPROVED", issued_by=self.mao,
            date_issued=self.today, time_issued=time(9, 0), reviewed_by=self.mao, reviewed_at=timezone.now(),
        )
        pending = LivestockInspection.objects.create(shipper=self.farmer, shipper_name="Juan Dela Cruz",
                                                      destination="Lipa", purpose="SLAUGHTER",
                                                      inspection_date=self.today, created_by=self.mao)
        LivestockInspectionItem.objects.create(inspection=pending, livestock_type=self.cattle,
                                               quantity=10, classification="SLAUGHTER")
        LivestockInspectionClearance.objects.create(inspection=pending, control_number="CLR-REPORT-2",
                                                    shipper_address=self.farmer.address, status="PENDING")

    def params(self, report_type, **overrides):
        values = {"report_type": report_type, "date_from": self.today.isoformat(), "date_to": self.today.isoformat()}
        values.update(overrides)
        return values

    def preview(self, report_type, **filters):
        return self.client.get(reverse("reports-preview"), self.params(report_type, **filters))

    def test_each_report_type_uses_approved_database_rows_and_correct_units(self):
        expected = {"inventory": (1, 1), "production": (2, 2), "disease_mortality": (2, 2),
                    "slaughter": (1, 1), "movement": (2, 1), "inspection": (2, 1)}
        for report_type, (row_count, records) in expected.items():
            with self.subTest(report_type=report_type):
                response = self.preview(report_type)
                self.assertEqual(response.status_code, 200, response.data)
                self.assertEqual(len(response.data["rows"]), row_count)
                self.assertEqual(response.data["record_count"], records)
                self.assertEqual(response.data["period"]["date_from"], self.today.isoformat())
        production = self.preview("production").data
        self.assertEqual(production["summary"]["totals_by_type_and_unit"], {"MILK (LITERS)": 12.5, "EGGS (PIECES)": 8.0})
        health = self.preview("disease_mortality").data["summary"]
        self.assertEqual((health["disease_cases"], health["affected_heads"], health["mortality_records"], health["deaths"]), (1, 2, 1, 1))
        movement = self.preview("movement").data
        self.assertEqual(movement["summary"]["livestock_heads"], 3)
        self.assertEqual({row["direction"] for row in movement["rows"]}, {"INTERNAL"})
        self.assertTrue(all(row["clearance_status"] == "APPROVED" for row in movement["rows"]))

    def test_filters_and_empty_date_range_are_applied_to_preview(self):
        response = self.preview("movement", species="Goat", direction="INTERNAL", purpose="SLAUGHTER")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["rows"]), 1)
        self.assertEqual(response.data["rows"][0]["species"], "Goat")
        self.assertEqual(response.data["rows"][0]["quantity"], 2)
        empty = self.client.get(reverse("reports-preview"), self.params("inventory", date_from="2020-01-01", date_to="2020-01-31"))
        self.assertEqual(empty.status_code, 200)
        self.assertEqual(empty.data["rows"], [])
        self.assertEqual(empty.data["summary"]["total_heads"], 0)

    def test_date_validation_and_role_authorization(self):
        bad_range = self.client.get(reverse("reports-preview"), self.params("inventory", date_from="2026-02-01", date_to="2026-01-01"))
        self.assertEqual(bad_range.status_code, 400)
        unsupported_filter = self.client.get(reverse("reports-preview"), self.params("inventory", direction="INBOUND"))
        self.assertEqual(unsupported_filter.status_code, 400)
        self.client.force_authenticate(self.farmer_user)
        self.assertEqual(self.preview("inventory").status_code, 403)
        self.client.force_authenticate(user=None)
        self.assertEqual(self.preview("inventory").status_code, 401)

    def test_excel_and_pdf_exports_are_real_downloads(self):
        for file_format, signature, content_type in (("xlsx", b"PK", "spreadsheetml.sheet"),
                                                       ("pdf", b"%PDF", "application/pdf")):
            with self.subTest(file_format=file_format):
                response = self.client.get(reverse("reports-export"), self.params("movement", file_format=file_format))
                self.assertEqual(response.status_code, 200)
                self.assertTrue(response.content.startswith(signature))
                self.assertIn(content_type, response["Content-Type"])
                self.assertIn("attachment; filename=", response["Content-Disposition"])

    def test_movement_direction_labels(self):
        from analytics.services.movement_direction import classify_movement_direction
        local = ["Poblacion", "Manggas"]
        self.assertEqual(classify_movement_direction("Lipa", "Poblacion, Padre Garcia", local), "INBOUND")
        self.assertEqual(classify_movement_direction("Manggas", "Lipa", local), "OUTBOUND")
        self.assertEqual(classify_movement_direction("Manggas", "Poblacion", local), "INTERNAL")
        self.assertEqual(classify_movement_direction("Tanauan", "Lipa", local), "UNKNOWN")

from django.test import TestCase

# TODO: Write tests for:
#   - ProductionRecord creation (milk/eggs/wool with correct units)
#   - SlaughterRecord with nullable livestock FK (batch slaughter)
#   - LiveAnimalSale with different sale methods (MATA-MATA vs WEIGHING)
#   - Status workflow: PENDING → VERIFIED → APPROVED/SUBJECT_TO_REVISION

from datetime import date
from rest_framework import status
from rest_framework.test import APITestCase
from users.models import Notification, Role, User
from livestock.models import Barangay, Farmer, LivestockBatch, LivestockInventory, LivestockType
from .models import CalvingRecord, LiveAnimalSale, ProductionRecord


class ProductionRecordAPITests(APITestCase):
    def setUp(self):
        self.farmer_role = Role.objects.create(role_name=Role.UserRoles.FARMER)
        self.mao_role = Role.objects.create(role_name=Role.UserRoles.MAO)
        self.sibat_role = Role.objects.create(role_name=Role.UserRoles.SIBAT)
        self.auction_role = Role.objects.create(role_name=Role.UserRoles.AUCTION)
        self.farmer_user = User.objects.create_user(
            username="production-farmer", email="production-farmer@example.com",
            password=None, role=self.farmer_role,
            account_status=User.AccountStatus.APPROVED,
        )
        self.mao_user = User.objects.create_user(
            username="production-mao", email="production-mao@example.com",
            password=None, role=self.mao_role,
            account_status=User.AccountStatus.APPROVED,
        )
        self.sibat_user = User.objects.create_user(
            username="production-sibat", email="production-sibat@example.com",
            password=None, role=self.sibat_role,
            account_status=User.AccountStatus.APPROVED,
        )
        self.auction_user = User.objects.create_user(
            username="production-auction", email="production-auction@example.com",
            password=None, role=self.auction_role,
            account_status=User.AccountStatus.APPROVED,
        )
        barangay = Barangay.objects.create(
            barangay_name="San Roque", latitude=13.8821, longitude=121.2144,
        )
        self.farmer = Farmer.objects.create(
            user=self.farmer_user, barangay=barangay, address="Purok 1",
        )
        self.cattle = LivestockType.objects.create(name="Cattle")
        self.animal = LivestockInventory.objects.create(
            farmer=self.farmer, livestock_type=self.cattle, quantity=1,
            created_by=self.farmer_user,
            status=LivestockInventory.StatusType.APPROVED,
        )
        self.record = ProductionRecord.objects.create(
            livestock=self.animal, production_type=ProductionRecord.ProductionType.MILK,
            quantity=10, unit=ProductionRecord.UnitType.LITERS,
            record_date=date(2026, 1, 1), created_by=self.farmer_user,
        )

    def test_farmer_can_edit_and_delete_pending_record(self):
        self.client.force_authenticate(user=self.farmer_user)
        response = self.client.patch(
            f"/production/records/{self.record.pk}/", {"notes": "Morning milking"},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.record.refresh_from_db()
        self.assertEqual(self.record.notes, "Morning milking")
        response = self.client.delete(f"/production/records/{self.record.pk}/")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(ProductionRecord.objects.filter(pk=self.record.pk).exists())

    def test_auction_role_cannot_review_production(self):
        self.client.force_authenticate(user=self.auction_user)
        response = self.client.post(
            f"/production/records/{self.record.pk}/review/", {"status": "APPROVED"},
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.record.refresh_from_db()
        self.assertEqual(self.record.status, ProductionRecord.ProductionStatus.PENDING)

    def test_mao_review_notifies_record_owner(self):
        self.record.status = ProductionRecord.ProductionStatus.VERIFIED
        self.record.save(update_fields=["status"])
        self.client.force_authenticate(user=self.mao_user)
        response = self.client.post(
            f"/production/records/{self.record.pk}/review/", {"status": "APPROVED"},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.record.refresh_from_db()
        self.assertEqual(self.record.status, ProductionRecord.ProductionStatus.APPROVED)
        self.assertTrue(Notification.objects.filter(user=self.farmer_user).exists())

    def test_farmer_cannot_log_production_against_another_farmers_batch(self):
        other_user = User.objects.create_user(
            username="other-production-farmer", email="other-production-farmer@example.com",
            password=None, role=self.farmer_role,
            account_status=User.AccountStatus.APPROVED,
        )
        other_farmer = Farmer.objects.create(
            user=other_user, barangay=self.farmer.barangay, address="Purok 2",
        )
        other_batch = LivestockBatch.objects.create(
            farmer=other_farmer, livestock_type=self.cattle,
            batch_name="Other Herd", batch_code="OTHER-HERD",
            created_by=other_user,
        )
        self.client.force_authenticate(user=self.farmer_user)
        response = self.client.post(
            "/production/records/",
            {"batch": other_batch.pk, "production_type": "MILK", "quantity": "5.00",
             "unit": "LITERS", "record_date": "2026-01-01"},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(ProductionRecord.objects.filter(batch=other_batch).exists())

    def test_auction_cannot_create_or_review_sale(self):
        sale = LiveAnimalSale.objects.create(
            livestock=self.animal,
            quantity=1,
            sale_date=date(2026, 1, 2),
            created_by=self.farmer_user,
        )
        self.client.force_authenticate(user=self.auction_user)
        create_response = self.client.post(
            "/production/sales/",
            {
                "livestock": self.animal.pk,
                "quantity": 1,
                "sale_date": "2026-01-03",
            },
        )
        review_response = self.client.post(
            f"/production/sales/{sale.pk}/review/",
            {"status": "APPROVED"},
        )
        self.assertEqual(create_response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(review_response.status_code, status.HTTP_403_FORBIDDEN)

    def test_sale_requires_sibat_then_mao(self):
        sale = LiveAnimalSale.objects.create(
            livestock=self.animal,
            quantity=1,
            sale_date=date(2026, 1, 2),
            created_by=self.farmer_user,
        )
        self.client.force_authenticate(user=self.mao_user)
        skipped = self.client.post(
            f"/production/sales/{sale.pk}/review/",
            {"status": "APPROVED"},
        )
        self.assertEqual(skipped.status_code, status.HTTP_400_BAD_REQUEST)

        self.client.force_authenticate(user=self.sibat_user)
        verified = self.client.post(
            f"/production/sales/{sale.pk}/review/",
            {"status": "VERIFIED"},
        )
        self.assertEqual(verified.status_code, status.HTTP_200_OK)

        self.client.force_authenticate(user=self.mao_user)
        approved = self.client.post(
            f"/production/sales/{sale.pk}/review/",
            {"status": "APPROVED"},
        )
        self.assertEqual(approved.status_code, status.HTTP_200_OK)

    def test_calving_requires_owned_approved_female_dam(self):
        self.animal.sex = "MALE"
        self.animal.save(update_fields=["sex"])
        self.client.force_authenticate(user=self.farmer_user)
        response = self.client.post(
            "/production/calving/",
            {
                "dam": self.animal.pk,
                "calving_date": "2026-01-03",
                "calf_sex": "FEMALE",
            },
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def swine_animal(self, approved=True):
        swine, _ = LivestockType.objects.get_or_create(name="Swine")
        return LivestockInventory.objects.create(
            farmer=self.farmer, livestock_type=swine, quantity=1,
            created_by=self.farmer_user, status="APPROVED" if approved else "PENDING",
        )

    def test_approved_swine_meat_creation_review_and_species_response(self):
        animal = self.swine_animal()
        self.client.force_authenticate(user=self.farmer_user)
        response = self.client.post("/production/records/", {
            "livestock": animal.pk, "production_type": "MEAT", "unit": "KILOGRAMS",
            "quantity": "12.50", "record_date": "2026-01-01",
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data["livestock_type_name"], "Swine")
        record_id = response.data["id"]
        self.client.force_authenticate(user=self.sibat_user)
        self.assertEqual(self.client.post(f"/production/records/{record_id}/review/", {"status": "VERIFIED"}).status_code, 200)
        self.client.force_authenticate(user=self.mao_user)
        self.assertEqual(self.client.post(f"/production/records/{record_id}/review/", {"status": "APPROVED"}).status_code, 200)
        from analytics.services.descriptive import descriptive_summary
        summary = descriptive_summary(date(2026, 1, 1))["descriptive"]
        self.assertIn({"type": "MEAT", "unit": "KILOGRAMS", "quantity": 12.5, "records": 1}, summary["production"]["by_type"])
        self.record.refresh_from_db()
        self.assertEqual(self.record.production_type, "MILK")
        self.assertEqual(self.record.quantity, 10)

    def test_pending_swine_and_invalid_production_combinations_rejected(self):
        pending = self.swine_animal(approved=False)
        approved = self.swine_animal()
        self.client.force_authenticate(user=self.farmer_user)
        cases = [(pending, "MEAT", "KILOGRAMS"), (approved, "MILK", "LITERS"),
                 (approved, "EGGS", "PIECES"), (approved, "WOOL", "KILOGRAMS"),
                 (approved, "MEAT", "LITERS")]
        for animal, production_type, unit in cases:
            with self.subTest(species=animal.livestock_type.name, approval=animal.status, production_type=production_type, unit=unit):
                response = self.client.post("/production/records/", {
                    "livestock": animal.pk, "production_type": production_type, "unit": unit,
                    "quantity": "5.00", "record_date": "2026-01-01",
                })
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(ProductionRecord.objects.count(), 1)

    def test_swine_herd_production_derives_species_from_batch(self):
        animal = self.swine_animal()
        herd = LivestockBatch.objects.create(
            farmer=self.farmer, livestock_type=animal.livestock_type,
            batch_name="Swine herd", batch_code="SWINE-TEST", created_by=self.farmer_user,
        )
        animal.batch = herd
        animal.save(update_fields=["batch"])
        self.client.force_authenticate(user=self.farmer_user)
        response = self.client.post("/production/records/", {
            "batch": herd.pk, "production_type": "MEAT", "unit": "KILOGRAMS",
            "quantity": "7.25", "record_date": "2026-01-01",
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data["livestock_type_name"], "Swine")
        self.assertEqual(response.data["batch"], herd.pk)

    def test_production_access_is_limited_to_farmer_and_reviewers(self):
        self.client.force_authenticate(user=self.auction_user)
        self.assertEqual(self.client.get("/production/records/").status_code, 403)
        self.assertEqual(self.client.get(f"/production/records/{self.record.pk}/").status_code, 403)
        self.assertEqual(self.client.post("/production/records/", {
            "livestock": self.animal.pk, "production_type": "MILK", "unit": "LITERS",
            "quantity": "2", "record_date": "2026-01-01",
        }).status_code, 403)
        self.client.force_authenticate(user=self.mao_user)
        self.assertEqual(self.client.get("/production/records/").status_code, 200)
        self.assertEqual(self.client.post("/production/records/", {}).status_code, 403)

    def test_zero_and_negative_reported_quantities_are_rejected(self):
        self.client.force_authenticate(user=self.farmer_user)
        for quantity in ("0", "-1"):
            with self.subTest(quantity=quantity):
                response = self.client.post("/production/records/", {
                    "livestock": self.animal.pk, "production_type": "MILK", "unit": "LITERS",
                    "quantity": quantity, "record_date": "2026-01-01",
                })
                self.assertEqual(response.status_code, 400)
                self.assertIn("quantity", response.data)
        self.assertEqual(ProductionRecord.objects.count(), 1)

    def test_returned_report_resubmits_and_reenters_approval_flow(self):
        from analytics.services.descriptive import descriptive_summary
        record_id = self.record.pk
        self.client.force_authenticate(user=self.sibat_user)
        self.assertEqual(self.client.post(f"/production/records/{record_id}/review/", {"status": "VERIFIED"}).status_code, 200)
        self.client.force_authenticate(user=self.mao_user)
        response = self.client.post(f"/production/records/{record_id}/review/", {"status": "SUBJECT_TO_REVISION", "remarks": "Correct the reported quantity"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(descriptive_summary(date(2026, 1, 1))["descriptive"]["production"]["records"], 0)
        self.client.force_authenticate(user=self.farmer_user)
        response = self.client.patch(f"/production/records/{record_id}/", {"quantity": "8.50"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "PENDING")
        self.record.refresh_from_db()
        self.assertIsNone(self.record.reviewed_by)
        self.assertEqual(self.record.review_remarks, "Correct the reported quantity")
        self.assertEqual(ProductionRecord.objects.count(), 1)
        self.client.force_authenticate(user=self.mao_user)
        self.assertEqual(self.client.post(f"/production/records/{record_id}/review/", {"status": "APPROVED"}).status_code, 400)
        self.client.force_authenticate(user=self.sibat_user)
        self.assertEqual(self.client.post(f"/production/records/{record_id}/review/", {"status": "VERIFIED"}).status_code, 200)
        self.client.force_authenticate(user=self.mao_user)
        self.assertEqual(self.client.post(f"/production/records/{record_id}/review/", {"status": "APPROVED"}).status_code, 200)
        summary = descriptive_summary(date(2026, 1, 1))["descriptive"]["production"]
        self.assertEqual(summary["records"], 1)
        self.assertEqual(summary["by_type"][0]["quantity"], 8.5)

    def test_farmer_reads_herd_report_encoded_by_another_user(self):
        animal = self.swine_animal()
        herd = LivestockBatch.objects.create(farmer=self.farmer, livestock_type=animal.livestock_type,
                                             batch_name="Reported herd", batch_code="REPORTED-HERD", created_by=self.farmer_user)
        record = ProductionRecord.objects.create(batch=herd, production_type="MEAT", unit="KILOGRAMS",
                                                 quantity=5, record_date=date(2026, 1, 1), created_by=self.mao_user)
        self.client.force_authenticate(user=self.farmer_user)
        response = self.client.get("/production/records/")
        self.assertEqual(response.status_code, 200)
        self.assertIn(record.pk, [row["id"] for row in response.data])
        self.assertEqual(self.client.get(f"/production/records/{record.pk}/").status_code, 200)

    def load_reference_data(self):
        from django.core.management import call_command
        for name in ("Carabao", "Goat", "Chicken", "Duck"):
            LivestockType.objects.get_or_create(name=name)
        call_command("load_psa_prices", verbosity=0)

    def submit_output(self, species, production_type, unit, quantity, when="2026-01-15"):
        livestock_type = LivestockType.objects.get(name=species)
        animal = LivestockInventory.objects.create(farmer=self.farmer, livestock_type=livestock_type,
            quantity=1, status="APPROVED", created_by=self.farmer_user)
        self.client.force_authenticate(user=self.farmer_user)
        return self.client.post("/production/records/", {"livestock": animal.pk, "production_type": production_type,
            "unit": unit, "quantity": quantity, "record_date": when})

    def test_psa_values_multiple_species_with_correct_commodity_and_units(self):
        self.load_reference_data()
        cases = [("Cattle", "MILK", "LITERS", "15", "705.75"),
                 ("Carabao", "MILK", "LITERS", "2", "179.10"),
                 ("Goat", "MILK", "LITERS", "2", "207.60"),
                 ("Chicken", "EGGS", "PIECES", "10", "68.90"),
                 ("Duck", "EGGS", "PIECES", "10", "90.60")]
        for species, kind, unit, quantity, expected in cases:
            with self.subTest(species=species):
                response = self.submit_output(species, kind, unit, quantity)
                self.assertEqual(response.status_code, 201, response.data)
                snapshot = response.data["valuation_snapshot"]
                self.assertEqual(snapshot["estimated_value"], expected)
                self.assertEqual(snapshot["unit"], unit)
                self.assertEqual(snapshot["reference_period"], "January-March 2026")
                self.assertEqual(response.data["status"], "PENDING")
                self.assertTrue(snapshot["source_url"].startswith("https://psa.gov.ph/"))

    def test_psa_outage_and_missing_period_never_block_submission(self):
        from unittest.mock import patch
        self.load_reference_data()
        with patch("urllib.request.urlopen", side_effect=TimeoutError("PSA unavailable")) as external:
            response = self.submit_output("Cattle", "MILK", "LITERS", "3", "2025-12-31")
            self.assertEqual(response.status_code, 201)
            self.assertIsNone(response.data["valuation_snapshot"])
            external.assert_not_called()

    def test_liveweight_reference_cannot_value_meat_yield(self):
        from decimal import Decimal
        from .models import PSACommodityMapping, PSAReferencePrice
        animal = self.swine_animal()
        PSACommodityMapping.objects.create(livestock_type=animal.livestock_type, production_type="MEAT", unit="KILOGRAMS", commodity_id="HOG_LIVEWEIGHT")
        PSAReferencePrice.objects.create(commodity_id="HOG_LIVEWEIGHT", commodity="Hog liveweight", product_basis="LIVEWEIGHT", unit="KILOGRAMS", price=Decimal("176.03"),
            period_start=date(2026, 1, 1), period_end=date(2026, 3, 31), reference_period="Q1 2026",
            source_url="https://psa.gov.ph/statistics/lp", source_title="Test reference", source_table="Table 12")
        response = self.submit_output("Swine", "MEAT", "KILOGRAMS", "5")
        self.assertEqual(response.status_code, 201)
        self.assertIsNone(response.data["valuation_snapshot"])

    def test_price_snapshot_is_immutable_and_notes_edits_keep_reference(self):
        from django.core.exceptions import ValidationError
        from decimal import Decimal
        from .models import PSAReferencePrice
        self.load_reference_data()
        response = self.submit_output("Cattle", "MILK", "LITERS", "2")
        record_id = response.data["id"]
        old_snapshot = response.data["valuation_snapshot"]
        reference = PSAReferencePrice.objects.get(pk=old_snapshot["reference_id"])
        reference.price = Decimal("99")
        with self.assertRaises(ValidationError):
            reference.save()
        reference.refresh_from_db()
        reference.active = False
        reference.save(update_fields=["active"])
        response = self.client.patch(f"/production/records/{record_id}/", {"notes": "Corrected note", "valuation_snapshot": {"estimated_value": "0"}}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["valuation_snapshot"], old_snapshot)
        response = self.client.patch(f"/production/records/{record_id}/", {"quantity": "3"})
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.data["valuation_snapshot"])

    def test_ambiguous_or_incompatible_reference_is_unavailable(self):
        from .models import PSAReferencePrice
        self.load_reference_data()
        reference = PSAReferencePrice.objects.get(commodity_id="PSA_DAIRY_CATTLE")
        reference.pk = None
        reference.revision = 2
        reference.save()
        response = self.submit_output("Cattle", "MILK", "LITERS", "3")
        self.assertIsNone(response.data["valuation_snapshot"])
        reference.active = False
        reference.save(update_fields=["active"])
        original = PSAReferencePrice.objects.get(commodity_id="PSA_DAIRY_CATTLE", revision=1)
        original.active = False
        original.save(update_fields=["active"])
        reference.pk = None
        reference.revision = 3
        reference.active = True
        reference.unit = "KILOGRAMS"
        reference.save()
        response = self.submit_output("Cattle", "MILK", "LITERS", "3")
        self.assertEqual(response.status_code, 201)
        self.assertIsNone(response.data["valuation_snapshot"])

    def test_psa_analytics_only_include_approved_valuations(self):
        from analytics.services.descriptive import descriptive_summary
        self.load_reference_data()
        response = self.submit_output("Cattle", "MILK", "LITERS", "2")
        record_id = response.data["id"]
        summary = descriptive_summary(date(2026, 1, 31))["descriptive"]["production"]["valuation"]
        self.assertIsNone(summary["estimated_value"])
        self.client.force_authenticate(user=self.sibat_user)
        self.assertEqual(self.client.post(f"/production/records/{record_id}/review/", {"status": "VERIFIED"}).status_code, 200)
        self.client.force_authenticate(user=self.mao_user)
        self.assertEqual(self.client.post(f"/production/records/{record_id}/review/", {"status": "APPROVED"}).status_code, 200)
        summary = descriptive_summary(date(2026, 1, 31))["descriptive"]["production"]["valuation"]
        self.assertEqual(summary["estimated_value"], 94.1)
        self.assertEqual(summary["valued_records"], 1)
        self.assertEqual(summary["by_species"][0]["species"], "Cattle")
        self.assertEqual(summary["by_barangay"][0]["value"], 94.1)
        self.assertEqual(summary["by_month"][0]["month"], "2026-01-01")

    def test_psa_fallback_uses_latest_earlier_period_and_preserves_snapshot(self):
        from decimal import Decimal
        from .models import PSAReferencePrice
        self.load_reference_data()
        response = self.submit_output("Cattle", "MILK", "LITERS", "15", "2026-09-29")
        self.assertEqual(response.status_code, 201)
        initial = response.data["valuation_snapshot"]
        self.assertEqual(initial["estimated_value"], "705.75")
        self.assertEqual(initial["price_match"], "PREVIOUS_PERIOD")
        self.assertEqual(initial["reference_period"], "January-March 2026")
        record_id = response.data["id"]
        reference = PSAReferencePrice.objects.get(commodity_id="PSA_DAIRY_CATTLE")
        reference.pk = None
        reference.period_start = date(2026, 4, 1)
        reference.period_end = date(2026, 6, 30)
        reference.reference_period = "Q2 test fixture"
        reference.price = Decimal("50")
        reference.save()
        response = self.submit_output("Cattle", "MILK", "LITERS", "15", "2026-09-29")
        self.assertEqual(response.data["valuation_snapshot"]["estimated_value"], "750.00")
        self.assertEqual(response.data["valuation_snapshot"]["reference_period"], "Q2 test fixture")
        reference.pk = None
        reference.period_start = date(2026, 10, 1)
        reference.period_end = date(2026, 12, 31)
        reference.reference_period = "Q4 test fixture"
        reference.price = Decimal("80")
        reference.save()
        response = self.submit_output("Cattle", "MILK", "LITERS", "15", "2026-09-29")
        self.assertEqual(response.data["valuation_snapshot"]["reference_period"], "Q2 test fixture")
        response = self.client.patch(f"/production/records/{record_id}/", {"notes": "A note"}, format="json")
        self.assertEqual(response.data["valuation_snapshot"], initial)
        response = self.submit_output("Cattle", "MILK", "LITERS", "15", "2026-02-01")
        self.assertEqual(response.data["valuation_snapshot"]["price_match"], "EXACT_PERIOD")
        self.assertEqual(response.data["valuation_snapshot"]["estimated_value"], "705.75")

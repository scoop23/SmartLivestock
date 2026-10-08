from django.db import IntegrityError, transaction
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
        self.sibat_user.assigned_barangay = barangay
        self.sibat_user.save(update_fields=["assigned_barangay"])
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

    def test_approved_calving_creates_one_offspring_with_birth_date(self):
        from livestock.reconciliation import reconcile_approved_calving
        calving_date = date(2026, 5, 17)
        calving = CalvingRecord.objects.create(
            dam=self.animal, calf_tag="CALF-BIRTH-001", calf_sex="FEMALE",
            calving_date=calving_date, status=CalvingRecord.StatusType.APPROVED,
            created_by=self.farmer_user, reviewed_by=self.mao_user,
        )
        reconcile_approved_calving(calving)
        reconcile_approved_calving(calving)
        calving.refresh_from_db()
        self.assertIsNotNone(calving.offspring_inventory)
        self.assertEqual(calving.offspring_inventory.birth_date, calving_date)
        self.assertEqual(LivestockInventory.objects.filter(tag_number="CALF-BIRTH-001").count(), 1)

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
            "batch": herd.pk, "selected_animals": [animal.pk], "production_type": "MEAT", "unit": "KILOGRAMS",
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

    def test_meat_requires_approved_active_positive_inventory(self):
        animal = self.swine_animal()
        self.client.force_authenticate(user=self.farmer_user)
        payload = {"livestock": animal.pk, "production_type": "MEAT", "unit": "KILOGRAMS",
                   "quantity": "12.5", "record_date": "2026-01-15"}
        response = self.client.post("/production/records/", payload)
        self.assertEqual(response.status_code, 201, response.data)
        self.assertIsNone(response.data["valuation_snapshot"])
        for state in ("PENDING", "VERIFIED", "SUBJECT_TO_REVISION", "REJECTED"):
            with self.subTest(state=state):
                animal.status = state
                animal.save(update_fields=["status"])
                self.assertEqual(self.client.post("/production/records/", payload).status_code, 400)
        animal.status = "APPROVED"
        for state in ("SOLD", "DECEASED", "SLAUGHTERED", "MOVED_OUT", "INACTIVE"):
            with self.subTest(operational_status=state):
                animal.operational_status = state
                animal.save(update_fields=["status", "operational_status"])
                response = self.client.post("/production/records/", payload)
                self.assertEqual(response.status_code, 400)
                self.assertIn("active", str(response.data))
        animal.operational_status = "ACTIVE"
        animal.entry_type = "BATCH"  # Legacy aggregate rows remain distinct from individual animals.
        animal.quantity = 0
        animal.save(update_fields=["entry_type", "operational_status", "quantity"])
        self.assertEqual(self.client.post("/production/records/", payload).status_code, 400)

    def test_inventory_encoder_cannot_submit_other_farmers_meat(self):
        other_user = User.objects.create_user(username="other-meat-owner", role=self.farmer_role, password=None)
        other_farmer = Farmer.objects.create(user=other_user, barangay=self.farmer.barangay, address="Elsewhere")
        animal = self.swine_animal()
        animal.farmer = other_farmer
        animal.save(update_fields=["farmer"])
        self.client.force_authenticate(user=self.farmer_user)
        payload = {"livestock": animal.pk, "production_type": "MEAT", "unit": "KILOGRAMS",
                   "quantity": "5", "record_date": "2026-01-15"}
        self.assertEqual(self.client.post("/production/records/", payload).status_code, 400)
        herd = LivestockBatch.objects.create(farmer=other_farmer, livestock_type=animal.livestock_type,
            batch_name="Other owner's herd", batch_code="OTHER-MEAT", created_by=self.farmer_user)
        animal.batch = herd
        animal.save(update_fields=["batch"])
        payload.pop("livestock")
        payload["batch"] = herd.pk
        self.assertEqual(self.client.post("/production/records/", payload).status_code, 400)

    def test_meat_herd_requires_available_active_heads(self):
        animal = self.swine_animal()
        herd = LivestockBatch.objects.create(farmer=self.farmer, livestock_type=animal.livestock_type,
            batch_name="Meat herd", batch_code="MEAT-HERD", created_by=self.farmer_user)
        animal.batch = herd
        animal.save(update_fields=["batch"])
        self.client.force_authenticate(user=self.farmer_user)
        payload = {"batch": herd.pk, "selected_animals": [animal.pk], "production_type": "MEAT", "unit": "KILOGRAMS",
                   "quantity": "5", "record_date": "2026-01-15"}
        response = self.client.post("/production/records/", payload)
        self.assertEqual(response.status_code, 201, response.data)
        record_id = response.data["id"]
        animal.operational_status = "DECEASED"
        animal.save(update_fields=["operational_status"])
        self.assertEqual(self.client.post("/production/records/", payload).status_code, 400)
        self.assertEqual(self.client.patch(f"/production/records/{record_id}/", {"quantity": "6"}).status_code, 400)
        animal.operational_status = "ACTIVE"
        animal.entry_type = "BATCH"  # Legacy aggregate rows remain distinct from individual animals.
        animal.quantity = 0
        with self.assertRaises(IntegrityError), transaction.atomic():
            animal.save(update_fields=["entry_type", "operational_status", "quantity"])

    def test_meat_edit_revalidates_omitted_inventory_source(self):
        animal = self.swine_animal()
        self.client.force_authenticate(user=self.farmer_user)
        response = self.client.post("/production/records/", {"livestock": animal.pk, "production_type": "MEAT",
            "unit": "KILOGRAMS", "quantity": "5", "record_date": "2026-01-15"})
        self.assertEqual(response.status_code, 201)
        animal.operational_status = "SLAUGHTERED"
        animal.save(update_fields=["operational_status"])
        response = self.client.patch(f"/production/records/{response.data['id']}/", {"quantity": "6"})
        self.assertEqual(response.status_code, 400)
        self.assertIn("livestock", response.data)

    def test_meat_and_mortality_remain_separate_through_review_and_analytics(self):
        from diseases.models import MortalityRecord
        from analytics.services.descriptive import descriptive_summary
        from .models import SlaughterRecord
        animal = self.swine_animal()
        self.client.force_authenticate(user=self.farmer_user)
        response = self.client.post("/production/records/", {"livestock": animal.pk, "production_type": "MEAT",
            "unit": "KILOGRAMS", "quantity": "12.5", "record_date": "2026-01-15"})
        self.assertEqual(response.status_code, 201)
        record_id = response.data["id"]
        self.client.force_authenticate(user=self.sibat_user)
        self.assertEqual(self.client.post(f"/production/records/{record_id}/review/", {"status": "VERIFIED"}).status_code, 200)
        self.client.force_authenticate(user=self.mao_user)
        self.assertEqual(self.client.post(f"/production/records/{record_id}/review/", {"status": "APPROVED"}).status_code, 200)
        animal.refresh_from_db()
        self.assertEqual(animal.operational_status, "SLAUGHTERED")
        self.assertEqual(animal.quantity, 1)
        self.assertEqual(MortalityRecord.objects.count(), 0)
        self.assertEqual(SlaughterRecord.objects.count(), 1)
        record_count = ProductionRecord.objects.count()
        animal = self.swine_animal()
        self.client.force_authenticate(user=self.farmer_user)
        response = self.client.post("/diseases/mortality/", {"livestock": animal.pk, "death_count": 1,
            "cause": "Accident", "record_date": "2026-01-16"})
        self.assertEqual(response.status_code, 201, response.data)
        mortality_id = response.data["id"]
        for user, state in ((self.sibat_user, "VERIFIED"), (self.mao_user, "APPROVED")):
            self.client.force_authenticate(user=user)
            response = self.client.post(f"/diseases/mortality/{mortality_id}/review/", {"status": state})
            self.assertEqual(response.status_code, 200, response.data)
        animal.refresh_from_db()
        self.assertEqual(animal.operational_status, "DECEASED")
        self.assertEqual(ProductionRecord.objects.count(), record_count)
        self.assertEqual(SlaughterRecord.objects.count(), 1)
        summary = descriptive_summary(date(2026, 1, 31))["descriptive"]
        meat = next(row for row in summary["production"]["by_type"] if row["type"] == "MEAT")
        self.assertEqual(meat["quantity"], 12.5)
        self.assertEqual(summary["mortality"]["deaths"], 1)
        self.assertIsNone(summary["production"]["valuation"]["estimated_value"])

    def slaughter_herd(self, count=10):
        animal = self.swine_animal()
        herd = LivestockBatch.objects.create(farmer=self.farmer, livestock_type=animal.livestock_type,
            batch_name="Slaughter selection", batch_code="SELECT-SLAUGHTER", created_by=self.farmer_user)
        animals = [animal]
        animal.batch = herd
        animal.save(update_fields=["batch"])
        for index in range(1, count):
            animals.append(LivestockInventory.objects.create(farmer=self.farmer, livestock_type=animal.livestock_type,
                batch=herd, quantity=1, tag_number=f"TEST-PIG-{index}", status="APPROVED", created_by=self.farmer_user))
        return herd, animals

    def submit_slaughter(self, herd, animals, weight="210"):
        self.client.force_authenticate(user=self.farmer_user)
        return self.client.post("/production/records/", {"batch": herd.pk, "selected_animals": [a.pk for a in animals],
            "production_type": "MEAT", "unit": "KILOGRAMS", "quantity": weight, "record_date": "2026-01-15"}, format="json")

    def test_partial_slaughter_changes_only_selected_animals_after_mao_approval(self):
        from .models import SlaughterRecord
        from diseases.models import MortalityRecord
        from analytics.services.descriptive import descriptive_summary
        from .services.slaughter import reconcile_approved_slaughter
        herd, animals = self.slaughter_herd()
        response = self.submit_slaughter(herd, animals[:3])
        self.assertEqual(response.status_code, 201, response.data)
        record = ProductionRecord.objects.get(pk=response.data["id"])
        slaughter = record.slaughter
        self.assertEqual(slaughter.quantity, 3)
        self.assertEqual(float(slaughter.carcass_weight), 210)
        self.assertEqual(herd.animals.filter(operational_status="ACTIVE").count(), 10)
        self.assertTrue(Notification.objects.filter(user=self.sibat_user, title="New Production Entry Awaiting Verification", link="/sibat?tab=production").exists())
        self.client.force_authenticate(user=self.mao_user)
        self.assertEqual(self.client.post(f"/production/records/{record.pk}/review/", {"status": "APPROVED"}).status_code, 400)
        self.client.force_authenticate(user=self.sibat_user)
        self.assertEqual(self.client.post(f"/production/records/{record.pk}/review/", {"status": "VERIFIED"}).status_code, 200)
        self.assertEqual(herd.animals.filter(operational_status="ACTIVE").count(), 10)
        self.assertTrue(Notification.objects.filter(user=self.mao_user, title="Production Record Awaiting MAO Approval").exists())
        self.client.force_authenticate(user=self.mao_user)
        response = self.client.post(f"/production/records/{record.pk}/review/", {"status": "APPROVED"})
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(herd.animals.filter(operational_status="SLAUGHTERED").count(), 3)
        self.assertEqual(herd.animals.filter(operational_status="ACTIVE").count(), 7)
        herd.refresh_from_db()
        self.assertEqual(herd.status, "ACTIVE")
        self.assertEqual(MortalityRecord.objects.count(), 0)
        self.assertEqual(SlaughterRecord.objects.count(), 1)
        self.assertEqual(slaughter.selected_animals.count(), 3)
        reconcile_approved_slaughter(slaughter)
        self.assertEqual(herd.animals.count(), 10)
        summary = descriptive_summary(date(2026, 1, 31))["descriptive"]
        meat = next(row for row in summary["production"]["by_type"] if row["type"] == "MEAT")
        self.assertEqual(meat["quantity"], 210)
        self.assertEqual(meat["records"], 1)
        self.assertEqual(summary["mortality"]["deaths"], 0)
        self.assertTrue(Notification.objects.filter(user=self.farmer_user, title="Production Record Approved by MAO").exists())

    def test_slaughter_revision_resubmits_without_changing_inventory(self):
        herd, animals = self.slaughter_herd(3)
        response = self.submit_slaughter(herd, animals[:2])
        record_id = response.data["id"]
        for user, state, remarks in ((self.sibat_user, "VERIFIED", "Checked"), (self.mao_user, "SUBJECT_TO_REVISION", "Correct animal selection")):
            self.client.force_authenticate(user=user)
            response = self.client.post(f"/production/records/{record_id}/review/", {"status": state, "remarks": remarks})
            self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(herd.animals.filter(operational_status="ACTIVE").count(), 3)
        self.client.force_authenticate(user=self.farmer_user)
        response = self.client.patch(f"/production/records/{record_id}/", {"selected_animals": [a.pk for a in animals], "quantity": "300"}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        record = ProductionRecord.objects.get(pk=record_id)
        self.assertEqual(record.status, "PENDING")
        self.assertEqual(record.slaughter.status, "PENDING")
        self.assertEqual(record.slaughter.quantity, 3)
        self.assertEqual(herd.animals.filter(operational_status="ACTIVE").count(), 3)
        self.assertTrue(Notification.objects.filter(user=self.farmer_user, title="Revision Required on Production Record").exists())
        for user, state in ((self.sibat_user, "VERIFIED"), (self.mao_user, "APPROVED")):
            self.client.force_authenticate(user=user)
            response = self.client.post(f"/production/records/{record_id}/review/", {"status": state})
            self.assertEqual(response.status_code, 200, response.data)
        herd.refresh_from_db()
        self.assertEqual(herd.status, "HARVESTED")
        self.assertEqual(herd.animals.filter(operational_status="SLAUGHTERED").count(), 3)

    def test_slaughter_rejects_invalid_or_ambiguous_animal_selection(self):
        herd, animals = self.slaughter_herd(3)
        self.client.force_authenticate(user=self.farmer_user)
        base = {"batch": herd.pk, "production_type": "MEAT", "unit": "KILOGRAMS", "quantity": "100", "record_date": "2026-01-15"}
        for ids in ([], [animals[0].pk]*2, [a.pk for a in animals]+[999999,999998]):
            response = self.client.post("/production/records/", dict(base, selected_animals=ids), format="json")
            self.assertEqual(response.status_code, 400, response.data)
        for state in ("DECEASED", "SOLD", "SLAUGHTERED", "MOVED_OUT"):
            animals[0].operational_status = state
            animals[0].save(update_fields=["operational_status"])
            self.assertEqual(self.submit_slaughter(herd, animals[:1]).status_code, 400)
        animals[0].operational_status = "ACTIVE"
        animals[0].status = "PENDING"
        animals[0].save(update_fields=["operational_status", "status"])
        self.assertEqual(self.submit_slaughter(herd, animals[:1]).status_code, 400)
        animals[0].status = "APPROVED"
        # A multi-head herd child is rejected at storage time, before slaughter selection.
        animals[0].entry_type = "BATCH"
        animals[0].quantity = 3
        with self.assertRaises(IntegrityError), transaction.atomic():
            animals[0].save(update_fields=["entry_type", "status", "quantity"])

    def test_approval_rolls_back_if_selected_animal_is_no_longer_available(self):
        herd, animals = self.slaughter_herd(2)
        response = self.submit_slaughter(herd, animals)
        record_id = response.data["id"]
        self.client.force_authenticate(user=self.sibat_user)
        self.assertEqual(self.client.post(f"/production/records/{record_id}/review/", {"status": "VERIFIED"}).status_code, 200)
        animals[0].operational_status = "SOLD"
        animals[0].save(update_fields=["operational_status"])
        self.client.force_authenticate(user=self.mao_user)
        response = self.client.post(f"/production/records/{record_id}/review/", {"status": "APPROVED"})
        self.assertEqual(response.status_code, 400)
        record = ProductionRecord.objects.get(pk=record_id)
        self.assertEqual(record.status, "VERIFIED")
        self.assertEqual(record.slaughter.status, "VERIFIED")
        animals[1].refresh_from_db()
        self.assertEqual(animals[1].operational_status, "ACTIVE")

    def test_deleting_pending_slaughter_removes_projection_and_selection_only(self):
        from .models import SlaughterRecord
        herd, animals = self.slaughter_herd(2)
        response = self.submit_slaughter(herd, animals)
        self.assertEqual(self.client.delete(f"/production/records/{response.data['id']}/").status_code, 204)
        self.assertEqual(SlaughterRecord.objects.count(), 0)
        self.assertEqual(herd.animals.filter(operational_status="ACTIVE").count(), 2)

    def test_slaughter_selection_rejects_other_owners_and_other_herds(self):
        herd, animals = self.slaughter_herd(2)
        outsider = self.swine_animal()
        response = self.submit_slaughter(herd, [animals[0], outsider])
        self.assertEqual(response.status_code, 400)
        other_user = User.objects.create_user(username="slaughter-other-owner", role=self.farmer_role, password=None)
        other_farmer = Farmer.objects.create(user=other_user, barangay=self.farmer.barangay, address="Other farm")
        outsider.farmer = other_farmer
        outsider.save(update_fields=["farmer"])
        response = self.submit_slaughter(herd, [animals[0], outsider])
        self.assertEqual(response.status_code, 400)
        self.assertIn("selected_animals", response.data)

    def test_sibat_return_and_invalid_slaughter_measurements_do_not_change_inventory(self):
        herd, animals = self.slaughter_herd(2)
        self.assertEqual(self.submit_slaughter(herd, animals, "0").status_code, 400)
        self.assertEqual(self.submit_slaughter(herd, animals, "-1").status_code, 400)
        self.client.force_authenticate(user=self.farmer_user)
        response = self.client.post("/production/records/", {"batch": herd.pk, "selected_animals": [a.pk for a in animals],
            "production_type": "MEAT", "unit": "KILOGRAMS", "quantity": "100", "record_date": "2099-01-01"}, format="json")
        self.assertEqual(response.status_code, 400)
        response = self.submit_slaughter(herd, animals)
        record_id = response.data["id"]
        self.client.force_authenticate(user=self.sibat_user)
        response = self.client.post(f"/production/records/{record_id}/review/", {"status": "SUBJECT_TO_REVISION", "remarks": "Check weight"})
        self.assertEqual(response.status_code, 200)
        record = ProductionRecord.objects.get(pk=record_id)
        self.assertEqual(record.slaughter.status, "SUBJECT_TO_REVISION")
        self.assertIsNone(record.slaughter.inventory_reconciled_at)
        self.assertEqual(herd.animals.filter(operational_status="ACTIVE").count(), 2)

    def test_slaughter_weight_is_authoritative_and_animal_history_is_protected(self):
        from django.db.models.deletion import ProtectedError
        from analytics.services.descriptive import descriptive_summary
        herd, animals = self.slaughter_herd(2)
        response = self.submit_slaughter(herd, animals)
        record_id = response.data["id"]
        for user, state in ((self.sibat_user, "VERIFIED"), (self.mao_user, "APPROVED")):
            self.client.force_authenticate(user=user)
            self.assertEqual(self.client.post(f"/production/records/{record_id}/review/", {"status": state}).status_code, 200)
        # Even if a projection drifts, aggregation uses the authoritative event weight once.
        ProductionRecord.objects.filter(pk=record_id).update(quantity=999)
        summary = descriptive_summary(date(2026, 1, 31))["descriptive"]
        meat = next(row for row in summary["production"]["by_type"] if row["type"] == "MEAT")
        self.assertEqual(meat["quantity"], 210)
        with self.assertRaises(ProtectedError):
            animals[1].delete()

    def test_farmer_own_production_records_include_pending_while_analytics_excludes_unapproved(self):
        from analytics.services.descriptive import descriptive_summary

        other_farmer_user = User.objects.create_user(
            username="other-farmer-test", email="other-farmer-test@example.com",
            password=None, role=self.farmer_role,
            account_status=User.AccountStatus.APPROVED,
        )
        other_farmer = Farmer.objects.create(
            user=other_farmer_user, barangay=self.farmer.barangay, address="Purok 2",
        )
        other_animal = LivestockInventory.objects.create(
            farmer=other_farmer, livestock_type=self.cattle, quantity=1,
            created_by=other_farmer_user,
            status=LivestockInventory.StatusType.APPROVED,
        )

        # Farmer A creates an approved record (quantity 25) and a pending record (quantity 15)
        self.record.status = ProductionRecord.ProductionStatus.APPROVED
        self.record.quantity = 25
        self.record.record_date = date(2026, 1, 10)
        self.record.save(update_fields=["status", "quantity", "record_date"])

        pending_record = ProductionRecord.objects.create(
            livestock=self.animal,
            production_type=ProductionRecord.ProductionType.MILK,
            quantity=15,
            unit=ProductionRecord.UnitType.LITERS,
            record_date=date(2026, 1, 15),
            status=ProductionRecord.ProductionStatus.PENDING,
            created_by=self.farmer_user,
        )

        # Farmer B creates a pending record (quantity 50)
        other_record = ProductionRecord.objects.create(
            livestock=other_animal,
            production_type=ProductionRecord.ProductionType.MILK,
            quantity=50,
            unit=ProductionRecord.UnitType.LITERS,
            record_date=date(2026, 1, 20),
            status=ProductionRecord.ProductionStatus.PENDING,
            created_by=other_farmer_user,
        )

        # 1. Farmer A retrieves their production records
        self.client.force_authenticate(user=self.farmer_user)
        response = self.client.get("/production/records/")
        self.assertEqual(response.status_code, 200)
        record_ids = [r["id"] for r in response.data]
        self.assertIn(self.record.id, record_ids)
        self.assertIn(pending_record.id, record_ids)
        self.assertNotIn(other_record.id, record_ids)

        # 2. Farmer B retrieves their production records
        self.client.force_authenticate(user=other_farmer_user)
        response_b = self.client.get("/production/records/")
        self.assertEqual(response_b.status_code, 200)
        record_ids_b = [r["id"] for r in response_b.data]
        self.assertIn(other_record.id, record_ids_b)
        self.assertNotIn(self.record.id, record_ids_b)
        self.assertNotIn(pending_record.id, record_ids_b)

        # 3. Descriptive municipal analytics only aggregates APPROVED records (25 L)
        summary = descriptive_summary(date(2026, 1, 31))["descriptive"]
        milk_stats = [row for row in summary["production"]["by_type"] if row["type"] == "MILK"]
        self.assertEqual(len(milk_stats), 1)
        self.assertEqual(milk_stats[0]["quantity"], 25.0)

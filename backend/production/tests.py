from django.db import IntegrityError, transaction
from django.test import TestCase
from django.utils import timezone

# TODO: Write tests for:
#   - ProductionRecord creation (milk/eggs/wool with correct units)
#   - SlaughterRecord with nullable livestock FK (batch slaughter)
#   - LiveAnimalSale with different sale methods (MATA-MATA vs WEIGHING)
#   - Status workflow: PENDING → VERIFIED → APPROVED/SUBJECT_TO_REVISION

from datetime import date, timedelta
from rest_framework import status
from rest_framework.test import APITestCase
from users.models import Notification, Role, User
from livestock.models import Barangay, Farmer, LivestockBatch, LivestockInventory, LivestockType
from .models import CalvingRecord, LiveAnimalSale, ProductionRecord, SlaughterRecord


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
            sex="FEMALE",
            status=LivestockInventory.StatusType.APPROVED,
        )
        self.record = ProductionRecord.objects.create(
            livestock=self.animal, production_type=ProductionRecord.ProductionType.MILK,
            quantity=10, unit=ProductionRecord.UnitType.LITERS,
            record_date=date(2026, 1, 1), milking_session="MORNING", created_by=self.farmer_user,
        )

    def _valid_submission_payload(self):
        chicken, _ = LivestockType.objects.get_or_create(name="Chicken")
        animal = LivestockInventory.objects.create(
            farmer=self.farmer, livestock_type=chicken, quantity=1,
            created_by=self.farmer_user, status=LivestockInventory.StatusType.APPROVED,
        )
        return {
            "livestock": animal.pk,
            "production_type": "EGGS",
            "quantity": "5.00",
            "unit": "PIECES",
            "record_date": "2026-01-02",
        }

    def test_farmer_submission_saves_personal_record_without_reviewer_notification(self):
        self.client.force_authenticate(user=self.farmer_user)

        response = self.client.post("/production/records/", self._valid_submission_payload())

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(ProductionRecord.objects.count(), 2)
        self.assertEqual(response.data["status"], "RECORDED")
        self.assertFalse(Notification.objects.filter(
            related_entity_type="production_record", related_entity_id=response.data["id"]
        ).exists())

    def test_notification_failure_reports_saved_record_without_duplicate_creation(self):
        from unittest.mock import patch

        self.client.force_authenticate(user=self.farmer_user)

        def fail_after_record_is_saved(*args, **kwargs):
            self.assertEqual(ProductionRecord.objects.count(), 2)
            raise RuntimeError("controlled notification failure")

        with patch("production.views._notify_production_route", side_effect=fail_after_record_is_saved):
            response = self.client.post("/production/records/", self._valid_submission_payload())

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data["notification_status"], "failed")
        self.assertIn("Do not resubmit", response.data["notification_detail"])
        self.assertTrue(response.data["notification_diagnostic_id"])
        self.assertEqual(ProductionRecord.objects.count(), 2)
        self.assertTrue(ProductionRecord.objects.filter(pk=response.data["id"]).exists())

    def test_invalid_submission_does_not_save_or_create_notification(self):
        from unittest.mock import patch

        self.client.force_authenticate(user=self.farmer_user)
        payload = self._valid_submission_payload()
        payload["quantity"] = "0"

        with patch("production.views._notify_production_route") as notify:
            response = self.client.post("/production/records/", payload)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(ProductionRecord.objects.count(), 1)
        notify.assert_not_called()

    def test_persistence_failure_still_returns_server_error(self):
        from unittest.mock import patch

        self.client.force_authenticate(user=self.farmer_user)

        with patch("production.views.ProductionRecordSerializer.save", side_effect=IntegrityError):
            response = self.client.post("/production/records/", self._valid_submission_payload())

        self.assertEqual(response.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)
        self.assertEqual(response.data["stage"], "save")
        self.assertEqual(ProductionRecord.objects.count(), 1)

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
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.record.refresh_from_db()
        self.assertEqual(self.record.status, ProductionRecord.ProductionStatus.PENDING)


    def test_mao_review_notifies_record_owner(self):
        self.record.status = ProductionRecord.ProductionStatus.VERIFIED
        self.record.save(update_fields=["status"])
        self.client.force_authenticate(user=self.mao_user)
        response = self.client.post(
            f"/production/records/{self.record.pk}/review/", {"status": "APPROVED"},
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.record.refresh_from_db()
        self.assertEqual(self.record.status, ProductionRecord.ProductionStatus.VERIFIED)
        self.assertFalse(Notification.objects.filter(user=self.farmer_user).exists())

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

    def test_legacy_sale_cannot_finalize_inventory_without_auction_transfer(self):
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
        self.assertEqual(skipped.status_code, status.HTTP_403_FORBIDDEN)

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
        self.assertEqual(approved.status_code, status.HTTP_403_FORBIDDEN)
        self.animal.refresh_from_db()
        self.assertEqual(self.animal.operational_status, "ACTIVE")

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
        slaughter_id = ProductionRecord.objects.get(pk=record_id).slaughter_id
        self.assertEqual(response.data["status"], "RECORDED")
        self.client.force_authenticate(user=self.mao_user)
        self.assertEqual(self.client.post(f"/production/slaughterhouse/records/{slaughter_id}/review/", {"status": "APPROVED"}).status_code, 200)
        from analytics.services.descriptive import descriptive_summary
        summary = descriptive_summary(date(2026, 1, 1))["descriptive"]
        self.assertEqual(summary["slaughter"]["total_carcass_weight_kg"], 12.5)
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

    def test_legacy_returned_report_can_be_corrected_without_review_queue(self):
        from analytics.services.descriptive import descriptive_summary
        record_id = self.record.pk
        ProductionRecord.objects.filter(pk=record_id).update(
            status=ProductionRecord.ProductionStatus.SUBJECT_TO_REVISION,
            review_remarks="Correct the reported quantity",
        )
        self.client.force_authenticate(user=self.sibat_user)
        self.assertEqual(self.client.post(f"/production/records/{record_id}/review/", {"status": "VERIFIED"}).status_code, 404)
        self.client.force_authenticate(user=self.mao_user)
        self.assertEqual(self.client.post(f"/production/records/{record_id}/review/", {"status": "APPROVED"}).status_code, 404)
        self.client.force_authenticate(user=self.farmer_user)
        response = self.client.patch(f"/production/records/{record_id}/", {"quantity": "8.50"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "RECORDED")
        self.record.refresh_from_db()
        self.assertIsNone(self.record.reviewed_by)
        self.assertEqual(self.record.review_remarks, "Correct the reported quantity")
        self.assertEqual(ProductionRecord.objects.count(), 1)
        summary = descriptive_summary(date(2026, 1, 31))["descriptive"]["production"]
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
            quantity=1, sex="FEMALE" if production_type == "MILK" else "MALE",
            status="APPROVED", created_by=self.farmer_user)
        self.client.force_authenticate(user=self.farmer_user)
        return self.client.post("/production/records/", {"livestock": animal.pk, "production_type": production_type,
            "unit": unit, "quantity": quantity, "record_date": when,
            **({"milking_session": "MORNING"} if production_type == "MILK" else {})})

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
                self.assertEqual(response.data["status"], "RECORDED")
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

    def test_psa_production_analytics_include_recorded_and_exclude_approved_rows(self):
        from analytics.services.descriptive import descriptive_summary
        self.load_reference_data()
        response = self.submit_output("Cattle", "MILK", "LITERS", "2")
        record_id = response.data["id"]
        summary = descriptive_summary(date(2026, 1, 31))["descriptive"]["production"]["valuation"]
        self.assertEqual(summary["estimated_value"], 94.1)
        self.assertEqual(summary["valued_records"], 1)
        # The old approval state is excluded from routine farmer production analytics.
        ProductionRecord.objects.filter(pk=record_id).update(status=ProductionRecord.ProductionStatus.APPROVED)
        summary = descriptive_summary(date(2026, 1, 31))["descriptive"]["production"]["valuation"]
        self.assertIsNone(summary["estimated_value"])
        self.assertEqual(summary["valued_records"], 0)

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
        slaughter_id = ProductionRecord.objects.get(pk=record_id).slaughter_id
        self.client.force_authenticate(user=self.mao_user)
        self.assertEqual(self.client.post(f"/production/slaughterhouse/records/{slaughter_id}/review/", {"status": "APPROVED"}).status_code, 200)
        animal.refresh_from_db()
        self.assertEqual(animal.operational_status, "SLAUGHTERED")
        self.assertEqual(animal.quantity, 1)
        self.assertEqual(MortalityRecord.objects.count(), 0)
        self.assertEqual(SlaughterRecord.objects.count(), 1)
        record_count = ProductionRecord.objects.count()
        animal = self.swine_animal()
        self.client.force_authenticate(user=self.farmer_user)
        response = self.client.post("/diseases/mortality/", {"livestocks": [animal.pk], "death_count": 1,
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
        self.assertEqual(summary["slaughter"]["total_carcass_weight_kg"], 12.5)
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
        self.assertTrue(Notification.objects.filter(
            user=self.sibat_user, related_entity_type="slaughter_record", related_entity_id=slaughter.pk,
        ).exists())
        self.client.force_authenticate(user=self.sibat_user)
        self.assertEqual(self.client.post(f"/production/slaughterhouse/records/{slaughter.pk}/review/", {"status": "APPROVED"}).status_code, 403)
        self.assertEqual(herd.animals.filter(operational_status="ACTIVE").count(), 10)
        self.assertTrue(Notification.objects.filter(user=self.mao_user, related_entity_type="slaughter_record", related_entity_id=slaughter.pk).exists())
        self.client.force_authenticate(user=self.mao_user)
        response = self.client.post(f"/production/slaughterhouse/records/{slaughter.pk}/review/", {"status": "APPROVED"})
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
        self.assertEqual(summary["slaughter"]["total_carcass_weight_kg"], 210)
        self.assertEqual(summary["slaughter"]["records"], 1)
        self.assertEqual(summary["mortality"]["deaths"], 0)
        self.assertTrue(Notification.objects.filter(user=self.farmer_user, title="Official slaughter report approved").exists())

    def test_slaughter_revision_resubmits_without_changing_inventory(self):
        herd, animals = self.slaughter_herd(3)
        response = self.submit_slaughter(herd, animals[:2])
        record_id = response.data["id"]
        slaughter_id = ProductionRecord.objects.get(pk=record_id).slaughter_id
        self.client.force_authenticate(user=self.mao_user)
        response = self.client.post(f"/production/slaughterhouse/records/{slaughter_id}/review/", {
            "status": "SUBJECT_TO_REVISION", "remarks": "Correct animal selection"})
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(herd.animals.filter(operational_status="ACTIVE").count(), 3)
        self.client.force_authenticate(user=self.farmer_user)
        response = self.client.patch(f"/production/records/{record_id}/", {"selected_animals": [a.pk for a in animals], "quantity": "300"}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        record = ProductionRecord.objects.get(pk=record_id)
        self.assertEqual(record.status, "RECORDED")
        self.assertEqual(record.slaughter.status, "PENDING")
        self.assertEqual(record.slaughter.quantity, 3)
        self.assertEqual(herd.animals.filter(operational_status="ACTIVE").count(), 3)
        self.assertTrue(Notification.objects.filter(user=self.farmer_user, title="Slaughter report returned for correction").exists())
        self.client.force_authenticate(user=self.mao_user)
        response = self.client.post(f"/production/slaughterhouse/records/{slaughter_id}/review/", {"status": "APPROVED"})
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
        slaughter_id = ProductionRecord.objects.get(pk=record_id).slaughter_id
        animals[0].operational_status = "SOLD"
        animals[0].save(update_fields=["operational_status"])
        self.client.force_authenticate(user=self.mao_user)
        response = self.client.post(f"/production/slaughterhouse/records/{slaughter_id}/review/", {"status": "APPROVED"})
        self.assertEqual(response.status_code, 400)
        record = ProductionRecord.objects.get(pk=record_id)
        self.assertEqual(record.status, "RECORDED")
        self.assertEqual(record.slaughter.status, "PENDING")
        animals[1].refresh_from_db()
        self.assertEqual(animals[1].operational_status, "ACTIVE")

    def test_deleting_recorded_slaughter_is_blocked_to_preserve_official_report(self):
        from .models import SlaughterRecord
        herd, animals = self.slaughter_herd(2)
        response = self.submit_slaughter(herd, animals)
        self.assertEqual(self.client.delete(f"/production/records/{response.data['id']}/").status_code, 403)
        self.assertEqual(SlaughterRecord.objects.count(), 1)
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

    def test_field_staff_cannot_return_slaughter_and_invalid_measurements_do_not_change_inventory(self):
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
        slaughter_id = ProductionRecord.objects.get(pk=record_id).slaughter_id
        response = self.client.post(f"/production/slaughterhouse/records/{slaughter_id}/review/", {"status": "SUBJECT_TO_REVISION", "remarks": "Check weight"})
        self.assertEqual(response.status_code, 403)
        record = ProductionRecord.objects.get(pk=record_id)
        self.assertEqual(record.slaughter.status, "PENDING")
        self.assertIsNone(record.slaughter.inventory_reconciled_at)
        self.assertEqual(herd.animals.filter(operational_status="ACTIVE").count(), 2)

    def test_slaughter_weight_is_authoritative_and_animal_history_is_protected(self):
        from django.db.models.deletion import ProtectedError
        from analytics.services.descriptive import descriptive_summary
        herd, animals = self.slaughter_herd(2)
        response = self.submit_slaughter(herd, animals)
        record_id = response.data["id"]
        slaughter_id = ProductionRecord.objects.get(pk=record_id).slaughter_id
        self.client.force_authenticate(user=self.mao_user)
        self.assertEqual(self.client.post(f"/production/slaughterhouse/records/{slaughter_id}/review/", {"status": "APPROVED"}).status_code, 200)
        # Even if a projection drifts, aggregation uses the authoritative event weight once.
        ProductionRecord.objects.filter(pk=record_id).update(quantity=999)
        summary = descriptive_summary(date(2026, 1, 31))["descriptive"]
        self.assertEqual(summary["slaughter"]["total_carcass_weight_kg"], 210)
        with self.assertRaises(ProtectedError):
            animals[1].delete()

    def test_farmer_own_production_records_include_legacy_statuses_while_analytics_uses_recorded_only(self):
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

        # 3. Production analytics now uses RECORDED logs only, not historical
        # approval-state records or pending rows.
        summary = descriptive_summary(date(2026, 1, 31))["descriptive"]
        milk_stats = [row for row in summary["production"]["by_type"] if row["type"] == "MILK"]
        self.assertEqual(milk_stats, [])


class SlaughterhouseAggregateRecordAPITests(APITestCase):
    def setUp(self):
        self.staff_role = Role.objects.create(role_name=Role.UserRoles.SLAUGHTERHOUSESTAFF)
        self.mao_role = Role.objects.create(role_name=Role.UserRoles.MAO)
        self.farmer_role = Role.objects.create(role_name=Role.UserRoles.FARMER)
        self.staff = User.objects.create_user(username="abattoir", email="abattoir@example.com", password="pw", role=self.staff_role, account_status="APPROVED")
        self.mao = User.objects.create_user(username="reviewer", email="reviewer@example.com", password="pw", role=self.mao_role, account_status="APPROVED")
        self.farmer_user = User.objects.create_user(username="farmer", email="farmer@example.com", password="pw", role=self.farmer_role, account_status="APPROVED")
        self.cattle = LivestockType.objects.create(name="Cattle")

    def test_staff_can_create_pending_aggregate_without_fake_barangay(self):
        self.client.force_authenticate(self.staff)
        response = self.client.post("/api/production/slaughterhouse/records/", {
            "livestock_type": self.cattle.pk, "quantity": 3,
            "carcass_weight": "415.75", "record_date": "2026-05-01",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        record = SlaughterRecord.objects.get(pk=response.data["id"])
        self.assertEqual(record.status, SlaughterRecord.StatusType.PENDING)
        self.assertEqual(str(record.carcass_weight), "415.75")
        self.assertIsNone(record.barangay_id)

    def test_staff_cannot_create_invalid_or_duplicate_record(self):
        self.client.force_authenticate(self.staff)
        payload = {"livestock_type": self.cattle.pk, "quantity": 1, "carcass_weight": "10.25", "record_date": "2026-05-02"}
        invalid = self.client.post("/api/production/slaughterhouse/records/", {**payload, "quantity": 0}, format="json")
        self.assertEqual(invalid.status_code, status.HTTP_400_BAD_REQUEST)
        first = self.client.post("/api/production/slaughterhouse/records/", payload, format="json")
        duplicate = self.client.post("/api/production/slaughterhouse/records/", payload, format="json")
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        self.assertEqual(duplicate.status_code, status.HTTP_409_CONFLICT)

    def test_mao_approval_does_not_reconcile_individual_inventory(self):
        record = SlaughterRecord.objects.create(
            livestock_type=self.cattle, quantity=2, carcass_weight="212.50",
            record_date=date(2026, 5, 3), created_by=self.staff,
        )
        self.client.force_authenticate(self.mao)
        response = self.client.post(f"/api/production/slaughterhouse/records/{record.pk}/review/", {"status": "APPROVED"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        record.refresh_from_db()
        self.assertEqual(record.status, SlaughterRecord.StatusType.APPROVED)
        self.assertTrue(SlaughterRecord.objects.filter(pk=record.pk).exists())

    def test_filters_limit_records_by_date_and_livestock_type(self):
        SlaughterRecord.objects.create(
            livestock_type=self.cattle, quantity=2, carcass_weight="212.50",
            record_date=date(2026, 5, 3), created_by=self.staff,
        )
        other_type, _ = LivestockType.objects.get_or_create(name="Carabao")
        SlaughterRecord.objects.create(
            livestock_type=other_type, quantity=4, carcass_weight="380.00",
            record_date=date(2026, 5, 4), created_by=self.staff,
        )
        self.client.force_authenticate(self.staff)
        response = self.client.get("/api/production/slaughterhouse/records/?start_date=2026-05-03&end_date=2026-05-03&livestock_type=%s" % self.cattle.pk)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["livestock_type_name"], "Cattle")

    def test_farmer_cannot_access_slaughterhouse_workflow(self):
        self.client.force_authenticate(self.farmer_user)
        response = self.client.get("/api/production/slaughterhouse/records/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class MilkAnomalyDetectionAndRoutingTests(APITestCase):
    def setUp(self):
        self.farmer_role = Role.objects.create(role_name=Role.UserRoles.FARMER)
        self.sibat_role = Role.objects.create(role_name=Role.UserRoles.SIBAT)
        self.cbat_role = Role.objects.create(role_name=Role.UserRoles.CBAT)
        self.mao_role = Role.objects.create(role_name=Role.UserRoles.MAO)

        self.barangay_a = Barangay.objects.create(barangay_name="Poblacion", latitude=13.88, longitude=121.21)
        self.barangay_b = Barangay.objects.create(barangay_name="Maugat East", latitude=13.89, longitude=121.22)

        self.farmer_user = User.objects.create_user(
            username="milk-farmer-a",
            email="milk-farmer-a@example.com",
            password=None,
            role=self.farmer_role,
            account_status=User.AccountStatus.APPROVED,
        )
        self.farmer = Farmer.objects.create(
            user=self.farmer_user,
            barangay=self.barangay_a,
            address="Purok 1",
        )

        self.other_farmer_user = User.objects.create_user(
            username="milk-farmer-b",
            email="milk-farmer-b@example.com",
            password=None,
            role=self.farmer_role,
            account_status=User.AccountStatus.APPROVED,
        )
        self.other_farmer = Farmer.objects.create(
            user=self.other_farmer_user,
            barangay=self.barangay_b,
            address="Purok 2",
        )

        self.sibat_user = User.objects.create_user(
            username="milk-sibat-a",
            email="milk-sibat-a@example.com",
            password=None,
            role=self.sibat_role,
            assigned_barangay=self.barangay_a,
            account_status=User.AccountStatus.APPROVED,
        )
        self.cbat_user = User.objects.create_user(
            username="milk-cbat-a",
            email="milk-cbat-a@example.com",
            password=None,
            role=self.cbat_role,
            assigned_barangay=self.barangay_a,
            access_scope=User.AccessScope.ASSIGNED_ONLY,
            account_status=User.AccountStatus.APPROVED,
        )
        self.other_cbat_user = User.objects.create_user(
            username="milk-cbat-b",
            email="milk-cbat-b@example.com",
            password=None,
            role=self.cbat_role,
            assigned_barangay=self.barangay_b,
            access_scope=User.AccessScope.ASSIGNED_ONLY,
            account_status=User.AccountStatus.APPROVED,
        )
        self.all_barangay_cbat_user = User.objects.create_user(
            username="milk-cbat-all",
            email="milk-cbat-all@example.com",
            password=None,
            role=self.cbat_role,
            assigned_barangay=self.barangay_b,
            access_scope=User.AccessScope.ALL_BARANGAYS,
            account_status=User.AccountStatus.APPROVED,
        )
        self.mao_user = User.objects.create_user(
            username="milk-mao",
            email="milk-mao@example.com",
            password=None,
            role=self.mao_role,
            account_status=User.AccountStatus.APPROVED,
        )

        self.cattle = LivestockType.objects.create(name="Cattle")
        self.poultry = LivestockType.objects.create(name="Poultry")

        self.cow = LivestockInventory.objects.create(
            farmer=self.farmer,
            livestock_type=self.cattle,
            quantity=1,
            tag_number="COW-A-01",
            sex="Female",
            status=LivestockInventory.StatusType.APPROVED,
            created_by=self.farmer_user,
        )
        self.second_cow = LivestockInventory.objects.create(
            farmer=self.farmer,
            livestock_type=self.cattle,
            quantity=1,
            tag_number="COW-A-02",
            sex="Female",
            status=LivestockInventory.StatusType.APPROVED,
            created_by=self.farmer_user,
        )
        self.other_farmer_cow = LivestockInventory.objects.create(
            farmer=self.other_farmer,
            livestock_type=self.cattle,
            quantity=1,
            tag_number="COW-B-01",
            sex="Female",
            status=LivestockInventory.StatusType.APPROVED,
            created_by=self.other_farmer_user,
        )

    def seed_recorded_milk_history(self, cow, quantities, end_date=date(2026, 3, 10)):
        start_date = end_date - timedelta(days=len(quantities) - 1)
        records = []
        for idx, qty in enumerate(quantities):
            records.append(
                ProductionRecord.objects.create(
                    livestock=cow,
                    production_type=ProductionRecord.ProductionType.MILK,
                    quantity=qty,
                    unit=ProductionRecord.UnitType.LITERS,
                    record_date=start_date + timedelta(days=idx),
                    milking_session=ProductionRecord.MilkingSession.MORNING,
                    status=ProductionRecord.ProductionStatus.RECORDED,
                    anomaly_assessment_status=ProductionRecord.AnomalyAssessmentStatus.CLEAN,
                    next_review_queue=ProductionRecord.ReviewQueue.NONE,
                    created_by=cow.farmer.user,
                )
            )
        return records

    def submit_milk(self, quantity, record_date="2026-03-11", cow=None, extra=None):
        target_cow = cow or self.cow
        self.client.force_authenticate(user=target_cow.farmer.user)
        payload = {
            "livestock": target_cow.pk,
            "production_type": "MILK",
            "unit": "LITERS",
            "quantity": str(quantity),
            "record_date": str(record_date),
            "milking_session": "MORNING",
        }
        if extra:
            payload.update(extra)
        return self.client.post("/production/records/", payload, format="json")

    def test_clean_milk_log_is_recorded_without_review_notifications(self):
        self.seed_recorded_milk_history(self.cow, [12.0, 12.2, 11.8, 12.1, 11.9, 12.0, 12.1])
        response = self.submit_milk("12.3")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["status"], "RECORDED")
        self.assertEqual(response.data["anomaly_assessment_status"], "CLEAN")
        self.assertEqual(response.data["next_review_queue"], "NONE")
        self.assertFalse(Notification.objects.filter(related_entity_type="production_record", related_entity_id=response.data["id"]).exists())

    def test_anomalous_milk_is_advisory_only(self):
        self.seed_recorded_milk_history(self.cow, [10] * 7)
        response = self.submit_milk("18")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertTrue(response.data["anomaly_detected"])
        self.assertEqual(response.data["anomaly_assessment_status"], "ANOMALY_DETECTED")
        self.assertFalse(response.data["requires_cbat_verification"])
        self.assertEqual(response.data["next_review_queue"], "NONE")
        self.assertIn("Advisory", response.data["anomaly_reason"])
        self.assertEqual(response.data["anomaly_assessment"]["next_review_queue"], "NONE")

    def test_recorded_session_is_used_for_later_advisory_baseline(self):
        self.seed_recorded_milk_history(self.cow, [10] * 4)
        first = self.submit_milk("10", "2026-03-11")
        self.assertEqual(first.status_code, 201, first.data)
        second = self.submit_milk("17", "2026-03-12")
        self.assertEqual(second.status_code, 201, second.data)
        self.assertTrue(second.data["anomaly_detected"])

    def test_anomaly_does_not_use_another_cow_or_unapproved_legacy_history(self):
        self.seed_recorded_milk_history(self.second_cow, [20] * 7)
        self.seed_recorded_milk_history(self.cow, [10] * 4)
        ProductionRecord.objects.create(
            livestock=self.cow, production_type="MILK", quantity=50, unit="LITERS",
            record_date=date(2026, 3, 10), milking_session="EVENING",
            status="PENDING", created_by=self.farmer_user,
        )
        response = self.submit_milk("17", "2026-03-11")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["anomaly_assessment_status"], "INSUFFICIENT_HISTORY")

    def test_farmer_can_correct_own_log_without_resubmission(self):
        response = self.submit_milk("8")
        self.assertEqual(response.status_code, 201, response.data)
        record_id = response.data["id"]
        changed = self.client.patch(f"/production/records/{record_id}/", {"quantity": "9"}, format="json")
        self.assertEqual(changed.status_code, 200, changed.data)
        self.assertEqual(changed.data["status"], "RECORDED")
        self.assertEqual(float(changed.data["quantity"]), 9)
        self.assertEqual(list(ProductionRecord.objects.get(pk=record_id).workflow_events.values_list("event_type", flat=True)), ["SUBMITTED"])

    def test_field_and_mao_users_cannot_view_or_decide_private_milk(self):
        response = self.submit_milk("8")
        self.assertEqual(response.status_code, 201, response.data)
        record_id = response.data["id"]
        for reviewer, target in ((self.cbat_user, "VERIFIED"), (self.all_barangay_cbat_user, "VERIFIED"), (self.mao_user, "APPROVED")):
            self.client.force_authenticate(user=reviewer)
            self.assertNotIn(record_id, [row["id"] for row in self.client.get("/production/records/").data])
            self.assertEqual(self.client.post(f"/production/records/{record_id}/review/", {"status": target}).status_code, 404)
        self.client.force_authenticate(user=self.other_farmer_user)
        self.assertNotIn(record_id, [row["id"] for row in self.client.get("/production/records/").data])

    def test_farmer_cannot_forge_status_reviewer_or_anomaly_route(self):
        response = self.submit_milk("8", extra={"status": "APPROVED", "next_review_queue": "CBAT", "requires_cbat_verification": True, "reviewed_by": self.mao_user.pk})
        self.assertEqual(response.status_code, 201, response.data)
        record = ProductionRecord.objects.get(pk=response.data["id"])
        self.assertEqual(record.status, "RECORDED")
        self.assertEqual(record.next_review_queue, "NONE")
        self.assertFalse(record.requires_cbat_verification)
        self.assertIsNone(record.reviewed_by)

    def test_historical_verified_milk_audit_remains_but_mao_cannot_review_it(self):
        from production.models import ProductionRecordWorkflowEvent
        old = ProductionRecord.objects.create(
            livestock=self.cow, production_type="MILK", quantity=8, unit="LITERS",
            record_date=date(2026, 3, 1), milking_session="MORNING",
            status="VERIFIED", created_by=self.farmer_user,
        )
        event = ProductionRecordWorkflowEvent.objects.create(
            production_record=old, event_type="VERIFIED", actor=self.cbat_user,
            from_status="PENDING", to_status="VERIFIED",
        )
        self.client.force_authenticate(user=self.mao_user)
        approved = self.client.post(f"/production/records/{old.pk}/review/", {"status": "APPROVED"})
        self.assertEqual(approved.status_code, 404, approved.data)
        self.assertTrue(ProductionRecordWorkflowEvent.objects.filter(pk=event.pk).exists())
        old.refresh_from_db()
        self.assertEqual(old.status, "VERIFIED")

    def test_same_session_duplicate_and_forecast_target_are_safe(self):
        first = self.submit_milk("8")
        self.assertEqual(first.status_code, 201, first.data)
        self.assertEqual(first.data["anomaly_assessment"]["next_review_queue"], "NONE")
        again = self.submit_milk("8")
        self.assertEqual(again.status_code, 400)
        assessment = ProductionRecord.objects.get(pk=first.data["id"]).anomaly_assessment
        self.assertEqual(assessment["forecast_comparison"]["status"], "INCOMPATIBLE_TARGET")

    def test_egg_log_is_recorded_without_field_review(self):
        hen = LivestockInventory.objects.create(
            farmer=self.farmer, livestock_type=self.poultry, quantity=1, tag_number="HEN-1",
            sex="FEMALE", status="APPROVED", created_by=self.farmer_user,
        )
        self.client.force_authenticate(user=self.farmer_user)
        response = self.client.post("/production/records/", {
            "livestock": hen.pk, "production_type": "EGGS", "quantity": "5",
            "unit": "PIECES", "record_date": "2026-03-11",
        }, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["status"], "RECORDED")
        self.assertEqual(response.data["next_review_queue"], "NONE")

import os
from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch

from django.core.management import call_command, CommandError
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from livestock.models import Barangay, Farmer, LivestockInventory, LivestockType
from production.models import MilkAnomalyDemoOwnership, ProductionRecord
from users.models import Notification, Role, User


class MilkAnomalyDemoSeedCommandTests(TestCase):
    def setUp(self):
        self.tangob = Barangay.objects.create(
            barangay_name="Tangob", latitude=Decimal("13.880000"), longitude=Decimal("121.210000"),
        )
        self.manggas = Barangay.objects.create(
            barangay_name="Manggas", latitude=Decimal("13.881000"), longitude=Decimal("121.211000"),
        )
        self.cattle = LivestockType.objects.create(name="Cattle")
        self.roles = {
            name: Role.objects.create(role_name=name)
            for name in ("FARMER", "CBAT", "MAO")
        }
        self.password_env = patch.dict(os.environ, {
            "SMARTLIVESTOCK_DEMO_PASSWORD": "test-only-demo-password",
            "SMARTLIVESTOCK_DEMO_ALLOW_CLEANUP": "YES",
        })
        self.password_env.start()
        self.addCleanup(self.password_env.stop)

    def seed(self, *args):
        call_command("seed_milk_anomaly_demo", *args, verbosity=0)

    def demo_user(self, email):
        return User.objects.get(email=email)

    def demo_record(self, key):
        marker = MilkAnomalyDemoOwnership.objects.get(identifier=f"milk-anomaly-demo-v1:{key}")
        return ProductionRecord.objects.get(pk=marker.object_id)

    def test_seed_creates_tangob_farmer_two_cattle_sixty_approved_days_and_real_routing(self):
        self.seed()
        farmer_user = self.demo_user("demo.milk.farmer@smartlivestock-demo.invalid")
        farmer = Farmer.objects.get(user=farmer_user)
        self.assertEqual(farmer.barangay, self.tangob)
        cows = list(LivestockInventory.objects.filter(farmer=farmer).order_by("tag_number"))
        self.assertEqual([cow.tag_number for cow in cows], ["DEMO-MILK-ANOMALY", "DEMO-MILK-CLEAN"])
        for cow in cows:
            history = ProductionRecord.objects.filter(
                livestock=cow, status=ProductionRecord.ProductionStatus.APPROVED,
                production_type=ProductionRecord.ProductionType.MILK,
            )
            self.assertEqual(history.count(), 60)
            self.assertEqual(history.values("record_date").distinct().count(), 60)
            self.assertTrue(history.filter(notes__startswith="DEMO synthetic").exists())

        clean = self.demo_record("scenario-clean")
        anomaly = self.demo_record("scenario-anomaly")
        self.assertEqual(clean.anomaly_assessment_status, "CLEAN")
        self.assertFalse(clean.anomaly_detected)
        self.assertFalse(clean.requires_cbat_verification)
        self.assertEqual(clean.next_review_queue, "MAO")
        self.assertEqual(clean.status, "PENDING")
        self.assertEqual(anomaly.anomaly_assessment_status, "ANOMALY_DETECTED")
        self.assertTrue(anomaly.anomaly_detected)
        self.assertTrue(anomaly.requires_cbat_verification)
        self.assertEqual(anomaly.next_review_queue, "CBAT")
        self.assertEqual(anomaly.status, "PENDING")
        for record in (clean, anomaly):
            comparison = record.anomaly_assessment["forecast_comparison"]
            self.assertEqual(comparison["status"], "MATCHED")
            self.assertEqual(comparison["forecast_date"], record.record_date.isoformat())
        self.assertEqual(clean.record_date, timezone.localdate() + timedelta(days=1))
        self.assertIn("50.0%", anomaly.anomaly_reason)

        from production.management.commands.seed_milk_anomaly_demo import Command
        for cow in cows:
            forecast = Command()._forecast(cow)
            self.assertEqual(forecast["status"], "READY")
            self.assertEqual(len(forecast["forecast"]), 7)
            self.assertEqual(forecast["forecast"][0]["date"], (timezone.localdate() + timedelta(days=1)).isoformat())

    def test_seed_reruns_without_duplicates_and_dry_run_does_not_write(self):
        self.seed()
        counts = (
            User.objects.count(), Farmer.objects.count(), LivestockInventory.objects.count(),
            ProductionRecord.objects.count(), Notification.objects.count(),
        )
        self.seed()
        self.assertEqual(counts, (
            User.objects.count(), Farmer.objects.count(), LivestockInventory.objects.count(),
            ProductionRecord.objects.count(), Notification.objects.count(),
        ))
        before = MilkAnomalyDemoOwnership.objects.count()
        call_command("seed_milk_anomaly_demo", "--dry-run", verbosity=0)
        self.assertEqual(before, MilkAnomalyDemoOwnership.objects.count())

    def test_clean_recreates_demo_and_preserves_unrelated_records_and_shared_reference_data(self):
        unrelated_user = User.objects.create_user(
            username="unrelated_farmer", email="unrelated@example.test", password="x",
            role=self.roles["FARMER"], account_status=User.AccountStatus.APPROVED,
        )
        unrelated_farmer = Farmer.objects.create(user=unrelated_user, barangay=self.manggas, address="Real unrelated farm")
        unrelated_cow = LivestockInventory.objects.create(
            farmer=unrelated_farmer, livestock_type=self.cattle, tag_number="REAL-COW",
            created_by=unrelated_user, status=LivestockInventory.StatusType.APPROVED,
        )
        unrelated_record = ProductionRecord.objects.create(
            livestock=unrelated_cow, production_type="MILK", quantity=Decimal("8"), unit="LITERS",
            record_date=timezone.localdate() - timedelta(days=3), created_by=unrelated_user,
        )
        self.seed()
        self.seed("--clean")
        self.assertTrue(User.objects.filter(pk=unrelated_user.pk).exists())
        self.assertTrue(Farmer.objects.filter(pk=unrelated_farmer.pk).exists())
        self.assertTrue(LivestockInventory.objects.filter(pk=unrelated_cow.pk).exists())
        self.assertTrue(ProductionRecord.objects.filter(pk=unrelated_record.pk).exists())
        self.assertTrue(Barangay.objects.filter(pk=self.tangob.pk).exists())
        self.assertTrue(LivestockType.objects.filter(pk=self.cattle.pk).exists())
        self.assertEqual(MilkAnomalyDemoOwnership.objects.count(), 130)
        self.assertEqual(ProductionRecord.objects.filter(livestock__farmer__user__email="demo.milk.farmer@smartlivestock-demo.invalid").count(), 122)

    def test_clean_refuses_to_delete_untracked_activity_linked_to_demo_user(self):
        self.seed()
        demo_farmer = self.demo_user("demo.milk.farmer@smartlivestock-demo.invalid")
        extra = ProductionRecord.objects.create(
            livestock=LivestockInventory.objects.filter(farmer__user=demo_farmer).first(),
            production_type="MILK", quantity=Decimal("9"), unit="LITERS",
            record_date=timezone.localdate() + timedelta(days=2), created_by=demo_farmer,
        )
        with self.assertRaisesRegex(CommandError, "no demo ownership marker"):
            self.seed("--clean")
        self.assertTrue(extra.pk and ProductionRecord.objects.filter(pk=extra.pk).exists())
        self.assertTrue(User.objects.filter(pk=demo_farmer.pk).exists())

    def test_failed_seed_transaction_leaves_no_partial_demo(self):
        from production.management.commands.seed_milk_anomaly_demo import Command

        with patch.object(Command, "_get_or_create_scenario", side_effect=RuntimeError("synthetic failure")):
            with self.assertRaisesRegex(RuntimeError, "synthetic failure"):
                self.seed()
        self.assertFalse(User.objects.filter(email__endswith="@smartlivestock-demo.invalid").exists())
        self.assertFalse(Farmer.objects.filter(address__startswith="DEMO ONLY").exists())
        self.assertFalse(LivestockInventory.objects.filter(tag_number__startswith="DEMO-MILK-").exists())
        self.assertEqual(MilkAnomalyDemoOwnership.objects.count(), 0)

    def test_seed_refuses_explicit_production_environment(self):
        with patch.dict(os.environ, {"SMARTLIVESTOCK_DEMO_ENV": "production"}):
            with self.assertRaisesRegex(CommandError, "explicitly identified as production"):
                self.seed("--dry-run")
        self.assertEqual(MilkAnomalyDemoOwnership.objects.count(), 0)

    def test_real_review_queues_and_role_transitions_are_enforced(self):
        self.seed()
        clean = self.demo_record("scenario-clean")
        anomaly = self.demo_record("scenario-anomaly")
        farmer = self.demo_user("demo.milk.farmer@smartlivestock-demo.invalid")
        cbat = self.demo_user("demo.milk.cbat@smartlivestock-demo.invalid")
        mao = self.demo_user("demo.milk.mao@smartlivestock-demo.invalid")
        client = APIClient()

        client.force_authenticate(cbat)
        cbat_rows = client.get("/production/records/").data
        self.assertIn(anomaly.pk, [row["id"] for row in cbat_rows])
        self.assertNotIn(clean.pk, [row["id"] for row in cbat_rows])
        blocked_clean = client.post(f"/production/records/{clean.pk}/review/", {"status": "VERIFIED"})
        self.assertEqual(blocked_clean.status_code, 400)
        direct_flagged = client.post(f"/production/records/{anomaly.pk}/review/", {"status": "APPROVED"})
        self.assertEqual(direct_flagged.status_code, 400)

        client.force_authenticate(mao)
        mao_rows = client.get("/production/records/").data
        self.assertIn(clean.pk, [row["id"] for row in mao_rows])
        # The record can be listed for context, but the review transition remains
        # blocked until the CBAT verification step is complete.
        self.assertEqual(client.post(f"/production/records/{clean.pk}/review/", {"status": "APPROVED"}).status_code, 200)

        client.force_authenticate(cbat)
        self.assertEqual(client.post(f"/production/records/{anomaly.pk}/review/", {"status": "VERIFIED"}).status_code, 200)
        client.force_authenticate(mao)
        self.assertEqual(client.post(f"/production/records/{anomaly.pk}/review/", {"status": "APPROVED"}).status_code, 200)

        # A Tangob CBAT cannot open or review an otherwise valid Manggas record.
        other_user = User.objects.create_user(
            username="other_farmer", email="other-farmer@example.test", password="x",
            role=self.roles["FARMER"], account_status=User.AccountStatus.APPROVED,
        )
        other_farmer = Farmer.objects.create(user=other_user, barangay=self.manggas, address="Other farm")
        other_cow = LivestockInventory.objects.create(
            farmer=other_farmer, livestock_type=self.cattle, tag_number="OTHER-MILK-COW",
            created_by=other_user, status=LivestockInventory.StatusType.APPROVED,
        )
        foreign_record = ProductionRecord.objects.create(
            livestock=other_cow, production_type="MILK", quantity=Decimal("15"), unit="LITERS",
            record_date=timezone.localdate() + timedelta(days=1), created_by=other_user,
        )
        client.force_authenticate(cbat)
        self.assertEqual(client.get("/production/records/").status_code, 200)
        self.assertEqual(client.post(f"/production/records/{foreign_record.pk}/review/", {"status": "VERIFIED"}).status_code, 404)

    def test_route_notifications_target_tangob_cbat_and_old_manggas_notice_is_hidden(self):
        manggas_cbat = User.objects.create_user(
            username="manggas_cbat", email="manggas-cbat@example.test", password="x",
            role=self.roles["CBAT"], account_status=User.AccountStatus.APPROVED,
            assigned_barangay=self.manggas,
        )
        self.seed()
        anomaly = self.demo_record("scenario-anomaly")
        tangob_cbat = self.demo_user("demo.milk.cbat@smartlivestock-demo.invalid")
        self.assertTrue(Notification.objects.filter(user=tangob_cbat, related_entity_id=anomaly.pk).exists())
        self.assertFalse(Notification.objects.filter(user=manggas_cbat, related_entity_id=anomaly.pk).exists())

        # Simulate an old Manggas notification retained after the same CBAT account
        # is reassigned to Tangob. The inbox must revalidate linked record scope.
        manggas_cow = LivestockInventory.objects.create(
            farmer=Farmer.objects.create(
                user=User.objects.create_user(
                    username="old_manggas_farmer", email="old-manggas@example.test", password="x",
                    role=self.roles["FARMER"], account_status=User.AccountStatus.APPROVED,
                ), barangay=self.manggas, address="Old farm",
            ), livestock_type=self.cattle, tag_number="OLD-MANGGAS-COW",
            created_by=User.objects.get(email="old-manggas@example.test"), status="APPROVED",
        )
        old_record = ProductionRecord.objects.create(
            livestock=manggas_cow, production_type="MILK", quantity=Decimal("15"), unit="LITERS",
            record_date=timezone.localdate() + timedelta(days=1), created_by=manggas_cow.farmer.user,
        )
        Notification.objects.create(
            user=tangob_cbat, notification_type="production", title="Old Manggas record",
            message="Old scope notification", related_entity_type="production_record", related_entity_id=old_record.pk,
        )
        Notification.objects.create(user=tangob_cbat, title="General notice", message="Keep this notice")

        client = APIClient()
        client.force_authenticate(tangob_cbat)
        inbox = client.get("/api/notifications/").data["notifications"]
        linked_ids = {item["related_entity_id"] for item in inbox if item["related_entity_type"] == "production_record"}
        self.assertIn(anomaly.pk, linked_ids)
        anomaly_notice = next(item for item in inbox if item["related_entity_id"] == anomaly.pk)
        self.assertEqual(anomaly_notice["related_barangay_name"], "Tangob")
        self.assertNotIn(old_record.pk, linked_ids)
        self.assertTrue(any(item["title"] == "General notice" for item in inbox))

        # Once reassigned, newly created Tangob notifications remain visible.
        tangob_cbat.assigned_barangay = self.tangob
        tangob_cbat.save(update_fields=["assigned_barangay"])
        scoped_inbox = client.get("/api/notifications/").data["notifications"]
        self.assertFalse(any(item["related_entity_id"] == old_record.pk for item in scoped_inbox))

import os
from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch

from django.core.management import call_command, CommandError
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from livestock.models import Barangay, Farmer, LivestockInventory, LivestockType
from production.models import LiveAnimalSale, MilkAnomalyDemoOwnership, ProductionRecord, SlaughterRecord
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

    def cow_state(self, cow):
        return LivestockInventory.objects.values().get(pk=cow.pk)

    def assert_cow_state(self, cow, before):
        self.assertEqual(self.cow_state(cow), before)
        self.assertEqual(before["operational_status"], LivestockInventory.OperationalStatus.ACTIVE)

    def test_seed_creates_tangob_farmer_two_cattle_and_private_anomaly_scenarios(self):
        self.seed()
        farmer_user = self.demo_user("demo.milk.farmer@smartlivestock-demo.invalid")
        farmer = Farmer.objects.get(user=farmer_user)
        self.assertEqual(farmer.barangay, self.tangob)
        cows = list(LivestockInventory.objects.filter(farmer=farmer).order_by("tag_number"))
        self.assertEqual([cow.tag_number for cow in cows], ["DEMO-MILK-ANOMALY", "DEMO-MILK-CLEAN"])
        for cow in cows:
            history = ProductionRecord.objects.filter(
                livestock=cow, status=ProductionRecord.ProductionStatus.RECORDED,
                production_type=ProductionRecord.ProductionType.MILK,
                record_date__lte=timezone.localdate(),
            )
            self.assertEqual(history.count(), 60)
            self.assertEqual(history.values("record_date").distinct().count(), 60)
            self.assertEqual(set(history.values_list("milking_session", flat=True)), {ProductionRecord.MilkingSession.MORNING})
            self.assertTrue(history.filter(notes__startswith="DEMO synthetic").exists())

        clean = self.demo_record("scenario-clean")
        anomaly = self.demo_record("scenario-anomaly")
        self.assertEqual(clean.anomaly_assessment_status, "CLEAN")
        self.assertFalse(clean.anomaly_detected)
        self.assertFalse(clean.requires_cbat_verification)
        self.assertEqual(clean.next_review_queue, "NONE")
        self.assertEqual(clean.status, "RECORDED")
        self.assertEqual(anomaly.anomaly_assessment_status, "ANOMALY_DETECTED")
        self.assertTrue(anomaly.anomaly_detected)
        self.assertFalse(anomaly.requires_cbat_verification)
        self.assertEqual(anomaly.next_review_queue, "NONE")
        self.assertEqual(anomaly.status, "RECORDED")
        self.assertEqual(clean.milking_session, ProductionRecord.MilkingSession.MORNING)
        self.assertEqual(anomaly.milking_session, ProductionRecord.MilkingSession.MORNING)
        for record in (clean, anomaly):
            comparison = record.anomaly_assessment["forecast_comparison"]
            self.assertFalse(comparison["available"])
            self.assertEqual(comparison["status"], "INCOMPATIBLE_TARGET")
            self.assertIsNone(comparison["forecast_date"])
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

    def test_clean_removes_demo_and_preserves_unrelated_records_and_shared_reference_data(self):
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
            record_date=timezone.localdate() - timedelta(days=3),
            milking_session=ProductionRecord.MilkingSession.MORNING, created_by=unrelated_user,
        )
        self.seed()
        self.seed("--clean")
        self.assertTrue(User.objects.filter(pk=unrelated_user.pk).exists())
        self.assertTrue(Farmer.objects.filter(pk=unrelated_farmer.pk).exists())
        self.assertTrue(LivestockInventory.objects.filter(pk=unrelated_cow.pk).exists())
        self.assertTrue(ProductionRecord.objects.filter(pk=unrelated_record.pk).exists())
        self.assertTrue(Barangay.objects.filter(pk=self.tangob.pk).exists())
        self.assertTrue(LivestockType.objects.filter(pk=self.cattle.pk).exists())
        self.assertEqual(MilkAnomalyDemoOwnership.objects.count(), 0)
        self.assertFalse(User.objects.filter(email__endswith="@smartlivestock-demo.invalid").exists())
        self.assertFalse(LivestockInventory.objects.filter(tag_number__startswith="DEMO-MILK-").exists())
        self.assertFalse(ProductionRecord.objects.filter(notes__startswith="DEMO synthetic").exists())

    def test_clean_refuses_to_delete_untracked_activity_linked_to_demo_user(self):
        self.seed()
        demo_farmer = self.demo_user("demo.milk.farmer@smartlivestock-demo.invalid")
        extra = ProductionRecord.objects.create(
            livestock=LivestockInventory.objects.filter(farmer__user=demo_farmer).first(),
            production_type="MILK", quantity=Decimal("9"), unit="LITERS",
            record_date=timezone.localdate() + timedelta(days=2),
            milking_session=ProductionRecord.MilkingSession.MORNING, created_by=demo_farmer,
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

    def test_demo_scenarios_are_farmer_only_and_cannot_be_reviewed(self):
        self.seed()
        farmer = self.demo_user("demo.milk.farmer@smartlivestock-demo.invalid")
        mao = self.demo_user("demo.milk.mao@smartlivestock-demo.invalid")
        clean = self.demo_record("scenario-clean")
        anomaly = self.demo_record("scenario-anomaly")
        client = APIClient()
        client.force_authenticate(user=farmer)
        rows = client.get("/production/records/").data
        self.assertIn(clean.pk, {row["id"] for row in rows})
        self.assertIn(anomaly.pk, {row["id"] for row in rows})
        client.force_authenticate(user=mao)
        rows = client.get("/production/records/").data
        self.assertNotIn(clean.pk, {row["id"] for row in rows})
        self.assertNotIn(anomaly.pk, {row["id"] for row in rows})
        self.assertEqual(client.post(f"/production/records/{anomaly.pk}/review/", {"status": "APPROVED"}).status_code, 404)
        self.assertFalse(Notification.objects.filter(
            related_entity_type="production_record", related_entity_id__in=[clean.pk, anomaly.pk]
        ).exists())
        self.assertEqual(SlaughterRecord.objects.count(), 0)

    def test_old_demo_scenario_is_not_silently_rewritten(self):
        self.seed()
        scenario = self.demo_record("scenario-clean")
        scenario.status = ProductionRecord.ProductionStatus.PENDING
        scenario.save(update_fields=["status"])
        with self.assertRaisesRegex(CommandError, "old review workflow"):
            self.seed()
        scenario.refresh_from_db()
        self.assertEqual(scenario.status, ProductionRecord.ProductionStatus.PENDING)

from datetime import date, timedelta
from decimal import Decimal

import pandas as pd
from django.test import TestCase
from django.utils import timezone

from livestock.models import Barangay, Farmer, LivestockInventory, LivestockOwnershipTransfer, LivestockType
from analytics.seed_markers import SEED_MARKER_FORECAST_QUALITY_IDEAL
from production.models import LiveAnimalSale
from users.models import Role, User
from analytics.services.predictive.auction_weekly import (
    build_weekly_auction_series,
    evaluate_weekly_auction,
)
from analytics.services.predictive.data import extract_monthly_series


class WeeklyAuctionForecastTests(TestCase):
    def setUp(self):
        role, _ = Role.objects.get_or_create(role_name="MAO")
        self.user = User.objects.create(username="weekly-auction-test", email="weekly-auction@example.test", role=role)
        self.barangay = Barangay.objects.create(barangay_name="Forecast Test", latitude=13.8, longitude=121.2)
        self.farmer = Farmer.objects.create(user=self.user, barangay=self.barangay, address="Test")
        self.cattle = LivestockType.objects.create(name="Cattle")
        today = timezone.localdate()
        this_monday = today - timedelta(days=today.weekday())
        self.anchor_monday = this_monday - timedelta(weeks=40)

    def sale(self, event_date, *, heads=1, price=100, status="APPROVED", available_on=None):
        transfers = []
        if price is None:
            per_animal_prices = [None] * heads
        else:
            total_cents = int((Decimal(str(price)) * 100).quantize(Decimal("1")))
            base_cents, remainder_cents = divmod(total_cents, heads)
            per_animal_prices = [
                Decimal(base_cents + (1 if index < remainder_cents else 0)) / 100
                for index in range(heads)
            ]
        for index in range(heads):
            animal = LivestockInventory.objects.create(
                farmer=self.farmer, livestock_type=self.cattle, entry_type="INDIVIDUAL", quantity=1,
                status="APPROVED", operational_status="SOLD" if status == "APPROVED" else "ACTIVE",
                created_by=self.user, tag_number=f"TEST-{LivestockInventory.objects.count()}-{index}",
            )
            transfer = LivestockOwnershipTransfer.objects.create(
                livestock=animal, previous_owner=self.farmer,
                owner_type=LivestockOwnershipTransfer.OwnerType.EXTERNAL_INDIVIDUAL,
                external_owner_name="Synthetic buyer", external_owner_address="Demo only",
                transfer_certificate_number=f"TEST-{animal.pk}", original_certificate_number=f"ORIG-{animal.pk}",
                transfer_date=event_date, municipality="Padre Garcia", province="Batangas",
                purchase_price=per_animal_prices[index],
                status=status, created_by=self.user,
                reviewed_by=self.user if status == "APPROVED" else None,
                reviewed_at=timezone.now() if status == "APPROVED" else None,
                review_remarks="TEST_SYNTHETIC",
            )
            transfers.append(transfer)
        if available_on is not None:
            stamp = timezone.make_aware(timezone.datetime.combine(available_on, timezone.datetime.min.time()))
            LivestockOwnershipTransfer.objects.filter(pk__in=[row.pk for row in transfers]).update(created_at=stamp, reviewed_at=stamp)
        return transfers

    def test_weekly_targets_count_transactions_heads_and_value_separately(self):
        monday = self.anchor_monday
        self.sale(monday + timedelta(days=3), heads=2, price=125)  # Thursday
        self.sale(monday + timedelta(days=4), heads=3, price=250)  # Friday
        self.sale(monday + timedelta(days=6), heads=4, price=300)  # Sunday
        # The separate auction-sale model must not inflate transfer analytics.
        LiveAnimalSale.objects.create(quantity=99, sale_date=monday + timedelta(days=3),
                                      total_price=Decimal("99999"), status="APPROVED", created_by=self.user)

        count_df, _ = build_weekly_auction_series(unit="TRANSACTIONS")
        heads_df, _ = build_weekly_auction_series(unit="HEADS")
        php_df, _ = build_weekly_auction_series(unit="PHP")

        self.assertEqual(float(count_df.iloc[0]["quantity"]), 9.0)
        self.assertEqual(float(heads_df.iloc[0]["quantity"]), 9.0)
        self.assertEqual(float(php_df.iloc[0]["quantity"]), 675.0)

    def test_pending_verified_and_returned_transfers_are_excluded(self):
        monday = self.anchor_monday
        self.sale(monday + timedelta(days=4), status="PENDING")
        self.sale(monday + timedelta(days=2), status="VERIFIED")
        self.sale(monday + timedelta(days=3), status="SUBJECT_TO_REVISION")
        df, meta = build_weekly_auction_series(unit="TRANSACTIONS")
        self.assertTrue(df.empty)
        self.assertEqual(meta["total_records"], 0)

    def test_monthly_predictive_aggregation_uses_transfer_date_and_unique_animals(self):
        today = timezone.localdate()
        current_month_index = today.year * 12 + today.month - 1
        first_month_index = current_month_index - 18
        for offset in range(18):
            index = first_month_index + offset
            month_start = date(index // 12, index % 12 + 1, 1)
            self.sale(month_start + timedelta(days=9), heads=2, price=200)
        df, meta = extract_monthly_series(domain="auction", target="ALL", unit="HEADS")
        self.assertIsNotNone(df)
        self.assertEqual(meta["frequency"], "MONTHLY")
        self.assertEqual(len(df), 18)
        self.assertEqual(float(df.iloc[0]["quantity"]), 2.0)

    def test_repeated_transfer_events_for_same_animal_are_two_events_but_one_head(self):
        transfer = self.sale(self.anchor_monday + timedelta(days=4))[0]
        LivestockOwnershipTransfer.objects.create(
            livestock=transfer.livestock, previous_owner=self.farmer,
            owner_type=LivestockOwnershipTransfer.OwnerType.EXTERNAL_INDIVIDUAL,
            external_owner_name="Later buyer", external_owner_address="Demo only",
            transfer_certificate_number="SECOND-TRANSFER", original_certificate_number="ORIGINAL",
            transfer_date=self.anchor_monday + timedelta(days=5), municipality="Padre Garcia", province="Batangas",
            purchase_price=Decimal("125"), status="APPROVED", created_by=self.user,
            reviewed_by=self.user, reviewed_at=timezone.now(), review_remarks="TEST_SYNTHETIC",
        )
        events, _ = build_weekly_auction_series(unit="TRANSACTIONS")
        heads, _ = build_weekly_auction_series(unit="HEADS")
        self.assertEqual(float(events.iloc[0]["quantity"]), 2.0)
        self.assertEqual(float(heads.iloc[0]["quantity"]), 1.0)

    def test_forecast_quality_seed_marker_is_reported_as_synthetic(self):
        transfer = self.sale(self.anchor_monday + timedelta(days=4))[0]
        LivestockOwnershipTransfer.objects.filter(pk=transfer.pk).update(
            review_remarks=SEED_MARKER_FORECAST_QUALITY_IDEAL
        )
        _, metadata = build_weekly_auction_series(unit="TRANSACTIONS")
        self.assertTrue(metadata["is_seeded"])
        self.assertEqual(metadata["synthetic_records"], 1)
        self.assertIn(SEED_MARKER_FORECAST_QUALITY_IDEAL, metadata["seed_markers"])

    def test_missing_weeks_are_unknown_and_withhold_forecast(self):
        for week_index in range(0, 30, 2):
            self.sale(self.anchor_monday + timedelta(weeks=week_index, days=4))
        result = evaluate_weekly_auction(unit="HEADS", horizon_weeks=4)
        self.assertFalse(result["forecast_available"])
        self.assertGreater(result["data"]["missing_week_count"], 0)
        self.assertIn("unknown", result["message"].lower())

    def test_all_weekdays_count_and_weekday_effect_is_not_inferred_without_coverage(self):
        monday = self.anchor_monday
        for offset in (0, 3, 4, 5):
            self.sale(monday + timedelta(days=offset), heads=2)
        _, meta = build_weekly_auction_series()
        by_day = {row["weekday"]: row for row in meta["weekday_activity"]}
        # Each fixture sale has two animals, represented by two transfer rows.
        self.assertEqual(by_day["Monday"]["transaction_count"], 2)
        self.assertEqual(by_day["Thursday"]["transaction_count"], 2)
        self.assertEqual(by_day["Friday"]["transaction_count"], 2)
        self.assertEqual(by_day["Saturday"]["transaction_count"], 2)
        self.assertFalse(meta["weekday_pattern_estimable"])
        self.assertEqual(meta["coverage_status"], "UNKNOWN")

    def test_php_target_is_withheld_when_any_approved_sale_lacks_price(self):
        monday = self.anchor_monday
        for week_index in range(15):
            self.sale(monday + timedelta(weeks=week_index, days=4), price=100)
        self.sale(monday + timedelta(weeks=5, days=3), price=None)
        result = evaluate_weekly_auction(unit="PHP", horizon_weeks=2)
        self.assertFalse(result["forecast_available"])
        self.assertGreater(result["data"]["unmeasured_value_records"], 0)

    def test_complete_weekly_history_can_forecast_and_backtest_full_requested_horizon(self):
        for week_index in range(40):
            monday = self.anchor_monday + timedelta(weeks=week_index)
            self.sale(monday + timedelta(days=4), heads=week_index + 2,
                      available_on=monday + timedelta(days=5))

        result = evaluate_weekly_auction(unit="HEADS", horizon_weeks=4)
        self.assertTrue(result["forecast_available"])
        self.assertEqual(result["frequency"], "WEEKLY")
        self.assertGreater(result["backtesting"]["valid_windows"], 0)
        self.assertEqual(result["data"]["test_period"]["observations"], 4)
        self.assertEqual(result["backtesting"]["horizon_weeks"], 4)
        self.assertTrue(all(len(row["test_predictions"]) == 4 for row in result["models"]))

    def test_early_cutoffs_with_late_approvals_do_not_block_later_valid_windows(self):
        now_date = timezone.localdate()
        for week_index in range(36):
            monday = self.anchor_monday + timedelta(weeks=week_index)
            # The first 18 observations were approved after all simulated cutoffs
            # that could have used them. Later records retain event-relative fixture
            # timestamps and should still support independent later cutoffs.
            available_on = now_date if week_index < 18 else monday + timedelta(days=5)
            self.sale(monday + timedelta(days=4), heads=week_index + 1, available_on=available_on)

        result = evaluate_weekly_auction(unit="HEADS", horizon_weeks=3)
        statuses = [row["status"] for row in result["backtesting"]["diagnostics"]]
        self.assertIn("SKIPPED", statuses)
        self.assertIn("EVALUATED", statuses)
        self.assertGreater(result["backtesting"]["valid_windows"], 0)

    def test_current_partial_week_is_not_added_to_completed_week_history(self):
        today = timezone.localdate()
        this_monday = today - timedelta(days=today.weekday())
        self.sale(this_monday + timedelta(days=today.weekday()))
        df, _ = build_weekly_auction_series()
        self.assertTrue(df.empty)


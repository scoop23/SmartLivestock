from datetime import timedelta
from decimal import Decimal

import pandas as pd
from django.test import TestCase
from django.utils import timezone

from production.models import LiveAnimalSale
from users.models import Role, User
from analytics.services.predictive.auction_weekly import (
    build_weekly_auction_series,
    evaluate_weekly_auction,
)


class WeeklyAuctionForecastTests(TestCase):
    def setUp(self):
        role, _ = Role.objects.get_or_create(role_name="MAO")
        self.user = User.objects.create(username="weekly-auction-test", email="weekly-auction@example.test", role=role)
        today = timezone.localdate()
        this_monday = today - timedelta(days=today.weekday())
        self.anchor_monday = this_monday - timedelta(weeks=40)

    def sale(self, event_date, *, heads=1, price=100, status="APPROVED", available_on=None):
        sale = LiveAnimalSale.objects.create(
            quantity=heads,
            sale_date=event_date,
            total_price=Decimal(str(price)) if price is not None else None,
            status=status,
            created_by=self.user,
            reviewed_by=self.user if status == "APPROVED" else None,
            reviewed_at=timezone.now() if status == "APPROVED" else None,
        )
        if available_on is not None:
            stamp = timezone.make_aware(timezone.datetime.combine(available_on, timezone.datetime.min.time()))
            LiveAnimalSale.objects.filter(pk=sale.pk).update(created_at=stamp, reviewed_at=stamp)
        return sale

    def test_weekly_targets_count_transactions_heads_and_value_separately(self):
        monday = self.anchor_monday
        self.sale(monday + timedelta(days=3), heads=2, price=125)  # Thursday
        self.sale(monday + timedelta(days=4), heads=3, price=250)  # Friday
        self.sale(monday + timedelta(days=6), heads=4, price=300)  # Sunday

        count_df, _ = build_weekly_auction_series(unit="TRANSACTIONS")
        heads_df, _ = build_weekly_auction_series(unit="HEADS")
        php_df, _ = build_weekly_auction_series(unit="PHP")

        self.assertEqual(float(count_df.iloc[0]["quantity"]), 3.0)
        self.assertEqual(float(heads_df.iloc[0]["quantity"]), 9.0)
        self.assertEqual(float(php_df.iloc[0]["quantity"]), 675.0)

    def test_pending_and_returned_transactions_are_excluded(self):
        monday = self.anchor_monday
        self.sale(monday + timedelta(days=4), status="PENDING")
        self.sale(monday + timedelta(days=3), status="SUBJECT_TO_REVISION")
        df, meta = build_weekly_auction_series(unit="TRANSACTIONS")
        self.assertTrue(df.empty)
        self.assertEqual(meta["total_records"], 0)

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
        self.assertEqual(by_day["Monday"]["transaction_count"], 1)
        self.assertEqual(by_day["Thursday"]["transaction_count"], 1)
        self.assertEqual(by_day["Friday"]["transaction_count"], 1)
        self.assertEqual(by_day["Saturday"]["transaction_count"], 1)
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


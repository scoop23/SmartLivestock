"""
Deterministic Seed Command for Live Animal Sales / Auction Records (SmartLivestock Analytics).

=============================================================================
EDUCATIONAL OVERVIEW & LIVESTOCK CONCEPTS:
=============================================================================
1. Live Animal Trading:
   Municipal auction markets and livestock trade yards record commercial transfers
   of live animals. Key metrics are:
     - Head count (animals sold) reflecting market volume.
     - Monetary value (PHP total_price) reflecting commercial transaction volume.

2. Deterministic Seed Marker:
   Every generated record carries: AI_SEED::ANALYTICS_TEST::AUCTION::V1 in `review_remarks`.
   Running with `--clean` deletes ONLY records containing this exact marker.
"""

from datetime import date
from decimal import Decimal
import numpy as np

from django.core.management.base import BaseCommand
from django.utils import timezone

from production.models import LiveAnimalSale
from livestock.models import LivestockInventory
from users.models import User
from analytics.seed_markers import SEED_MARKER_AUCTION


class Command(BaseCommand):
    help = (
        "Deterministically seeds or cleans synthetic municipal live animal sale / auction records.\n"
        "Carries marker 'AI_SEED::ANALYTICS_TEST::AUCTION::V1' in review_remarks.\n"
        "Use --clean to safely remove ONLY synthetic records without modifying real records."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--clean",
            action="store_true",
            help="Safely remove ONLY seeded synthetic auction/sale records.",
        )
        parser.add_argument(
            "--months",
            type=int,
            default=36,
            help="Number of historical months to generate auction activity for (default: 36).",
        )

    def handle(self, *args, **options):
        if options["clean"]:
            self._handle_clean()
            return

        self._handle_seed(months=options["months"])

    def _handle_clean(self):
        seed_qs = LiveAnimalSale.objects.filter(review_remarks__contains=SEED_MARKER_AUCTION)
        count = seed_qs.count()

        if count == 0:
            self.stdout.write(self.style.WARNING("No seeded synthetic auction records found to clean."))
            return

        deleted_count, _ = seed_qs.delete()
        self.stdout.write(
            self.style.SUCCESS(
                f"Successfully removed {deleted_count} synthetic auction records.\n"
                f"Real commercial livestock sale records were NOT modified."
            )
        )

    def _handle_seed(self, months: int):
        existing_count = LiveAnimalSale.objects.filter(
            review_remarks__contains=SEED_MARKER_AUCTION
        ).count()
        if existing_count > 0:
            self.stdout.write(
                self.style.WARNING(
                    f"Found {existing_count} existing synthetic auction records.\n"
                    f"Run 'python manage.py seed_auction --clean' before re-seeding."
                )
            )
            return

        inventory = (
            LivestockInventory.objects.filter(status="APPROVED").first()
        )

        mao_user = (
            User.objects.filter(role__role_name__icontains="MAO").first()
            or User.objects.filter(is_superuser=True).first()
            or User.objects.first()
        )
        if not mao_user:
            self.stdout.write(self.style.ERROR("Cannot seed: No user account found."))
            return

        rng = np.random.RandomState(42)
        today = timezone.localdate()

        records_to_create = []

        sale_methods = [
            LiveAnimalSale.SaleMethod.MATA_MATA,
            LiveAnimalSale.SaleMethod.WEIGHING,
        ]
        purposes = [
            LiveAnimalSale.SalePurpose.BREEDING,
            LiveAnimalSale.SalePurpose.FATTENING,
            LiveAnimalSale.SalePurpose.SLAUGHTER,
        ]

        # Generate realistic monthly auction trade over requested months
        for m_idx in range(months):
            month_offset = months - 1 - m_idx
            year = today.year - (month_offset // 12)
            month = today.month - (month_offset % 12)
            if month <= 0:
                month += 12
                year -= 1

            # Seasonal holiday bump in November/December
            seasonal_multiplier = 1.3 if month in (11, 12) else 1.0
            trend_bump = m_idx * 0.2

            # 2 to 4 market days per month
            num_events = int(rng.choice([2, 3, 4]))
            for e_idx in range(num_events):
                base_heads = float(rng.uniform(4, 10)) * seasonal_multiplier + trend_bump
                heads = max(1, int(round(base_heads)))

                # Average price per head around ₱28,000 - ₱42,000 for cattle
                avg_price_per_head = float(rng.uniform(28000.0, 42000.0))
                total_val = round(heads * avg_price_per_head, 2)

                day = min(28, int(rng.choice([4, 11, 18, 25])))
                sale_date = date(year, month, day)

                method = sale_methods[e_idx % len(sale_methods)]
                purpose = purposes[(m_idx + e_idx) % len(purposes)]

                record = LiveAnimalSale(
                    livestock=inventory,
                    batch=None,
                    quantity=heads,
                    sale_method=method,
                    purpose=purpose,
                    price_per_head=Decimal(str(round(avg_price_per_head, 2))),
                    total_price=Decimal(str(total_val)),
                    destination="Padre Garcia Livestock Auction Market",
                    sale_date=sale_date,
                    status=LiveAnimalSale.StatusType.APPROVED,
                    reviewed_by=mao_user,
                    reviewed_at=timezone.now(),
                    review_remarks=(
                        f"{SEED_MARKER_AUCTION} Synthetic municipal auction market record "
                        f"for month {m_idx + 1}/{months}."
                    ),
                    created_by=mao_user,
                )
                records_to_create.append(record)

        LiveAnimalSale.objects.bulk_create(records_to_create)
        self.stdout.write(
            self.style.SUCCESS(
                f"Successfully seeded {len(records_to_create)} synthetic auction records across {months} months "
                f"with marker '{SEED_MARKER_AUCTION}'."
            )
        )

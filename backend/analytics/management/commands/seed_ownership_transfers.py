"""
Deterministic seed command for synthetic municipal Auction ownership-transfer records.
The 27 certificate lots expand into one transfer row per animal.
"""

from datetime import date
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from analytics.seed_markers import SEED_MARKER_OWNERSHIP_TRANSFER
from livestock.models import LivestockOwnershipTransfer
from smartlivestock.seed_safety import assert_safe_seed_database
from smartlivestock.workflows import MAO, validate_review_transition
from users.models import User

SEED_MARKER = SEED_MARKER_OWNERSHIP_TRANSFER
LEGACY_SEED_MARKER = "AI_SEED::AUCTION_TRANSFER::V1"

# 27 certificate lots; each lot expands to one transfer event per animal.
# Buyers: 18 unique names
BUYERS = [
    "Lipa Cattle Trading Corp",
    "Batangas Livestock Buyers Inc",
    "San Juan Meat Dealers",
    "Rosario Abattoir Traders",
    "Tanauan Commercial Feedlot",
    "Malvar Agri-Commerce",
    "Ibaan Beef Center",
    "Southern Luzon Cattle Buyers",
    "San Jose Meat Market",
    "Padre Garcia Trading Union",
    "Batangas Prime Meats",
    "Calabarzon Agro-Holdings",
    "Lipa Quality Beef Co",
    "San Juan Livestock Hub",
    "Rosario Prime Cattle",
    "Batangas Meat Packers",
    "Taal Heritage Meats",
    "Alangilan Cattle Wholesale",
]

SELLERS = [
    ("Ricardo Mendoza", "Brgy. Banaba, Padre Garcia, Batangas"),
    ("Elena Santos", "Brgy. Castillo, Padre Garcia, Batangas"),
    ("Antonio Garcia", "Brgy. Cawongan, Padre Garcia, Batangas"),
    ("Maria Hernandez", "Brgy. Manggas, Padre Garcia, Batangas"),
    ("Juanito Reyes", "Brgy. Poblacion, Padre Garcia, Batangas"),
    ("Carmela Bautista", "Brgy. San Miguel, Padre Garcia, Batangas"),
    ("Danilo Ilagan", "Brgy. Quilo-quilo North, Padre Garcia, Batangas"),
    ("Teresa Dimaculangan", "Brgy. Bawi, Padre Garcia, Batangas"),
]

# Destination & Volume Plan:
# Lipa City: 34 heads total
# Batangas City: 28 heads total
# San Juan: 24 heads total
# Rosario: 18 heads total
# Others: 48 heads total (Tanauan, Malvar, Ibaan, San Jose)
# Total: 152 heads across 27 certificate lots.
#
# Status: 21 APPROVED, 6 PENDING
# Price total: ~₱4,560,000

TRANSFER_PLANS = [
    # ── Recent November 2026 ──────────────────────────────────────────
    {"code": "AUC-2026-027", "date": date(2026, 11, 2), "dest": "Lipa City", "buyer_idx": 0, "heads": 10, "price": "300000.00", "status": "APPROVED", "desc": "10 head Brahman cross cattle lot."},
    {"code": "AUC-2026-026", "date": date(2026, 10, 30), "dest": "Batangas City", "buyer_idx": 1, "heads": 8, "price": "240000.00", "status": "APPROVED", "desc": "8 head commercial steers."},
    {"code": "AUC-2026-025", "date": date(2026, 10, 28), "dest": "San Juan", "buyer_idx": 2, "heads": 12, "price": "360000.00", "status": "PENDING", "desc": "12 head fattening steers awaiting transport clearance."},
    {"code": "AUC-2026-024", "date": date(2026, 10, 24), "dest": "Rosario", "buyer_idx": 3, "heads": 6, "price": "180000.00", "status": "APPROVED", "desc": "6 head breeding heifers."},
    {"code": "AUC-2026-023", "date": date(2026, 10, 20), "dest": "Tanauan City", "buyer_idx": 4, "heads": 14, "price": "420000.00", "status": "APPROVED", "desc": "14 head commercial batch."},
    {"code": "AUC-2026-022", "date": date(2026, 10, 15), "dest": "Lipa City", "buyer_idx": 12, "heads": 5, "price": "150000.00", "status": "APPROVED", "desc": "5 head high-yield breeding cattle."},
    {"code": "AUC-2026-021", "date": date(2026, 10, 8), "dest": "Batangas City", "buyer_idx": 10, "heads": 5, "price": "150000.00", "status": "PENDING", "desc": "5 head yearling cattle lot."},

    # ── September 2026 (42 heads total) ───────────────────────────────
    {"code": "AUC-2026-020", "date": date(2026, 9, 28), "dest": "Lipa City", "buyer_idx": 0, "heads": 9, "price": "270000.00", "status": "APPROVED", "desc": "9 head yearling fatteners."},
    {"code": "AUC-2026-019", "date": date(2026, 9, 24), "dest": "San Juan", "buyer_idx": 13, "heads": 7, "price": "210000.00", "status": "APPROVED", "desc": "7 head dairy-cross heifers."},
    {"code": "AUC-2026-018", "date": date(2026, 9, 19), "dest": "Batangas City", "buyer_idx": 1, "heads": 8, "price": "240000.00", "status": "APPROVED", "desc": "8 head commercial steers."},
    {"code": "AUC-2026-017", "date": date(2026, 9, 14), "dest": "Rosario", "buyer_idx": 14, "heads": 6, "price": "180000.00", "status": "PENDING", "desc": "6 head finished bulls."},
    {"code": "AUC-2026-016", "date": date(2026, 9, 9), "dest": "Malvar", "buyer_idx": 5, "heads": 6, "price": "180000.00", "status": "APPROVED", "desc": "6 head breeding cows."},
    {"code": "AUC-2026-015", "date": date(2026, 9, 4), "dest": "Ibaan", "buyer_idx": 6, "heads": 6, "price": "180000.00", "status": "APPROVED", "desc": "6 head native cattle."},

    # ── August 2026 (30 heads total) ──────────────────────────────────
    {"code": "AUC-2026-014", "date": date(2026, 8, 28), "dest": "Lipa City", "buyer_idx": 12, "heads": 6, "price": "180000.00", "status": "APPROVED", "desc": "6 head prime slaughter cattle."},
    {"code": "AUC-2026-013", "date": date(2026, 8, 22), "dest": "Batangas City", "buyer_idx": 15, "heads": 7, "price": "210000.00", "status": "APPROVED", "desc": "7 head feedlot cattle."},
    {"code": "AUC-2026-012", "date": date(2026, 8, 17), "dest": "San Juan", "buyer_idx": 2, "heads": 5, "price": "150000.00", "status": "APPROVED", "desc": "5 head steers."},
    {"code": "AUC-2026-011", "date": date(2026, 8, 12), "dest": "San Jose", "buyer_idx": 8, "heads": 6, "price": "180000.00", "status": "APPROVED", "desc": "6 head breeder cattle."},
    {"code": "AUC-2026-010", "date": date(2026, 8, 5), "dest": "Rosario", "buyer_idx": 3, "heads": 6, "price": "180000.00", "status": "PENDING", "desc": "6 head fatteners."},

    # ── July 2026 (20 heads total) ────────────────────────────────────
    {"code": "AUC-2026-009", "date": date(2026, 7, 29), "dest": "Lipa City", "buyer_idx": 0, "heads": 4, "price": "120000.00", "status": "APPROVED", "desc": "4 head dairy heifers."},
    {"code": "AUC-2026-008", "date": date(2026, 7, 24), "dest": "Batangas City", "buyer_idx": 1, "heads": 4, "price": "120000.00", "status": "APPROVED", "desc": "4 head commercial lot."},
    {"code": "AUC-2026-007", "date": date(2026, 7, 18), "dest": "San Juan", "buyer_idx": 13, "heads": 4, "price": "120000.00", "status": "APPROVED", "desc": "4 head Brahman cattle."},
    {"code": "AUC-2026-006", "date": date(2026, 7, 12), "dest": "Alangilan", "buyer_idx": 17, "heads": 4, "price": "120000.00", "status": "APPROVED", "desc": "4 head steers."},
    {"code": "AUC-2026-005", "date": date(2026, 7, 5), "dest": "Taal", "buyer_idx": 16, "heads": 4, "price": "120000.00", "status": "APPROVED", "desc": "4 head draft cattle."},

    # ── Earlier Records (Matching Balance) ────────────────────────────
    {"code": "AUC-2026-004", "date": date(2026, 6, 26), "dest": "Batangas City", "buyer_idx": 11, "heads": 4, "price": "120000.00", "status": "APPROVED", "desc": "4 head steers."},
    {"code": "AUC-2026-003", "date": date(2026, 6, 18), "dest": "Tanauan City", "buyer_idx": 7, "heads": 4, "price": "120000.00", "status": "PENDING", "desc": "4 head heifers."},
    {"code": "AUC-2026-002", "date": date(2026, 6, 10), "dest": "Padre Garcia", "buyer_idx": 9, "heads": 4, "price": "120000.00", "status": "APPROVED", "desc": "4 head breeding stock."},
    {"code": "AUC-2026-001", "date": date(2026, 6, 3), "dest": "Tanauan City", "buyer_idx": 4, "heads": 4, "price": "120000.00", "status": "PENDING", "desc": "4 head commercial lot."},
]


class Command(BaseCommand):
    help = "Seeds marked synthetic ownership-transfer events through the current Auction-to-MAO workflow."

    def add_arguments(self, parser):
        parser.add_argument("--clean", action="store_true", help="Remove only this command's marked synthetic transfers.")

    def handle(self, *args, **options):
        assert_safe_seed_database(clean=options["clean"])
        from django.db.models import Q

        seeded_rows = LivestockOwnershipTransfer.objects.filter(
            Q(original_certificate_number__contains=SEED_MARKER)
            | Q(review_remarks__contains=SEED_MARKER)
            | Q(original_certificate_number__contains=LEGACY_SEED_MARKER)
            | Q(review_remarks__contains=LEGACY_SEED_MARKER)
        )
        if options["clean"]:
            deleted, _ = seeded_rows.delete()
            self.stdout.write(self.style.SUCCESS(f"Cleaned {deleted} seeded ownership transfers."))
            return

        auction_user = User.objects.filter(
            role__role_name="AUCTION",
            account_status=User.AccountStatus.APPROVED,
            is_active=True,
        ).order_by("pk").first()
        if not auction_user:
            self.stderr.write(self.style.ERROR("An active, approved AUCTION user is required; no transfers were created."))
            return

        mao_user = User.objects.filter(
            role__role_name=MAO,
            account_status=User.AccountStatus.APPROVED,
            is_active=True,
        ).order_by("pk").first()
        if not mao_user:
            self.stderr.write(self.style.ERROR("An active, approved MAO reviewer is required; no transfers were created."))
            return

        # Check existing
        existing = seeded_rows.count()
        if existing > 0:
            self.stdout.write(self.style.WARNING(f"Found {existing} existing seeded transfers. Run with --clean first."))
            return

        created_count = 0
        total_heads = 0
        approved_heads = 0
        pending_heads = 0
        total_price = Decimal("0.00")

        validate_review_transition(
            domain="ownership_transfers",
            role=MAO,
            current=LivestockOwnershipTransfer.Status.PENDING,
            target=LivestockOwnershipTransfer.Status.APPROVED,
        )

        with transaction.atomic():
            for idx, plan in enumerate(TRANSFER_PLANS):
                seller_name, seller_addr = SELLERS[idx % len(SELLERS)]
                buyer_name = BUYERS[plan["buyer_idx"]]
                lot_price = Decimal(plan["price"])
                heads = plan["heads"]
                price_per_head = (lot_price / heads).quantize(Decimal("0.01"))
                # Each transfer row represents exactly one animal. The paper lot
                # certificate can be shared by all rows in that lot.
                for animal_index in range(1, heads + 1):
                    approved = plan["status"] == LivestockOwnershipTransfer.Status.APPROVED
                    transfer = LivestockOwnershipTransfer(
                        external_seller_name=seller_name,
                        external_seller_address=seller_addr,
                        external_livestock_type="Cattle",
                        external_livestock_tag_number=(
                            f"PG-{plan['code']}-{animal_index:02d}"
                        ),
                        origin_municipality="Padre Garcia",
                        origin_province="Batangas",
                        owner_type=LivestockOwnershipTransfer.OwnerType.COMPANY,
                        external_owner_name=buyer_name,
                        external_owner_address=f"{plan['dest']}, Batangas",
                        transfer_certificate_number=plan["code"],
                        original_certificate_number=f"{SEED_MARKER}::ORIG-{plan['code']}",
                        transfer_date=plan["date"],
                        municipality=plan["dest"],
                        province="Batangas",
                        animal_description=f"Synthetic demo head {animal_index}/{heads}: {plan['desc']}",
                        purchase_price=price_per_head,
                        status=plan["status"],
                        reviewed_by=mao_user if approved else None,
                        reviewed_at=timezone.now() if approved else None,
                        review_remarks=(
                            f"{SEED_MARKER} Synthetic transfer fixture; "
                            f"head {animal_index} of {heads} under certificate {plan['code']}."
                        ),
                        created_by=auction_user,
                    )
                    transfer.full_clean()
                    transfer.save()
                    created_count += 1
                    total_heads += 1
                    if approved:
                        approved_heads += 1
                    else:
                        pending_heads += 1
                    total_price += price_per_head

        self.stdout.write(
            self.style.SUCCESS(
                f"Successfully seeded {created_count} synthetic per-animal ownership transfer records!\n"
                f"  Planned Heads: {total_heads} ({approved_heads} approved, {pending_heads} pending)\n"
                f"  Declared Value: PHP {total_price:,.2f} including pending transfers\n"
                f"  Unique Buyers: {len(set(b['buyer_idx'] for b in TRANSFER_PLANS))}\n"
                f"  Created By: {auction_user.username}\n"
                f"  Approved By: {mao_user.username}"
            )
        )

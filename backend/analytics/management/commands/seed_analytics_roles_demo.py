"""Prepare a role-based analytics demo with reversible synthetic datasets.

The forecast seed supplies 36 months of production/slaughter and 104 weeks of
auction activity. The ideal auction series creates about 260,000 synthetic
external transfer rows to match the published 2,500-head weekly average. The
surveillance seed supplies 24 months of irregular event reports. Farmer records
use up to three existing seed_farmers survey accounts; this command never
creates or changes Farmer accounts. --clean preserves those accounts and
profiles, as well as this command's staff demo accounts.
"""

import os

from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from analytics.models import SurveillanceDemoOwnership
from analytics.seed_markers import (
    SEED_MARKER_DISEASE,
    SEED_MARKER_FORECAST_QUALITY_IDEAL,
    SEED_MARKER_FORECAST_QUALITY_POOR,
    SEED_MARKER_MORTALITY,
)
from livestock.models import Farmer
from smartlivestock.seed_safety import assert_safe_seed_database
from users.models import Role, User


PREFIX = "analytics-roles-demo-v1:"
DEMO_USERS = {
    "cbat": {
        "email": "demo.analytics.cbat@smartlivestock-demo.invalid",
        "username": "demo-analytics-cbat",
        "role": Role.UserRoles.CBAT,
        "first_name": "Demo Analytics",
        "last_name": "CBAT Reviewer",
    },
    "mao": {
        "email": "demo.analytics.mao@smartlivestock-demo.invalid",
        "username": "demo-analytics-mao",
        "role": Role.UserRoles.MAO,
        "first_name": "Demo Analytics",
        "last_name": "MAO Reviewer",
    },
    "auction": {
        "email": "demo.analytics.auction@smartlivestock-demo.invalid",
        "username": "demo-analytics-auction",
        "role": Role.UserRoles.AUCTION,
        "first_name": "Demo Analytics",
        "last_name": "Auction Staff",
    },
}


class Command(BaseCommand):
    help = "Seed benchmark-calibrated synthetic analytics records against existing seed_farmers and demo CBAT, MAO, and Auction accounts."

    def add_arguments(self, parser):
        parser.add_argument("--clean", action="store_true", help="Remove only this demo's seeded records; keep its demo accounts and Farmer profiles.")
        parser.add_argument("--dry-run", action="store_true", help="Show the planned action without creating or deleting rows.")
        parser.add_argument("--scenario", choices=("ideal", "poor"), default="ideal", help="Forecast input quality to demonstrate (default: ideal).")

    def handle(self, *args, **options):
        clean = options["clean"]
        dry_run = options["dry_run"]
        scenario = options["scenario"]
        assert_safe_seed_database(clean=clean, dry_run=dry_run)

        if dry_run:
            owned_count = SurveillanceDemoOwnership.objects.filter(identifier__startswith=PREFIX).count()
            forecast_marker = SEED_MARKER_FORECAST_QUALITY_IDEAL if scenario == "ideal" else SEED_MARKER_FORECAST_QUALITY_POOR
            if clean:
                market_rows = "remove only rows owned by the selected forecast marker"
            else:
                market_rows = "about 260,000 external per-head transfer rows" if scenario == "ideal" else "sparse transfer rows"
            surveillance_count = SurveillanceDemoOwnership.objects.filter(identifier__startswith="disease-mortality-analytics-v1:").count()
            seeded_farmer_count = self._seeded_farmers_queryset().count()
            self.stdout.write(
                f"Dry run: {'would clean' if clean else 'would seed'} the {scenario} role demo. "
                f"Existing seed_farmers profiles: {seeded_farmer_count}; staff demo-account ownership entries: {owned_count}; "
                f"surveillance objects: {surveillance_count}; auction plan: {market_rows}; "
                f"forecast marker: {forecast_marker}; disease/mortality markers: {SEED_MARKER_DISEASE}, {SEED_MARKER_MORTALITY}."
            )
            self.stdout.write("No database changes were made.")
            return

        if clean:
            with transaction.atomic():
                call_command("seed_disease_mortality_analytics_demo", clean=True)
                call_command("seed_forecast_quality_demo", scenario=scenario, clean=True)
            self.stdout.write(self.style.SUCCESS(
                "Role demo records cleaned. seed_farmers accounts, Farmer profiles, and demo staff accounts were retained."
            ))
            return

        password = os.environ.get("SMARTLIVESTOCK_DEMO_PASSWORD", "")
        with transaction.atomic():
            farmers = self._get_seed_farmers()
            barangay = farmers[0].barangay
            accounts = {
                key: self._get_or_create_demo_user(key, spec, barangay, password)
                for key, spec in DEMO_USERS.items()
            }

            call_command(
                "seed_forecast_quality_demo",
                scenario=scenario,
                farmer_email=[farmer.user.email for farmer in farmers],
                mao_email=accounts["mao"].email,
                auction_email=accounts["auction"].email,
            )
            call_command(
                "seed_disease_mortality_analytics_demo",
                cbat_email=accounts["cbat"].email,
                mao_email=accounts["mao"].email,
                farmer_email=farmers[0].user.email,
            )

        self.stdout.write(self.style.SUCCESS("Role-based analytics demo is ready."))
        farmer_login_count = sum(
            farmer.user.is_active and farmer.user.account_status == User.AccountStatus.APPROVED
            for farmer in farmers
        )
        self.stdout.write(
            f"Farmer records: {len(farmers)} selected existing seed_farmers profiles across "
            + ", ".join(sorted({farmer.barangay.barangay_name for farmer in farmers}))
            + f"; login-ready: {farmer_login_count}/{len(farmers)}"
        )
        if farmer_login_count < len(farmers):
            self.stdout.write(self.style.WARNING(
            "Some selected seed_farmers accounts are not active and approved, so those farmers cannot log in yet. "
                "This analytics seed left their account status and passwords unchanged."
            ))
        self.stdout.write("CBAT, MAO, and Auction demo accounts are ready; their login emails use the .invalid demo domain.")
        self.stdout.write(
            "Synthetic scope: 36 months of production and slaughter, 104 weeks of auction transfers, "
            "and 24 months of irregular disease/mortality events with reversible demo coverage confirmations."
        )
        self.stdout.write(
            "The selected Farmer names and profiles come from seed_farmers; all newly generated records are clearly marked synthetic. "
            "The ideal scenario demonstrates a forecast workflow, not proof of real-world accuracy. "
            f"Clean records with: python manage.py seed_analytics_roles_demo --scenario {scenario} --clean"
        )

    @staticmethod
    def _seeded_farmers_queryset():
        from livestock.management.commands.seed_farmers import Command as SeedFarmersCommand

        emails = SeedFarmersCommand._seeded_account_emails()
        return Farmer.objects.filter(
            user__email__in=emails,
            user__role__role_name=Role.UserRoles.FARMER,
        ).select_related("user", "barangay")

    def _get_seed_farmers(self):
        from livestock.management.commands.seed_farmers import Command as SeedFarmersCommand

        seeded_emails = SeedFarmersCommand._seeded_account_emails()
        if User.objects.filter(email__in=seeded_emails).exclude(role__role_name=Role.UserRoles.FARMER).exists():
            raise CommandError("A seed_farmers email belongs to a non-Farmer role; refusing to use it.")
        farmers = list(self._seeded_farmers_queryset().order_by("barangay__barangay_name", "pk"))
        if not farmers:
            raise CommandError(
                "No existing Farmer profiles from seed_farmers were found. Run seed_farmers separately, "
                "then rerun this demo command; this command will not create Farmer identities."
            )

        selected = []
        seen_barangays = set()
        for farmer in farmers:
            if farmer.barangay_id not in seen_barangays:
                selected.append(farmer)
                seen_barangays.add(farmer.barangay_id)
                if len(selected) == 3:
                    return selected
        for farmer in farmers:
            if farmer not in selected:
                selected.append(farmer)
                if len(selected) == 3:
                    return selected
        return selected

    @staticmethod
    def _owned(identifier, expected_type, model):
        marker = SurveillanceDemoOwnership.objects.filter(identifier=f"{PREFIX}{identifier}").first()
        if marker is None:
            return None
        if marker.object_type != expected_type:
            raise CommandError(f"Demo ownership marker {identifier} has an unexpected object type; refusing to continue.")
        try:
            return model.objects.get(pk=marker.object_id)
        except model.DoesNotExist as exc:
            raise CommandError(f"Demo ownership marker {identifier} points to a missing row; clean or repair the ownership ledger first.") from exc

    @staticmethod
    def _track(identifier, object_type, obj):
        marker, created = SurveillanceDemoOwnership.objects.get_or_create(
            identifier=f"{PREFIX}{identifier}",
            defaults={"object_type": object_type, "object_id": obj.pk},
        )
        if not created and (marker.object_type != object_type or marker.object_id != obj.pk):
            raise CommandError(f"Demo ownership marker {identifier} conflicts with another row; refusing to adopt it.")

    def _get_or_create_demo_user(self, key, spec, barangay, password):
        role = Role.objects.filter(role_name=spec["role"]).first()
        if role is None:
            raise CommandError(f"The {spec['role']} role must exist before seeding role accounts.")
        user = self._owned(f"user:{key}", "user", User)
        if user is None:
            if not password:
                raise CommandError(
                    "Set SMARTLIVESTOCK_DEMO_PASSWORD to a temporary demo login password before creating role accounts. "
                    "The password is not printed or stored in the seed source."
                )
            if User.objects.filter(email__iexact=spec["email"]).exists() or User.objects.filter(username=spec["username"]).exists():
                raise CommandError(f"{spec['email']} or its username exists without this seed's ownership marker; refusing to reuse it.")
            user = User.objects.create_user(
                username=spec["username"],
                email=spec["email"],
                password=password,
                role=role,
                first_name=spec["first_name"],
                last_name=spec["last_name"],
                account_status=User.AccountStatus.APPROVED,
                approved_at=timezone.now(),
                is_active=True,
                assigned_barangay=barangay if key in {"cbat", "mao"} else None,
            )
            self._track(f"user:{key}", "user", user)
        elif (
            user.email.lower() != spec["email"].lower()
            or user.username != spec["username"]
            or user.role.role_name != spec["role"]
            or not user.is_active
            or user.account_status != User.AccountStatus.APPROVED
            or (key in {"cbat", "mao"} and user.assigned_barangay_id != barangay.pk)
        ):
            raise CommandError(f"Owned {key} demo account no longer matches its expected active role; refusing to modify it.")
        return user

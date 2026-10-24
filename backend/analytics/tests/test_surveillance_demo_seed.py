from datetime import date
from decimal import Decimal
import os
from unittest.mock import patch

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase

from analytics.management.commands.seed_surveillance_demo import PREFIX
from analytics.models import SurveillanceDemoOwnership
from analytics.seed_markers import (
    SEED_MARKER_DISEASE,
    SEED_MARKER_MORTALITY,
    SEED_MARKER_SURVEILLANCE_DEMO,
)
from analytics.services.surveillance import complete_week_windows, surveillance_summary
from diseases.models import DiseaseCase, MortalityRecord
from livestock.models import Barangay, Farmer, LivestockInventory, LivestockType
from users.models import Role, User


class SurveillanceDemoSeedTests(TestCase):
    def setUp(self):
        self.farmer_role = Role.objects.create(role_name="FARMER")
        self.mao_role = Role.objects.create(role_name="MAO")
        self.sibat_role = Role.objects.create(role_name="SIBAT")
        self.reviewer = User.objects.create_user(
            username="surv-seed-mao",
            email="surv-seed-mao@example.test",
            password="test-pass",
            role=self.mao_role,
            is_active=True,
        )
        self.barangays = [
            Barangay.objects.create(
                barangay_name=f"Seed Scenario {index}",
                latitude=Decimal("13.880000") + Decimal(index) / Decimal("1000"),
                longitude=Decimal("121.210000"),
            )
            for index in range(1, 5)
        ]
        self.cattle = LivestockType.objects.create(name="Cattle")
        self.today = date(2025, 1, 1)

    def _run_seed(self):
        with (
            patch(
                "analytics.management.commands.seed_surveillance_demo.timezone.localdate",
                return_value=self.today,
            ),
            patch("diseases.serializer.timezone.localdate", return_value=self.today),
        ):
            call_command("seed_surveillance_demo", stdout=None)

    def _scenario_barangay(self, scenario):
        marker = SurveillanceDemoOwnership.objects.get(
            identifier=f"{PREFIX}{scenario}:barangay"
        )
        return Barangay.objects.get(pk=marker.object_id)

    def _scoped_summary(self, barangay):
        reviewer = User.objects.create_user(
            username=f"reviewer-{barangay.pk}",
            email=f"reviewer-{barangay.pk}@example.test",
            password="test-pass",
            role=self.sibat_role,
            assigned_barangay=barangay,
            is_active=True,
        )
        return surveillance_summary(user=reviewer, today=self.today)

    def test_week_windows_follow_monday_sunday_boundaries_across_calendar_edges(self):
        new_year = complete_week_windows(date(2025, 1, 1))
        self.assertEqual(
            (new_year["previous_start"], new_year["previous_end"]),
            (date(2024, 12, 16), date(2024, 12, 22)),
        )
        self.assertEqual(
            (new_year["latest_start"], new_year["latest_end"]),
            (date(2024, 12, 23), date(2024, 12, 29)),
        )
        month_edge = complete_week_windows(date(2025, 3, 1))
        self.assertEqual(
            (month_edge["latest_start"], month_edge["latest_end"]),
            (date(2025, 2, 17), date(2025, 2, 23)),
        )

    def test_seed_is_repeatable_and_scoped_services_return_each_alert(self):
        self._run_seed()
        first_markers = list(
            SurveillanceDemoOwnership.objects.filter(identifier__startswith=PREFIX)
            .values_list("identifier", "object_type", "object_id")
        )
        first_diseases = DiseaseCase.objects.filter(
            review_remarks__contains=SEED_MARKER_SURVEILLANCE_DEMO
        ).count()
        first_mortalities = MortalityRecord.objects.filter(
            review_remarks__contains=SEED_MARKER_SURVEILLANCE_DEMO
        ).count()
        self.assertGreater(first_diseases, 0)
        self.assertEqual(first_mortalities, 3)

        self._run_seed()
        self.assertEqual(
            SurveillanceDemoOwnership.objects.filter(identifier__startswith=PREFIX).count(),
            len(first_markers),
        )
        self.assertEqual(
            DiseaseCase.objects.filter(review_remarks__contains=SEED_MARKER_SURVEILLANCE_DEMO).count(),
            first_diseases,
        )
        self.assertEqual(
            MortalityRecord.objects.filter(review_remarks__contains=SEED_MARKER_SURVEILLANCE_DEMO).count(),
            first_mortalities,
        )

        expected_levels = {
            "normal": "NORMAL",
            "watch": "WATCH",
            "elevated": "ELEVATED",
            "insufficient": "INSUFFICIENT_DATA",
        }
        summaries = {}
        for scenario, level in expected_levels.items():
            summary = self._scoped_summary(self._scenario_barangay(scenario))
            summaries[scenario] = summary
            self.assertEqual(summary["disease"]["alert"]["level"], level)

        normal = summaries["normal"]["disease"]
        self.assertEqual(normal["preceding_complete_week"]["reports"], 2)
        self.assertEqual(normal["latest_complete_week"]["reports"], 1)
        self.assertEqual(normal["preceding_complete_week"]["affected_heads"], 3)
        self.assertEqual(normal["latest_complete_week"]["affected_heads"], 4)

        elevated = summaries["elevated"]["disease"]
        previous_reports = elevated["preceding_complete_week"]["reports"]
        latest_reports = elevated["latest_complete_week"]["reports"]
        self.assertEqual((previous_reports, latest_reports), (2, 5))
        self.assertGreaterEqual(latest_reports, previous_reports * 2)
        self.assertGreaterEqual(latest_reports - previous_reports, 2)
        self.assertEqual(
            summaries["insufficient"]["disease"]["latest_complete_week"]["reports"], 0
        )
        self.assertIn("not measured", summaries["insufficient"]["data_quality"]["reporting_completeness"])

        all_events = surveillance_summary(user=self.reviewer, today=self.today)["associations"]["events"]
        relationships = {event["relationship"] for event in all_events}
        self.assertIn("same_livestock", relationships)
        self.assertIn("same_herd", relationships)
        self.assertIn("same_barangay", relationships)
        expected_pairs = {
            ("association:disease:same-animal", "association:mortality:same-animal"): "same_livestock",
            ("association:disease:same-herd", "association:mortality:same-herd"): "same_herd",
            ("association:disease:same-barangay", "association:mortality:same-barangay"): "same_barangay",
        }
        for (disease_key, mortality_key), relationship in expected_pairs.items():
            disease_id = SurveillanceDemoOwnership.objects.get(
                identifier=f"{PREFIX}{disease_key}"
            ).object_id
            mortality_marker = SurveillanceDemoOwnership.objects.filter(
                identifier__startswith=f"{PREFIX}{mortality_key}:"
            ).first()
            self.assertIsNotNone(mortality_marker)
            mortality_id = mortality_marker.object_id
            matching_pair = next(
                event for event in all_events
                if event["disease_record"] == f"DIS-{disease_id}"
                and event["mortality_record"] == f"MOR-{mortality_id}"
            )
            self.assertEqual(matching_pair["relationship"], relationship)
        near_boundary = [event for event in all_events if event["days_between"] == 30]
        self.assertTrue(near_boundary)
        self.assertTrue(all(event["disease_date"] < event["mortality_date"] for event in all_events))

        dates = complete_week_windows(self.today)
        self.assertTrue(
            DiseaseCase.objects.filter(
                review_remarks__contains=SEED_MARKER_SURVEILLANCE_DEMO,
                record_date__range=(dates["previous_start"], dates["latest_end"]),
            ).exists()
        )

    def test_clean_deletes_only_owned_rows_and_preserves_real_and_other_seed_data(self):
        self._run_seed()
        normal_barangay = self._scenario_barangay("normal")
        genuine_user = User.objects.create_user(
            username="real-surveillance-farmer",
            email="real-surveillance-farmer@example.test",
            password="test-pass",
            role=self.farmer_role,
        )
        genuine_farmer = Farmer.objects.create(
            user=genuine_user, barangay=normal_barangay, address="Genuine farm"
        )
        genuine_animal = LivestockInventory.objects.create(
            farmer=genuine_farmer,
            livestock_type=self.cattle,
            entry_type=LivestockInventory.EntryType.INDIVIDUAL,
            quantity=1,
            tag_number="GENUINE-SURVEILLANCE-01",
            status=LivestockInventory.StatusType.APPROVED,
            operational_status=LivestockInventory.OperationalStatus.ACTIVE,
            created_by=genuine_user,
        )
        date_in_latest_week = complete_week_windows(self.today)["latest_start"]
        genuine_case = DiseaseCase.objects.create(
            livestock=genuine_animal,
            name="Genuine field observation",
            affected_count=1,
            record_date=date_in_latest_week,
            status=DiseaseCase.DiseaseStatus.APPROVED,
            clinical_status=DiseaseCase.ClinicalStatus.NOT_RECORDED,
            created_by=genuine_user,
        )
        other_seed_case = DiseaseCase.objects.create(
            livestock=genuine_animal,
            name="Other seed record",
            affected_count=1,
            record_date=date_in_latest_week,
            status=DiseaseCase.DiseaseStatus.APPROVED,
            clinical_status=DiseaseCase.ClinicalStatus.NOT_RECORDED,
            review_remarks=SEED_MARKER_DISEASE,
            created_by=genuine_user,
        )
        other_seed_death = MortalityRecord.objects.create(
            livestock=genuine_animal,
            death_count=1,
            cause="Other seed cause",
            record_date=date_in_latest_week,
            status=MortalityRecord.MortalityRecordStatus.PENDING,
            review_remarks=SEED_MARKER_MORTALITY,
            created_by=genuine_user,
        )

        call_command("seed_surveillance_demo", clean=True)

        self.assertFalse(
            SurveillanceDemoOwnership.objects.filter(identifier__startswith=PREFIX).exists()
        )
        self.assertTrue(User.objects.filter(pk=genuine_user.pk).exists())
        self.assertTrue(Farmer.objects.filter(pk=genuine_farmer.pk).exists())
        self.assertTrue(LivestockInventory.objects.filter(pk=genuine_animal.pk).exists())
        self.assertTrue(DiseaseCase.objects.filter(pk=genuine_case.pk).exists())
        self.assertTrue(DiseaseCase.objects.filter(pk=other_seed_case.pk).exists())
        self.assertTrue(MortalityRecord.objects.filter(pk=other_seed_death.pk).exists())

    def test_clean_refuses_if_owned_object_has_an_unowned_related_record(self):
        self._run_seed()
        owned_inventory_marker = SurveillanceDemoOwnership.objects.filter(
            identifier__startswith=f"{PREFIX}normal:livestock:"
        ).first()
        self.assertIsNotNone(owned_inventory_marker)
        owned_animal = LivestockInventory.objects.get(pk=owned_inventory_marker.object_id)
        unrelated = DiseaseCase.objects.create(
            livestock=owned_animal,
            name="Unowned linked record",
            affected_count=1,
            record_date=self.today,
            status=DiseaseCase.DiseaseStatus.PENDING,
            created_by=owned_animal.farmer.user,
        )
        with self.assertRaisesRegex(CommandError, "is related but is not owned"):
            call_command("seed_surveillance_demo", clean=True)
        self.assertTrue(DiseaseCase.objects.filter(pk=unrelated.pk).exists())
        self.assertTrue(
            SurveillanceDemoOwnership.objects.filter(identifier__startswith=PREFIX).exists()
        )

    def test_command_refuses_an_explicitly_production_environment_before_writing(self):
        with patch.dict(os.environ, {"SMARTLIVESTOCK_DEMO_ENV": "production"}):
            with self.assertRaisesRegex(CommandError, "against production"):
                call_command("seed_surveillance_demo")
        self.assertFalse(
            SurveillanceDemoOwnership.objects.filter(identifier__startswith=PREFIX).exists()
        )

    def test_linkless_aggregate_mortality_is_not_fabricated_through_current_workflow(self):
        # The schema permits NULL animal links, but the active write serializer
        # and approval reconciliation require exact identified animals.
        self.assertTrue(MortalityRecord._meta.get_field("livestock").null)
        self.assertTrue(MortalityRecord._meta.get_field("batch").null)
        self.assertFalse(
            MortalityRecord.objects.filter(
                review_remarks__contains=SEED_MARKER_SURVEILLANCE_DEMO,
                livestock__isnull=True,
                batch__isnull=True,
            ).exists()
        )

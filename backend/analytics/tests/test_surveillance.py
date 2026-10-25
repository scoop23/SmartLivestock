from datetime import date, datetime, timedelta, timezone as datetime_timezone
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone as django_timezone
from rest_framework.test import APIRequestFactory, force_authenticate

from analytics.seed_markers import SEED_MARKER_DISEASE, SEED_MARKER_MORTALITY
from analytics.services.surveillance import _trend_signal, surveillance_summary
from analytics.views import disease_mortality_surveillance, surveillance_forecast_experiment
from diseases.models import DiseaseCase, MortalityRecord
from livestock.models import Barangay, Farmer, LivestockBatch, LivestockInventory, LivestockType
from users.models import Role, User


class DiseaseMortalitySurveillanceTests(TestCase):
    def setUp(self):
        self.admin_role = Role.objects.create(role_name="ADMIN")
        self.sibat_role = Role.objects.create(role_name="SIBAT")
        self.cbat_role = Role.objects.create(role_name="CBAT")
        self.farmer_role = Role.objects.create(role_name="FARMER")
        self.admin = User.objects.create_user(
            username="surveillance-admin", email="surveillance-admin@example.test",
            password="test-pass", role=self.admin_role, is_superuser=True,
        )
        self.barangay = Barangay.objects.create(
            barangay_name="Cawongan", latitude=Decimal("13.880000"), longitude=Decimal("121.210000"),
        )
        self.other_barangay = Barangay.objects.create(
            barangay_name="Manggas", latitude=Decimal("13.870000"), longitude=Decimal("121.240000"),
        )
        self.farmer_user = User.objects.create_user(
            username="surveillance-farmer", email="surveillance-farmer@example.test",
            password="test-pass", role=self.farmer_role,
        )
        self.farmer = Farmer.objects.create(user=self.farmer_user, barangay=self.barangay, address="Test address")
        self.type = LivestockType.objects.create(name="Cattle")
        self.animals = [self._animal(index) for index in range(4)]

    def _animal(self, index, *, farmer=None, batch=None):
        return LivestockInventory.objects.create(
            farmer=farmer or self.farmer,
            livestock_type=self.type,
            entry_type=LivestockInventory.EntryType.INDIVIDUAL,
            quantity=1,
            tag_number=f"SURV-{index}",
            status=LivestockInventory.StatusType.APPROVED,
            operational_status=LivestockInventory.OperationalStatus.ACTIVE,
            created_by=self.farmer_user,
            batch=batch,
        )

    def _disease(self, event_date, *, animal=None, batch=None, status="APPROVED", remarks=""):
        return DiseaseCase.objects.create(
            livestock=animal,
            batch=batch,
            name="Recorded respiratory signs",
            affected_count=1,
            record_date=event_date,
            status=status,
            clinical_status=DiseaseCase.ClinicalStatus.NOT_RECORDED,
            reviewed_at=datetime(2026, 10, 24, tzinfo=datetime_timezone.utc) if status == "APPROVED" else None,
            review_remarks=remarks,
            created_by=self.farmer_user,
        )

    def _mortality(self, event_date, *, count=1, animal=None, batch=None, source=None, status="APPROVED", remarks=""):
        return MortalityRecord.objects.create(
            livestock=animal,
            batch=batch,
            death_count=count,
            cause="Recorded respiratory failure",
            source_disease_case=source,
            record_date=event_date,
            status=status,
            reviewed_at=datetime(2026, 10, 24, tzinfo=datetime_timezone.utc) if status == "APPROVED" else None,
            review_remarks=remarks,
            created_by=self.farmer_user,
        )

    def test_complete_week_counts_approved_reports_and_keeps_heads_distinct(self):
        # Saturday 24 October: latest complete week is 12-18 Oct.
        self._disease(date(2026, 10, 12), animal=self.animals[0])
        self._disease(date(2026, 10, 13), animal=self.animals[0])  # separate report, same animal
        self._disease(date(2026, 10, 14), animal=self.animals[1], status="PENDING")
        self._disease(date(2026, 10, 15), animal=self.animals[1], status="VERIFIED")
        self._disease(date(2026, 10, 16), animal=self.animals[1], status="SUBJECT_TO_REVISION")
        self._mortality(date(2026, 10, 12), animal=self.animals[2], status="PENDING")
        summary = surveillance_summary(user=self.admin, today=date(2026, 10, 24))

        week = summary["disease"]["latest_complete_week"]
        self.assertEqual((week["reports"], week["affected_heads"]), (2, 2))
        self.assertEqual(week["distinct_identified_livestock"], 1)
        self.assertEqual(summary["mortality"]["latest_complete_week"]["deaths"], 0)
        self.assertEqual(summary["periods"]["latest_complete_week"], {"start": "2026-10-12", "end": "2026-10-18"})
        self.assertEqual(len(summary["disease"]["daily_last_14_days"]), 14)

    def test_mortality_rate_uses_current_official_individual_snapshot(self):
        report = self._mortality(date(2026, 10, 1), count=2, animal=self.animals[0])
        report.affected_livestock.add(self.animals[1])
        # A later duplicate report for an already identified death is not another death.
        self._mortality(date(2026, 10, 2), count=1, animal=self.animals[0])
        summary = surveillance_summary(user=self.admin, today=date(2026, 10, 24))

        mortality = summary["mortality"]
        self.assertEqual(mortality["population_denominator"], 4)
        self.assertEqual(mortality["last_30_days"]["deaths"], 2)
        self.assertEqual(mortality["identified_animals_last_30_days"], 2)
        self.assertEqual(mortality["rate_percent"], 50.0)
        self.assertIn("current approved active individual inventory", mortality["rate_method"])

    def test_weekly_alert_levels_are_explicit_record_count_rules(self):
        self.assertEqual(_trend_signal(0, 0)["level"], "INSUFFICIENT_DATA")
        self.assertEqual(_trend_signal(2, 1)["level"], "WATCH")
        elevated = _trend_signal(4, 2)
        self.assertEqual(elevated["level"], "ELEVATED")
        self.assertIn("at least 2 times", elevated["explanation"])

    def test_missing_denominator_returns_no_rate(self):
        for animal in self.animals:
            animal.operational_status = LivestockInventory.OperationalStatus.DECEASED
            animal.save(update_fields=["operational_status"])
        self._mortality(date(2026, 10, 1), count=1)

        summary = surveillance_summary(user=self.admin, today=date(2026, 10, 24))
        self.assertEqual(summary["mortality"]["population_denominator"], 0)
        self.assertIsNone(summary["mortality"]["rate_percent"])

    def test_temporal_association_requires_disease_before_death(self):
        prior = self._disease(date(2026, 10, 1), animal=self.animals[0])
        death = self._mortality(date(2026, 10, 5), animal=self.animals[0], source=prior)
        self._disease(date(2026, 10, 7), animal=self.animals[1])

        summary = surveillance_summary(user=self.admin, today=date(2026, 10, 24))
        events = summary["associations"]["events"]
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]["mortality_record"], f"MOR-{death.pk}")
        self.assertEqual(events[0]["relationship"], "explicit_source_disease_case")
        self.assertEqual(events[0]["days_between"], 4)
        self.assertIn("does not establish", events[0]["interpretation"])

    def test_temporal_association_detects_shared_herd(self):
        herd = LivestockBatch.objects.create(
            farmer=self.farmer,
            livestock_type=self.type,
            batch_name="Shared herd",
            batch_code="SURV-HERD-1",
            created_by=self.farmer_user,
        )
        diseased_animal = self._animal(10, batch=herd)
        deceased_animal = self._animal(11, batch=herd)
        self._disease(date(2026, 10, 1), animal=diseased_animal)
        self._mortality(date(2026, 10, 5), animal=deceased_animal)

        summary = surveillance_summary(user=self.admin, today=date(2026, 10, 24))
        self.assertEqual(len(summary["associations"]["events"]), 1)
        self.assertEqual(summary["associations"]["events"][0]["relationship"], "same_herd")

    def test_undated_and_synthetic_records_are_not_counted_as_zero_activity(self):
        self._disease(None)
        self._disease(date(2026, 10, 12), animal=self.animals[0], remarks=SEED_MARKER_DISEASE)
        self._mortality(None)
        self._mortality(date(2026, 10, 12), remarks=SEED_MARKER_MORTALITY)
        summary = surveillance_summary(user=self.admin, today=date(2026, 10, 24))

        self.assertEqual(summary["disease"]["undated_approved_reports_excluded"], 1)
        self.assertEqual(summary["disease"]["latest_complete_week"]["reports"], 0)
        self.assertEqual(summary["mortality"]["undated_approved_reports_excluded"], 1)
        self.assertEqual(summary["mortality"]["last_30_days"]["deaths"], 0)
        self.assertIn("not measured", summary["data_quality"]["reporting_completeness"])

    def test_only_municipal_reviewers_can_access_surveillance_endpoints(self):
        for role in (self.sibat_role, self.cbat_role):
            reviewer = User.objects.create_user(
                username=f"surveillance-{role.role_name.lower()}",
                email=f"surveillance-{role.role_name.lower()}@example.test",
                password="test-pass", role=role, assigned_barangay=self.barangay,
            )
            for path, view in (
                ("/api/analytics/surveillance/", disease_mortality_surveillance),
                ("/api/analytics/surveillance/forecast-experiment/", surveillance_forecast_experiment),
            ):
                request = APIRequestFactory().get(path)
                force_authenticate(request, user=reviewer)
                self.assertEqual(view(request).status_code, 403)

        request = APIRequestFactory().get("/api/analytics/surveillance/")
        force_authenticate(request, user=self.admin)
        self.assertEqual(disease_mortality_surveillance(request).status_code, 200)

        experiment_request = APIRequestFactory().get("/api/analytics/surveillance/forecast-experiment/")
        force_authenticate(experiment_request, user=self.admin)
        self.assertEqual(surveillance_forecast_experiment(experiment_request).status_code, 200)

    def test_non_reviewer_is_denied_by_endpoint(self):
        request = APIRequestFactory().get("/api/analytics/surveillance/")
        force_authenticate(request, user=self.farmer_user)
        response = disease_mortality_surveillance(request)
        self.assertEqual(response.status_code, 403)

        experiment_request = APIRequestFactory().get("/api/analytics/surveillance/forecast-experiment/")
        force_authenticate(experiment_request, user=self.farmer_user)
        experiment_response = surveillance_forecast_experiment(experiment_request)
        self.assertEqual(experiment_response.status_code, 403)

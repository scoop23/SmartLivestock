from datetime import timedelta
from django.utils import timezone
from rest_framework.test import APITestCase
from livestock.models import Barangay, Farmer, LivestockBatch, LivestockInventory, LivestockType
from production.models import BreedingRecord, CalvingRecord, LivestockTreatmentRecord, get_species_gestation_days
from production.reproductive_service import (
    resolve_reproductive_status,
    check_active_bull_herd_exposure,
    calculate_conception_analytics,
    evaluate_conception_prediction_readiness,
    ReproductiveStatus,
)
from users.models import Role, User


class ReproductiveManagementTests(APITestCase):
    def setUp(self):
        self.farmer_role, _ = Role.objects.get_or_create(role_name="FARMER")
        self.sibat_role, _ = Role.objects.get_or_create(role_name="SIBAT")
        self.barangay, _ = Barangay.objects.get_or_create(
            barangay_name="Poblacion",
            defaults={"latitude": 13.8765, "longitude": 121.2144},
        )

        # Farmer 1
        self.user1 = User.objects.create_user(
            username="farmer_juan",
            email="juan@example.invalid",
            role=self.farmer_role,
            account_status=User.AccountStatus.APPROVED,
        )
        self.farmer1 = Farmer.objects.create(
            user=self.user1, barangay=self.barangay, address="Sitio 1"
        )

        # Farmer 2 (unauthorized neighbor)
        self.user2 = User.objects.create_user(
            username="farmer_pedro",
            email="pedro@example.invalid",
            role=self.farmer_role,
            account_status=User.AccountStatus.APPROVED,
        )
        self.farmer2 = Farmer.objects.create(
            user=self.user2, barangay=self.barangay, address="Sitio 2"
        )

        self.cattle, _ = LivestockType.objects.get_or_create(name="Cattle")
        self.carabao, _ = LivestockType.objects.get_or_create(name="Carabao")

        # Female Cattle
        self.cow = LivestockInventory.objects.create(
            farmer=self.farmer1,
            livestock_type=self.cattle,
            tag_number="COW-001",
            sex="FEMALE",
            status="APPROVED",
            operational_status="ACTIVE",
            created_by=self.user1,
        )

        # Male Cattle (Bull)
        self.bull = LivestockInventory.objects.create(
            farmer=self.farmer1,
            livestock_type=self.cattle,
            tag_number="BULL-001",
            sex="MALE",
            status="APPROVED",
            operational_status="ACTIVE",
            created_by=self.user1,
        )

        # Herd Batches
        self.batch_alpha = LivestockBatch.objects.create(
            farmer=self.farmer1,
            batch_name="Alpha Pasture",
            batch_code="BATCH-ALPHA",
            livestock_type=self.cattle,
            created_by=self.user1,
            status=LivestockBatch.StatusType.ACTIVE,
        )
        self.batch_beta = LivestockBatch.objects.create(
            farmer=self.farmer1,
            batch_name="Beta Feedlot",
            batch_code="BATCH-BETA",
            livestock_type=self.cattle,
            created_by=self.user1,
            status=LivestockBatch.StatusType.ACTIVE,
        )

        self.client.force_authenticate(user=self.user1)

    # -------------------------------------------------------------------------
    # PHASE 3: Reproductive Status Rules
    # -------------------------------------------------------------------------

    def test_male_animal_receives_not_applicable(self):
        """Male animals must receive NOT_APPLICABLE regardless of herd records."""
        status_info = resolve_reproductive_status(self.bull)
        self.assertEqual(status_info["status"], ReproductiveStatus.NOT_APPLICABLE)
        self.assertEqual(status_info["badge_label"], "Not Applicable")

    def test_female_open_receives_unknown_not_recorded(self):
        """Female animal with no breeding, exposure, or calving records has UNKNOWN status."""
        status_info = resolve_reproductive_status(self.cow)
        self.assertEqual(status_info["status"], ReproductiveStatus.UNKNOWN)
        self.assertEqual(status_info["badge_label"], "Unknown / Not Recorded")

    # -------------------------------------------------------------------------
    # PHASE 4: Bull Exposure & Herd Boundaries
    # -------------------------------------------------------------------------

    def test_bull_in_same_herd_batch_results_in_exposed(self):
        """Active bull in same batch sets female status to EXPOSED."""
        self.cow.batch = self.batch_alpha
        self.cow.save(update_fields=["batch"])

        self.bull.batch = self.batch_alpha
        self.bull.save(update_fields=["batch"])

        exposure = check_active_bull_herd_exposure(self.cow)
        self.assertTrue(exposure["exposed"])
        self.assertEqual(len(exposure["bulls"]), 1)
        self.assertEqual(exposure["bulls"][0]["tag_number"], "BULL-001")

        status_info = resolve_reproductive_status(self.cow)
        self.assertEqual(status_info["status"], ReproductiveStatus.EXPOSED)
        self.assertEqual(status_info["badge_label"], "Exposed")
        # Ensure herd exposure NEVER confirms pregnancy
        self.assertNotEqual(status_info["status"], ReproductiveStatus.PREGNANT)

    def test_bull_on_same_farm_different_herd_does_not_imply_exposure(self):
        """
        Critical constraint: Animals belonging to same farm/owner in different
        herds/batches MUST NOT infer exposure.
        """
        self.cow.batch = self.batch_alpha
        self.cow.save(update_fields=["batch"])

        self.bull.batch = self.batch_beta  # Different batch!
        self.bull.save(update_fields=["batch"])

        exposure = check_active_bull_herd_exposure(self.cow)
        self.assertFalse(exposure["exposed"])

        status_info = resolve_reproductive_status(self.cow)
        self.assertEqual(status_info["status"], ReproductiveStatus.UNKNOWN)

    # -------------------------------------------------------------------------
    # PHASE 3 & 4: Recorded Breeding Events
    # -------------------------------------------------------------------------

    def test_recorded_breeding_results_in_exposed_never_auto_pregnant(self):
        """
        A recorded breeding event without clinical confirmation results in EXPOSED,
        never PREGNANT.
        """
        today = timezone.localdate()
        record = BreedingRecord.objects.create(
            dam=self.cow,
            sire_livestock=self.bull,
            breeding_date=today - timedelta(days=20),
            breeding_type=BreedingRecord.BreedingType.NATURAL,
            status=BreedingRecord.BreedingStatus.PENDING_CHECK,
            gestation_days=283,
            created_by=self.user1,
        )

        status_info = resolve_reproductive_status(self.cow)
        self.assertEqual(status_info["status"], ReproductiveStatus.EXPOSED)
        self.assertNotEqual(status_info["status"], ReproductiveStatus.PREGNANT)
        self.assertIn("exposure does not confirm conception", status_info["explanation"])

    def test_pregnancy_confirmation_results_in_pregnant(self):
        """Explicitly confirmed pregnancy yields PREGNANT status."""
        today = timezone.localdate()
        BreedingRecord.objects.create(
            dam=self.cow,
            sire_tag_or_code="STRAW-BAT-901",
            breeding_date=today - timedelta(days=60),
            breeding_type=BreedingRecord.BreedingType.ARTIFICIAL_INSEMINATION,
            status=BreedingRecord.BreedingStatus.PREGNANT,
            pregnancy_confirmed_date=today - timedelta(days=5),
            pregnancy_confirmed_by=self.user1,
            confirmation_method="Transrectal Palpation",
            gestation_days=283,
            expected_due_date=today - timedelta(days=60) + timedelta(days=283),
            created_by=self.user1,
        )

        status_info = resolve_reproductive_status(self.cow)
        self.assertEqual(status_info["status"], ReproductiveStatus.PREGNANT)
        self.assertEqual(status_info["badge_label"], "Pregnant — Confirmed")
        self.assertIsNotNone(status_info["expected_calving_date"])
        self.assertTrue(status_info["is_confirmed_pregnant"])

    def test_calving_completes_reproductive_cycle(self):
        """A valid calving record completes the cycle."""
        today = timezone.localdate()
        # Historical breeding
        breeding = BreedingRecord.objects.create(
            dam=self.cow,
            breeding_date=today - timedelta(days=300),
            breeding_type=BreedingRecord.BreedingType.NATURAL,
            status=BreedingRecord.BreedingStatus.CALVED,
            created_by=self.user1,
        )
        CalvingRecord.objects.create(
            dam=self.cow,
            calving_date=today - timedelta(days=15),
            status=CalvingRecord.StatusType.APPROVED,
            calf_tag="CALF-001",
            calf_sex=CalvingRecord.SexType.FEMALE,
            birth_weight=32.5,
            created_by=self.user1,
        )

        status_info = resolve_reproductive_status(self.cow)
        self.assertEqual(status_info["status"], ReproductiveStatus.COMPLETE)
        self.assertEqual(status_info["badge_label"], "Complete")

    def test_subsequent_breeding_after_calving_starts_new_cycle(self):
        """
        Cycle awareness: If a cow calved previously and is exposed or bred again,
        the status transitions to EXPOSED or PREGNANT rather than remaining permanently COMPLETE.
        """
        today = timezone.localdate()
        # Past calving (100 days ago)
        CalvingRecord.objects.create(
            dam=self.cow,
            calving_date=today - timedelta(days=100),
            status=CalvingRecord.StatusType.APPROVED,
            created_by=self.user1,
        )
        # New breeding attempt (20 days ago)
        new_breeding = BreedingRecord.objects.create(
            dam=self.cow,
            sire_tag_or_code="STRAW-BAT-902",
            breeding_date=today - timedelta(days=20),
            breeding_type=BreedingRecord.BreedingType.ARTIFICIAL_INSEMINATION,
            status=BreedingRecord.BreedingStatus.PENDING_CHECK,
            gestation_days=283,
            created_by=self.user1,
        )

        status_info = resolve_reproductive_status(self.cow)
        self.assertEqual(status_info["status"], ReproductiveStatus.EXPOSED)
        self.assertNotEqual(status_info["status"], ReproductiveStatus.COMPLETE)

    def test_historical_overdue_pregnancy_not_persisted_indefinitely(self):
        """
        A confirmed pregnancy whose expected due date is overdue by more than 45 days
        without calving does not remain permanently active/valid.
        """
        today = timezone.localdate()
        # Breeding occurred 400 days ago (Cattle gestation 283 days; 400 > 283 + 45 = 328)
        BreedingRecord.objects.create(
            dam=self.cow,
            breeding_date=today - timedelta(days=400),
            breeding_type=BreedingRecord.BreedingType.NATURAL,
            status=BreedingRecord.BreedingStatus.PREGNANT,
            pregnancy_confirmed_date=today - timedelta(days=340),
            expected_due_date=today - timedelta(days=400) + timedelta(days=283),
            gestation_days=283,
            created_by=self.user1,
        )

        status_info = resolve_reproductive_status(self.cow)
        self.assertEqual(status_info["status"], ReproductiveStatus.UNKNOWN)
        self.assertIn("exceeded maximum biological gestation", status_info["explanation"])

    # -------------------------------------------------------------------------
    # PHASE 6: Conception Analytics (Formula, Denominator, and Test Fixture)
    # -------------------------------------------------------------------------

    def test_conception_analytics_test_fixture_40_events_24_conceptions_equals_60_percent(self):
        """
        Prompt Phase 6 Example:
        40 eligible breeding events with known outcomes, and 24 resulted in confirmed conception.
        Expected event-based observed conception rate is exactly 60.0%.
        Pending checks must be excluded from the denominator.
        """
        today = timezone.localdate()
        records_to_create = []

        # 24 Confirmed conceptions (PREGNANT or CALVED)
        for i in range(24):
            records_to_create.append(
                BreedingRecord(
                    dam=self.cow,
                    breeding_date=today - timedelta(days=50 + i),
                    breeding_type=BreedingRecord.BreedingType.ARTIFICIAL_INSEMINATION,
                    status=BreedingRecord.BreedingStatus.PREGNANT,
                    gestation_days=283,
                    created_by=self.user1,
                )
            )

        # 16 Known unsuccessful outcomes (FAILED or OPEN)
        for i in range(16):
            records_to_create.append(
                BreedingRecord(
                    dam=self.cow,
                    breeding_date=today - timedelta(days=100 + i),
                    breeding_type=BreedingRecord.BreedingType.ARTIFICIAL_INSEMINATION,
                    status=BreedingRecord.BreedingStatus.OPEN,
                    gestation_days=283,
                    created_by=self.user1,
                )
            )

        # 10 Pending checks (Unknown outcomes - MUST BE EXCLUDED from denominator!)
        for i in range(10):
            records_to_create.append(
                BreedingRecord(
                    dam=self.cow,
                    breeding_date=today - timedelta(days=5 + i),
                    breeding_type=BreedingRecord.BreedingType.ARTIFICIAL_INSEMINATION,
                    status=BreedingRecord.BreedingStatus.PENDING_CHECK,
                    gestation_days=283,
                    created_by=self.user1,
                )
            )

        BreedingRecord.objects.bulk_create(records_to_create)

        qs = BreedingRecord.objects.filter(dam=self.cow)
        analytics = calculate_conception_analytics(qs)

        self.assertEqual(analytics["total_eligible_breeding_events"], 50)
        self.assertEqual(analytics["events_with_known_outcomes"], 40)
        self.assertEqual(analytics["confirmed_conceptions"], 24)
        self.assertEqual(analytics["known_unsuccessful_outcomes"], 16)
        self.assertEqual(analytics["pending_outcome_checks"], 10)
        # Denominator is 40. 24 / 40 * 100 = 60.0%
        self.assertEqual(analytics["observed_conception_rate_pct"], 60.0)
        self.assertEqual(analytics["rate_status"], "SUFFICIENT")

    def test_empty_or_insufficient_outcomes_returns_honest_warning_state(self):
        """
        When there are too few or 0 known outcomes, the service returns INSUFFICIENT_DATA
        and observed_conception_rate_pct is None.
        """
        qs = BreedingRecord.objects.none()
        analytics = calculate_conception_analytics(qs)
        self.assertEqual(analytics["rate_status"], "INSUFFICIENT_DATA")
        self.assertIsNone(analytics["observed_conception_rate_pct"])
        self.assertIn("Insufficient", analytics["status_message"])

    # -------------------------------------------------------------------------
    # PHASE 7: Conception Prediction Readiness
    # -------------------------------------------------------------------------

    def test_conception_prediction_readiness_blocks_ungrounded_ml(self):
        """
        With 0 recorded breeding records in the live dataset, prediction readiness
        must return BLOCKED_PENDING_DATA rather than fabricating a model.
        """
        readiness = evaluate_conception_prediction_readiness(self.user1)
        self.assertEqual(readiness["status"], "BLOCKED_PENDING_DATA")
        self.assertFalse(readiness["is_ready"])
        self.assertIn("Deferred", readiness["verdict"])
        self.assertGreater(readiness["minimum_required_samples"], readiness["known_outcomes_available"])

    # -------------------------------------------------------------------------
    # PHASE 5 & 10: Treatment History & Security Permissions
    # -------------------------------------------------------------------------

    def test_treatment_record_creation_and_ownership_scoping(self):
        """Farmers can log treatments on their own livestock and query their profile."""
        today = timezone.localdate()
        res = self.client.post("/production/treatments/", {
            "livestock": self.cow.pk,
            "treatment_date": str(today),
            "treatment_type": "ANTIBIOTIC",
            "medication_name": "Oxytetracycline LA 200mg/mL",
            "reason": "Post-calving uterine cleanse prophylaxis",
            "dosage": "20 mL",
            "route_of_administration": "Intramuscular (IM)",
            "administered_by": "Dr. Dimaano (MAO)",
            "notes": "Monitor withdrawal period 28 days.",
        })
        self.assertEqual(res.status_code, 201)
        treatment_id = res.json()["id"]

        # Farmer 1 can see treatment in list
        get_res = self.client.get(f"/production/treatments/?livestock={self.cow.pk}")
        self.assertEqual(get_res.status_code, 200)
        self.assertEqual(len(get_res.json()), 1)
        self.assertEqual(get_res.json()[0]["medication_name"], "Oxytetracycline LA 200mg/mL")

        # Farmer 2 (unauthorized) cannot access or modify this treatment
        self.client.force_authenticate(user=self.user2)
        unauth_get = self.client.get(f"/production/treatments/{treatment_id}/")
        self.assertEqual(unauth_get.status_code, 404)

        # Farmer 2 cannot post treatment on Farmer 1's cow
        unauth_post = self.client.post("/production/treatments/", {
            "livestock": self.cow.pk,
            "treatment_date": str(today),
            "treatment_type": "VITAMINS",
            "medication_name": "Multivitamins ADE",
            "dosage": "10 mL",
        })
        self.assertEqual(unauth_post.status_code, 400)

    # -------------------------------------------------------------------------
    # PHASE 3 & 9: Pregnancy Confirmation API Endpoint
    # -------------------------------------------------------------------------

    def test_breeding_confirm_pregnancy_endpoint(self):
        """Testing the dedicated POST /production/breeding/<pk>/confirm-pregnancy/ endpoint."""
        today = timezone.localdate()
        record = BreedingRecord.objects.create(
            dam=self.cow,
            breeding_date=today - timedelta(days=45),
            breeding_type=BreedingRecord.BreedingType.ARTIFICIAL_INSEMINATION,
            status=BreedingRecord.BreedingStatus.PENDING_CHECK,
            gestation_days=283,
            created_by=self.user1,
        )

        res = self.client.post(f"/production/breeding/{record.pk}/confirm-pregnancy/", {
            "confirmation_date": str(today),
            "confirmation_method": "Veterinary Ultrasound Scan",
            "notes": "Single viable fetus observed with strong heartbeat.",
        })
        self.assertEqual(res.status_code, 200)
        record.refresh_from_db()
        self.assertEqual(record.status, BreedingRecord.BreedingStatus.PREGNANT)
        self.assertEqual(record.confirmation_method, "Veterinary Ultrasound Scan")
        self.assertEqual(record.pregnancy_confirmed_date, today)
        self.assertEqual(record.pregnancy_confirmed_by, self.user1)

    def test_reproductive_summary_endpoint(self):
        """Testing the GET /production/livestock/<pk>/reproductive-summary/ endpoint."""
        res = self.client.get(f"/production/livestock/{self.cow.pk}/reproductive-summary/")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["tag_number"], "COW-001")
        self.assertIn("reproductive_status", data)
        self.assertIn("timeline", data)
        self.assertIn("prediction_readiness", data)
        self.assertIn("gestation_summary", data)

from datetime import timedelta

from django.utils import timezone
from rest_framework.test import APITestCase

from analytics.services.gis import get_gis_aggregated_data
from livestock.models import Barangay, Farmer, LivestockInventory, LivestockType
from users.models import Notification, Role, User
from .models import DiseaseCase, DiseaseCaseFollowUp


class DiseaseFollowUpTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        roles = {role: Role.objects.create(role_name=role) for role in ("FARMER", "SIBAT", "CBAT", "MAO")}
        cls.local = Barangay.objects.create(barangay_name="Manggas", latitude=13.8, longitude=121.2)
        cls.remote = Barangay.objects.create(barangay_name="Bawi", latitude=13.9, longitude=121.3)

        def account(name, role, barangay=None):
            return User.objects.create_user(username=name, email=f"{name}@case.test", password=None,
                role=roles[role], account_status="APPROVED", assigned_barangay=barangay)

        cls.owner = account("owner", "FARMER")
        cls.other = account("other", "FARMER")
        cls.cbat = account("cbat", "CBAT", cls.local)
        cls.remote_cbat = account("remote-cbat", "CBAT", cls.remote)
        cls.sibat = account("sibat", "SIBAT", cls.local)
        cls.mao = account("mao", "MAO")
        cls.farmer = Farmer.objects.create(user=cls.owner, barangay=cls.local, address="Test")
        Farmer.objects.create(user=cls.other, barangay=cls.remote, address="Test")
        cls.species = LivestockType.objects.create(name="Cattle")
        cls.animal = LivestockInventory.objects.create(farmer=cls.farmer, livestock_type=cls.species,
            tag_number="OWNER-001", entry_type="INDIVIDUAL", quantity=1, status="APPROVED", created_by=cls.owner)
        cls.case = DiseaseCase.objects.create(livestock=cls.animal, name="Observed symptoms", affected_count=1,
            record_date=timezone.localdate() - timedelta(days=7), status="APPROVED", created_by=cls.owner)

    def post(self, user, event_type="FARMER_UPDATE", **extra):
        self.client.force_authenticate(user)
        return self.client.post(f"/api/diseases/cases/{self.case.pk}/follow-ups/", {
            "event_type": event_type, "observed_on": str(timezone.localdate()),
            "notes": "Symptoms have improved; please arrange follow-up.", **extra,
        }, format="json")

    def test_farmer_observation_notifies_scoped_officers_without_resolving_case(self):
        response = self.post(self.owner)
        self.assertEqual(response.status_code, 201, response.data)
        self.case.refresh_from_db()
        self.assertEqual(self.case.status, "APPROVED")
        self.assertEqual(self.case.clinical_status, "NOT_RECORDED")
        self.assertEqual(self.case.follow_ups.count(), 1)
        self.assertTrue(Notification.objects.filter(user=self.cbat, link__startswith="/sibat-alerts").exists())
        self.assertFalse(Notification.objects.filter(user=self.remote_cbat).exists())

    def test_farmer_and_sibat_cannot_record_official_resolution(self):
        for user in (self.owner, self.sibat):
            self.assertEqual(self.post(user, "RECOVERED").status_code, 403)
        self.assertFalse(DiseaseCaseFollowUp.objects.exists())

    def test_other_farmer_and_out_of_scope_cbat_cannot_access_case(self):
        for user in (self.other, self.remote_cbat):
            self.client.force_authenticate(user)
            self.assertEqual(self.client.get(f"/api/diseases/cases/{self.case.pk}/follow-ups/").status_code, 404)
            self.assertEqual(self.post(user).status_code, 404)

    def test_cbat_resolution_is_auditable_and_excluded_from_recent_gis(self):
        response = self.post(self.cbat, "RECOVERED", notes="Follow-up assessment completed; recovered.")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["clinical_status"], "RECOVERED")
        event = self.case.follow_ups.get()
        self.assertEqual(event.created_by, self.cbat)
        self.assertEqual(event.event_type, "RECOVERED")
        self.case.refresh_from_db()
        self.assertEqual(self.case.status, "APPROVED")
        gis = get_gis_aggregated_data(user=self.mao)["barangays_dict"]["Manggas"]
        self.assertEqual(gis["active_cases"], 0)
        self.assertEqual(gis["disease_cases"], 1)
        self.assertTrue(Notification.objects.filter(user=self.owner, link=f"/report-observation?reportId=DIS-{self.case.pk}").exists())
        self.assertEqual(self.post(self.mao, "CLOSED").status_code, 409)
        self.assertEqual(self.post(self.owner).status_code, 409)

    def test_mao_can_close_with_date_and_remarks(self):
        response = self.post(self.mao, "CLOSED", notes="Municipal review completed and case closed.")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["events"][0]["created_by_role"], "MAO")

    def test_invalid_dates_blank_notes_and_unapproved_cases_are_rejected(self):
        for payload in ({"notes": " "}, {"observed_on": str(timezone.localdate() + timedelta(days=1))},
                        {"observed_on": str(self.case.record_date - timedelta(days=1))}):
            self.assertEqual(self.post(self.owner, **payload).status_code, 400)
        self.case.status = "PENDING"
        self.case.save(update_fields=["status"])
        self.assertEqual(self.post(self.owner).status_code, 409)
        self.assertEqual(self.post(self.mao, "CLOSED").status_code, 409)

    def test_cbat_receives_new_inventory_and_health_alerts_only_within_scope(self):
        self.client.force_authenticate(self.owner)
        inventory = self.client.post("/api/livestock/inventory/", {
            "livestock_type": self.species.pk, "entry_type": "INDIVIDUAL", "quantity": 1,
            "tag_number": "OWNER-002",
        }, format="json")
        self.assertEqual(inventory.status_code, 201, inventory.data)
        self.assertTrue(Notification.objects.filter(user=self.cbat, related_entity_type="livestock_inventory").exists())
        health = self.client.post("/api/diseases/cases/", {
            "livestock": self.animal.pk, "name": "Coughing", "affected_count": 1,
            "record_date": str(timezone.localdate()),
        }, format="json")
        self.assertEqual(health.status_code, 201, health.data)
        self.assertTrue(Notification.objects.filter(user=self.cbat, related_entity_type="disease_case", link__startswith="/sibat-alerts").exists())
        self.assertFalse(Notification.objects.filter(user=self.remote_cbat).exists())

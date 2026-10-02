"""Exercise real API permissions; fixtures never touch the configured live database."""
from datetime import date
from io import StringIO
from django.core.management import call_command, CommandError
from rest_framework.test import APITestCase
from livestock.models import Barangay, Farmer, LivestockType, LivestockInventory, LivestockBatch, CensusSubmission
from production.models import ProductionRecord, LiveAnimalSale, CalvingRecord
from diseases.models import DiseaseCase, MortalityRecord
from users.models import User, Role, Notification


class LogVisibilityTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.local = Barangay.objects.create(barangay_name="Local", latitude=0, longitude=0)
        cls.remote = Barangay.objects.create(barangay_name="Remote", latitude=0, longitude=0)
        roles = {name: Role.objects.create(role_name=name) for name in ("FARMER", "SIBAT", "MAO")}
        def account(name, role, barangay=None):
            return User.objects.create_user(username=name, email=name+"@example.test", password=None,
                role=roles[role], account_status="APPROVED", assigned_barangay=barangay)
        cls.owner = account("owner", "FARMER")
        cls.other = account("other", "FARMER")
        cls.sibat = account("local-reviewer", "SIBAT", cls.local)
        cls.other_sibat = account("remote-reviewer", "SIBAT", cls.remote)
        cls.unassigned = account("legacy-reviewer", "SIBAT")
        cls.mao = account("mao", "MAO")
        cls.cattle = LivestockType.objects.create(name="Cattle")
        cls.expected = {}
        for user, barangay in ((cls.owner, cls.local), (cls.other, cls.remote)):
            farmer = Farmer.objects.create(user=user, barangay=barangay, address="Test address")
            herd = LivestockBatch.objects.create(farmer=farmer, livestock_type=cls.cattle,
                batch_name="Test herd", batch_code="TEST-"+user.username, created_by=user)
            rows = {"/livestock/batches/?all=true": {herd.pk}}
            specifications = [
                ("/livestock/inventory/?include_inactive=true", LivestockInventory, {}),
                ("/production/records/", ProductionRecord, {"production_type":"MILK", "quantity":10,"unit":"LITERS","record_date":date(2026,1,1)}),
                ("/production/sales/", LiveAnimalSale, {"quantity":1,"sale_date":date(2026,1,1)}),
                ("/production/calving/", CalvingRecord, {"calving_date":date(2026,1,1)}),
                ("/diseases/cases/", DiseaseCase, {"name":"Test disease","affected_count":1}),
                ("/diseases/mortality/", MortalityRecord, {"cause":"Test cause","death_count":1}),
            ]
            # Use each model's real status choices; REJECTED is not universal.
            for path, model, fields in specifications:
                rows[path] = set()
                for status, _ in model._meta.get_field("status").choices:
                    animal = LivestockInventory.objects.create(farmer=farmer, livestock_type=cls.cattle,
                        created_by=user, status="APPROVED", quantity=1)
                    values = dict(fields, status=status, created_by=user)
                    if model is LivestockInventory:
                        values.update(farmer=farmer, livestock_type=cls.cattle, quantity=1)
                    else:
                        values["dam" if model is CalvingRecord else "livestock"] = animal
                    obj = model.objects.create(**values)
                    rows[path].add(obj.pk)
            # Herd-only relationships must work without a direct livestock link.
            for path, model, fields in specifications:
                if model in (ProductionRecord, LiveAnimalSale, DiseaseCase, MortalityRecord):
                    rows[path].add(model.objects.create(batch=herd, created_by=user, **fields).pk)
            rows["/livestock/inventory/?include_inactive=true"] = set(LivestockInventory.objects.filter(farmer=farmer).values_list("pk",flat=True))
            rows["/livestock/census/"] = {CensusSubmission.objects.create(barangay=barangay, submitted_by=cls.sibat if user==cls.owner else cls.other_sibat, report_year=2026,report_quarter=1).pk}
            cls.expected[user.pk] = rows

    def assert_visibility(self, user, owners, census=True):
        self.client.force_authenticate(user)
        for path in self.expected[self.owner.pk]:
            if not census and "census" in path:
                self.assertEqual(self.client.get(path).status_code,403)
                continue
            response = self.client.get(path)
            self.assertEqual(response.status_code,200,(path,response.data))
            expected = set().union(*(self.expected[owner.pk][path] for owner in owners))
            self.assertEqual({row["id"] for row in response.data},expected,path)

    def test_farmer_owns_all_statuses_and_history(self):
        self.assert_visibility(self.owner,[self.owner],census=False)

    def test_other_farmer_cannot_see_local_logs(self):
        self.assert_visibility(self.other,[self.other],census=False)

    def test_same_barangay_sibat_sees_individual_and_herd_logs(self):
        self.assert_visibility(self.sibat,[self.owner])

    def test_other_barangay_sibat_sees_only_its_own_scope(self):
        self.assert_visibility(self.other_sibat,[self.other])

    def test_mao_keeps_municipal_access(self):
        self.assert_visibility(self.mao,[self.owner,self.other])

    def test_legacy_account_assignment_restores_existing_logs(self):
        self.assert_visibility(self.unassigned,[])
        self.client.force_authenticate(self.unassigned)
        self.assertIsNone(self.client.get("/api/users/me/").data["assigned_barangay_id"])
        call_command("assign_sibat_barangay",username=self.unassigned.username,barangay="Local",stdout=StringIO())
        self.unassigned.refresh_from_db()
        self.assert_visibility(self.unassigned,[self.owner])
        profile = self.client.get("/api/users/me/").data
        self.assertEqual(profile["assigned_barangay_name"],"Local")
        # Assignment must never become a farmer-writable profile field.
        self.client.patch("/api/users/me/",{"assigned_barangay_id":self.remote.pk})
        self.unassigned.refresh_from_db()
        self.assertEqual(self.unassigned.assigned_barangay_id,self.local.pk)

    def test_setup_rejects_unknown_barangay_and_non_sibat(self):
        for username,barangay in ((self.owner.username,"Local"),(self.unassigned.username,"Unknown")):
            with self.assertRaises(CommandError):
                call_command("assign_sibat_barangay",username=username,barangay=barangay,stdout=StringIO())
        self.unassigned.refresh_from_db()
        self.assertIsNone(self.unassigned.assigned_barangay_id)

    def test_cross_barangay_details_and_review_are_denied(self):
        self.client.force_authenticate(self.other_sibat)
        for path in ("/production/records/","/production/sales/","/production/calving/","/diseases/cases/","/diseases/mortality/"):
            pk = min(self.expected[self.owner.pk][path])
            self.assertEqual(self.client.get(f"{path}{pk}/").status_code,404,path)
            self.assertEqual(self.client.post(f"{path}{pk}/review/",{"status":"VERIFIED"},format="json").status_code,404,path)

    def test_inventory_notification_and_review_chain(self):
        self.client.force_authenticate(self.owner)
        response = self.client.post("/livestock/inventory/",{"livestock_type":self.cattle.pk,"quantity":1,"entry_type":"INDIVIDUAL"},format="json")
        self.assertEqual(response.status_code,201,response.data)
        self.assertTrue(Notification.objects.filter(user=self.sibat).exists())
        self.assertFalse(Notification.objects.filter(user__in=[self.other_sibat,self.unassigned]).exists())
        pk=response.data["id"]
        self.client.force_authenticate(self.sibat)
        response=self.client.post(f"/livestock/inventory/{pk}/review/",{"status":"VERIFIED","remarks":"Checked"},format="json")
        self.assertEqual(response.status_code,200,response.data)
        self.assertTrue(Notification.objects.filter(user=self.mao).exists())
        self.client.force_authenticate(self.mao)
        response=self.client.post(f"/livestock/inventory/{pk}/review/",{"status":"SUBJECT_TO_REVISION","remarks":"Correct tag"},format="json")
        self.assertEqual(response.status_code,200,response.data)
        self.assertTrue(Notification.objects.filter(user=self.owner).exists())
        self.client.force_authenticate(self.owner)
        response=self.client.patch(f"/livestock/inventory/{pk}/",{"tag_number":"TEST-RESUBMITTED"},format="json")
        self.assertEqual(response.status_code,200,response.data)
        self.assertEqual(response.data["status"],"PENDING")
        self.client.force_authenticate(self.sibat)
        self.assertEqual(self.client.get(f"/livestock/inventory/{pk}/").status_code,200)

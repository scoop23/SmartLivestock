"""Access-scope regression tests; fixtures use only Django's test database."""
from datetime import date, time
from django.test import override_settings
from rest_framework.test import APITestCase
from livestock.models import Barangay, Farmer, LivestockType, LivestockInventory, CensusSubmission
from production.models import ProductionRecord, LiveAnimalSale, CalvingRecord
from diseases.models import DiseaseCase, MortalityRecord
from users.models import User, Role, Notification, ProgramSchedule, ProgramBooking
from users.notification_views import notify_role, get_notification_recipients_for_farmer
from smartlivestock.workflows import scope_reviewer_queryset


@override_settings(SECURE_SSL_REDIRECT=False)
class AccessScopeTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.local = Barangay.objects.create(barangay_name="Scope Local", latitude=0, longitude=0)
        cls.remote = Barangay.objects.create(barangay_name="Scope Remote", latitude=0, longitude=0)
        roles = {r: Role.objects.create(role_name=r) for r in ("FARMER", "SIBAT", "MAO", "ADMIN")}
        def account(name, role, barangay=None, scope="ASSIGNED_ONLY"):
            return User.objects.create_user(username=name, email=name+"@scope.test", password=None,
                role=roles[role], account_status="APPROVED", assigned_barangay=barangay, access_scope=scope)
        cls.sibat = account("local-officer", "SIBAT", cls.local)
        cls.second = account("second-local", "SIBAT", cls.local)
        cls.remote_officer = account("remote-officer", "SIBAT", cls.remote)
        cls.unassigned = account("unassigned", "SIBAT")
        cls.municipal = account("municipal", "SIBAT", cls.local, "ALL_BARANGAYS")
        cls.mao = account("mao", "MAO")
        cls.admin = account("admin", "ADMIN")
        cls.owner = account("local-owner", "FARMER")
        cls.other = account("remote-owner", "FARMER")
        cls.farmer = Farmer.objects.create(user=cls.owner, barangay=cls.local, address="Test")
        cls.other_farmer = Farmer.objects.create(user=cls.other, barangay=cls.remote, address="Test")
        cls.species = LivestockType.objects.create(name="Scope Cattle")
        cls.local_animal = LivestockInventory.objects.create(farmer=cls.farmer, livestock_type=cls.species,
            quantity=1, created_by=cls.owner, status="APPROVED")
        cls.remote_animal = LivestockInventory.objects.create(farmer=cls.other_farmer, livestock_type=cls.species,
            quantity=1, created_by=cls.other, status="PENDING")
        cls.schedule = ProgramSchedule.objects.create(date=date(2099,1,1), capacity=4, program="Scope program", created_by=cls.mao)
        cls.local_booking = ProgramBooking.objects.create(schedule=cls.schedule, farmer=cls.owner, time=time(8))
        cls.remote_booking = ProgramBooking.objects.create(schedule=cls.schedule, farmer=cls.other, time=time(9,30))

    def authenticate(self, user):
        self.client.force_authenticate(user)

    def test_default_scope_and_unassigned_are_restrictive(self):
        self.assertEqual(self.sibat.access_scope, "ASSIGNED_ONLY")
        self.assertEqual(set(scope_reviewer_queryset(Farmer.objects.all(), self.sibat)), {self.farmer})
        self.assertFalse(scope_reviewer_queryset(Farmer.objects.all(), self.unassigned).exists())

    def test_lists_and_id_retrieval_are_scoped(self):
        self.authenticate(self.sibat)
        self.assertEqual({row["id"] for row in self.client.get("/livestock/inventory/").data}, {self.local_animal.pk})
        self.assertEqual(self.client.get(f"/livestock/inventory/{self.remote_animal.pk}/").status_code, 404)
        self.assertEqual(self.client.get(f"/livestock/farmers/{self.remote.pk}/").data, [])
        self.assertEqual(self.client.get("/livestock/inventory/", {"barangay_id":self.remote.pk}).data, [])

    def test_expanded_scope_allows_remote_review_but_not_final_approval(self):
        self.authenticate(self.municipal)
        path=f"/livestock/inventory/{self.remote_animal.pk}/"
        self.assertEqual(self.client.get(path).status_code, 200)
        self.assertEqual(self.client.post(path+"review/", {"status":"VERIFIED"}).status_code, 200)
        self.assertEqual(self.client.post(path+"review/", {"status":"APPROVED"}).status_code, 400)
        self.remote_animal.refresh_from_db()
        self.assertEqual(self.remote_animal.status, "VERIFIED")
        self.assertEqual(self.client.get("/api/users/directory/").status_code, 403)

    def test_restricted_review_denies_remote_id(self):
        self.authenticate(self.sibat)
        self.assertEqual(self.client.post(f"/livestock/inventory/{self.remote_animal.pk}/review/", {"status":"VERIFIED"}).status_code,404)

    def test_mao_and_admin_can_change_scope_without_changing_primary_barangay(self):
        for operator in (self.mao, self.admin):
            self.authenticate(operator)
            response=self.client.patch(f"/api/users/{self.sibat.pk}/assignment/", {"access_scope":"ALL_BARANGAYS"}, format="json")
            self.assertEqual(response.status_code,200)
            self.assertEqual(response.data["assigned_barangay_id"],self.local.pk)
            self.assertEqual(response.data["role"],"SIBAT")
        self.sibat.refresh_from_db()
        self.authenticate(self.sibat)
        self.assertEqual(self.client.get(f"/livestock/inventory/{self.remote_animal.pk}/").status_code,200)

    def test_change_barangay_updates_scope_without_reassigning_farmers(self):
        self.authenticate(self.mao)
        response=self.client.patch(f"/api/users/{self.sibat.pk}/assignment/", {"assigned_barangay_id":self.remote.pk})
        self.assertEqual(response.status_code,200)
        self.sibat.refresh_from_db()
        self.authenticate(self.sibat)
        self.assertEqual(self.client.get(f"/livestock/inventory/{self.local_animal.pk}/").status_code,404)
        self.assertEqual(self.client.get(f"/livestock/inventory/{self.remote_animal.pk}/").status_code,200)
        self.farmer.refresh_from_db()
        self.assertEqual(self.farmer.barangay_id,self.local.pk)
        self.assertNotIn(self.sibat, get_notification_recipients_for_farmer(self.farmer))
        self.assertIn(self.sibat, get_notification_recipients_for_farmer(self.other_farmer))

    def test_farmer_move_updates_scope_and_recipients(self):
        self.farmer.barangay=self.remote
        self.farmer.save(update_fields=["barangay"])
        self.assertNotIn(self.sibat,get_notification_recipients_for_farmer(self.farmer))
        self.assertIn(self.remote_officer,get_notification_recipients_for_farmer(self.farmer))
        self.assertFalse(scope_reviewer_queryset(Farmer.objects.filter(pk=self.farmer.pk),self.sibat).exists())

    def test_scope_changes_are_privileged_and_input_is_validated(self):
        path=f"/api/users/{self.sibat.pk}/assignment/"
        for operator in (self.owner,self.sibat,self.municipal):
            self.authenticate(operator)
            self.assertEqual(self.client.patch(path,{"access_scope":"ALL_BARANGAYS"}).status_code,403)
            self.client.patch("/api/users/me/",{"access_scope":"ALL_BARANGAYS"})
            operator.refresh_from_db()
            if operator!=self.municipal:self.assertEqual(operator.access_scope,"ASSIGNED_ONLY")
        self.authenticate(self.mao)
        for payload in ({"access_scope":"invalid"},{"role":"MAO"},{"assigned_barangay_id":999999},{}):
            self.assertEqual(self.client.patch(path,payload,format="json").status_code,400)
        self.assertEqual(self.client.patch(f"/api/users/{self.owner.pk}/assignment/",{"access_scope":"ALL_BARANGAYS"}).status_code,400)

    def test_notification_recipients_are_scoped_active_and_deduplicated(self):
        notify_role("SIBAT",barangay_id=self.local.pk,title="Local event")
        recipients=list(Notification.objects.filter(title="Local event").values_list("user_id",flat=True))
        self.assertCountEqual(recipients,[self.sibat.pk,self.second.pk,self.municipal.pk])
        self.assertEqual(len(recipients),len(set(recipients)))
        self.second.is_active=False;self.second.save(update_fields=["is_active"])
        self.assertNotIn(self.second,get_notification_recipients_for_farmer(self.farmer))
        notify_role("SIBAT",title="No location")
        self.assertEqual(list(Notification.objects.filter(title="No location").values_list("user_id",flat=True)),[self.municipal.pk])

    def test_unassigned_all_barangay_officer_receives_events(self):
        self.unassigned.access_scope="ALL_BARANGAYS";self.unassigned.save(update_fields=["access_scope"])
        self.assertIn(self.unassigned,get_notification_recipients_for_farmer(self.other_farmer))
        self.assertEqual(scope_reviewer_queryset(Farmer.objects.all(),self.unassigned).count(),2)

    def test_notifications_and_unread_counts_belong_to_authenticated_user(self):
        mine=Notification.objects.create(user=self.sibat,title="Mine",message="Test")
        theirs=Notification.objects.create(user=self.remote_officer,title="Theirs",message="Test")
        self.authenticate(self.sibat)
        response=self.client.get("/api/notifications/")
        self.assertEqual(response.data["unread_count"],1)
        self.assertEqual([n["id"] for n in response.data["notifications"]],[mine.pk])
        self.assertEqual(self.client.patch(f"/api/notifications/{theirs.pk}/read/").status_code,404)
        self.client.post("/api/notifications/mark-all-read/")
        theirs.refresh_from_db();self.assertFalse(theirs.is_read)

    def test_historical_notifications_survive_scope_changes(self):
        notification=Notification.objects.create(user=self.sibat,title="History",message="Test")
        self.sibat.assigned_barangay=self.remote;self.sibat.save(update_fields=["assigned_barangay"])
        self.authenticate(self.sibat)
        self.assertEqual(self.client.get("/api/notifications/").data["notifications"][0]["id"],notification.pk)

    def test_bookings_and_officer_counts_are_scoped(self):
        self.authenticate(self.sibat)
        self.assertEqual([r["id"] for r in self.client.get("/community/bookings/").data],[self.local_booking.pk])
        schedule=self.client.get("/community/schedules/").data[0]
        self.assertEqual(schedule["booking_count"],1)
        self.assertEqual(schedule["remaining_slots"],2) # shared capacity stays accurate
        self.authenticate(self.municipal)
        self.assertEqual(len(self.client.get("/community/bookings/").data),2)

    def test_dashboard_aggregates_and_census_reports_are_scoped(self):
        self.remote_animal.status="APPROVED";self.remote_animal.save(update_fields=["status"])
        CensusSubmission.objects.create(barangay=self.remote,submitted_by=self.remote_officer,report_year=2026,report_quarter=1,status="VERIFIED")
        self.authenticate(self.sibat)
        self.assertEqual(self.client.get("/analytics/dashboard/").data["descriptive"]["population"]["total_heads"],1)
        summary=self.client.get("/analytics/census/").data
        self.assertEqual(summary["totals"]["submissions"],0)
        self.assertEqual(summary["coverage"]["total_barangays"],1)
        self.authenticate(self.municipal)
        self.assertEqual(self.client.get("/analytics/dashboard/").data["descriptive"]["population"]["total_heads"],2)
        self.assertEqual(self.client.get("/analytics/census/").data["totals"]["submissions"],1)

    def test_remote_health_and_production_reviews_follow_same_scope(self):
        for model,values,endpoint in (
            (ProductionRecord,{"quantity":2,"unit":"LITERS","production_type":"MILK","record_date":date.today()},"/production/records/"),
            (LiveAnimalSale,{"quantity":1,"sale_date":date.today()},"/production/sales/"),
            (DiseaseCase,{"name":"Test","affected_count":1},"/diseases/cases/"),
            (MortalityRecord,{"cause":"Test","death_count":1},"/diseases/mortality/"),
        ):
            record=model.objects.create(livestock=self.remote_animal,created_by=self.other,status="PENDING",**values)
            path=f"{endpoint}{record.pk}/review/"
            self.authenticate(self.sibat)
            self.assertEqual(self.client.post(path,{"status":"VERIFIED"}).status_code,404)
            self.authenticate(self.municipal)
            self.assertEqual(self.client.post(path,{"status":"VERIFIED"}).status_code,200)
            self.assertIn(self.client.post(path,{"status":"APPROVED"}).status_code,(400,403))

    def test_municipal_revision_informs_owner_and_scoped_officers(self):
        self.local_animal.status="VERIFIED";self.local_animal.save(update_fields=["status"])
        self.authenticate(self.mao)
        response=self.client.post(f"/livestock/inventory/{self.local_animal.pk}/review/",{"status":"SUBJECT_TO_REVISION","remarks":"Correct the tag"})
        self.assertEqual(response.status_code,200)
        self.assertTrue(Notification.objects.filter(user=self.owner).exists())
        self.assertTrue(Notification.objects.filter(user=self.sibat).exists())
        self.assertTrue(Notification.objects.filter(user=self.municipal).exists())
        self.assertFalse(Notification.objects.filter(user=self.remote_officer).exists())

    def test_submission_and_health_notifications_reach_current_officers(self):
        self.authenticate(self.other)
        for endpoint,payload in (
            ("/livestock/inventory/", {"livestock_type":self.species.pk,"entry_type":"INDIVIDUAL","quantity":1}),
            ("/production/records/", {"livestock":self.remote_animal.pk,"quantity":2,"unit":"LITERS","production_type":"MILK","record_date":date.today().isoformat()}),
            ("/diseases/cases/", {"livestock":self.remote_animal.pk,"name":"Observation","affected_count":1,"record_date":date.today().isoformat()}),
            ("/diseases/mortality/", {"livestock":self.remote_animal.pk,"cause":"Observation","death_count":1,"record_date":date.today().isoformat()}),
        ):
            self.remote_animal.status="APPROVED";self.remote_animal.save(update_fields=["status"])
            Notification.objects.all().delete() # isolated fixtures only
            response=self.client.post(endpoint,payload,format="json")
            self.assertEqual(response.status_code,201,(endpoint,response.data))
            self.assertTrue(Notification.objects.filter(user=self.remote_officer).exists(),endpoint)
            self.assertTrue(Notification.objects.filter(user=self.municipal).exists(),endpoint)
            self.assertFalse(Notification.objects.filter(user=self.sibat).exists(),endpoint)
            self.assertFalse(Notification.objects.filter(user=self.unassigned).exists(),endpoint)

    def test_returned_inventory_resubmits_to_current_scope(self):
        self.remote_animal.status="SUBJECT_TO_REVISION";self.remote_animal.save(update_fields=["status"])
        self.authenticate(self.other)
        response=self.client.patch(f"/livestock/inventory/{self.remote_animal.pk}/",{"tag_number":"Revised"})
        self.assertEqual(response.status_code,200)
        self.remote_animal.refresh_from_db()
        self.assertEqual(self.remote_animal.status,"PENDING")
        self.assertTrue(Notification.objects.filter(user=self.remote_officer).exists())
        self.assertTrue(Notification.objects.filter(user=self.municipal).exists())
        self.assertFalse(Notification.objects.filter(user=self.sibat).exists())

    def test_all_barangay_census_submission_and_revision_keep_role_authority(self):
        self.authenticate(self.municipal)
        response=self.client.post("/livestock/census/",{"barangay":self.remote.pk,"report_year":2026,"report_quarter":2,"items":[]},format="json")
        self.assertEqual(response.status_code,201,response.data)
        pk=response.data["id"]
        self.assertEqual(self.client.post(f"/livestock/census/{pk}/review/",{"status":"APPROVED"}).status_code,403)
        self.assertEqual(self.client.patch(f"/livestock/census/{pk}/",{"remarks":"Updated"}).status_code,200)
        self.authenticate(self.sibat)
        self.assertEqual(self.client.get(f"/livestock/census/{pk}/").status_code,404)

    def test_admin_final_approval_still_follows_verified_step(self):
        record=DiseaseCase.objects.create(livestock=self.remote_animal,created_by=self.other,name="Test",affected_count=1,status="VERIFIED")
        self.authenticate(self.admin)
        response=self.client.post(f"/diseases/cases/{record.pk}/review/",{"status":"APPROVED"})
        self.assertEqual(response.status_code,200,response.data)

    def test_nested_activity_schedule_counts_match_officer_scope(self):
        from users.models import Announcement
        Announcement.objects.create(title="Program",content="Test",posted_by=self.mao,schedule=self.schedule,is_published=True)
        self.authenticate(self.sibat)
        response=self.client.get("/community/announcements/")
        self.assertEqual(response.data[0]["schedule"]["booking_count"],1)
        self.assertEqual(response.data[0]["schedule"]["remaining_slots"],2)

    def test_booking_without_farmer_profile_never_broadcasts(self):
        legacy=User.objects.create_user(username="no-profile",email="no-profile@scope.test",password=None,
            role=self.owner.role,account_status="APPROVED")
        self.authenticate(legacy)
        response=self.client.post("/community/bookings/",{"schedule":self.schedule.pk,"time":"11:00"},format="json")
        self.assertEqual(response.status_code,201)
        self.assertFalse(Notification.objects.filter(user=self.sibat).exists())
        self.assertFalse(Notification.objects.filter(user=self.remote_officer).exists())

    def test_municipal_forwarding_notifies_admin_and_mao(self):
        self.authenticate(self.municipal)
        self.client.post(f"/livestock/inventory/{self.remote_animal.pk}/review/",{"status":"VERIFIED"})
        self.assertTrue(Notification.objects.filter(user=self.mao).exists())
        self.assertTrue(Notification.objects.filter(user=self.admin).exists())

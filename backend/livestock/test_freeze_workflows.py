"""Real API workflow smoke checks; also runnable inside a rolled-back PostgreSQL transaction."""
from datetime import date
from uuid import uuid4
from rest_framework.test import APITestCase
from livestock.models import Barangay, Farmer, LivestockType, LivestockInventory, LivestockBatch
from production.models import ProductionRecord, SlaughterRecord, LiveAnimalSale, CalvingRecord
from diseases.models import MortalityRecord
from users.models import User, Role, Notification


class FreezeWorkflowTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        # Unique, clearly synthetic fixtures allow a rollback-only smoke run on PostgreSQL.
        cls.prefix = "FREEZE-TEST-" + uuid4().hex[:10]
        cls.barangay = Barangay.objects.create(barangay_name=cls.prefix, latitude=0, longitude=0)
        cls.actors = {}
        for name in ("FARMER", "SIBAT", "MAO"):
            role, _ = Role.objects.get_or_create(role_name=name)
            cls.actors[name] = User.objects.create_user(username=cls.prefix+name,
                email=cls.prefix+name+"@example.test", password="Synthetic-test-password-123!",
                role=role, account_status="APPROVED", assigned_barangay=cls.barangay if name=="SIBAT" else None)
        cls.farmer = Farmer.objects.create(user=cls.actors["FARMER"],barangay=cls.barangay,address="SYNTHETIC AUDIT FIXTURE")
        cls.cattle, _ = LivestockType.objects.get_or_create(name="Cattle")

    def as_role(self, role):
        # Exercise JWT authentication instead of bypassing it with force_authenticate.
        self.client.credentials()
        response = self.client.post("/api/token/",{"email":self.actors[role].email,"password":"Synthetic-test-password-123!"},format="json")
        self.assertEqual(response.status_code,200,response.data)
        self.client.credentials(HTTP_AUTHORIZATION="Bearer "+response.data["access"])

    def submit(self, path, payload):
        self.as_role("FARMER")
        response=self.client.post(path,payload,format="json")
        self.assertEqual(response.status_code,201,(path,response.data))
        return response.data

    def animal_tag(self):
        sequence = getattr(self, "tag_sequence", 0) + 1
        self.tag_sequence = sequence
        return f"{self.prefix}FARMER-{sequence:03d}"

    def review(self,path,pk,role,status):
        self.as_role(role)
        response=self.client.post(f"{path}{pk}/review/",{"status":status,"remarks":"Synthetic audit check"},format="json")
        self.assertEqual(response.status_code,200,(path,role,status,response.data))
        return response.data

    def approve(self,path,pk):
        self.review(path,pk,"SIBAT","VERIFIED")
        self.review(path,pk,"MAO","APPROVED")

    def animal(self):
        animal=self.submit("/livestock/inventory/",{"livestock_type":self.cattle.pk,"entry_type":"INDIVIDUAL","quantity":1,"sex":"FEMALE","tag_number":self.animal_tag()})
        self.approve("/livestock/inventory/",animal["id"])
        return animal["id"]

    def herd(self,count):
        herd=self.submit("/livestock/batches/",{"livestock_type":self.cattle.pk,"batch_code":self.prefix+uuid4().hex[:6],"batch_name":"SYNTHETIC AUDIT HERD","animals":[{"tag_number":self.animal_tag(),"sex":"FEMALE"} for _ in range(count)]})
        for animal in LivestockInventory.objects.filter(batch_id=herd["id"]).order_by("pk"):
            self.approve("/livestock/inventory/",animal.pk)
        return LivestockBatch.objects.get(pk=herd["id"])

    def test_routine_milk_record_is_recorded_and_not_queued_for_review(self):
        pk=self.animal()
        data=self.submit("/production/records/",{"livestock":pk,"production_type":"MILK","quantity":10,"unit":"LITERS","record_date":"2026-09-01","milking_session":"MORNING"})
        self.assertEqual(data["status"],"RECORDED")
        self.as_role("FARMER")
        r=self.client.patch(f"/production/records/{data['id']}/",{"quantity":12},format="json")
        self.assertEqual(r.status_code,200,r.data)
        self.assertEqual(r.data["status"],"RECORDED")
        self.as_role("SIBAT")
        self.assertEqual(self.client.get("/production/records/").data,[])
        self.as_role("MAO")
        review=self.client.post(f"/production/records/{data['id']}/review/",{"status":"APPROVED"},format="json")
        self.assertEqual(review.status_code,404)
        self.assertEqual(LivestockInventory.objects.get(pk=pk).operational_status,"ACTIVE")
        self.assertFalse(Notification.objects.filter(related_entity_type="production_record",related_entity_id=data["id"]).exists())

    def test_farmer_cannot_submit_a_completed_sale_record(self):
        pk=self.animal()
        self.as_role("FARMER")
        response=self.client.post("/production/sales/",{"livestock":pk,"quantity":1,"sale_date":"2026-09-01","destination":"Synthetic destination"},format="json")
        self.assertEqual(response.status_code,403,response.data)
        self.assertEqual(LivestockInventory.objects.get(pk=pk).operational_status,"ACTIVE")

    def test_full_herd_sale_api_and_partial_sale_rejection(self):
        herd=self.herd(3)
        self.as_role("FARMER")
        payload={"batch":herd.pk,"quantity":1,"sale_date":"2026-09-01"}
        self.assertEqual(self.client.post("/production/sales/",payload,format="json").status_code,403)
        payload["quantity"]=3
        self.assertEqual(self.client.post("/production/sales/",payload,format="json").status_code,403)
        self.assertEqual(herd.animals.filter(operational_status="ACTIVE").count(),3)

    def test_partial_slaughter_one_projection_and_no_mortality(self):
        herd=self.herd(10)
        ids=list(herd.animals.order_by("pk").values_list("pk",flat=True))[:3]
        data=self.submit("/production/records/",{"batch":herd.pk,"production_type":"MEAT","quantity":50,"unit":"KILOGRAMS","record_date":"2026-09-01","selected_animals":ids,"submit_slaughter_report":True})
        self.assertEqual(data["status"],"RECORDED")
        self.assertEqual(data["slaughter_details"]["status"],"PENDING")
        self.as_role("MAO")
        approval=self.client.post(f"/production/slaughterhouse/records/{data['slaughter_details']['id']}/review/",{"status":"APPROVED","remarks":"Synthetic audit approval"},format="json")
        self.assertEqual(approval.status_code,200,approval.data)
        self.assertEqual(herd.animals.filter(operational_status="SLAUGHTERED").count(),3)
        self.assertEqual(herd.animals.filter(operational_status="ACTIVE").count(),7)
        self.assertEqual(SlaughterRecord.objects.filter(batch=herd).count(),1)
        self.assertEqual(ProductionRecord.objects.filter(batch=herd).count(),1)
        self.assertFalse(MortalityRecord.objects.filter(livestock__batch=herd).exists())

    def test_mortality_and_calving_reconciliation(self):
        victim=self.animal()
        data=self.submit("/diseases/mortality/",{"livestock":victim,"death_count":1,"cause":"Synthetic audit cause","record_date":"2026-09-01"})
        self.approve("/diseases/mortality/",data["id"])
        self.assertEqual(LivestockInventory.objects.get(pk=victim).operational_status,"DECEASED")
        self.assertFalse(ProductionRecord.objects.filter(livestock_id=victim).exists())
        dam=self.animal()
        birth=self.submit("/production/calving/",{"dam":dam,"calving_date":"2026-09-01","calf_tag":self.animal_tag(),"calf_sex":"FEMALE"})
        self.approve("/production/calving/",birth["id"])
        event=CalvingRecord.objects.get(pk=birth["id"])
        self.assertIsNotNone(event.offspring_inventory_id)
        self.assertEqual(event.offspring_inventory.quantity,1)

    def test_pending_herd_with_history_returns_conflict_and_preserves_records(self):
        from diseases.models import DiseaseCase
        herd=self.submit("/livestock/batches/",{"livestock_type":self.cattle.pk,"batch_code":self.prefix+"PROTECTED","batch_name":"SYNTHETIC PROTECTED HERD","animals":[{"tag_number":self.animal_tag()}]})
        child=LivestockInventory.objects.get(batch_id=herd["id"])
        disease=DiseaseCase.objects.create(livestock=child,name="Synthetic protected history",affected_count=1,created_by=self.actors["FARMER"])
        response=self.client.delete(f"/livestock/batches/{herd['id']}/")
        self.assertEqual(response.status_code,409,response.data)
        self.assertTrue(LivestockBatch.objects.filter(pk=herd["id"]).exists())
        self.assertTrue(LivestockInventory.objects.filter(pk=child.pk).exists())
        self.assertTrue(DiseaseCase.objects.filter(pk=disease.pk).exists())

    def test_herd_only_history_is_not_detached_by_deletion(self):
        from diseases.models import DiseaseCase
        herd=self.submit("/livestock/batches/",{"livestock_type":self.cattle.pk,"batch_code":self.prefix+"HERD-HISTORY","batch_name":"SYNTHETIC HERD HISTORY","animals":[{"tag_number":self.animal_tag()}]})
        event=DiseaseCase.objects.create(batch_id=herd["id"],name="Synthetic herd disease",affected_count=1,created_by=self.actors["FARMER"])
        response=self.client.delete(f"/livestock/batches/{herd['id']}/")
        self.assertEqual(response.status_code,409,response.data)
        event.refresh_from_db()
        self.assertEqual(event.batch_id,herd["id"])

    def test_farmer_cannot_create_completed_sale_for_any_price(self):
        animal=self.animal()
        self.as_role("FARMER")
        for field in ("price_per_head","price_per_kg","total_price"):
            response=self.client.post("/production/sales/",{"livestock":animal,"quantity":1,"sale_date":"2026-09-01",field:-10},format="json")
            self.assertEqual(response.status_code,403,(field,response.data))
        response=self.client.post("/production/sales/",{"livestock":animal,"quantity":1,"sale_date":"2026-09-01","total_price":0},format="json")
        self.assertEqual(response.status_code,403,response.data)

    def test_public_registration_pending_gate_then_mao_approval(self):
        self.client.credentials()
        email=self.prefix+"REGISTER@example.test"
        password="Synthetic-registration-test-password-123!"
        response=self.client.post("/api/users/register/",{"email":email,"password":password,"first_name":"Synthetic","last_name":"Registration","barangay":self.barangay.pk,"farm_size":"1.00","address":"SYNTHETIC REGISTRATION ADDRESS","role":"MAO","account_status":"APPROVED"},format="json")
        self.assertEqual(response.status_code,201,response.data)
        user=User.objects.get(email=email)
        self.assertEqual(user.role.role_name,"FARMER")
        self.assertEqual(user.account_status,"PENDING")
        self.assertEqual(user.farmer_profile.barangay_id,self.barangay.pk)
        response=self.client.post("/api/token/",{"email":email,"password":password},format="json")
        self.assertEqual(response.status_code,400,response.data)
        self.as_role("MAO")
        response=self.client.patch(f"/api/users/{user.pk}/status/",{"status":"APPROVED"},format="json")
        self.assertEqual(response.status_code,200,response.data)
        self.client.credentials()
        response=self.client.post("/api/token/",{"email":email,"password":password},format="json")
        self.assertEqual(response.status_code,200,response.data)

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

    def review(self,path,pk,role,status):
        self.as_role(role)
        response=self.client.post(f"{path}{pk}/review/",{"status":status,"remarks":"Synthetic audit check"},format="json")
        self.assertEqual(response.status_code,200,(path,role,status,response.data))
        return response.data

    def approve(self,path,pk):
        self.review(path,pk,"SIBAT","VERIFIED")
        self.review(path,pk,"MAO","APPROVED")

    def animal(self):
        animal=self.submit("/livestock/inventory/",{"livestock_type":self.cattle.pk,"entry_type":"INDIVIDUAL","quantity":1,"sex":"FEMALE","tag_number":self.prefix+uuid4().hex[:6]})
        self.approve("/livestock/inventory/",animal["id"])
        return animal["id"]

    def herd(self,count):
        herd=self.submit("/livestock/batches/",{"livestock_type":self.cattle.pk,"batch_code":self.prefix+uuid4().hex[:6],"batch_name":"SYNTHETIC AUDIT HERD","animals":[{"tag_number":self.prefix+uuid4().hex[:6],"sex":"FEMALE"} for _ in range(count)]})
        self.approve("/livestock/batches/",herd["id"])
        return LivestockBatch.objects.get(pk=herd["id"])

    def test_production_revision_notifications_and_approval(self):
        pk=self.animal()
        data=self.submit("/production/records/",{"livestock":pk,"production_type":"MILK","quantity":10,"unit":"LITERS","record_date":"2026-09-01"})
        self.review("/production/records/",data["id"],"SIBAT","VERIFIED")
        self.review("/production/records/",data["id"],"MAO","SUBJECT_TO_REVISION")
        self.as_role("FARMER")
        r=self.client.patch(f"/production/records/{data['id']}/",{"quantity":12},format="json")
        self.assertEqual(r.status_code,200,r.data)
        self.assertEqual(r.data["status"],"PENDING")
        self.approve("/production/records/",data["id"])
        self.assertEqual(LivestockInventory.objects.get(pk=pk).operational_status,"ACTIVE")
        for role in self.actors:
            self.assertTrue(Notification.objects.filter(user=self.actors[role]).exists(),role)

    def test_sale_revision_and_approved_exit(self):
        pk=self.animal()
        data=self.submit("/production/sales/",{"livestock":pk,"quantity":1,"sale_date":"2026-09-01","destination":"Synthetic destination"})
        self.review("/production/sales/",data["id"],"SIBAT","SUBJECT_TO_REVISION")
        self.as_role("FARMER")
        r=self.client.patch(f"/production/sales/{data['id']}/",{"destination":"Corrected synthetic destination"},format="json")
        self.assertEqual(r.status_code,200,r.data)
        self.assertEqual(r.data["status"],"PENDING")
        self.approve("/production/sales/",data["id"])
        self.assertEqual(LivestockInventory.objects.get(pk=pk).operational_status,"SOLD")

    def test_full_herd_sale_api_and_partial_sale_rejection(self):
        herd=self.herd(3)
        self.as_role("FARMER")
        payload={"batch":herd.pk,"quantity":1,"sale_date":"2026-09-01"}
        self.assertEqual(self.client.post("/production/sales/",payload,format="json").status_code,400)
        payload["quantity"]=3
        data=self.submit("/production/sales/",payload)
        self.assertEqual(data["batch"],herd.pk)
        self.assertEqual(data["barangay_name"],self.barangay.barangay_name)
        self.approve("/production/sales/",data["id"])
        self.assertEqual(herd.animals.filter(operational_status="SOLD").count(),3)

    def test_partial_slaughter_one_projection_and_no_mortality(self):
        herd=self.herd(10)
        ids=list(herd.animals.order_by("pk").values_list("pk",flat=True))[:3]
        data=self.submit("/production/records/",{"batch":herd.pk,"production_type":"MEAT","quantity":50,"unit":"KILOGRAMS","record_date":"2026-09-01","selected_animals":ids})
        self.approve("/production/records/",data["id"])
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
        birth=self.submit("/production/calving/",{"dam":dam,"calving_date":"2026-09-01","calf_tag":self.prefix+"CALF","calf_sex":"FEMALE"})
        self.approve("/production/calving/",birth["id"])
        event=CalvingRecord.objects.get(pk=birth["id"])
        self.assertIsNotNone(event.offspring_inventory_id)
        self.assertEqual(event.offspring_inventory.quantity,1)

    def test_pending_herd_with_history_returns_conflict_and_preserves_records(self):
        from diseases.models import DiseaseCase
        herd=self.submit("/livestock/batches/",{"livestock_type":self.cattle.pk,"batch_code":self.prefix+"PROTECTED","batch_name":"SYNTHETIC PROTECTED HERD","animals":[{"tag_number":self.prefix+"PROTECTED-1"}]})
        child=LivestockInventory.objects.get(batch_id=herd["id"])
        disease=DiseaseCase.objects.create(livestock=child,name="Synthetic protected history",affected_count=1,created_by=self.actors["FARMER"])
        response=self.client.delete(f"/livestock/batches/{herd['id']}/")
        self.assertEqual(response.status_code,409,response.data)
        self.assertTrue(LivestockBatch.objects.filter(pk=herd["id"]).exists())
        self.assertTrue(LivestockInventory.objects.filter(pk=child.pk).exists())
        self.assertTrue(DiseaseCase.objects.filter(pk=disease.pk).exists())

    def test_herd_only_history_is_not_detached_by_deletion(self):
        from diseases.models import DiseaseCase
        herd=self.submit("/livestock/batches/",{"livestock_type":self.cattle.pk,"batch_code":self.prefix+"HERD-HISTORY","batch_name":"SYNTHETIC HERD HISTORY","animals":[{"tag_number":self.prefix+"HISTORY-1"}]})
        event=DiseaseCase.objects.create(batch_id=herd["id"],name="Synthetic herd disease",affected_count=1,created_by=self.actors["FARMER"])
        response=self.client.delete(f"/livestock/batches/{herd['id']}/")
        self.assertEqual(response.status_code,409,response.data)
        event.refresh_from_db()
        self.assertEqual(event.batch_id,herd["id"])

    def test_negative_sale_prices_are_rejected_and_zero_is_preserved(self):
        animal=self.animal()
        self.as_role("FARMER")
        for field in ("price_per_head","price_per_kg","total_price"):
            response=self.client.post("/production/sales/",{"livestock":animal,"quantity":1,"sale_date":"2026-09-01",field:-10},format="json")
            self.assertEqual(response.status_code,400,(field,response.data))
        response=self.client.post("/production/sales/",{"livestock":animal,"quantity":1,"sale_date":"2026-09-01","total_price":0},format="json")
        self.assertEqual(response.status_code,201,response.data)
        self.assertEqual(float(response.data["total_price"]),0)

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

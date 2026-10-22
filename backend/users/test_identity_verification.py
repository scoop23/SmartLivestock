"""Synthetic files and mocked provider only. No real identity material or network calls."""
import hashlib
import hmac
import json
import tempfile
import time
from datetime import timedelta
from io import BytesIO, StringIO
from uuid import uuid4
from unittest.mock import patch

from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import override_settings
from django.utils import timezone
from PIL import Image
from reportlab.pdfgen.canvas import Canvas
from rest_framework.test import APITestCase

from livestock.models import Barangay, Farmer
from .models import User, Role, UserDocument, Notification, IdentityVerificationAttempt as Attempt, IdentityVerificationEvent as Event
from . import identity_service as service
from .identity_views import enroll


def pdf_file(name="id.pdf"):
    buffer = BytesIO()
    canvas = Canvas(buffer)
    canvas.drawString(50, 700, "SYNTHETIC TEST DOCUMENT - NOT AN ID")
    canvas.save()
    return SimpleUploadedFile(name, buffer.getvalue(), content_type="application/pdf")


@override_settings(IDENTITY_ENABLED=True, DIDIT_API_KEY="test-key", DIDIT_WEBHOOK_SECRET="test-secret",
                   DIDIT_WORKFLOW_ID="11111111-1111-4111-8111-111111111111",
                   DIDIT_APPLICATION_ID="22222222-2222-4222-8222-222222222222",
                   IDENTITY_ENVIRONMENT="live", IDENTITY_POLICY_VERSION="test-v1",
                   IDENTITY_RETENTION_NOTICE="Synthetic test retention policy", IDENTITY_PRIVACY_CONTACT="MAO test desk",
                   IDENTITY_RETENTION_DAYS=30, IDENTITY_PROVIDER_PRIVACY_CONFIRMED=True, USE_R2_STORAGE=False)
class IdentityVerificationTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.private = tempfile.TemporaryDirectory()
        self.public = tempfile.TemporaryDirectory()
        self.addCleanup(self.private.cleanup)
        self.addCleanup(self.public.cleanup)
        settings_override = override_settings(PRIVATE_DOCUMENT_ROOT=self.private.name, MEDIA_ROOT=self.public.name)
        settings_override.enable()
        self.addCleanup(settings_override.disable)
        self.barangay = Barangay.objects.create(barangay_name="Synthetic A", latitude=13.88, longitude=121.22)
        self.other_barangay = Barangay.objects.create(barangay_name="Synthetic B", latitude=13.89, longitude=121.23)
        self.users = {}
        for name, role in (("owner", "FARMER"), ("other", "FARMER"), ("mao", "MAO"), ("sibat", "SIBAT"), ("cbat", "CBAT")):
            group, _ = Role.objects.get_or_create(role_name=role)
            self.users[name] = User.objects.create_user(username=name, email=f"{name}@example.test", password=None, role=group,
                                                       first_name="Synthetic", last_name=name,
                                                       account_status="PENDING" if name == "owner" else "APPROVED",
                                                       assigned_barangay=self.barangay if role in ("SIBAT", "CBAT") else None)
        Farmer.objects.create(user=self.users["owner"], barangay=self.barangay, farm_size=1, address="Synthetic location")
        Farmer.objects.create(user=self.users["other"], barangay=self.other_barangay, farm_size=1, address="Synthetic location")
        self.doc = UserDocument.objects.create(user=self.users["owner"], document_type="PASSPORT", document_file=pdf_file())
        self.attempt = enroll(self.users["owner"])
        self.client.credentials(HTTP_AUTHORIZATION="Identity " + service.registration_token(self.users["owner"]))

    def decision(self, **changes):
        attempt = self.users["owner"].identity_attempts.first()
        result = {"session_id": str(attempt.provider_session_id), "vendor_data": str(attempt.pk),
                  "workflow_id": attempt.workflow_id, "status": "Approved", "session_url": "https://verify.didit.me/session/synthetic",
                  "id_verifications": [{"status": "Approved"}], "face_matches": [{"status": "Approved", "score": 97}],
                  "liveness_checks": [{"status": "Approved", "method": "PASSIVE", "score": 98}]}
        result.update(changes)
        return result

    def provider(self, method, path, payload=None):
        if method == "POST":
            return {"session_id": str(uuid4()), "workflow_id": payload["workflow_id"], "vendor_data": payload["vendor_data"],
                    "url": "https://verify.didit.me/session/synthetic"}
        return self.decision()

    def start(self, **extra):
        with patch("users.identity_service.provider_request", side_effect=self.provider):
            return self.client.post("/api/users/identity/start/", {"consent": True, "policy_version": "test-v1", **extra}, format="json")

    def reviewer(self, name):
        self.client.credentials()
        self.client.force_authenticate(self.users[name])

    def test_registration_forces_pending_farmer_and_issues_limited_session(self):
        self.client.credentials()
        payload = {"email": "new@example.test", "password": "SyntheticPass123!", "first_name": "Test", "last_name": "Applicant",
                   "barangay": self.barangay.pk, "farm_size": 1, "address": "Synthetic", "government_id_type": "PASSPORT",
                   "government_id_pdf": pdf_file(), "role": "MAO", "account_status": "APPROVED", "verified": True,
                   "user": self.users["other"].pk}
        response = self.client.post("/api/users/register/", payload, format="multipart")
        self.assertEqual(response.status_code, 201, response.data)
        user = User.objects.get(email=payload["email"])
        self.assertEqual((user.role.role_name, user.account_status), ("FARMER", "PENDING"))
        self.assertEqual(user.identity_attempts.count(), 1)
        self.assertEqual(user.documents.first().user_id, user.pk)
        self.assertNotIn("password", response.data)
        self.assertIn("identity_verification", response.data)
        registration_notices = Notification.objects.filter(title="Farmer account awaiting approval")
        self.assertEqual(list(registration_notices.values_list("user_id", flat=True)), [self.users["mao"].pk])
        self.assertEqual(self.client.post("/api/users/register/", {**payload, "government_id_pdf": pdf_file()}, format="multipart").status_code, 400)

    def test_registration_identity_evidence_notifies_mao_only(self):
        from .identity_views import notify_evidence

        notify_evidence(self.attempt)

        self.assertTrue(Notification.objects.filter(user=self.users["mao"], title="Registration identity evidence updated").exists())
        self.assertFalse(Notification.objects.filter(user__in=[self.users["sibat"], self.users["cbat"]]).exists())

    def test_hosted_capture_registers_pending_without_duplicate_id_upload(self):
        self.client.credentials()
        payload = {"email": "hosted@example.test", "password": "SyntheticPass123!", "first_name": "Test",
                   "last_name": "Hosted", "phone_number": "+639123456789", "barangay": self.barangay.pk,
                   "farm_size": "1.00", "address": "Synthetic", "provider_capture": True}
        response = self.client.post("/api/users/register/", payload, format="multipart")
        self.assertEqual(response.status_code, 201, response.data)
        user = User.objects.get(email=payload["email"])
        self.assertEqual(user.account_status, "PENDING")
        self.assertFalse(user.documents.exists())
        self.assertIsNone(user.identity_attempts.first().document_id)
        self.client.credentials(HTTP_AUTHORIZATION="Identity " + response.data["identity_verification"]["access_token"])
        status = self.client.get("/api/users/identity/status/")
        self.assertEqual(status.data["attempt"]["document_capture"], "DIDIT_HOSTED")
        with patch("users.identity_service.provider_request", side_effect=self.provider):
            started = self.client.post("/api/users/identity/start/", {"consent": True, "policy_version": "test-v1"})
        self.assertEqual(started.status_code, 201, started.data)
        user.refresh_from_db()
        self.assertEqual(user.account_status, "PENDING")

    def test_hosted_capture_cannot_bypass_missing_provider_or_manual_id_requirements(self):
        self.client.credentials()
        payload = {"email": "blocked@example.test", "password": "SyntheticPass123!", "first_name": "Test",
                   "last_name": "Hosted", "phone_number": "+639123456789", "barangay": self.barangay.pk,
                   "farm_size": "1.00", "address": "Synthetic", "provider_capture": True}
        for configuration in ({"IDENTITY_ENABLED": False}, {"DIDIT_API_KEY": ""}, {"IDENTITY_RETENTION_NOTICE": ""}):
            with self.subTest(configuration=configuration), override_settings(**configuration):
                self.assertEqual(self.client.post("/api/users/register/", payload, format="multipart").status_code, 400)
        payload["provider_capture"] = False
        self.assertEqual(self.client.post("/api/users/register/", payload, format="multipart").status_code, 400)
        payload.update(provider_capture=True, government_id_type="PASSPORT", government_id_pdf=pdf_file())
        self.assertEqual(self.client.post("/api/users/register/", payload, format="multipart").status_code, 400)
        self.assertFalse(User.objects.filter(email=payload["email"]).exists())

    def test_upload_rejects_spoofed_content_malformed_pdf_and_oversized_file(self):
        from .document_security import validate_document
        from rest_framework.exceptions import ValidationError
        for file in [SimpleUploadedFile("id.jpg", b"not an image", content_type="image/jpeg"),
                     SimpleUploadedFile("id.pdf", b"%PDF-1.4 broken", content_type="application/pdf"),
                     SimpleUploadedFile("id.exe", b"executable"),
                     SimpleUploadedFile("id.png", b"0" * (10 * 1024 * 1024 + 1), content_type="image/png"),
                     SimpleUploadedFile("id.png", b"not png", content_type="text/html")]:
            with self.subTest(file=file.name), self.assertRaises(ValidationError):
                validate_document(file, "ID")
        image = BytesIO()
        Image.new("RGB", (20, 20), "white").save(image, "PNG")
        self.assertIsNotNone(validate_document(SimpleUploadedFile("id.png", image.getvalue(), content_type="image/png"), "ID"))
        self.assertIsNotNone(validate_document(pdf_file(), "ID"))

    def test_private_storage_stream_headers_and_cross_user_access(self):
        from pathlib import Path
        self.assertTrue((Path(self.private.name) / self.doc.document_file.name).exists())
        self.assertFalse((Path(self.public.name) / self.doc.document_file.name).exists())
        with self.assertRaises(ValueError):
            _ = self.doc.document_file.url
        url = f"/api/users/documents/{self.doc.pk}/view/"
        # Registration capability deliberately cannot read arbitrary document APIs.
        self.assertEqual(self.client.get(url).status_code, 401)
        self.reviewer("other")
        self.assertEqual(self.client.get(url).status_code, 403)
        self.reviewer("mao")
        result = self.client.get(url)
        self.assertEqual(result.status_code, 200)
        self.assertIn("no-store", result["Cache-Control"])
        self.assertEqual(result["X-Content-Type-Options"], "nosniff")
        result.close()
        self.assertEqual(self.client.get("/media/" + self.doc.document_file.name).status_code, 404)

    def test_capability_is_owned_expiring_and_never_a_portal_login(self):
        self.assertEqual(self.client.get("/api/users/identity/status/").status_code, 200)
        self.assertEqual(self.client.get("/api/users/me/").status_code, 401)
        self.assertEqual(self.client.get("/api/users/identity/reviews/").status_code, 401)
        self.client.credentials(HTTP_AUTHORIZATION="Identity invalid-token")
        self.assertEqual(self.client.get("/api/users/identity/status/").status_code, 401)
        with patch("django.core.signing.time.time", return_value=time.time() - 4000):
            expired = service.registration_token(self.users["owner"])
        self.client.credentials(HTTP_AUTHORIZATION="Identity " + expired)
        self.assertEqual(self.client.get("/api/users/identity/status/").status_code, 401)

    def test_consent_version_and_forged_browser_results_rejected(self):
        for payload in ({"consent": False, "policy_version": "test-v1"}, {"consent": True, "policy_version": "old"},
                        {"consent": True, "policy_version": "test-v1", "verified": True}):
            with patch("users.identity_service.provider_request") as provider:
                self.assertEqual(self.client.post("/api/users/identity/start/", payload).status_code, 400)
                provider.assert_not_called()
        self.assertIsNone(Attempt.objects.get(pk=self.attempt.pk).consent_at)

    def test_start_links_correct_registration_and_does_not_approve(self):
        result = self.start()
        self.assertEqual(result.status_code, 201, result.data)
        attempt = Attempt.objects.get(pk=self.attempt.pk)
        self.assertEqual(attempt.user_id, self.users["owner"].pk)
        self.assertEqual(attempt.state, "IN_PROGRESS")
        self.assertIsNotNone(attempt.consent_at)
        self.users["owner"].refresh_from_db()
        self.assertEqual(self.users["owner"].account_status, "PENDING")

    def test_success_stores_only_result_categories(self):
        self.start()
        data = self.decision(document_number="MUST-NOT-PERSIST", face_embedding=[1, 2, 3])
        with patch("users.identity_service.provider_request", return_value=data):
            result = self.client.post("/api/users/identity/refresh/", {})
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.data["attempt"]["state"], "COMPLETED")
        self.assertNotIn("MUST-NOT-PERSIST", str(result.data))
        self.assertNotIn("face_embedding", str(result.data))
        self.doc.refresh_from_db()
        self.assertEqual(self.doc.verification_status, "PENDING")

    def test_missing_liveness_low_match_and_active_capture_require_review(self):
        self.start()
        for change in ({"liveness_checks": []}, {"face_matches": [{"status": "Declined", "score": 1}]},
                       {"liveness_checks": [{"status": "Approved", "method": "ACTIVE_3D"}]}, {"status": "In Review"}):
            with patch("users.identity_service.provider_request", return_value=self.decision(**change)):
                result = self.client.post("/api/users/identity/refresh/", {})
            self.assertEqual(result.data["attempt"]["state"], "REVIEW_REQUIRED")

    def test_sandbox_never_reports_real_completed_checks(self):
        with override_settings(IDENTITY_ENVIRONMENT="sandbox"):
            self.attempt.environment = "sandbox"
            self.attempt.save()
            self.start()
            with patch("users.identity_service.provider_request", return_value=self.decision()):
                result = self.client.post("/api/users/identity/refresh/", {})
            self.assertEqual(result.data["attempt"]["state"], "REVIEW_REQUIRED")

    def test_changed_privacy_policy_does_not_resume_an_old_capture_session(self):
        self.start()
        with override_settings(IDENTITY_POLICY_VERSION="new-policy"), patch("users.identity_service.provider_request") as provider:
            response = self.client.post("/api/users/identity/start/", {"consent": True, "policy_version": "new-policy"})
            self.assertEqual(response.status_code, 409)
            provider.assert_not_called()

    def test_provider_timeout_is_technical_and_retries_do_not_create_accounts(self):
        count = User.objects.count()
        for number in range(3):
            with patch("users.identity_service.provider_request", side_effect=service.ProviderUnavailable("Service unavailable")):
                result = self.client.post("/api/users/identity/start/", {"consent": True, "policy_version": "test-v1", "retry": True})
            self.assertEqual(result.status_code, 503)
            self.assertEqual(result.data["attempt"]["state"], "FAILED_TECHNICAL")
            self.assertEqual(result.data["attempt"]["face_result"], "NOT_COMPLETED")
        self.assertEqual(self.start(retry=True).status_code, 429)
        self.assertEqual(User.objects.count(), count)

    def test_unavailable_configuration_does_not_call_provider(self):
        with override_settings(DIDIT_API_KEY=""), patch("users.identity_service.provider_request") as provider:
            self.assertEqual(self.start().status_code, 503)
            provider.assert_not_called()

    def test_refresh_timeout_preserves_evidence_and_client_cannot_supply_status(self):
        self.start()
        with patch("users.identity_service.provider_request", side_effect=service.ProviderUnavailable("Service unavailable")):
            self.assertEqual(self.client.post("/api/users/identity/refresh/", {}).status_code, 503)
        self.assertEqual(Attempt.objects.get(pk=self.attempt.pk).state, "IN_PROGRESS")
        self.assertEqual(self.client.post("/api/users/identity/refresh/", {"verified": True}).status_code, 400)

    def callback(self, **changes):
        from django.conf import settings
        attempt = self.users["owner"].identity_attempts.first()
        now = int(time.time())
        data = {"timestamp": now, "created_at": now, "event_id": str(uuid4()), "session_id": str(attempt.provider_session_id),
                "vendor_data": str(attempt.pk), "workflow_id": attempt.workflow_id,
                "environment": "live", "application_id": settings.DIDIT_APPLICATION_ID, "webhook_type": "status.updated", **changes}
        return data

    def send_callback(self, data, signature=None):
        raw = json.dumps(data, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()
        signature = signature or hmac.new(b"test-secret", raw, hashlib.sha256).hexdigest()
        self.client.force_authenticate(user=None)
        self.client.credentials()
        return self.client.post("/api/users/identity/webhook/", raw, content_type="application/json",
                                HTTP_X_SIGNATURE_V2=signature, HTTP_X_TIMESTAMP=str(data["timestamp"]))

    def test_forged_expired_and_mismatched_callbacks_rejected(self):
        self.start()
        self.assertEqual(self.send_callback(self.callback(), signature="forged").status_code, 401)
        self.assertEqual(self.send_callback(self.callback(timestamp=int(time.time()) - 400)).status_code, 401)
        for change in ({"vendor_data": str(uuid4())}, {"environment": "sandbox"}, {"workflow_id": str(uuid4())}):
            self.assertEqual(self.send_callback(self.callback(**change)).status_code, 400)

    def test_callback_replay_and_old_events_are_idempotent(self):
        self.start()
        data = self.callback()
        with patch("users.identity_service.provider_request", side_effect=self.provider) as provider:
            self.assertEqual(self.send_callback(data).status_code, 204)
            self.assertEqual(self.send_callback(data).status_code, 204)
            self.assertEqual(self.send_callback(self.callback(created_at=data["created_at"] - 1)).status_code, 204)
            self.assertEqual(provider.call_count, 1)
        self.assertEqual(Event.objects.filter(provider_event_id=data["event_id"]).count(), 1)

    def test_callback_timeout_retries_without_accepting_payload_evidence(self):
        self.start()
        data = self.callback(decision={"status": "Approved"})
        with patch("users.identity_service.provider_request", side_effect=service.ProviderUnavailable()):
            self.assertEqual(self.send_callback(data).status_code, 503)
        self.assertFalse(Event.objects.filter(provider_event_id=data["event_id"]).exists())

    def test_signed_callback_recovers_unknown_create_outcome_from_provider(self):
        with patch("users.identity_service.provider_request", side_effect=service.ProviderUnavailable()):
            self.client.post("/api/users/identity/start/", {"consent": True, "policy_version": "test-v1"})
        provider_id = str(uuid4())
        callback = self.callback(session_id=provider_id)
        result = self.decision(session_id=provider_id)
        with patch("users.identity_service.provider_request", return_value=result):
            self.assertEqual(self.send_callback(callback).status_code, 204)
        self.attempt.refresh_from_db()
        self.assertEqual(str(self.attempt.provider_session_id), provider_id)
        self.assertEqual(self.attempt.state, "COMPLETED")

    def test_existing_local_document_remains_readable_only_through_protected_stream(self):
        from pathlib import Path
        old_name = "user_documents/legacy-id.pdf"
        legacy = Path(self.public.name) / old_name
        legacy.parent.mkdir(exist_ok=True)
        legacy.write_bytes(pdf_file().read())
        self.doc.document_file = old_name
        self.doc.save()
        self.reviewer("mao")
        response = self.client.get(f"/api/users/documents/{self.doc.pk}/view/")
        self.assertEqual(response.status_code, 200)
        response.close()
        self.assertEqual(self.client.get("/media/" + old_name).status_code, 404)

    def test_reviewer_scope_for_cbat_sibat_and_mao(self):
        for name in ("cbat", "sibat", "mao"):
            self.reviewer(name)
            self.assertEqual(self.client.get(f'/api/users/identity/reviews/{self.users["owner"].pk}/').status_code, 200)
            streamed = self.client.get(f"/api/users/documents/{self.doc.pk}/view/")
            self.assertEqual(streamed.status_code, 200)
            streamed.close()
        self.reviewer("sibat")
        self.users["sibat"].assigned_barangay = self.other_barangay
        self.users["sibat"].save()
        self.assertEqual(self.client.get(f'/api/users/identity/reviews/{self.users["owner"].pk}/').status_code, 404)
        self.assertEqual(self.client.get(f"/api/users/documents/{self.doc.pk}/view/").status_code, 403)
        self.users["sibat"].access_scope = "ALL_BARANGAYS"
        self.users["sibat"].save()
        self.assertEqual(self.client.get(f'/api/users/identity/reviews/{self.users["owner"].pk}/').status_code, 200)
        self.reviewer("other")
        self.assertEqual(self.client.get("/api/users/identity/reviews/").status_code, 403)

    def test_mao_assesses_incomplete_evidence_then_explicitly_approves(self):
        user_id = self.users["owner"].pk
        self.doc.verification_status = "APPROVED"
        self.doc.save()
        self.reviewer("mao")
        self.assertEqual(self.client.patch(f"/api/users/{user_id}/status/", {"status": "APPROVED"}).status_code, 400)
        self.reviewer("cbat")
        self.assertEqual(self.client.post(f"/api/users/identity/reviews/{user_id}/assessment/", {"reason": "Manual inspection completed"}).status_code, 403)
        self.reviewer("mao")
        self.assertEqual(self.client.post(f"/api/users/identity/reviews/{user_id}/assessment/", {"reason": "Manual inspection completed; provider unavailable"}).status_code, 200)
        self.assertEqual(self.client.patch(f"/api/users/{user_id}/status/", {"status": "APPROVED"}).status_code, 200)

    def test_sensitive_provider_transport_error_is_redacted(self):
        from urllib.error import HTTPError
        error = HTTPError("https://verification.didit.me", 500, "SECRET-PAYLOAD", {}, BytesIO(b"ID-NUMBER"))
        with patch("users.identity_service.build_opener") as opener:
            opener.return_value.open.side_effect = error
            with self.assertRaises(service.ProviderUnavailable) as caught:
                service.provider_request("POST", "session/", {"secret": "ID-NUMBER"})
        self.assertNotIn("ID-NUMBER", str(caught.exception))
        self.assertNotIn("SECRET", str(caught.exception))

    def test_retention_cleanup_dry_run_holds_and_deletion_outcome(self):
        self.start()
        attempt = Attempt.objects.get(pk=self.attempt.pk)
        attempt.retention_due_at = timezone.now() - timedelta(days=1)
        attempt.save()
        with patch("users.management.commands.expire_identity_sessions.provider_request") as provider:
            call_command("expire_identity_sessions", stdout=StringIO())
            provider.assert_not_called()
            attempt.retention_hold = True
            attempt.save()
            call_command("expire_identity_sessions", execute=True, stdout=StringIO())
            provider.assert_not_called()
            attempt.retention_hold = False
            attempt.save()
            provider.return_value = {"session_id": str(attempt.provider_session_id), "face_retention_outcome": "deleted"}
            call_command("expire_identity_sessions", execute=True, stdout=StringIO())
            self.assertIs(provider.call_args.args[2]["retain_face_embeddings"], False)
        attempt.refresh_from_db()
        self.assertIsNotNone(attempt.provider_deleted_at)
        self.assertTrue(UserDocument.objects.filter(pk=self.doc.pk).exists())

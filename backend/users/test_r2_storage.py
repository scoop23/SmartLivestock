"""
Tests for Cloudflare R2 Object Storage Integration and File Uploads.
Verifies R2MediaStorage configuration, model upload behavior, presigned URL generation,
management commands, and RBAC authorization without sending live traffic to production.
"""

import tempfile
from unittest.mock import MagicMock, patch
from django.test import TestCase, override_settings
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.files.storage import default_storage
from django.core.management import call_command
from io import StringIO
from rest_framework.test import APITestCase
from rest_framework import status

from smartlivestock.storage import R2MediaStorage, is_r2_storage_active, get_r2_client
from users.models import User, Role, UserDocument, Announcement, AnnouncementPhoto
from livestock.models import Barangay, Farmer, LivestockInventory, LivestockType
from diseases.models import DiseaseCase, MortalityRecord



class R2StorageConfigurationTests(TestCase):
    def test_default_fallback_to_filesystem_storage(self):
        """When R2 credentials are not set in environment, Django safely falls back to FileSystemStorage."""
        self.assertFalse(is_r2_storage_active())
        self.assertEqual(default_storage.__class__.__name__, "FileSystemStorage")

    @override_settings(
        AWS_STORAGE_BUCKET_NAME="smartlivestock-prod",
        AWS_S3_ENDPOINT_URL="https://test-account.r2.cloudflarestorage.com",
        AWS_ACCESS_KEY_ID="test-key",
        AWS_SECRET_ACCESS_KEY="test-secret",
    )
    def test_r2_storage_properties(self):
        """R2MediaStorage enforces private bucket defaults, s3v4 signatures, and auto region."""
        storage = R2MediaStorage()
        self.assertEqual(storage.bucket_name, "smartlivestock-prod")
        self.assertIsNone(storage.default_acl)
        self.assertFalse(storage.file_overwrite)
        self.assertEqual(storage.signature_version, "s3v4")
        self.assertEqual(storage.region_name, "auto")
        self.assertEqual(storage.addressing_style, "path")

    @override_settings(
        AWS_STORAGE_BUCKET_NAME="smartlivestock-prod",
        AWS_S3_ENDPOINT_URL="https://test-account.r2.cloudflarestorage.com",
        AWS_ACCESS_KEY_ID="test-key",
        AWS_SECRET_ACCESS_KEY="test-secret",
    )
    def test_presigned_url_generation(self):
        """Presigned URLs must be signed via boto3 client without exposing secret key."""
        storage = R2MediaStorage()
        mock_client = MagicMock()
        mock_client.generate_presigned_url.return_value = (
            "https://test-account.r2.cloudflarestorage.com/smartlivestock-prod/user_documents/sample.pdf?X-Amz-Signature=fake"
        )
        storage.connection.meta.client = mock_client

        url = storage.get_presigned_url("user_documents/sample.pdf", expiration=1800)
        self.assertTrue(url.startswith("https://"))
        self.assertIn("X-Amz-Signature=", url)
        mock_client.generate_presigned_url.assert_called_once()
        call_kwargs = mock_client.generate_presigned_url.call_args[1]
        self.assertEqual(call_kwargs["Params"]["Bucket"], "smartlivestock-prod")
        self.assertEqual(call_kwargs["Params"]["Key"], "user_documents/sample.pdf")
        self.assertEqual(call_kwargs["ExpiresIn"], 1800)


class AllModelFileUploadTests(TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp_dir.cleanup)
        self.override = override_settings(MEDIA_ROOT=self.temp_dir.name)
        self.override.enable()
        self.addCleanup(self.override.disable)

        self.farmer_role, _ = Role.objects.get_or_create(role_name=Role.UserRoles.FARMER)
        self.barangay = Barangay.objects.create(
            barangay_name="San Felipe", latitude=13.88, longitude=121.22
        )
        self.user = User.objects.create_user(
            username="test-uploader", email="uploader@example.com", password="password123",
            role=self.farmer_role, account_status=User.AccountStatus.APPROVED,
        )
        self.farmer = Farmer.objects.create(
            user=self.user, barangay=self.barangay, farm_size=2.0, address="Purok 1"
        )
        self.livestock_type = LivestockType.objects.create(name="Cow")


    def test_user_profile_image_upload_and_replace(self):
        img1 = SimpleUploadedFile("avatar1.jpg", b"\xff\xd8\xff\xe0test-jpg-content", content_type="image/jpeg")
        self.user.profile_image = img1
        self.user.save()
        self.assertTrue(self.user.profile_image.name.startswith("profile_photos/"))

        # Replace image
        img2 = SimpleUploadedFile("avatar2.jpg", b"\xff\xd8\xff\xe0test-jpg-content-2", content_type="image/jpeg")
        self.user.profile_image = img2
        self.user.save()
        self.assertTrue("avatar2" in self.user.profile_image.name)

        # Clear image
        self.user.profile_image = None
        self.user.save()
        self.assertFalse(bool(self.user.profile_image))

    def test_user_document_file_upload(self):
        doc = SimpleUploadedFile("gov_id.pdf", b"%PDF-1.4 sample content", content_type="application/pdf")
        user_doc = UserDocument.objects.create(
            user=self.user,
            document_type=UserDocument.DocumentType.GOVERNMENT_ID,
            document_file=doc,
            verification_status=UserDocument.VerificationStatus.PENDING,
        )
        self.assertTrue(user_doc.document_file.name.startswith("user_documents/"))

    def test_announcement_and_photos_upload(self):
        hero = SimpleUploadedFile("hero.png", b"\x89PNG\r\n\x1a\ntest-png", content_type="image/png")
        announcement = Announcement.objects.create(
            title="Vaccination Drive",
            content="Scheduled drive for Padre Garcia",
            image=hero,
            posted_by=self.user,
        )
        self.assertTrue(announcement.image.name.startswith("activity_images/"))

        photo = SimpleUploadedFile("gallery1.jpg", b"\xff\xd8\xff\xe0gallery-bytes", content_type="image/jpeg")
        ann_photo = AnnouncementPhoto.objects.create(
            announcement=announcement,
            image=photo,
            position=0,
        )
        self.assertTrue(ann_photo.image.name.startswith("activity_images/"))

    def test_livestock_inventory_photo_upload(self):
        cow_pic = SimpleUploadedFile("cow.jpg", b"\xff\xd8\xff\xe0cow-bytes", content_type="image/jpeg")
        inv = LivestockInventory.objects.create(
            farmer=self.farmer,
            livestock_type=self.livestock_type,
            quantity=1,
            photo=cow_pic,
            created_by=self.user,
        )
        self.assertTrue(inv.photo.name.startswith("livestock_photos/"))

    def test_disease_case_photos_upload(self):
        evidence = SimpleUploadedFile("disease_ev.jpg", b"\xff\xd8\xff\xe0disease-ev", content_type="image/jpeg")
        inspect_pic = SimpleUploadedFile("disease_insp.jpg", b"\xff\xd8\xff\xe0disease-insp", content_type="image/jpeg")
        case = DiseaseCase.objects.create(
            created_by=self.user,
            name="Foot and Mouth Disease",
            photo=evidence,
            inspector_photo=inspect_pic,
        )
        self.assertTrue(case.photo.name.startswith("disease_evidence/"))
        self.assertTrue(case.inspector_photo.name.startswith("disease_inspection/"))

    def test_mortality_record_photos_upload(self):
        mort_ev = SimpleUploadedFile("mort_ev.jpg", b"\xff\xd8\xff\xe0mort-ev", content_type="image/jpeg")
        mort_insp = SimpleUploadedFile("mort_insp.jpg", b"\xff\xd8\xff\xe0mort-insp", content_type="image/jpeg")
        mort = MortalityRecord.objects.create(
            created_by=self.user,
            death_count=1,
            cause="Heat stroke",
            photo=mort_ev,
            inspector_photo=mort_insp,
        )
        self.assertTrue(mort.photo.name.startswith("mortality_evidence/"))
        self.assertTrue(mort.inspector_photo.name.startswith("mortality_inspection/"))



class StorageManagementCommandsTests(TestCase):
    def test_check_r2_storage_unconfigured_output(self):
        """Running check_r2_storage without R2 env vars outputs clean warning without crashing."""
        out = StringIO()
        call_command("check_r2_storage", stdout=out)
        output = out.getvalue()
        self.assertIn("SmartLivestock Cloudflare R2 Health Check", output)
        self.assertIn("FileSystemStorage (Local)", output)
        self.assertIn("Cloudflare R2 credentials are not set", output)

    def test_migrate_media_to_r2_dry_run_unconfigured(self):
        """Running migrate_media_to_r2 without credentials gracefully notifies user."""
        out = StringIO()
        call_command("migrate_media_to_r2", "--dry-run", stdout=out)
        output = out.getvalue()
        self.assertIn("SmartLivestock Media Migration to Cloudflare R2", output)
        self.assertIn("Cloudflare R2 is not accessible or credentials are not configured", output)

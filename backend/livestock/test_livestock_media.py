from io import BytesIO
import tempfile
from unittest.mock import patch

from django.test import override_settings
from PIL import Image
from rest_framework import status
from rest_framework.test import APITestCase
from django.core.files.uploadedfile import SimpleUploadedFile

from livestock.models import Barangay, Farmer, LivestockBatch, LivestockInventory, LivestockType
from users.models import Role, User


class LivestockMediaTests(APITestCase):
    def setUp(self):
        self.media_dir = tempfile.TemporaryDirectory()
        self.settings_override = override_settings(MEDIA_ROOT=self.media_dir.name)
        self.settings_override.enable()

        self.farmer_role = Role.objects.create(role_name=Role.UserRoles.FARMER)
        self.barangay = Barangay.objects.create(barangay_name="Manggas", latitude=13.8, longitude=121.2)
        self.cattle = LivestockType.objects.create(name="Cattle")
        self.farmer = self.make_farmer("media-owner")
        self.other_farmer = self.make_farmer("media-other")
        self.batch = LivestockBatch.objects.create(
            farmer=self.farmer,
            livestock_type=self.cattle,
            batch_name="Main Herd",
            batch_code="MEDIA-B001",
            created_by=self.farmer.user,
        )
        self.animal = LivestockInventory.objects.create(
            farmer=self.farmer,
            livestock_type=self.cattle,
            entry_type=LivestockInventory.EntryType.INDIVIDUAL,
            quantity=1,
            tag_number="MEDIA-COW-001",
            status=LivestockInventory.StatusType.APPROVED,
            operational_status=LivestockInventory.OperationalStatus.ACTIVE,
            batch=self.batch,
            created_by=self.farmer.user,
        )

    def tearDown(self):
        self.settings_override.disable()
        self.media_dir.cleanup()

    def make_farmer(self, username):
        user = User.objects.create_user(
            username=username,
            password="test",
            role=self.farmer_role,
            email=f"{username}@example.test",
            account_status=User.AccountStatus.APPROVED,
        )
        return Farmer.objects.create(user=user, barangay=self.barangay, address="Manggas")

    @staticmethod
    def image_upload(name="animal.png", content_type="image/png", padding=b"", image_format="PNG"):
        buffer = BytesIO()
        Image.new("RGB", (2, 2), color="green").save(buffer, format=image_format)
        return SimpleUploadedFile(name, buffer.getvalue() + padding, content_type=content_type)

    @staticmethod
    def malformed_upload():
        return SimpleUploadedFile("malformed.png", b"not an image", content_type="image/png")

    def test_owner_can_replace_animal_photo_and_invalid_upload_keeps_existing_photo(self):
        self.client.force_authenticate(self.farmer.user)
        first = self.client.patch(
            f"/livestock/inventory/{self.animal.pk}/",
            {"photo": self.image_upload()},
            format="multipart",
        )
        self.assertEqual(first.status_code, status.HTTP_200_OK, first.data)
        self.animal.refresh_from_db()
        original_name = self.animal.photo.name
        self.assertTrue(first.data["photo_url"])

        rejected = self.client.patch(
            f"/livestock/inventory/{self.animal.pk}/",
            {"photo": self.malformed_upload()},
            format="multipart",
        )
        self.assertEqual(rejected.status_code, status.HTTP_400_BAD_REQUEST)
        self.animal.refresh_from_db()
        self.assertEqual(self.animal.photo.name, original_name)

        unsupported = self.client.patch(
            f"/livestock/inventory/{self.animal.pk}/",
            {"photo": self.image_upload("wrong.gif", "image/gif", image_format="GIF")},
            format="multipart",
        )
        self.assertEqual(unsupported.status_code, status.HTTP_400_BAD_REQUEST)
        self.animal.refresh_from_db()
        self.assertEqual(self.animal.photo.name, original_name)

        oversized = self.client.patch(
            f"/livestock/inventory/{self.animal.pk}/",
            {"photo": self.image_upload(padding=b"0" * (5 * 1024 * 1024))},
            format="multipart",
        )
        self.assertEqual(oversized.status_code, status.HTTP_400_BAD_REQUEST)
        self.animal.refresh_from_db()
        self.assertEqual(self.animal.photo.name, original_name)

        replaced = self.client.patch(
            f"/livestock/inventory/{self.animal.pk}/",
            {"photo": self.image_upload("replacement.png", padding=b"replacement")},
            format="multipart",
        )
        self.assertEqual(replaced.status_code, status.HTTP_200_OK, replaced.data)
        self.animal.refresh_from_db()
        self.assertNotEqual(self.animal.photo.name, original_name)

    def test_other_farmer_cannot_change_animal_or_batch_photo(self):
        self.client.force_authenticate(self.other_farmer.user)
        animal_response = self.client.patch(
            f"/livestock/inventory/{self.animal.pk}/",
            {"photo": self.image_upload()},
            format="multipart",
        )
        batch_response = self.client.patch(
            f"/livestock/batches/{self.batch.pk}/",
            {"photo": self.image_upload()},
            format="multipart",
        )
        self.assertEqual(animal_response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(batch_response.status_code, status.HTTP_404_NOT_FOUND)
        self.animal.refresh_from_db()
        self.batch.refresh_from_db()
        self.assertFalse(self.animal.photo)
        self.assertFalse(self.batch.photo)

    def test_owner_can_upload_replace_and_remove_batch_photo(self):
        self.client.force_authenticate(self.farmer.user)
        first = self.client.patch(
            f"/livestock/batches/{self.batch.pk}/",
            {"photo": self.image_upload("herd.png")},
            format="multipart",
        )
        self.assertEqual(first.status_code, status.HTTP_200_OK, first.data)
        self.batch.refresh_from_db()
        first_name = self.batch.photo.name
        self.assertTrue(first.data["photo_url"])

        replaced = self.client.patch(
            f"/livestock/batches/{self.batch.pk}/",
            {"photo": self.image_upload("herd-replacement.png", padding=b"replacement")},
            format="multipart",
        )
        self.assertEqual(replaced.status_code, status.HTTP_200_OK, replaced.data)
        self.batch.refresh_from_db()
        self.assertNotEqual(self.batch.photo.name, first_name)

        removed = self.client.patch(
            f"/livestock/batches/{self.batch.pk}/",
            {"photo": None},
            format="json",
        )
        self.assertEqual(removed.status_code, status.HTTP_200_OK, removed.data)
        self.batch.refresh_from_db()
        self.assertFalse(self.batch.photo)
        self.animal.refresh_from_db()
        self.assertFalse(self.animal.photo)

    def test_batch_list_survives_storage_url_generation_failure(self):
        self.batch.photo.name = "livestock_batches/2026/10/herd.png"
        self.batch.save(update_fields=["photo"])
        self.animal.photo.name = "livestock_photos/2026/10/animal.png"
        self.animal.save(update_fields=["photo"])
        self.client.force_authenticate(self.farmer.user)

        # R2 is private and generates signed URLs at request time. If signing
        # fails, the real herd and animal data must still be returned.
        storage = self.batch.photo.storage
        with patch.object(storage, "url", side_effect=OSError("storage unavailable")):
            response = self.client.get("/livestock/batches/?include_roster=true")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertIsNone(response.data[0]["photo"])
        self.assertIsNone(response.data[0]["photo_url"])
        self.assertEqual(response.data[0]["animals"][0]["tag_number"], "MEDIA-COW-001")
        self.assertIsNone(response.data[0]["animals"][0]["photo"])
        self.assertIsNone(response.data[0]["animals"][0]["photo_url"])

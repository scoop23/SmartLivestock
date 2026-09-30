import tempfile
from io import BytesIO
from datetime import timedelta

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.utils import timezone
from PIL import Image
from rest_framework import status
from rest_framework.test import APITestCase

from users.models import Announcement, ProgramBooking, ProgramSchedule, Role, User
from livestock.models import Barangay, Farmer


class ActivitySchedulingApiTests(APITestCase):
    def setUp(self):
        self.mao = self._user("activity-mao", Role.UserRoles.MAO)
        self.sibat = self._user("activity-sibat", Role.UserRoles.SIBAT)
        self.farmer = self._user("activity-farmer", Role.UserRoles.FARMER)

    def _user(self, username, role_name):
        role, _ = Role.objects.get_or_create(role_name=role_name)
        return User.objects.create_user(
            username=username,
            email=f"{username}@example.com",
            password="test-password",
            role=role,
            account_status=User.AccountStatus.APPROVED,
        )

    def _create_schedule(self):
        return ProgramSchedule.objects.create(
            date=timezone.localdate() + timedelta(days=14),
            program="Cattle Vaccination Drive",
            location="Municipal Agriculture Office",
            created_by=self.mao,
        )

    def test_announcement_without_schedule_remains_supported_and_visible_to_farmer(self):
        self.client.force_authenticate(self.mao)
        response = self.client.post(
            "/community/announcements/",
            {
                "title": "Farmers meeting",
                "content": "Meeting details",
                "category": "Farmer Meeting",
                "audience": "ALL",
                "is_published": True,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIsNone(response.data["schedule"])
        self.assertIsNone(Announcement.objects.get().schedule_id)

        self.client.force_authenticate(self.farmer)
        feed_response = self.client.get("/community/announcements/")
        self.assertEqual(feed_response.status_code, status.HTTP_200_OK)
        self.assertEqual(feed_response.data[0]["id"], response.data["id"])
        self.assertIsNone(feed_response.data[0]["schedule"])

    def test_linked_activity_serializes_actual_schedule_and_booking_counts(self):
        schedule = self._create_schedule()
        ProgramBooking.objects.create(schedule=schedule, farmer=self.farmer, time="08:00")

        self.client.force_authenticate(self.sibat)
        response = self.client.post(
            "/community/announcements/",
            {
                "title": "Cattle Vaccination Drive",
                "content": "Reserve your time slot.",
                "category": "Vaccination",
                "audience": "ALL",
                "is_published": True,
                "schedule_id": str(schedule.pk),
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["schedule"]["id"], schedule.pk)
        self.assertEqual(response.data["schedule"]["location"], schedule.location)
        self.assertEqual(response.data["schedule"]["booking_count"], 1)
        self.assertEqual(response.data["schedule"]["capacity"], 4)
        self.assertEqual(response.data["schedule"]["booked_times"], ["08:00"])
        self.assertEqual(response.data["schedule"]["registration_status"], "AVAILABLE")

        for reviewer in (self.mao, self.sibat, self.farmer):
            self.client.force_authenticate(reviewer)
            feed_response = self.client.get("/community/announcements/")
            self.assertEqual(feed_response.status_code, status.HTTP_200_OK)
            self.assertEqual(feed_response.data[0]["schedule"]["id"], schedule.pk)
            self.assertEqual(feed_response.data[0]["schedule"]["booking_count"], 1)

        schedules_response = self.client.get("/community/schedules/")
        self.assertEqual(schedules_response.status_code, status.HTTP_200_OK)
        self.assertEqual(schedules_response.data[0]["id"], schedule.pk)
        self.assertEqual(schedules_response.data[0]["booking_count"], 1)

    def test_farmer_feed_keeps_existing_audience_and_publication_rules(self):
        self.client.force_authenticate(self.mao)
        base = {"content": "Activity details", "category": "General", "is_published": True}
        for title, audience, published in (
            ("For farmers", "FARMER", True),
            ("For SIBAT", "SIBAT", True),
            ("Draft", "ALL", False),
        ):
            response = self.client.post(
                "/community/announcements/",
                {**base, "title": title, "audience": audience, "is_published": published},
                format="json",
            )
            self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        self.client.force_authenticate(self.farmer)
        response = self.client.get("/community/announcements/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([item["title"] for item in response.data], ["For farmers"])
class FieldSchedulingPermissionApiTests(APITestCase):
    def setUp(self):
        self.mao = self._user("schedule-mao", Role.UserRoles.MAO)
        self.sibat = self._user("schedule-sibat", Role.UserRoles.SIBAT)
        self.farmer = self._user("schedule-farmer", Role.UserRoles.FARMER)
        self.other_farmer = self._user("schedule-other-farmer", Role.UserRoles.FARMER)
        self.barangay = Barangay.objects.create(
            barangay_name="Poblacion", latitude=13.8821, longitude=121.2144
        )
        Farmer.objects.create(user=self.farmer, barangay=self.barangay, farm_size=1, address="Purok 1")

    def _user(self, username, role_name):
        role, _ = Role.objects.get_or_create(role_name=role_name)
        return User.objects.create_user(
            username=username,
            email=f"{username}@example.com",
            password="test-password",
            role=role,
            account_status=User.AccountStatus.APPROVED,
        )

    def _schedule_payload(self, program="Vaccination Drive"):
        return {
            "date": (timezone.localdate() + timedelta(days=21)).isoformat(),
            "program": program,
            "location": "Poblacion Barangay Hall",
        }

    def test_mao_retains_schedule_create_edit_close_and_delete(self):
        self.client.force_authenticate(self.mao)
        created = self.client.post("/community/schedules/", self._schedule_payload(), format="json")
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        schedule_id = created.data["id"]

        edited = self.client.patch(
            f"/community/schedules/{schedule_id}/",
            {"program": "Updated Vaccination Drive", "location": "Municipal Hall"},
            format="json",
        )
        self.assertEqual(edited.status_code, status.HTTP_200_OK)
        self.assertEqual(edited.data["program"], "Updated Vaccination Drive")

        closed = self.client.patch(f"/community/schedules/{schedule_id}/", {"is_open": False}, format="json")
        self.assertEqual(closed.status_code, status.HTTP_200_OK)
        self.assertEqual(closed.data["registration_status"], "CLOSED")
        self.assertEqual(self.client.delete(f"/community/schedules/{schedule_id}/").status_code, status.HTTP_204_NO_CONTENT)

    def test_sibat_can_manage_schedule_view_roster_and_deletion_rules_protect_bookings(self):
        self.client.force_authenticate(self.sibat)
        created = self.client.post("/community/schedules/", self._schedule_payload(), format="json")
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        schedule_id = created.data["id"]
        self.assertEqual(created.data["location"], "Poblacion Barangay Hall")

        ProgramBooking.objects.create(
            schedule_id=schedule_id, farmer=self.farmer, time="08:00"
        )
        bookings = self.client.get("/community/bookings/")
        self.assertEqual(bookings.status_code, status.HTTP_200_OK)
        self.assertEqual(bookings.data[0]["farmer_name"], self.farmer.get_full_name() or self.farmer.username)
        self.assertEqual(bookings.data[0]["farmer_barangay"], "Poblacion")
        self.assertEqual(bookings.data[0]["status"], "CONFIRMED")

        edited = self.client.patch(
            f"/community/schedules/{schedule_id}/", {"program": "Revised Drive"}, format="json"
        )
        self.assertEqual(edited.status_code, status.HTTP_200_OK)
        closed = self.client.patch(
            f"/community/schedules/{schedule_id}/", {"is_open": False}, format="json"
        )
        self.assertEqual(closed.status_code, status.HTTP_200_OK)
        listed = self.client.get("/community/schedules/")
        self.assertIn(schedule_id, [row["id"] for row in listed.data])

        self.client.force_authenticate(self.farmer)
        farmer_schedules = self.client.get("/community/schedules/")
        self.assertNotIn(schedule_id, [row["id"] for row in farmer_schedules.data])
        rejected_booking = self.client.post(
            "/community/bookings/", {"schedule": schedule_id, "time": "09:30"}, format="json"
        )
        self.assertEqual(rejected_booking.status_code, status.HTTP_400_BAD_REQUEST)

        self.client.force_authenticate(self.sibat)
        self.assertEqual(
            self.client.delete(f"/community/schedules/{schedule_id}/").status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertTrue(ProgramSchedule.objects.filter(pk=schedule_id).exists())
        self.assertTrue(ProgramBooking.objects.filter(schedule_id=schedule_id).exists())

        empty_program = self.client.post(
            "/community/schedules/", self._schedule_payload("No booking program"), format="json"
        )
        self.assertEqual(empty_program.status_code, status.HTTP_201_CREATED)
        self.assertEqual(
            self.client.delete(f"/community/schedules/{empty_program.data['id']}/").status_code,
            status.HTTP_204_NO_CONTENT,
        )

    def test_farmer_cannot_manage_schedules_or_see_another_farmers_booking(self):
        schedule = ProgramSchedule.objects.create(
            date=timezone.localdate() + timedelta(days=21),
            program="Public Visit",
            created_by=self.mao,
        )
        ProgramBooking.objects.create(schedule=schedule, farmer=self.other_farmer, time="08:00")
        self.client.force_authenticate(self.farmer)

        create_response = self.client.post("/community/schedules/", self._schedule_payload(), format="json")
        self.assertEqual(create_response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.client.patch(f"/community/schedules/{schedule.pk}/", {"is_open": False}, format="json").status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.client.delete(f"/community/schedules/{schedule.pk}/").status_code, status.HTTP_403_FORBIDDEN)
        farmer_bookings = self.client.get("/community/bookings/")
        self.assertEqual(farmer_bookings.status_code, status.HTTP_200_OK)
        self.assertEqual(farmer_bookings.data, [])
    def test_capacity_allows_same_time_until_full_and_rejects_overbooking(self):
        schedule = ProgramSchedule.objects.create(
            date=timezone.localdate() + timedelta(days=21),
            program="Capacity Test Program",
            capacity=2,
            created_by=self.mao,
        )

        self.client.force_authenticate(self.farmer)
        first = self.client.post(
            "/community/bookings/", {"schedule": schedule.pk, "time": "08:00"}, format="json"
        )
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)

        self.client.force_authenticate(self.other_farmer)
        second = self.client.post(
            "/community/bookings/", {"schedule": schedule.pk, "time": "08:00"}, format="json"
        )
        self.assertEqual(second.status_code, status.HTTP_201_CREATED)

        self.client.force_authenticate(self.sibat)
        listed = self.client.get("/community/schedules/")
        row = next(item for item in listed.data if item["id"] == schedule.pk)
        self.assertEqual(row["capacity"], 2)
        self.assertEqual(row["booking_count"], 2)
        self.assertEqual(row["remaining_slots"], 0)
        self.assertEqual(row["registration_status"], "FULL")

        third_farmer = self._user("schedule-third-farmer", Role.UserRoles.FARMER)
        self.client.force_authenticate(third_farmer)
        rejected = self.client.post(
            "/community/bookings/", {"schedule": schedule.pk, "time": "09:30"}, format="json"
        )
        self.assertEqual(rejected.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(rejected.data["detail"], "This program is fully booked.")

    def test_capacity_cannot_be_reduced_below_confirmed_bookings_and_can_be_increased(self):
        schedule = ProgramSchedule.objects.create(
            date=timezone.localdate() + timedelta(days=21),
            program="Capacity Edit Program",
            capacity=3,
            created_by=self.mao,
        )
        ProgramBooking.objects.create(schedule=schedule, farmer=self.farmer, time="08:00")
        ProgramBooking.objects.create(schedule=schedule, farmer=self.other_farmer, time="08:00")

        self.client.force_authenticate(self.sibat)
        rejected = self.client.patch(
            f"/community/schedules/{schedule.pk}/", {"capacity": 1}, format="json"
        )
        self.assertEqual(rejected.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Capacity cannot be lower", str(rejected.data["capacity"]))

        increased = self.client.patch(
            f"/community/schedules/{schedule.pk}/", {"capacity": 5}, format="json"
        )
        self.assertEqual(increased.status_code, status.HTTP_200_OK)
        self.assertEqual(increased.data["capacity"], 5)
        self.assertEqual(increased.data["remaining_slots"], 3)

    def test_sibat_can_upload_and_remove_individual_activity_photos(self):
        image_buffer = BytesIO()
        Image.new("RGB", (2, 2), color="green").save(image_buffer, format="PNG")
        image_bytes = image_buffer.getvalue()
        with tempfile.TemporaryDirectory() as media_root, override_settings(MEDIA_ROOT=media_root):
            self.client.force_authenticate(self.sibat)
            response = self.client.post(
                "/community/announcements/",
                {
                    "title": "Farm visit photos",
                    "content": "Photos from the farm visit.",
                    "audience": "ALL",
                    "is_published": True,
                    "photo_uploads": [
                        SimpleUploadedFile("first.png", image_bytes, content_type="image/png"),
                        SimpleUploadedFile("second.png", image_bytes, content_type="image/png"),
                    ],
                },
                format="multipart",
            )
            self.assertEqual(response.status_code, status.HTTP_201_CREATED)
            self.assertEqual(len(response.data["photos"]), 2)

            removed = self.client.patch(
                f"/community/announcements/{response.data['id']}/",
                {"remove_photo_ids": [response.data["photos"][0]["id"]]},
                format="multipart",
            )
            self.assertEqual(removed.status_code, status.HTTP_200_OK)
            self.assertEqual(len(removed.data["photos"]), 1)

import tempfile
from io import BytesIO
from datetime import timedelta

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.utils import timezone
from PIL import Image
from rest_framework import status
from rest_framework.test import APITestCase

from users.models import Announcement, Notification, ProgramBooking, ProgramSchedule, Role, User
from livestock.models import Barangay, Farmer


class ActivitySchedulingApiTests(APITestCase):
    def setUp(self):
        self.mao = self._user("activity-mao", Role.UserRoles.MAO)
        self.sibat = self._user("activity-sibat", Role.UserRoles.SIBAT)
        self.farmer = self._user("activity-farmer", Role.UserRoles.FARMER)
        self.barangay = Barangay.objects.create(barangay_name="Activity Local", latitude=0, longitude=0)
        Farmer.objects.create(user=self.farmer, barangay=self.barangay, address="Test")
        self.sibat.assigned_barangay = self.barangay
        self.sibat.save(update_fields=["assigned_barangay"])

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
            barangay=self.barangay,
            location="Municipal Agriculture Office",
            created_by=self.mao,
        )

    def test_announcement_is_standalone_and_visible_to_farmer(self):
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
        self.assertNotIn("schedule", response.data)

        self.client.force_authenticate(self.farmer)
        feed_response = self.client.get("/community/announcements/")
        self.assertEqual(feed_response.status_code, status.HTTP_200_OK)
        self.assertEqual(feed_response.data[0]["id"], response.data["id"])
        self.assertNotIn("schedule", feed_response.data[0])

    def test_announcement_does_not_link_to_or_expose_a_program(self):
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
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertNotIn("schedule", response.data)

        for reviewer in (self.mao, self.sibat, self.farmer):
            self.client.force_authenticate(reviewer)
            feed_response = self.client.get("/community/announcements/")
            self.assertEqual(feed_response.status_code, status.HTTP_200_OK)
            self.assertNotIn("schedule", feed_response.data[0])

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
        Farmer.objects.create(user=self.other_farmer, barangay=self.barangay, address="Test")
        self.sibat.assigned_barangay = self.barangay
        self.sibat.save(update_fields=["assigned_barangay"])

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
        closed_program = next(row for row in farmer_schedules.data if row["id"] == schedule_id)
        self.assertEqual(closed_program["registration_status"], "CLOSED")
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

    def test_sibat_can_remove_expired_schedule_without_losing_booking_history(self):
        schedule = ProgramSchedule.objects.create(
            date=timezone.localdate() - timedelta(days=13),
            program="Completed Outreach",
            barangay=self.barangay,
            is_open=False,
            created_by=self.mao,
        )
        booking = ProgramBooking.objects.create(schedule=schedule, farmer=self.farmer, time="08:00")
        self.client.force_authenticate(self.sibat)

        response = self.client.delete(f"/community/schedules/{schedule.pk}/")

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        schedule.refresh_from_db()
        booking.refresh_from_db()
        self.assertIsNotNone(schedule.deleted_at)
        self.assertEqual(booking.schedule_id, schedule.pk)
        self.assertTrue(ProgramBooking.objects.filter(pk=booking.pk).exists())
        listed = self.client.get("/community/schedules/")
        self.assertNotIn(schedule.pk, [row["id"] for row in listed.data])

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
            barangay=self.barangay,
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
        Farmer.objects.create(user=third_farmer, barangay=self.barangay, address="Test")
        self.client.force_authenticate(third_farmer)
        rejected = self.client.post(
            "/community/bookings/", {"schedule": schedule.pk, "time": "09:30"}, format="json"
        )
        self.assertEqual(rejected.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(rejected.data["detail"], "This program is fully booked.")

    def test_unlimited_capacity_program_notifies_farmers_with_deep_link_and_rejects_booking(self):
        self.client.force_authenticate(self.mao)
        payload = self._schedule_payload()
        payload["program"] = "Open Livestock Seminar"
        payload["capacity"] = 0
        payload["location"] = "Municipal Gymnasium"
        payload["publication_status"] = "PUBLISHED"
        res = self.client.post("/community/schedules/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        schedule_id = res.data["id"]

        notif = Notification.objects.filter(user=self.farmer, related_entity_id=schedule_id).first()
        self.assertIsNotNone(notif)
        self.assertIn("Open Program", notif.title)
        self.assertIn("walk-in welcome", notif.message.lower())
        self.assertEqual(notif.link, f"/farmer-scheduling?scheduleId={schedule_id}")

        self.client.force_authenticate(self.farmer)
        book_res = self.client.post(
            "/community/bookings/",
            {"schedule": schedule_id, "time": "08:00"},
            format="json",
        )
        self.assertEqual(book_res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("no participant limit", book_res.data["detail"])

    def test_capacity_cannot_be_reduced_below_confirmed_bookings_and_can_be_increased(self):
        schedule = ProgramSchedule.objects.create(
            date=timezone.localdate() + timedelta(days=21),
            program="Capacity Edit Program",
            capacity=3,
            barangay=self.barangay,
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

    def test_program_visibility_and_management_follow_assigned_barangay(self):
        other_barangay = Barangay.objects.create(barangay_name="Remote", latitude=0, longitude=0)
        local = ProgramSchedule.objects.create(
            date=timezone.localdate() + timedelta(days=14), program="Local program",
            barangay=self.barangay, created_by=self.mao,
        )
        remote = ProgramSchedule.objects.create(
            date=timezone.localdate() + timedelta(days=14), program="Remote program",
            barangay=other_barangay, created_by=self.mao,
        )
        self.client.force_authenticate(self.sibat)
        listed = self.client.get("/community/schedules/")
        self.assertEqual([row["id"] for row in listed.data], [local.pk])
        self.assertEqual(self.client.patch(f"/community/schedules/{remote.pk}/", {"program": "Tampered"}, format="json").status_code, status.HTTP_404_NOT_FOUND)
        rejected = self.client.post("/community/schedules/", {**self._schedule_payload("Wrong scope"), "barangay": other_barangay.pk}, format="json")
        self.assertEqual(rejected.status_code, status.HTTP_400_BAD_REQUEST)
        created = self.client.post("/community/schedules/", self._schedule_payload("Assigned scope"), format="json")
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        self.assertEqual(created.data["barangay"], self.barangay.pk)

    def test_all_barangays_sibat_can_create_municipal_program_without_mao_approval(self):
        self.sibat.access_scope = User.AccessScope.ALL_BARANGAYS
        self.sibat.save(update_fields=["access_scope"])
        self.client.force_authenticate(self.sibat)
        response = self.client.post("/community/schedules/", self._schedule_payload("Municipal seminar"), format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertIsNone(response.data["barangay"])
        self.assertEqual(response.data["publication_status"], ProgramSchedule.PublicationStatus.PUBLISHED)

    def test_sibat_can_publish_directly_and_cancellation_preserves_booking_history(self):
        self.client.force_authenticate(self.sibat)
        created = self.client.post(
            "/community/schedules/",
            {**self._schedule_payload("Field vaccination"), "publication_status": "DRAFT"},
            format="json",
        )
        self.assertEqual(created.status_code, status.HTTP_201_CREATED, created.data)
        self.assertFalse(created.data["is_open"])

        self.client.force_authenticate(self.farmer)
        self.assertNotIn(created.data["id"], [row["id"] for row in self.client.get("/community/schedules/").data])

        self.client.force_authenticate(self.sibat)
        published = self.client.patch(f"/community/schedules/{created.data['id']}/", {"publication_status": "PUBLISHED"}, format="json")
        self.assertEqual(published.status_code, status.HTTP_200_OK, published.data)
        self.assertTrue(published.data["is_open"])

        self.client.force_authenticate(self.farmer)
        booking = self.client.post("/community/bookings/", {"schedule": created.data["id"], "time": "08:00"}, format="json")
        self.assertEqual(booking.status_code, status.HTTP_201_CREATED, booking.data)

        self.client.force_authenticate(self.sibat)
        cancelled = self.client.patch(f"/community/schedules/{created.data['id']}/", {"publication_status": "CANCELLED"}, format="json")
        self.assertEqual(cancelled.status_code, status.HTTP_200_OK, cancelled.data)
        booking_row = ProgramBooking.objects.get(pk=booking.data["id"])
        self.assertEqual(booking_row.status, ProgramBooking.Status.CANCELLED)
        self.assertTrue(Notification.objects.filter(user=self.farmer, title="Program cancelled").exists())
        self.assertEqual(self.client.patch(f"/community/schedules/{created.data['id']}/", {"publication_status": "PUBLISHED"}, format="json").status_code, status.HTTP_400_BAD_REQUEST)

    def test_cbat_has_the_same_program_and_roster_capabilities_with_barangay_scope(self):
        cbat = self._user("schedule-cbat", Role.UserRoles.CBAT)
        cbat.assigned_barangay = self.barangay
        cbat.save(update_fields=["assigned_barangay"])
        self.client.force_authenticate(cbat)
        created = self.client.post("/community/schedules/", self._schedule_payload("CBAT health visit"), format="json")
        self.assertEqual(created.status_code, status.HTTP_201_CREATED, created.data)
        self.assertEqual(created.data["barangay"], self.barangay.pk)
        edited = self.client.patch(f"/community/schedules/{created.data['id']}/", {"description": "Field animal health activity"}, format="json")
        self.assertEqual(edited.status_code, status.HTTP_200_OK, edited.data)

        self.client.force_authenticate(self.farmer)
        booking = self.client.post("/community/bookings/", {"schedule": created.data["id"], "time": "08:00"}, format="json")
        self.assertEqual(booking.status_code, status.HTTP_201_CREATED, booking.data)
        self.client.force_authenticate(cbat)
        roster = self.client.get("/community/bookings/")
        self.assertEqual([row["id"] for row in roster.data], [booking.data["id"]])
        cancelled = self.client.patch(
            f"/community/bookings/{booking.data['id']}/", {"status": "CANCELLED"}, format="json"
        )
        self.assertEqual(cancelled.status_code, status.HTTP_200_OK, cancelled.data)
        self.assertEqual(cancelled.data["status"], ProgramBooking.Status.CANCELLED)
        self.assertTrue(Notification.objects.filter(user=self.farmer, title="Program booking cancelled").exists())

    def test_farmer_only_sees_published_programs_matching_coverage_and_can_attend_history(self):
        visible = ProgramSchedule.objects.create(
            date=timezone.localdate() + timedelta(days=14), program="Visible", barangay=self.barangay,
            description="Vaccination and health check", category=ProgramSchedule.Category.VACCINATION,
            registration_deadline=timezone.localdate() + timedelta(days=7), created_by=self.mao,
        )
        draft = ProgramSchedule.objects.create(
            date=timezone.localdate() + timedelta(days=14), program="Draft",
            publication_status=ProgramSchedule.PublicationStatus.DRAFT, created_by=self.mao,
        )
        expired_registration = ProgramSchedule.objects.create(
            date=timezone.localdate() + timedelta(days=14), program="Registration closed",
            registration_deadline=timezone.localdate() - timedelta(days=1), created_by=self.mao,
        )
        opening_later = ProgramSchedule.objects.create(
            date=timezone.localdate() + timedelta(days=14), program="Opening later",
            registration_opens=timezone.localdate() + timedelta(days=3), created_by=self.mao,
        )
        other_barangay = Barangay.objects.create(barangay_name="Other", latitude=0, longitude=0)
        ProgramSchedule.objects.create(
            date=timezone.localdate() + timedelta(days=14), program="Not for this barangay",
            barangay=other_barangay, created_by=self.mao,
        )
        self.client.force_authenticate(self.farmer)
        rows = self.client.get("/community/schedules/").data
        self.assertEqual({row["id"] for row in rows}, {visible.pk, expired_registration.pk, opening_later.pk})
        status_by_id = {row["id"]: row["registration_status"] for row in rows}
        self.assertEqual(status_by_id[expired_registration.pk], "CLOSED")
        self.assertEqual(status_by_id[opening_later.pk], "NOT_OPEN")
        closed_booking = self.client.post("/community/bookings/", {"schedule": draft.pk, "time": "08:00"}, format="json")
        self.assertEqual(closed_booking.status_code, status.HTTP_400_BAD_REQUEST)
        deadline_booking = self.client.post("/community/bookings/", {"schedule": expired_registration.pk, "time": "08:00"}, format="json")
        self.assertEqual(deadline_booking.status_code, status.HTTP_400_BAD_REQUEST)
        early_booking = self.client.post("/community/bookings/", {"schedule": opening_later.pk, "time": "08:00"}, format="json")
        self.assertEqual(early_booking.status_code, status.HTTP_400_BAD_REQUEST)
        booking = self.client.post("/community/bookings/", {"schedule": visible.pk, "time": "08:00"}, format="json")
        self.assertEqual(booking.status_code, status.HTTP_201_CREATED)

        visible.date = timezone.localdate() - timedelta(days=1)
        visible.save(update_fields=["date"])
        self.client.force_authenticate(self.sibat)
        attendance = self.client.patch(f"/community/bookings/{booking.data['id']}/", {"status": "ATTENDED"}, format="json")
        self.assertEqual(attendance.status_code, status.HTTP_200_OK, attendance.data)
        self.assertEqual(attendance.data["status"], ProgramBooking.Status.ATTENDED)

    def test_program_cover_image_upload_and_replacement_uses_media_storage(self):
        image_buffer = BytesIO()
        Image.new("RGB", (3, 3), color="green").save(image_buffer, format="PNG")
        image_bytes = image_buffer.getvalue()
        with tempfile.TemporaryDirectory() as media_root, override_settings(MEDIA_ROOT=media_root):
            self.client.force_authenticate(self.sibat)
            payload = self._schedule_payload("Image program")
            payload["cover_image"] = SimpleUploadedFile("cover.png", image_bytes, content_type="image/png")
            payload["description"] = "A farmer vaccination service."
            payload["category"] = ProgramSchedule.Category.VACCINATION
            payload["registration_opens"] = ""
            payload["registration_deadline"] = ""
            created = self.client.post("/community/schedules/", payload, format="multipart")
            self.assertEqual(created.status_code, status.HTTP_201_CREATED, created.data)
            self.assertIn("program_images/", created.data["cover_image"])
            self.assertEqual(created.data["description"], payload["description"])

            replacement = self.client.patch(
                f"/community/schedules/{created.data['id']}/",
                {"cover_image": SimpleUploadedFile("replacement.png", image_bytes, content_type="image/png")},
                format="multipart",
            )
            self.assertEqual(replacement.status_code, status.HTTP_200_OK, replacement.data)
            self.assertIn("replacement", replacement.data["cover_image"])

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


class AnnouncementAudienceAndBarangayScopingTests(APITestCase):
    def setUp(self):
        self.cawongan = Barangay.objects.create(barangay_name="Cawongan", latitude=0, longitude=0)
        self.manggas = Barangay.objects.create(barangay_name="Manggas", latitude=0, longitude=0)
        self.pansol = Barangay.objects.create(barangay_name="Pansol", latitude=0, longitude=0)

        self.mao = self._user("aud-mao", Role.UserRoles.MAO)
        self.farmer = self._user("aud-farmer", Role.UserRoles.FARMER)
        self.auction = self._user("aud-auction", Role.UserRoles.AUCTION)
        self.slaughterhouse = self._user("aud-slaughter", Role.UserRoles.SLAUGHTERHOUSESTAFF)

        # SIBAT users
        self.sibat_a = self._user("sibat-cawongan", Role.UserRoles.SIBAT, assigned_barangay=self.cawongan)
        self.sibat_b = self._user("sibat-manggas", Role.UserRoles.SIBAT, assigned_barangay=self.manggas)
        self.sibat_c = self._user("sibat-pansol", Role.UserRoles.SIBAT, assigned_barangay=self.pansol)
        self.sibat_d = self._user(
            "sibat-all-barangay",
            Role.UserRoles.SIBAT,
            assigned_barangay=self.manggas,
            access_scope=User.AccessScope.ALL_BARANGAYS,
        )

    def _user(self, username, role_name, assigned_barangay=None, access_scope=User.AccessScope.ASSIGNED_ONLY):
        role, _ = Role.objects.get_or_create(role_name=role_name)
        return User.objects.create_user(
            username=username,
            email=f"{username}@example.com",
            password="test-password",
            role=role,
            assigned_barangay=assigned_barangay,
            access_scope=access_scope,
            account_status=User.AccountStatus.APPROVED,
        )

    @override_settings(FRONTEND_URL="https://smartlivestock.example")
    def test_public_share_endpoint_is_anonymous_but_only_for_published_all_audience_announcements(self):
        public = Announcement.objects.create(
            title="Public livestock notice",
            content="Municipal vaccination schedule.",
            category="Vaccination",
            audience=Announcement.Audience.ALL,
            is_published=True,
            posted_by=self.mao,
            published_at=timezone.now(),
        )
        restricted = Announcement.objects.create(
            title="Farmer-only notice",
            content="Restricted details.",
            audience=Announcement.Audience.FARMER_ONLY,
            is_published=True,
            posted_by=self.mao,
        )
        draft = Announcement.objects.create(
            title="Unpublished draft",
            content="Draft details.",
            audience=Announcement.Audience.ALL,
            is_published=False,
            posted_by=self.mao,
        )

        response = self.client.get(f"/community/announcements/{public.pk}/share/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["title"], public.title)
        self.assertEqual(
            set(response.data.keys()),
            {"id", "title", "content", "category", "image", "photos", "published_at", "share_url"},
        )
        self.assertTrue(response.data["share_url"].endswith(f"/share/announcements/{public.pk}"))
        self.assertEqual(self.client.get(f"/community/announcements/{restricted.pk}/share/").status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(self.client.get(f"/community/announcements/{draft.pk}/share/").status_code, status.HTTP_404_NOT_FOUND)

    def test_validation_requires_target_barangay_for_sibat_barangay_only(self):
        self.client.force_authenticate(self.mao)
        
        # Missing target barangay should fail
        res = self.client.post(
            "/community/announcements/",
            {
                "title": "Cawongan SIBAT Notice",
                "content": "Meeting details",
                "category": "General",
                "audience": Announcement.Audience.SIBAT_BARANGAY,
                "is_published": True,
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("target_barangay", res.data)

        # With target barangay should succeed
        res_ok = self.client.post(
            "/community/announcements/",
            {
                "title": "Cawongan SIBAT Notice",
                "content": "Meeting details",
                "category": "General",
                "audience": Announcement.Audience.SIBAT_BARANGAY,
                "target_barangay": self.cawongan.id,
                "is_published": True,
            },
            format="json",
        )
        self.assertEqual(res_ok.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res_ok.data["target_barangay"], self.cawongan.id)
        self.assertEqual(res_ok.data["target_barangay_name"], "Cawongan")

    def test_audience_visibility_matrix(self):
        self.client.force_authenticate(self.mao)
        base = {"content": "Test content", "category": "General", "is_published": True}

        # 1. Farmer and SIBAT
        self.client.post(
            "/community/announcements/",
            {**base, "title": "For Farmer and SIBAT", "audience": Announcement.Audience.FARMER_AND_SIBAT},
            format="json",
        )
        # 2. Farmer Only
        self.client.post(
            "/community/announcements/",
            {**base, "title": "For Farmer Only", "audience": Announcement.Audience.FARMER_ONLY},
            format="json",
        )
        # 3. SIBAT Only
        self.client.post(
            "/community/announcements/",
            {**base, "title": "For SIBAT Only", "audience": Announcement.Audience.SIBAT_ONLY},
            format="json",
        )
        # 4. ALL
        self.client.post(
            "/community/announcements/",
            {**base, "title": "For ALL", "audience": Announcement.Audience.ALL},
            format="json",
        )
        # 5. SIBAT Cawongan Only
        self.client.post(
            "/community/announcements/",
            {
                **base,
                "title": "For SIBAT Cawongan Only",
                "audience": Announcement.Audience.SIBAT_BARANGAY,
                "target_barangay": self.cawongan.id,
            },
            format="json",
        )

        # Verify Farmer: sees FARMER_AND_SIBAT, FARMER_ONLY, ALL
        self.client.force_authenticate(self.farmer)
        titles_farmer = [a["title"] for a in self.client.get("/community/announcements/").data]
        self.assertIn("For Farmer and SIBAT", titles_farmer)
        self.assertIn("For Farmer Only", titles_farmer)
        self.assertIn("For ALL", titles_farmer)
        self.assertNotIn("For SIBAT Only", titles_farmer)
        self.assertNotIn("For SIBAT Cawongan Only", titles_farmer)

        # Verify Auction: sees only ALL
        self.client.force_authenticate(self.auction)
        titles_auction = [a["title"] for a in self.client.get("/community/announcements/").data]
        self.assertEqual(titles_auction, ["For ALL"])

        # Verify Slaughterhouse: sees only ALL
        self.client.force_authenticate(self.slaughterhouse)
        titles_slaughter = [a["title"] for a in self.client.get("/community/announcements/").data]
        self.assertEqual(titles_slaughter, ["For ALL"])

        # Verify SIBAT A (Cawongan): sees FARMER_AND_SIBAT, SIBAT_ONLY, ALL, and Cawongan-targeted
        self.client.force_authenticate(self.sibat_a)
        titles_sibat_a = [a["title"] for a in self.client.get("/community/announcements/").data]
        self.assertIn("For Farmer and SIBAT", titles_sibat_a)
        self.assertIn("For SIBAT Only", titles_sibat_a)
        self.assertIn("For ALL", titles_sibat_a)
        self.assertIn("For SIBAT Cawongan Only", titles_sibat_a)
        self.assertNotIn("For Farmer Only", titles_sibat_a)

        # Verify SIBAT B (Manggas): does NOT see Cawongan-targeted
        self.client.force_authenticate(self.sibat_b)
        titles_sibat_b = [a["title"] for a in self.client.get("/community/announcements/").data]
        self.assertIn("For Farmer and SIBAT", titles_sibat_b)
        self.assertIn("For SIBAT Only", titles_sibat_b)
        self.assertIn("For ALL", titles_sibat_b)
        self.assertNotIn("For SIBAT Cawongan Only", titles_sibat_b)

        # Verify SIBAT C (Pansol): does NOT see Cawongan-targeted
        self.client.force_authenticate(self.sibat_c)
        titles_sibat_c = [a["title"] for a in self.client.get("/community/announcements/").data]
        self.assertNotIn("For SIBAT Cawongan Only", titles_sibat_c)

        # Verify SIBAT D (ALL_BARANGAYS): sees Cawongan-targeted even if assigned to Manggas
        self.client.force_authenticate(self.sibat_d)
        titles_sibat_d = [a["title"] for a in self.client.get("/community/announcements/").data]
        self.assertIn("For SIBAT Cawongan Only", titles_sibat_d)

    def test_notifications_sent_according_to_audience(self):
        from users.models import Notification
        Notification.objects.all().delete()

        self.client.force_authenticate(self.mao)
        
        # SIBAT Cawongan Only announcement
        self.client.post(
            "/community/announcements/",
            {
                "title": "Cawongan Notice",
                "content": "Cawongan SIBAT details",
                "category": "General",
                "audience": Announcement.Audience.SIBAT_BARANGAY,
                "target_barangay": self.cawongan.id,
                "is_published": True,
            },
            format="json",
        )

        notified_users = set(Notification.objects.values_list("user_id", flat=True))
        # sibat_a (Cawongan) and sibat_d (ALL_BARANGAYS) must be notified
        self.assertIn(self.sibat_a.id, notified_users)
        self.assertIn(self.sibat_d.id, notified_users)
        # sibat_b, sibat_c, farmer, auction, slaughterhouse must NOT be notified
        self.assertNotIn(self.sibat_b.id, notified_users)
        self.assertNotIn(self.sibat_c.id, notified_users)
        self.assertNotIn(self.farmer.id, notified_users)
        self.assertNotIn(self.auction.id, notified_users)
        self.assertNotIn(self.slaughterhouse.id, notified_users)


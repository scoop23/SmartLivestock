"""
Management command to safely migrate local media files to Cloudflare R2 ('smartlivestock-prod').
Supports dry-run verification, preserves database references, avoids accidental overwrites,
and never deletes files without explicit authorization.
"""

import os
import mimetypes
from django.core.management.base import BaseCommand
from django.conf import settings
from smartlivestock.storage import get_r2_client, is_r2_storage_active
from botocore.exceptions import ClientError


class Command(BaseCommand):
    help = "Migrates existing local media files (user documents, profile images, livestock/disease photos) to Cloudflare R2."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Simulate the migration without uploading any files to Cloudflare R2.",
        )
        parser.add_argument(
            "--overwrite",
            action="store_true",
            help="Overwrite objects in R2 if they already exist with the same key.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        overwrite = options["overwrite"]

        self.stdout.write(self.style.NOTICE("=== SmartLivestock Media Migration to Cloudflare R2 ==="))
        if dry_run:
            self.stdout.write(self.style.WARNING("[MODE] DRY RUN ACTIVE — No files will be uploaded.\n"))

        bucket_name = getattr(settings, "R2_BUCKET_NAME", os.environ.get("R2_BUCKET_NAME", "smartlivestock-prod"))

        try:
            client = get_r2_client()
            client.head_bucket(Bucket=bucket_name)
        except Exception as exc:
            self.stdout.write(self.style.ERROR(
                f"[!] Cloudflare R2 is not accessible or credentials are not configured: {exc}\n"
                "Please configure R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_ENDPOINT_URL."
            ))
            return

        # Registry of all known model fields storing uploaded files
        from users.models import User, UserDocument, Announcement, AnnouncementPhoto
        from livestock.models import LivestockInventory
        from diseases.models import DiseaseCase, MortalityRecord

        targets = [
            (User, "profile_image", "User Profile Avatars"),
            (UserDocument, "document_file", "Farmer Registration Documents"),
            (Announcement, "image", "Announcement Banners"),
            (AnnouncementPhoto, "image", "Announcement Gallery Photos"),
            (LivestockInventory, "photo", "Livestock Identification Photos"),
            (DiseaseCase, "photo", "Disease Farmer Photo Evidence"),
            (DiseaseCase, "inspector_photo", "Disease SIBAT Inspection Photos"),
            (MortalityRecord, "photo", "Mortality Farmer Photo Evidence"),
            (MortalityRecord, "inspector_photo", "Mortality SIBAT Inspection Photos"),
        ]

        total_inspected = 0
        total_uploaded = 0
        total_already_exists = 0
        total_missing_local = 0
        total_errors = 0

        media_root = str(settings.MEDIA_ROOT)

        for model_cls, field_name, label in targets:
            self.stdout.write(f"\nScanning {label} ({model_cls.__name__}.{field_name})...")
            qs = model_cls.objects.exclude(**{f"{field_name}__isnull": True}).exclude(**{field_name: ""})
            count = qs.count()
            self.stdout.write(f"  Found {count} registered records.")

            for obj in qs:
                total_inspected += 1
                field_file = getattr(obj, field_name)
                if not field_file or not field_file.name:
                    continue

                storage_key = field_file.name.replace("\\", "/")
                local_path = os.path.join(media_root, *storage_key.split("/"))

                if not os.path.exists(local_path):
                    self.stdout.write(self.style.WARNING(f"    [MISSING LOCAL] Record #{obj.pk} file missing on disk: {storage_key}"))
                    total_missing_local += 1
                    continue

                # Check if object already exists in R2
                exists_in_r2 = False
                try:
                    client.head_object(Bucket=bucket_name, Key=storage_key)
                    exists_in_r2 = True
                except ClientError as e:
                    if e.response["Error"]["Code"] not in ["404", "NoSuchKey"]:
                        self.stdout.write(self.style.ERROR(f"    [ERROR] Checking R2 key '{storage_key}': {e}"))
                        total_errors += 1
                        continue

                file_size = os.path.getsize(local_path)

                if exists_in_r2 and not overwrite:
                    self.stdout.write(f"    [SKIP EXISTS] {storage_key} already exists in R2 ({file_size} bytes).")
                    total_already_exists += 1
                    continue

                content_type, _ = mimetypes.guess_type(local_path)
                if not content_type:
                    content_type = "application/octet-stream"

                if dry_run:
                    self.stdout.write(self.style.SUCCESS(
                        f"    [DRY RUN WOULD UPLOAD] {storage_key} -> r2://{bucket_name}/{storage_key} ({file_size} bytes, {content_type})"
                    ))
                    total_uploaded += 1
                else:
                    try:
                        with open(local_path, "rb") as f:
                            client.put_object(
                                Bucket=bucket_name,
                                Key=storage_key,
                                Body=f.read(),
                                ContentType=content_type,
                            )
                        self.stdout.write(self.style.SUCCESS(
                            f"    [UPLOADED] {storage_key} -> r2://{bucket_name}/{storage_key} ({file_size} bytes)"
                        ))
                        total_uploaded += 1
                    except Exception as exc:
                        self.stdout.write(self.style.ERROR(f"    [FAIL] Could not upload {storage_key}: {exc}"))
                        total_errors += 1

        self.stdout.write(self.style.NOTICE("\n=== Migration Summary ==="))
        self.stdout.write(f"Total Records Inspected:    {total_inspected}")
        self.stdout.write(f"Already in R2 (Skipped):     {total_already_exists}")
        self.stdout.write(f"Uploaded / Would Upload:    {total_uploaded}")
        self.stdout.write(f"Missing Local Files:        {total_missing_local}")
        self.stdout.write(f"Errors Encountered:         {total_errors}")

        if dry_run:
            self.stdout.write(self.style.NOTICE("\n[DRY RUN COMPLETE] No actual changes made to R2. Run without --dry-run to perform upload."))
        else:
            self.stdout.write(self.style.SUCCESS("\n[MIGRATION COMPLETE] All eligible local media uploaded to Cloudflare R2."))

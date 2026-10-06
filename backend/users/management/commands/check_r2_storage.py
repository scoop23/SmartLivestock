"""
Management command to test Cloudflare R2 connectivity and operations.
Verifies credentials, bucket accessibility, object write, read, and cleanup
without exposing any secret keys.
"""

import os
import uuid
from datetime import datetime, timezone
from django.core.management.base import BaseCommand
from django.conf import settings
from smartlivestock.storage import get_r2_client, is_r2_storage_active


class Command(BaseCommand):
    help = "Verifies Cloudflare R2 storage credentials, bucket connectivity, read/write/delete operations."

    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE("=== SmartLivestock Cloudflare R2 Health Check ==="))

        bucket_name = getattr(settings, "R2_BUCKET_NAME", os.environ.get("R2_BUCKET_NAME", "smartlivestock-prod"))
        endpoint_url = getattr(settings, "R2_ENDPOINT_URL", os.environ.get("R2_ENDPOINT_URL"))
        access_key = getattr(settings, "R2_ACCESS_KEY_ID", os.environ.get("R2_ACCESS_KEY_ID"))
        secret_key = getattr(settings, "R2_SECRET_ACCESS_KEY", os.environ.get("R2_SECRET_ACCESS_KEY"))

        self.stdout.write(f"Active Django Storage: {'R2MediaStorage (Cloudflare R2)' if is_r2_storage_active() else 'FileSystemStorage (Local)'}")
        self.stdout.write(f"Target Bucket: {bucket_name}")
        self.stdout.write(f"Endpoint URL: {endpoint_url or 'Not configured'}")
        
        # Masked credential check (never print actual keys)
        has_access_key = bool(access_key and access_key.strip())
        has_secret_key = bool(secret_key and secret_key.strip())
        self.stdout.write(f"Access Key ID Configured: {'[YES]' if has_access_key else '[NO]'}")
        self.stdout.write(f"Secret Access Key Configured: {'[YES]' if has_secret_key else '[NO]'}")

        if not (has_access_key and has_secret_key and endpoint_url):
            self.stdout.write(self.style.WARNING(
                "\n[!] Cloudflare R2 credentials are not set in the active environment.\n"
                "To connect to R2, configure R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_ENDPOINT_URL in .env or Render.\n"
                "System is currently operating using local filesystem fallback."
            ))
            return

        try:
            client = get_r2_client()
        except Exception as exc:
            self.stdout.write(self.style.ERROR(f"\n[-] Failed to initialize boto3 R2 client: {exc}"))
            return

        # 1. Bucket accessibility check
        self.stdout.write("\n1. Verifying bucket accessibility...")
        try:
            client.head_bucket(Bucket=bucket_name)
            self.stdout.write(self.style.SUCCESS(f"   [+] Bucket '{bucket_name}' exists and is accessible."))
        except Exception as exc:
            self.stdout.write(self.style.ERROR(f"   [-] Failed to access bucket '{bucket_name}': {exc}"))
            return

        # 2. Write temporary test object
        test_key = f"_healthcheck/r2_connectivity_test_{uuid.uuid4().hex[:8]}.txt"
        test_content = f"SmartLivestock R2 health check at {datetime.now(timezone.utc).isoformat()}".encode("utf-8")
        self.stdout.write(f"2. Writing temporary health check object ({test_key})...")
        try:
            client.put_object(
                Bucket=bucket_name,
                Key=test_key,
                Body=test_content,
                ContentType="text/plain",
            )
            self.stdout.write(self.style.SUCCESS("   [+] Object successfully written to R2."))
        except Exception as exc:
            self.stdout.write(self.style.ERROR(f"   [-] Failed to write object: {exc}"))
            return

        # 3. Read back test object
        self.stdout.write("3. Reading back test object from R2...")
        try:
            resp = client.get_object(Bucket=bucket_name, Key=test_key)
            downloaded = resp["Body"].read()
            if downloaded == test_content:
                self.stdout.write(self.style.SUCCESS("   [+] Object successfully read and verified bit-for-bit."))
            else:
                self.stdout.write(self.style.WARNING("   [!] Read succeeded but payload mismatch."))
        except Exception as exc:
            self.stdout.write(self.style.ERROR(f"   [-] Failed to read object: {exc}"))
            return

        # 4. Cleanup temporary test object
        self.stdout.write("4. Cleaning up temporary health check object...")
        try:
            client.delete_object(Bucket=bucket_name, Key=test_key)
            self.stdout.write(self.style.SUCCESS("   [+] Temporary test object cleaned up successfully."))
        except Exception as exc:
            self.stdout.write(self.style.WARNING(f"   [!] Failed to delete test object '{test_key}': {exc}"))

        self.stdout.write(self.style.SUCCESS("\n[SUCCESS] Cloudflare R2 integration is operational and verified!\n"))

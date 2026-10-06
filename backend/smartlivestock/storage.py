"""
Cloudflare R2 Object Storage Backend for SmartLivestock
=======================================================
Stores application media files in the private Cloudflare R2 bucket:
'smartlivestock-prod'.

Architecture & Security:
- PostgreSQL stores relational records, foreign keys, and file path references.
- Cloudflare R2 stores the binary payloads (images, PDFs, documents).
- Django and DRF enforce authentication, RBAC, and object ownership.
- The R2 bucket remains strictly PRIVATE.
- Sensitive credentials (R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY) exist strictly
  on the server environment and are never exposed to Next.js or the browser.
- Local development gracefully falls back to local FileSystemStorage when
  R2 credentials are not provided.
"""

import os
from django.conf import settings
from django.core.files.storage import default_storage
from storages.backends.s3 import S3Storage
import boto3
from botocore.config import Config


class R2MediaStorage(S3Storage):
    """
    S3-compatible custom storage backend targeting Cloudflare R2 ('smartlivestock-prod').
    Enforces private access, s3v4 signatures, and path-style addressing.
    """
    default_acl = None
    file_overwrite = False
    signature_version = "s3v4"
    region_name = "auto"
    addressing_style = "path"

    def __init__(self, **settings_dict):
        if "bucket_name" not in settings_dict and hasattr(settings, "AWS_STORAGE_BUCKET_NAME"):
            settings_dict["bucket_name"] = settings.AWS_STORAGE_BUCKET_NAME
        if "endpoint_url" not in settings_dict and hasattr(settings, "AWS_S3_ENDPOINT_URL"):
            settings_dict["endpoint_url"] = settings.AWS_S3_ENDPOINT_URL
        super().__init__(**settings_dict)

    def get_presigned_url(self, name: str, expiration: int = 3600, http_method: str = "GET", inline: bool = True) -> str:
        """
        Generate a secure, short-lived presigned URL for an object stored in R2.
        Does not expose account credentials to the client.
        """
        clean_key = self._normalize_name(name)
        params = {
            "Bucket": self.bucket_name,
            "Key": clean_key,
        }
        if inline:
            basename = os.path.basename(clean_key)
            params["ResponseContentDisposition"] = f'inline; filename="{basename}"'

        return self.connection.meta.client.generate_presigned_url(
            ClientMethod="get_object",
            Params=params,
            ExpiresIn=expiration,
            HttpMethod=http_method,
        )


def is_r2_storage_active() -> bool:
    """Return True if the current default storage backend is R2MediaStorage."""
    return isinstance(default_storage, R2MediaStorage)


def get_r2_client():
    """
    Create and return a raw boto3 S3 client configured for Cloudflare R2
    using settings or environment variables.
    """
    account_id = os.environ.get("R2_ACCOUNT_ID") or getattr(settings, "R2_ACCOUNT_ID", None)
    access_key = os.environ.get("R2_ACCESS_KEY_ID") or getattr(settings, "AWS_ACCESS_KEY_ID", None)
    secret_key = os.environ.get("R2_SECRET_ACCESS_KEY") or getattr(settings, "AWS_SECRET_ACCESS_KEY", None)
    endpoint = os.environ.get("R2_ENDPOINT_URL") or getattr(settings, "AWS_S3_ENDPOINT_URL", None)

    if not endpoint and account_id:
        endpoint = f"https://{account_id}.r2.cloudflarestorage.com"

    if not (access_key and secret_key and endpoint):
        raise ValueError("Cloudflare R2 credentials (access key, secret key, endpoint) are not fully configured.")

    return boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        region_name="auto",
        config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
    )

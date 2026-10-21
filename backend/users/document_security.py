"""Private registration storage and content validation (never biometric templates)."""
import os
import warnings
from io import BytesIO
from uuid import uuid4

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from pathlib import Path
from django.core.files.storage import FileSystemStorage, Storage, default_storage
from django.utils.deconstruct import deconstructible
from PIL import Image
from pypdf import PdfReader
from rest_framework import serializers


@deconstructible
class PrivateRegistrationStorage(Storage):
    @property
    def backend(self):
        if settings.USE_R2_STORAGE:
            return default_storage
        if Path(settings.PRIVATE_DOCUMENT_ROOT).resolve().is_relative_to(Path(settings.MEDIA_ROOT).resolve()):
            raise ImproperlyConfigured("PRIVATE_DOCUMENT_ROOT must be outside public MEDIA_ROOT.")
        return FileSystemStorage(location=settings.PRIVATE_DOCUMENT_ROOT)

    def _open(self, name, mode="rb"):
        # Existing local documents remain readable through the authorized stream.
        # Deployments must also deny /media/user_documents at their reverse proxy.
        if not settings.USE_R2_STORAGE and not self.backend.exists(name):
            return FileSystemStorage(location=settings.MEDIA_ROOT).open(name, mode)
        return self.backend.open(name, mode)

    def _save(self, name, content):
        return self.backend.save(name, content)

    def exists(self, name):
        return self.backend.exists(name)

    def delete(self, name):
        self.backend.delete(name)

    def size(self, name):
        with self._open(name) as uploaded:
            return uploaded.size

    def url(self, name):
        raise ValueError("Registration documents require authorized streaming.")


def document_upload_path(instance, filename):
    extension = os.path.splitext(filename)[1].lower()
    side = next((prefix for prefix in ("Front_", "Back_") if filename.startswith(prefix)), "")
    return f"user_documents/{side}{uuid4().hex}{extension}"


def validate_document(file_obj, label):
    if not file_obj:
        return file_obj
    if not 0 < file_obj.size <= 10 * 1024 * 1024:
        raise serializers.ValidationError(f"{label} must be nonempty and 10MB or less.")
    ext = os.path.splitext(file_obj.name)[1].lower()
    formats = {".jpg": ("JPEG", "image/jpeg"), ".jpeg": ("JPEG", "image/jpeg"),
               ".png": ("PNG", "image/png"), ".webp": ("WEBP", "image/webp"),
               ".pdf": ("PDF", "application/pdf")}
    if ext not in formats:
        raise serializers.ValidationError("Use a PDF, JPG, PNG or WEBP document.")
    expected, mime = formats[ext]
    if file_obj.content_type not in (mime, "application/octet-stream", "", None):
        raise serializers.ValidationError("The document type does not match its file extension.")
    try:
        content = file_obj.read()
        if expected == "PDF":
            if not content.startswith(b"%PDF-"):
                raise ValueError()
            reader = PdfReader(BytesIO(content), strict=True)
            if reader.is_encrypted or not 1 <= len(reader.pages) <= 10:
                raise ValueError()
            # Reject active content and embedded files; these IDs are for viewing only.
            root = reader.trailer["/Root"]
            if any(key in root for key in ("/OpenAction", "/AA", "/AcroForm")):
                raise ValueError()
            if root.get("/Names") and any(key in root["/Names"] for key in ("/JavaScript", "/EmbeddedFiles")):
                raise ValueError()
            for page in reader.pages:
                if page.get("/AA") or page.get("/Annots"):
                    raise ValueError()
                page.get_contents()
        else:
            with warnings.catch_warnings():
                warnings.simplefilter("error", Image.DecompressionBombWarning)
                with Image.open(BytesIO(content)) as image:
                    if image.format != expected or image.width * image.height > 20_000_000:
                        raise ValueError()
                    if getattr(image, "n_frames", 1) != 1:
                        raise ValueError()
                    image.verify()
    except Exception:
        # Never include parser errors, filenames or document content in responses/logs.
        raise serializers.ValidationError("Unreadable or unsupported document. Retake a clear, upright photo or use a nonencrypted PDF of up to 10 pages.") from None
    finally:
        file_obj.seek(0)
    return file_obj

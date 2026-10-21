"""Didit V3 hosted ID + selfie checks. No raw provider payload is persisted or logged."""
import hashlib
import hmac
import json
import logging
import re
import time
from datetime import timedelta
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, build_opener, HTTPRedirectHandler
from uuid import UUID

from django.conf import settings
from django.core import signing
from django.utils import timezone
from rest_framework.authentication import BaseAuthentication, get_authorization_header
from rest_framework.exceptions import AuthenticationFailed

from .models import IdentityVerificationAttempt as Attempt, User

logger = logging.getLogger(__name__)


class ProviderUnavailable(Exception):
    """Safe service boundary; deliberately excludes response bodies and credentials."""
    def __init__(self, message, code=None):
        super().__init__(message)
        self.code = code


def available():
    return bool(settings.IDENTITY_ENABLED and all((
        settings.DIDIT_API_KEY, settings.DIDIT_WORKFLOW_ID, settings.DIDIT_WEBHOOK_SECRET, settings.DIDIT_APPLICATION_ID,
        settings.IDENTITY_POLICY_VERSION, settings.IDENTITY_RETENTION_NOTICE,
        settings.IDENTITY_PRIVACY_CONTACT, settings.IDENTITY_RETENTION_DAYS > 0,
        settings.IDENTITY_PROVIDER_PRIVACY_CONFIRMED,
        settings.IDENTITY_ENVIRONMENT in ("sandbox", "live"),
    )))


def registration_token(user):
    return signing.dumps({"uid": user.pk, "password_hash": user.get_session_auth_hash()}, salt="registration-identity-v1")


class RegistrationIdentityAuthentication(BaseAuthentication):
    """A one-hour capability accepted ONLY by the identity endpoints, never portal APIs."""
    def authenticate(self, request):
        header = get_authorization_header(request).split()
        if not header or header[0].lower() != b"identity":
            return None
        try:
            if len(header) != 2:
                raise ValueError()
            data = signing.loads(header[1].decode(), salt="registration-identity-v1", max_age=3600)
            user = User.objects.select_related("role").get(pk=data["uid"], is_active=True, role__role_name="FARMER")
            if user.account_status not in (User.AccountStatus.PENDING, User.AccountStatus.SUBJECT_TO_REVISION):
                raise ValueError()
            if not hmac.compare_digest(data["password_hash"], user.get_session_auth_hash()):
                raise ValueError()
        except (signing.BadSignature, ValueError, KeyError, User.DoesNotExist):
            raise AuthenticationFailed("Registration session expired. Contact MAO for assistance; do not register again.") from None
        return user, None

    def authenticate_header(self, request):
        return "Identity"


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


def _provider_error_category(error):
    """Classify a provider error without logging its raw body or submitted values."""
    try:
        body = error.read(64 * 1024)
        data = json.loads(body) if body else {}
    except (OSError, ValueError, UnicodeDecodeError):
        data = {}

    if error.code in (401, 403):
        return "credentials_or_access_rejected"

    text = json.dumps(data, ensure_ascii=True).lower() if isinstance(data, (dict, list)) else ""
    if "workflow" in text and any(word in text for word in ("invalid", "not found", "inactive", "unpublished")):
        return "workflow_rejected"
    if any(word in text for word in ("credit", "quota", "balance")):
        return "account_limit_or_credits"
    if isinstance(data, list) and all(isinstance(item, dict) and "loc" in item and "type" in item for item in data):
        # FastAPI-style validation responses expose field paths and error types;
        # never log their input/context values or human-readable message.
        paths = []
        for item in data[:8]:
            location = item.get("loc", [])
            safe_path = ".".join(str(part) for part in location if re.fullmatch(r"[A-Za-z0-9_-]{1,40}", str(part)))
            error_type = str(item.get("type", ""))
            if safe_path and re.fullmatch(r"[A-Za-z0-9_.-]{1,64}", error_type):
                paths.append(f"{safe_path}:{error_type}")
        return "request_validation_failed" + ("[" + ",".join(paths) + "]" if paths else "")
    return "provider_rejected_request" if 400 <= error.code < 500 else "provider_server_error"


def provider_request(method, path, payload=None):
    # Host is fixed. No browser-supplied URL can receive the server credential.
    request = Request("https://verification.didit.me/v3/" + path,
                      data=json.dumps(payload).encode() if payload is not None else None,
                      headers={"x-api-key": settings.DIDIT_API_KEY, "Content-Type": "application/json", "Accept": "application/json"},
                      method=method)
    try:
        with build_opener(NoRedirect).open(request, timeout=12) as response:
            content = response.read(2 * 1024 * 1024 + 1)
            if len(content) > 2 * 1024 * 1024:
                raise ValueError()
            data = json.loads(content) if content else {}
            if not isinstance(data, dict):
                raise ValueError()
            return data
    except HTTPError as error:
        request_id = next((error.headers.get(name) for name in ("X-Request-ID", "Request-ID") if error.headers.get(name)), "")
        request_id = request_id if re.fullmatch(r"[A-Za-z0-9_.:-]{1,80}", request_id) else ""
        category = _provider_error_category(error)
        logger.warning("Didit request failed: status=%s category=%s request_id=%s",
                       error.code, category, request_id or "none")
        if category == "account_limit_or_credits":
            raise ProviderUnavailable(
                "Didit cannot start automated verification because the workflow or account has a billing/credit limit. You can continue by requesting MAO manual review.",
                code="DIDIT_BILLING_LIMIT",
            ) from None
        raise ProviderUnavailable("Verification service unavailable. Retry later or contact MAO for manual review.") from None
    except (URLError, TimeoutError, OSError, ValueError) as error:
        logger.warning("Didit request failed: category=%s", type(error).__name__)
        raise ProviderUnavailable("Verification service unavailable. Retry later or contact MAO for manual review.") from None


def safe_session_url(value):
    try:
        parsed = urlparse(value or "")
        valid = parsed.scheme == "https" and parsed.hostname == "verify.didit.me" and not parsed.username and not parsed.password and parsed.port in (None, 443)
    except (ValueError, TypeError):
        valid = False
    if not valid:
        raise ProviderUnavailable("The verification link is unavailable. Contact MAO for assistance.")
    return value


def registration_callback_url(origin=None):
    """Return only a configured public HTTPS callback; local origins omit it."""
    allowed_origins = getattr(settings, "CORS_ALLOWED_ORIGINS", [])
    candidate = origin if origin in allowed_origins else settings.FRONTEND_URL
    try:
        parsed = urlparse(candidate)
        if (parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password
                or parsed.port not in (None, 443) or parsed.path not in ("", "/")
                or parsed.query or parsed.fragment):
            return None
    except (TypeError, ValueError):
        return None
    return candidate.rstrip("/") + "/farmer-registration/identity"


def create_provider_session(attempt, callback_url=None):
    payload = {
        "workflow_id": attempt.workflow_id, "vendor_data": str(attempt.pk),
        "expected_details": {"first_name": attempt.user.first_name, "last_name": attempt.user.last_name},
    }
    # Didit needs no callback to create a session. In local development, omit
    # localhost callbacks; the farmer can return with the browser Back button.
    if callback_url:
        payload["callback"] = callback_url
    data = provider_request("POST", "session/", payload)
    try:
        session_id = UUID(data["session_id"])
        if data.get("vendor_data") != str(attempt.pk) or data.get("workflow_id") != attempt.workflow_id:
            raise ValueError()
        url = safe_session_url(data["url"])
    except (KeyError, ValueError, TypeError):
        raise ProviderUnavailable("The verification session could not be started. Contact MAO for assistance.") from None
    attempt.provider_session_id = session_id
    attempt.state = Attempt.State.IN_PROGRESS
    attempt.save()
    return url


def check_category(rows):
    if not isinstance(rows, list) or not rows:
        return "NOT_COMPLETED"
    statuses = [str(row.get("status") or "").upper().replace(" ", "_") for row in rows if isinstance(row, dict)]
    if len(statuses) != len(rows):
        return "INCONCLUSIVE"
    if all(status == "APPROVED" for status in statuses):
        return "PASSED"
    if any(status == "DECLINED" for status in statuses):
        return "CONCERN"
    return "INCONCLUSIVE"


def apply_decision(attempt, data):
    if (str(data.get("session_id")) != str(attempt.provider_session_id)
            or data.get("vendor_data") != str(attempt.pk)
            or data.get("workflow_id") != attempt.workflow_id):
        raise ProviderUnavailable("Verification reference mismatch. Human assistance is required.")
    attempt.document_result = check_category(data.get("id_verifications"))
    attempt.face_result = check_category(data.get("face_matches"))
    attempt.liveness_result = check_category(data.get("liveness_checks"))
    liveness_rows = data.get("liveness_checks")
    if isinstance(liveness_rows, list) and any(not isinstance(row, dict) or row.get("method") != "PASSIVE" for row in liveness_rows):
        attempt.liveness_result = "INCONCLUSIVE"
    status = str(data.get("status", "")).upper().replace(" ", "_")
    if status in ("NOT_STARTED", "IN_PROGRESS"):
        attempt.state = Attempt.State.IN_PROGRESS
    elif status in ("EXPIRED", "ABANDONED", "RESUBMITTED", "KYC_EXPIRED"):
        attempt.state = Attempt.State.RETRY_REQUIRED
    else:
        # A missing feature NEVER counts as passed. Sandbox never confirms real checks.
        all_passed = all(value == "PASSED" for value in (attempt.document_result, attempt.face_result, attempt.liveness_result))
        attempt.state = Attempt.State.COMPLETED if status == "APPROVED" and all_passed and attempt.environment == "live" else Attempt.State.REVIEW_REQUIRED
    attempt.save()


def refresh_attempt(attempt):
    data = provider_request("GET", f"session/{attempt.provider_session_id}/decision/")
    apply_decision(attempt, data)
    return data


def valid_webhook(raw, headers):
    """Didit's documented V2 canonical HMAC plus bound dispatch timestamp."""
    try:
        data = json.loads(raw)
        timestamp = int(headers.get("X-Timestamp", ""))
        if not isinstance(data, dict) or abs(time.time() - timestamp) > 300 or data.get("timestamp") != timestamp:
            return None

        def shorten_floats(value):
            if isinstance(value, dict):
                return {key: shorten_floats(item) for key, item in value.items()}
            if isinstance(value, list):
                return [shorten_floats(item) for item in value]
            return int(value) if isinstance(value, float) and value.is_integer() else value

        canonical = json.dumps(shorten_floats(data), sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False)
        signature = hmac.new(settings.DIDIT_WEBHOOK_SECRET.encode(), canonical.encode(), hashlib.sha256).hexdigest()
        if not settings.DIDIT_WEBHOOK_SECRET or not hmac.compare_digest(signature, headers.get("X-Signature-V2", "")):
            return None
        UUID(data["event_id"])
        UUID(data["session_id"])
        return data
    except (ValueError, TypeError, KeyError, UnicodeDecodeError):
        return None


def can_read_evidence(reviewer, user):
    role = getattr(getattr(reviewer, "role", None), "role_name", "")
    if not reviewer.is_active:
        return False
    if reviewer.pk == user.pk:
        return True
    if reviewer.account_status != User.AccountStatus.APPROVED:
        return False
    if role in ("MAO", "ADMIN"):
        return True
    if role not in ("SIBAT", "CBAT") or not hasattr(user, "farmer_profile"):
        return False
    return reviewer.access_scope == "ALL_BARANGAYS" or bool(
        reviewer.assigned_barangay_id and reviewer.assigned_barangay_id == user.farmer_profile.barangay_id
    )


def evidence(attempt):
    return {
        "id": str(attempt.pk), "state": attempt.state, "provider": "Didit",
        "environment": attempt.environment, "document_result": attempt.document_result,
        "document_capture": "LOCAL_UPLOAD" if attempt.document_id else "DIDIT_HOSTED",
        "face_result": attempt.face_result, "liveness_result": attempt.liveness_result,
        "provider_reference": str(attempt.provider_session_id) if attempt.provider_session_id else None,
        "created_at": attempt.created_at, "updated_at": attempt.updated_at,
        "consent_at": attempt.consent_at, "policy_version": attempt.policy_version,
        "manual_review_at": attempt.manual_review_at,
        "manual_review_reason": attempt.manual_review_reason,
        "assessment_current": bool(attempt.manual_review_at and attempt.manual_result_signature == evidence_fingerprint(attempt)),
        "events": [{"state": event.state, "created_at": event.created_at, "actor_id": event.actor_id, "remarks": event.remarks} for event in attempt.events.all()],
    }


def provider_review_data(attempt):
    """Return minimal, short-lived Didit review evidence without persisting it."""
    if not attempt.provider_session_id or attempt.provider_deleted_at:
        return {"images": [], "name_comparison": None}

    data = provider_request("GET", f"session/{attempt.provider_session_id}/decision/")
    if (str(data.get("session_id")) != str(attempt.provider_session_id)
            or data.get("vendor_data") != str(attempt.pk)
            or data.get("workflow_id") != attempt.workflow_id):
        raise ProviderUnavailable("Didit evidence does not match this registration.")

    id_rows = data.get("id_verifications")
    face_rows = data.get("face_matches")
    liveness_rows = data.get("liveness_checks")
    id_row = next((row for row in id_rows if isinstance(row, dict)), {}) if isinstance(id_rows, list) else {}
    face_row = next((row for row in face_rows if isinstance(row, dict)), {}) if isinstance(face_rows, list) else {}
    liveness_row = next((row for row in liveness_rows if isinstance(row, dict)), {}) if isinstance(liveness_rows, list) else {}

    def media_url(value):
        if not isinstance(value, str):
            return None
        try:
            parsed = urlparse(value)
            if (parsed.scheme == "https" and parsed.hostname and not parsed.username and not parsed.password
                    and parsed.port in (None, 443)):
                return value
        except ValueError:
            pass
        return None

    images = []
    for label, value in (
        ("ID front", id_row.get("front_image") or id_row.get("full_front_image")),
        ("ID back", id_row.get("back_image") or id_row.get("full_back_image")),
        ("Selfie", face_row.get("target_image") or liveness_row.get("reference_image")),
    ):
        url = media_url(value)
        if url:
            images.append({"label": label, "url": url})

    provided_name = " ".join(part for part in (attempt.user.first_name, attempt.user.last_name) if part).strip()
    extracted_name = str(id_row.get("full_name") or " ".join(
        part for part in (id_row.get("first_name"), id_row.get("last_name")) if isinstance(part, str)
    )).strip()
    warnings = id_row.get("warnings") if isinstance(id_row.get("warnings"), list) else []
    name_warning = next((
        warning for warning in warnings
        if isinstance(warning, dict)
        and "NAME_MISMATCH" in str(warning.get("risk", "")).upper()
        and warning.get("short_description")
    ), None)
    score = id_row.get("name_match_score_expected_details")
    match_type = None
    additional_data = name_warning.get("additional_data") if isinstance(name_warning, dict) else None
    if isinstance(additional_data, dict):
        if not isinstance(score, (int, float)) or isinstance(score, bool):
            score = next((additional_data.get(key) for key in ("match_score", "name_match_score", "score")
                          if isinstance(additional_data.get(key), (int, float))
                          and not isinstance(additional_data.get(key), bool)), None)
        raw_match_type = additional_data.get("match_type")
        if isinstance(raw_match_type, str) and len(raw_match_type) <= 40:
            match_type = raw_match_type
    if not isinstance(score, (int, float)) or isinstance(score, bool):
        score = None

    return {
        "images": images,
        "name_comparison": {
            "provided_name": provided_name or None,
            "extracted_name": extracted_name or None,
            "name_match_score": score,
            "match_type": match_type,
            "provider_warning": name_warning.get("short_description") if isinstance(name_warning, dict) else None,
        } if provided_name or extracted_name or name_warning else None,
    }


def evidence_fingerprint(attempt):
    return "|".join((attempt.state, attempt.document_result, attempt.face_result, attempt.liveness_result))

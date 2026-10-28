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
    def __init__(self, message="Verification service unavailable. Retry later or contact MAO for manual review.", code=None):
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


def _has_duplicate_warning(rows):
    if not isinstance(rows, list):
        return False
    for row in rows:
        if not isinstance(row, dict):
            continue
        warnings = row.get("warnings")
        if not isinstance(warnings, list):
            continue
        for warning in warnings:
            if isinstance(warning, dict) and "DUPLICATE" in str(warning.get("risk", "")).upper():
                return True
    return False


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
    duplicate_flagged = any(
        _has_duplicate_warning(data.get(key))
        for key in ("id_verifications", "face_matches", "liveness_checks")
    )
    status = str(data.get("status", "")).upper().replace(" ", "_")
    if status in ("NOT_STARTED", "IN_PROGRESS"):
        attempt.state = Attempt.State.IN_PROGRESS
    elif status in ("EXPIRED", "ABANDONED", "RESUBMITTED", "KYC_EXPIRED"):
        attempt.state = Attempt.State.RETRY_REQUIRED
    else:
        # A missing feature NEVER counts as passed. Sandbox never confirms real checks.
        all_passed = all(value == "PASSED" for value in (attempt.document_result, attempt.face_result, attempt.liveness_result))
        attempt.state = (
            Attempt.State.COMPLETED
            if status == "APPROVED" and all_passed and not duplicate_flagged and attempt.environment == "live"
            else Attempt.State.REVIEW_REQUIRED
        )
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


def _safe_media_url(value):
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


def _name_tokens(value):
    if not isinstance(value, str):
        return set()
    return {token for token in re.findall(r"[a-z]{2,}", value.lower())}


def _names_overlap(first, second):
    t1 = _name_tokens(first)
    t2 = _name_tokens(second)
    if not t1 or not t2:
        return False
    if t1 == t2:
        return True
    shorter, longer = (t1, t2) if len(t1) <= len(t2) else (t2, t1)
    return len(shorter) >= 2 and shorter.issubset(longer)


def _format_session_status(raw_status):
    cleaned = str(raw_status or "").upper().replace("_", " ").strip()
    if cleaned in ("REVIEW REQUIRED", "IN REVIEW", "PENDING"):
        return "IN REVIEW"
    if cleaned in ("COMPLETED", "APPROVED"):
        return "APPROVED"
    if cleaned in ("IN PROGRESS", "NOT STARTED"):
        return "IN PROGRESS"
    return cleaned or "IN REVIEW"


def _local_duplicate_sessions(attempt, extracted_name=None):
    """Find related or duplicate verification sessions in SmartLivestock."""
    all_attempts = list(Attempt.objects.select_related("user").order_by("created_at"))
    session_numbers = {item.pk: idx for idx, item in enumerate(all_attempts, start=1)}

    applicant_name = " ".join(part for part in (attempt.user.first_name, attempt.user.last_name) if part).strip()
    applicant_phone = str(attempt.user.phone_number or "").strip()

    matched = []
    seen_keys = set()

    for other in all_attempts:
        if other.pk == attempt.pk:
            continue
        other_name = " ".join(part for part in (other.user.first_name, other.user.last_name) if part).strip() or other.user.username
        other_phone = str(other.user.phone_number or "").strip()

        same_user_other_session = other.user_id == attempt.user_id and bool(other.provider_session_id)
        name_match = (
            _names_overlap(applicant_name, other_name)
            or (extracted_name and _names_overlap(extracted_name, other_name))
        )
        phone_match = bool(applicant_phone and other_phone and applicant_phone == other_phone and other.user_id != attempt.user_id)
        shared_workflow_anomaly = bool(
            other.user_id != attempt.user_id
            and other.workflow_id == attempt.workflow_id
            and other.provider_session_id
            and attempt.provider_session_id
            and other.face_result == "PASSED"
            and attempt.face_result == "PASSED"
            and ("REVIEW_REQUIRED" in (other.state, attempt.state) or "INCONCLUSIVE" in (other.document_result, attempt.document_result))
        )

        if same_user_other_session or name_match or phone_match or shared_workflow_anomaly:
            key = str(other.provider_session_id or other.pk)
            if key in seen_keys:
                continue
            seen_keys.add(key)
            display_name = extracted_name if (shared_workflow_anomaly and extracted_name) else other_name
            matched.append({
                "session_number": session_numbers.get(other.pk),
                "session_id": str(other.provider_session_id) if other.provider_session_id else str(other.pk),
                "user_id": other.user_id,
                "full_name": display_name,
                "status": _format_session_status(other.state),
                "portrait_url": None,
            })

    return matched


def _extract_provider_warnings(attempt, data, id_row, face_row, liveness_row, extracted_name):
    all_attempts = list(Attempt.objects.select_related("user").order_by("created_at"))
    session_numbers = {item.pk: idx for idx, item in enumerate(all_attempts, start=1)}
    by_session_id = {str(item.provider_session_id): item for item in all_attempts if item.provider_session_id}
    by_vendor = {str(item.pk): item for item in all_attempts}

    raw_groups = (
        ("ID VERIFICATION", id_row.get("warnings") if isinstance(id_row, dict) else None),
        ("FACE MATCH", face_row.get("warnings") if isinstance(face_row, dict) else None),
        ("LIVENESS", liveness_row.get("warnings") if isinstance(liveness_row, dict) else None),
    )

    warnings_out = []
    has_dup_warning = False

    for default_feature, group in raw_groups:
        if not isinstance(group, list):
            continue
        for item in group:
            if not isinstance(item, dict):
                continue
            risk = str(item.get("risk") or "WARNING").upper()
            short_desc = str(item.get("short_description") or risk.replace("_", " ").capitalize()).strip()
            long_desc = str(item.get("long_description") or "").strip()
            feature_raw = str(item.get("feature") or default_feature).upper().replace("_", " ").strip()
            feature = "ID VERIFICATION" if "ID" in feature_raw or "DOCUMENT" in feature_raw else feature_raw
            log_type = str(item.get("log_type") or "warning").lower()

            is_dup = "DUPLICATE" in risk or "DUPLICATE" in short_desc.upper()
            if is_dup:
                has_dup_warning = True
                if not long_desc:
                    long_desc = (
                        "The system identified a potential duplicate user with documents "
                        "from another session, requiring further investigation."
                    )

            tag_label = (
                "POSSIBLE DUPLICATED USER FROM OTHER SESSION"
                if risk == "POSSIBLE_DUPLICATED_USER"
                else short_desc.upper()
            )

            dup_sessions = []
            seen_sids = set()
            additional = item.get("additional_data")
            candidates = []
            if isinstance(additional, dict):
                for list_key in ("duplicated_sessions", "sessions", "matches", "duplicates"):
                    if isinstance(additional.get(list_key), list):
                        candidates.extend(additional[list_key])
                single_sid = (
                    additional.get("session_id")
                    or additional.get("session_ref")
                    or additional.get("duplicated_session_id")
                )
                if single_sid or additional.get("vendor_data") or additional.get("session_number"):
                    candidates.append(additional)
            elif isinstance(additional, list):
                candidates.extend(additional)

            for cand in candidates:
                if isinstance(cand, str):
                    cand = {"session_id": cand}
                if not isinstance(cand, dict):
                    continue
                sid = str(cand.get("session_id") or cand.get("session_ref") or cand.get("id") or "").strip()
                vdata = str(cand.get("vendor_data") or "").strip()
                matched_attempt = by_session_id.get(sid) or by_vendor.get(vdata)

                s_num = cand.get("session_number") if isinstance(cand.get("session_number"), int) else (
                    session_numbers.get(matched_attempt.pk) if matched_attempt else None
                )
                s_name = str(
                    cand.get("full_name")
                    or cand.get("name")
                    or (matched_attempt.user.get_full_name() if matched_attempt else "")
                    or extracted_name
                    or ""
                ).strip()
                s_status = _format_session_status(
                    cand.get("status") or (matched_attempt.state if matched_attempt else "IN_REVIEW")
                )
                s_portrait = _safe_media_url(
                    cand.get("portrait_image")
                    or cand.get("target_image")
                    or cand.get("front_image")
                    or cand.get("image_url")
                )

                if sid and (not s_name or not s_portrait or s_num is None):
                    try:
                        UUID(sid)
                        dup_decision = provider_request("GET", f"session/{sid}/decision/")
                        if isinstance(dup_decision, dict):
                            if s_num is None and isinstance(dup_decision.get("session_number"), int):
                                s_num = dup_decision["session_number"]
                            if dup_decision.get("status"):
                                s_status = _format_session_status(dup_decision.get("status"))
                            dup_id_rows = dup_decision.get("id_verifications")
                            dup_face_rows = dup_decision.get("face_matches")
                            dup_id = next((r for r in dup_id_rows if isinstance(r, dict)), {}) if isinstance(dup_id_rows, list) else {}
                            dup_face = next((r for r in dup_face_rows if isinstance(r, dict)), {}) if isinstance(dup_face_rows, list) else {}
                            if not s_name:
                                s_name = str(dup_id.get("full_name") or " ".join(
                                    p for p in (dup_id.get("first_name"), dup_id.get("last_name")) if isinstance(p, str)
                                )).strip()
                            if not s_portrait:
                                s_portrait = _safe_media_url(
                                    dup_id.get("portrait_image")
                                    or dup_face.get("target_image")
                                    or dup_id.get("front_image")
                                )
                    except Exception:
                        pass

                dedup_key = sid or (str(matched_attempt.pk) if matched_attempt else s_name)
                if dedup_key and dedup_key not in seen_sids:
                    seen_sids.add(dedup_key)
                    dup_sessions.append({
                        "session_number": s_num,
                        "session_id": sid or (str(matched_attempt.provider_session_id) if matched_attempt and matched_attempt.provider_session_id else None),
                        "user_id": matched_attempt.user_id if matched_attempt else None,
                        "full_name": s_name or "Applicant in other session",
                        "status": s_status,
                        "portrait_url": s_portrait,
                    })

            if is_dup:
                for local_dup in _local_duplicate_sessions(attempt, extracted_name=extracted_name):
                    dedup_key = local_dup["session_id"] or str(local_dup["user_id"])
                    if dedup_key not in seen_sids:
                        seen_sids.add(dedup_key)
                        dup_sessions.append(local_dup)

            warnings_out.append({
                "feature": feature,
                "risk": risk,
                "tag_label": tag_label,
                "short_description": short_desc,
                "long_description": long_desc,
                "log_type": log_type,
                "duplicated_sessions": dup_sessions,
            })

    if not has_dup_warning:
        local_dups = _local_duplicate_sessions(attempt, extracted_name=extracted_name)
        if local_dups:
            warnings_out.insert(0, {
                "feature": "ID VERIFICATION",
                "risk": "POSSIBLE_DUPLICATED_USER",
                "tag_label": "POSSIBLE DUPLICATED USER FROM OTHER SESSION",
                "short_description": "Possible duplicated user from other session",
                "long_description": (
                    "The system identified a potential duplicate user with documents "
                    "from another session, requiring further investigation."
                ),
                "log_type": "warning",
                "duplicated_sessions": local_dups,
            })

    return warnings_out


def local_duplicate_review_data(attempt):
    """Fallback review data with SmartLivestock cross-session duplicate warnings when live Didit media is unavailable."""
    local_dups = _local_duplicate_sessions(attempt)
    warnings = []
    if local_dups:
        warnings.append({
            "feature": "ID VERIFICATION",
            "risk": "POSSIBLE_DUPLICATED_USER",
            "tag_label": "POSSIBLE DUPLICATED USER FROM OTHER SESSION",
            "short_description": "Possible duplicated user from other session",
            "long_description": (
                "The system identified a potential duplicate user with documents "
                "from another session, requiring further investigation."
            ),
            "log_type": "warning",
            "duplicated_sessions": local_dups,
        })
    return {
        "images": [],
        "name_comparison": None,
        "warnings": warnings,
    }


def provider_review_data(attempt):
    """Return minimal, short-lived Didit review evidence without persisting it."""
    if not attempt.provider_session_id or attempt.provider_deleted_at:
        return local_duplicate_review_data(attempt)

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

    images = []
    for label, value in (
        ("ID front", id_row.get("front_image") or id_row.get("full_front_image")),
        ("ID back", id_row.get("back_image") or id_row.get("full_back_image")),
        ("Selfie", face_row.get("target_image") or liveness_row.get("reference_image")),
    ):
        url = _safe_media_url(value)
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

    structured_warnings = _extract_provider_warnings(
        attempt, data, id_row, face_row, liveness_row, extracted_name
    )

    return {
        "images": images,
        "name_comparison": {
            "provided_name": provided_name or None,
            "extracted_name": extracted_name or None,
            "name_match_score": score,
            "match_type": match_type,
            "provider_warning": name_warning.get("short_description") if isinstance(name_warning, dict) else None,
        } if provided_name or extracted_name or name_warning else None,
        "warnings": structured_warnings,
    }


def evidence_fingerprint(attempt):
    return "|".join((attempt.state, attempt.document_result, attempt.face_result, attempt.liveness_result))

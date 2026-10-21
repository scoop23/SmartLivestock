"""Registration-only capability, scoped evidence, and signed provider callback APIs."""
from datetime import timedelta
from uuid import UUID

from django.conf import settings
from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers
from rest_framework.decorators import api_view, authentication_classes, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.throttling import SimpleRateThrottle

from .authentication import ApprovedJWTAuthentication
from .models import IdentityVerificationAttempt as Attempt, IdentityVerificationEvent as Event, User, UserDocument
from . import identity_service as service
from .serializer import UserDocumentSerializer
from .notification_views import notify_role


class IdentityThrottle(SimpleRateThrottle):
    scope = "registration_identity"
    rate = "30/minute"

    def get_cache_key(self, request, view):
        return self.cache_format % {"scope": self.scope, "ident": request.user.pk if request.user.is_authenticated else self.get_ident(request)}


class StartThrottle(IdentityThrottle):
    scope = "registration_identity_start"
    rate = "6/hour"


class StartSerializer(serializers.Serializer):
    consent = serializers.BooleanField(required=True)
    policy_version = serializers.CharField(max_length=64)
    retry = serializers.BooleanField(default=False)

    def validate(self, attrs):
        if set(self.initial_data) - {"consent", "policy_version", "retry"}:
            raise serializers.ValidationError("Only consent, policy_version and retry are accepted.")
        if not attrs["consent"] or attrs["policy_version"] != settings.IDENTITY_POLICY_VERSION:
            raise serializers.ValidationError("Read and accept the current biometric privacy notice before continuing.")
        return attrs


def enroll(user):
    document = user.documents.exclude(document_type__in=["RSBSA", "BARANGAY_CERTIFICATE", "OTHER"]).first()
    return Attempt.objects.create(user=user, document=document, environment=settings.IDENTITY_ENVIRONMENT,
                                  workflow_id=settings.DIDIT_WORKFLOW_ID)


def notify_evidence(attempt):
    notify_role("MAO", title="Registration identity evidence updated",
                message="Identity checks need human assessment. Automated results do not approve or reject accounts.",
                link="/user-management", related_entity_type="identity_verification", related_entity_id=attempt.user_id)
    farmer = getattr(attempt.user, "farmer_profile", None)
    if farmer:
        notify_role("SIBAT", title="Registration identity evidence available",
                    message="Review supporting identity evidence within your assigned barangay scope.",
                    link="/sibat?identityReview=1", barangay_id=farmer.barangay_id, include_cbat=True)


def no_store(response):
    response["Cache-Control"] = "no-store, private"
    response["Referrer-Policy"] = "no-referrer"
    return response


@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
@throttle_classes([IdentityThrottle])
def configuration(request):
    return no_store(Response({
        "enabled": settings.IDENTITY_ENABLED, "available": service.available(), "provider": "Didit",
        "policy_version": settings.IDENTITY_POLICY_VERSION,
        "retention_notice": settings.IDENTITY_RETENTION_NOTICE,
        "privacy_contact": settings.IDENTITY_PRIVACY_CONTACT or "Visit the Municipal Agriculture Office for assistance.",
        "environment": settings.IDENTITY_ENVIRONMENT,
    }))


@api_view(["GET"])
@authentication_classes([service.RegistrationIdentityAuthentication, ApprovedJWTAuthentication])
@permission_classes([IsAuthenticated])
@throttle_classes([IdentityThrottle])
def own_status(request):
    attempt = request.user.identity_attempts.first()
    return no_store(Response({"attempt": service.evidence(attempt) if attempt else None,
                             "government_id_uploaded": request.user.documents.exclude(document_type="RSBSA").exists()}))


@api_view(["POST"])
@authentication_classes([service.RegistrationIdentityAuthentication, ApprovedJWTAuthentication])
@permission_classes([IsAuthenticated])
@throttle_classes([StartThrottle])
@transaction.atomic
def start(request):
    user = User.objects.select_for_update().get(pk=request.user.pk)
    if user.role.role_name != "FARMER" or user.account_status not in ("PENDING", "SUBJECT_TO_REVISION"):
        return no_store(Response({"detail": "Verification sessions are for pending farmer registrations."}, status=403))
    if not service.available():
        return no_store(Response({"detail": "Automated verification is unavailable. Your registration still requires MAO review; contact MAO for assistance."}, status=503))
    serializer = StartSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    attempt = user.identity_attempts.select_for_update().first()
    if attempt and attempt.state == Attempt.State.COMPLETED:
        return no_store(Response({"attempt": service.evidence(attempt)}))
    if attempt and attempt.provider_session_id and attempt.policy_version != settings.IDENTITY_POLICY_VERSION:
        return no_store(Response({"detail": "The privacy notice changed. Contact MAO before resuming this capture session."}, status=409))
    if attempt and attempt.provider_session_id and not serializer.validated_data["retry"]:
        try:
            data = service.refresh_attempt(attempt)
        except service.ProviderUnavailable as error:
            return no_store(Response({"detail": str(error)}, status=503))
        if attempt.state == Attempt.State.IN_PROGRESS:
            return no_store(Response({"attempt": service.evidence(attempt), "url": service.safe_session_url(data.get("session_url"))}))
        if attempt.state in (Attempt.State.COMPLETED, Attempt.State.REVIEW_REQUIRED):
            return no_store(Response({"attempt": service.evidence(attempt)}))
        # Didit may report EXPIRED or ABANDONED only when the farmer tries to
        # resume. In that case RETRY_REQUIRED is authoritative: fall through
        # and create a fresh attempt instead of returning the dead session URL.
    if attempt and attempt.provider_session_id and attempt.state == Attempt.State.IN_PROGRESS:
        if not attempt.expires_at or attempt.expires_at > timezone.now():
            return no_store(Response({"detail": "Resume the existing session before requesting another attempt."}, status=409))
    if user.identity_attempts.filter(consent_at__gte=timezone.now() - timedelta(days=1)).count() >= 3:
        return no_store(Response({"detail": "Daily verification attempt limit reached. Contact MAO for assistance."}, status=429))
    if not attempt or attempt.consent_at:
        attempt = enroll(user)
    attempt.consent_at = timezone.now()
    attempt.policy_version = settings.IDENTITY_POLICY_VERSION
    attempt.retention_notice = settings.IDENTITY_RETENTION_NOTICE
    attempt.expires_at = timezone.now() + timedelta(hours=1)
    attempt.retention_due_at = timezone.now() + timedelta(days=settings.IDENTITY_RETENTION_DAYS)
    attempt.save()
    try:
        callback_url = service.registration_callback_url(request.headers.get("Origin"))
        url = service.create_provider_session(attempt, callback_url=callback_url)
    except service.ProviderUnavailable as error:
        attempt.state = Attempt.State.FAILED_TECHNICAL
        attempt.save()
        Event.objects.create(attempt=attempt, state=attempt.state)
        notify_evidence(attempt)
        response_data = {"detail": str(error), "attempt": service.evidence(attempt)}
        if error.code == "DIDIT_BILLING_LIMIT":
            response_data.update({"code": error.code, "manual_review_available": True})
        return no_store(Response(response_data, status=503))
    Event.objects.create(attempt=attempt, state=attempt.state)
    return no_store(Response({"attempt": service.evidence(attempt), "url": url}, status=201))


@api_view(["POST"])
@authentication_classes([service.RegistrationIdentityAuthentication, ApprovedJWTAuthentication])
@permission_classes([IsAuthenticated])
@throttle_classes([IdentityThrottle])
@transaction.atomic
def refresh(request):
    attempt = request.user.identity_attempts.select_for_update().first()
    if not attempt or not attempt.provider_session_id or attempt.provider_deleted_at:
        return no_store(Response({"detail": "No active provider session. Start verification or contact MAO."}, status=409))
    if request.data:
        return no_store(Response({"detail": "Verification results cannot be supplied by the browser."}, status=400))
    if not service.available():
        return no_store(Response({"detail": "Verification service is unavailable. Contact MAO."}, status=503))
    previous = (attempt.state, attempt.document_result, attempt.face_result, attempt.liveness_result)
    try:
        service.refresh_attempt(attempt)
    except service.ProviderUnavailable as error:
        # Preserve the last known result: timeout is not a failed match.
        return no_store(Response({"detail": str(error)}, status=503))
    current = (attempt.state, attempt.document_result, attempt.face_result, attempt.liveness_result)
    if current != previous:
        Event.objects.create(attempt=attempt, state=attempt.state)
        notify_evidence(attempt)
    return no_store(Response({"attempt": service.evidence(attempt)}))


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
@transaction.atomic
def webhook(request):
    if len(request.body) > 2 * 1024 * 1024:
        return Response(status=413)
    data = service.valid_webhook(request.body, request.headers)
    if not data:
        return Response({"detail": "Invalid callback authentication."}, status=401)
    if request.headers.get("X-Didit-Test-Webhook", "").lower() == "true":
        return Response(status=204)
    if data.get("webhook_type") not in ("status.updated", "data.updated"):
        return Response(status=204)
    attempt = Attempt.objects.select_for_update().filter(provider_session_id=data["session_id"]).first()
    if attempt is None:
        # A create request can time out after the provider has created a session.
        # Recover only after authenticating the callback and re-fetching its decision.
        try:
            reference = UUID(str(data.get("vendor_data")))
        except ValueError:
            return Response(status=400)
        attempt = get_object_or_404(Attempt.objects.select_for_update(), pk=reference,
                                   provider_session_id__isnull=True, state=Attempt.State.FAILED_TECHNICAL,
                                   consent_at__isnull=False)
        attempt.provider_session_id = UUID(data["session_id"])
    if (data.get("vendor_data") != str(attempt.pk) or data.get("workflow_id") != attempt.workflow_id
            or data.get("environment") != attempt.environment
            or data.get("application_id") != settings.DIDIT_APPLICATION_ID):
        return Response({"detail": "Callback does not match this registration."}, status=400)
    if Event.objects.filter(provider_event_id=data["event_id"]).exists():
        return Response(status=204)
    created_at = data.get("created_at")
    if not isinstance(created_at, int) or created_at < attempt.last_provider_timestamp or attempt.provider_deleted_at:
        return Response(status=204)
    # Re-fetch from the provider. A webhook body cannot supply verification evidence.
    try:
        service.refresh_attempt(attempt)
    except service.ProviderUnavailable:
        return Response({"detail": "Decision retrieval unavailable; retry delivery."}, status=503)
    attempt.last_provider_timestamp = created_at
    attempt.save(update_fields=["last_provider_timestamp"])
    Event.objects.create(attempt=attempt, provider_event_id=data["event_id"], state=attempt.state)
    notify_evidence(attempt)
    return Response(status=204)


@api_view(["POST"])
@authentication_classes([service.RegistrationIdentityAuthentication, ApprovedJWTAuthentication])
@permission_classes([IsAuthenticated])
@throttle_classes([IdentityThrottle])
@transaction.atomic
def request_assistance(request):
    # Only the authenticated registration owner can request help for their attempt.
    attempt = request.user.identity_attempts.select_for_update().first()
    if not attempt:
        return no_store(Response({"detail": "No registration verification attempt exists."}, status=409))
    if request.data:
        return no_store(Response({"detail": "Verification results cannot be supplied by the browser."}, status=400))
    if not attempt.events.filter(state="ASSISTANCE_REQUESTED").exists():
        Event.objects.create(attempt=attempt, state="ASSISTANCE_REQUESTED", actor=request.user,
                             remarks="Farmer requested MAO assistance completing automated capture.")
        notify_evidence(attempt)
    # Preserve actual provider results and state; requesting help does not pass checks.
    return no_store(Response({"attempt": service.evidence(attempt)}))


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def reviews(request, user_id=None):
    role = getattr(request.user.role, "role_name", "")
    if role not in ("MAO", "ADMIN", "SIBAT", "CBAT"):
        return no_store(Response({"detail": "Registration reviewer access required."}, status=403))
    users = User.objects.filter(role__role_name="FARMER").select_related("farmer_profile__barangay").prefetch_related("documents", "identity_attempts__events")
    if role in ("SIBAT", "CBAT") and request.user.access_scope != "ALL_BARANGAYS":
        users = users.filter(farmer_profile__barangay_id=request.user.assigned_barangay_id) if request.user.assigned_barangay_id else users.none()

    def row(user):
        attempts = list(user.identity_attempts.all()[:3])
        farmer = getattr(user, "farmer_profile", None)
        result = {"user_id": user.pk, "name": user.get_full_name() or user.username,
                  "barangay": farmer.barangay.barangay_name if farmer and farmer.barangay else "",
                  "attempts": [service.evidence(attempt) for attempt in attempts],
                  "documents": UserDocumentSerializer(user.documents.all(), many=True, context={"request": request}).data}
        # Raw ID/selfie media is available only to MAO/Admin on the single-user
        # review detail, never to barangay reviewer queues or list responses.
        if user_id and role in ("MAO", "ADMIN") and attempts:
            try:
                result["provider_review"] = service.provider_review_data(attempts[0])
            except service.ProviderUnavailable:
                result["provider_review_error"] = "Didit images or extracted name are unavailable. Refresh and try again."
        return result

    if user_id:
        return no_store(Response(row(get_object_or_404(users, pk=user_id))))
    users = users.filter(identity_attempts__isnull=False).distinct().order_by("-created_at")
    search = request.query_params.get("search", "")[:100]
    if search:
        users = users.filter(Q(first_name__icontains=search) | Q(last_name__icontains=search) | Q(username__icontains=search))
    paginator = PageNumberPagination()
    paginator.page_size = 10
    page = paginator.paginate_queryset(users, request)
    return no_store(paginator.get_paginated_response([row(user) for user in page]))


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def acknowledge(request, user_id):
    if request.user.role.role_name not in ("MAO", "ADMIN"):
        return no_store(Response({"detail": "Only MAO/Admin may record the municipal evidence assessment."}, status=403))
    user = get_object_or_404(User.objects.select_for_update(), pk=user_id, role__role_name="FARMER")
    attempt = user.identity_attempts.select_for_update().first()
    reason = request.data.get("reason")
    if not attempt or not isinstance(reason, str) or not 10 <= len(reason.strip()) <= 2000:
        return no_store(Response({"detail": "Provide an assessment of 10–2000 characters. Include manual checks for incomplete or inconclusive automated evidence."}, status=400))
    attempt.manual_review_by = request.user
    attempt.manual_review_at = timezone.now()
    attempt.manual_review_reason = reason.strip()
    attempt.manual_result_signature = service.evidence_fingerprint(attempt)
    attempt.save()
    Event.objects.create(attempt=attempt, state="MAO_ASSESSED", actor=request.user, remarks=reason.strip())
    return no_store(Response(service.evidence(attempt)))

import os
import json
import mimetypes
import urllib.request
from django.conf import settings
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.decorators import api_view, authentication_classes, permission_classes, parser_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.authentication import JWTAuthentication  # type: ignore
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError  # type: ignore
from django.http import HttpResponse, HttpResponseNotFound, FileResponse
from django.views import View
from django.db import transaction
from django.db.models import Q
from rest_framework_simplejwt.views import TokenObtainPairView  # type: ignore
from rest_framework.generics import CreateAPIView
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.throttling import AnonRateThrottle

from livestock.permission import IsMAO
from users.models import User, UserDocument, Notification
from .notification_views import create_notification
from .serializer import (
    CurrentUserSerializer,
    MyTokenSerializer,
    RegisterSerializer,
    UserDocumentSerializer,
    UserManagementSerializer,
    UserStatusUpdateSerializer,
    SibatAssignmentSerializer,
)


def block_public_registration_document_media(request, path):
    """Keep private registration files out of Django's DEBUG media server."""
    return HttpResponseNotFound()



# Simple health check views (can be removed later)
def hello(request):
    return HttpResponse("")


class HelloView(View):
    def get(self, request):
        return HttpResponse("Hello, World!")


# Custom JWT login view.
# Uses MyTokenSerializer which validates account_status=APPROVED before issuing tokens
# and includes user role + email in the JWT payload for frontend routing.
class MyTokenView(TokenObtainPairView):
    serializer_class = MyTokenSerializer


# Registration view for new farmers.
# POST with email, password, first_name, last_name, phone_number, barangay, farm_size, address.
# Atomically creates both a User (with status=PENDING) and a Farmer profile.
class RegistrationThrottle(AnonRateThrottle):
    rate = "10/hour"


class RegisterView(CreateAPIView):
    # Registration is public; the serializer always creates a pending FARMER account.
    permission_classes = [AllowAny]
    serializer_class = RegisterSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    throttle_classes = [RegistrationThrottle]

    def perform_create(self, serializer):
        self.registered_user = serializer.save()

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        response = super().create(request, *args, **kwargs)
        from django.conf import settings
        if settings.IDENTITY_ENABLED:
            from .identity_service import registration_token
            from .identity_views import enroll, no_store
            enroll(self.registered_user)
            response.data["identity_verification"] = {"required": True, "access_token": registration_token(self.registered_user)}
            return no_store(response)
        return response


# Get current logged-in user basic profile or update photo/profile details
@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def get_user_information(request):
    user = request.user
    if request.method == "PATCH":
        if "profile_image" in request.FILES:
            user.profile_image = request.FILES["profile_image"]
        elif "profile_image" in request.data and request.data["profile_image"] in ["", "null", None]:
            user.profile_image = None

        if "first_name" in request.data:
            user.first_name = request.data["first_name"]
        if "last_name" in request.data:
            user.last_name = request.data["last_name"]
        if "phone_number" in request.data:
            user.phone_number = request.data["phone_number"]

        user.save()
        serializer = CurrentUserSerializer(user, context={"request": request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    serializer = CurrentUserSerializer(user, context={"request": request})
    return Response(serializer.data)


# GET /api/users/pending/ -> List users with PENDING account status (MAO only)
@api_view(["GET"])
@permission_classes([IsAuthenticated, IsMAO])
def pending_users_list(request):
    users = (
        User.objects.filter(account_status=User.AccountStatus.PENDING)
        .select_related("role", "assigned_barangay", "farmer_profile__barangay")
        .prefetch_related("farmer_profile__inventories", "documents")
        .order_by("-created_at")
    )
    serializer = UserManagementSerializer(users, many=True, context={"request": request})
    return Response(serializer.data, status=status.HTTP_200_OK)


# GET /api/users/ -> List all users for user management directory (MAO only)
@api_view(["GET"])
@permission_classes([IsAuthenticated, IsMAO])
def all_users_list(request):
    users = (
        User.objects.all()
        .select_related("role", "assigned_barangay", "farmer_profile__barangay")
        .prefetch_related("farmer_profile__inventories", "documents")
        .order_by("-created_at")
    )

    role_filter = request.query_params.get("role")
    if role_filter and role_filter.upper() != "ALL":
        users = users.filter(role__role_name__iexact=role_filter)

    status_filter = request.query_params.get("account_status") or request.query_params.get("status")
    if status_filter and status_filter.upper() != "ALL":
        users = users.filter(account_status__iexact=status_filter)

    barangay_filter = request.query_params.get("barangay_id") or request.query_params.get("barangay")
    if barangay_filter and barangay_filter.upper() != "ALL":
        if barangay_filter == "unassigned":
            users = users.filter(
                Q(role__role_name__in=["SIBAT", "CBAT"], assigned_barangay__isnull=True)
                | Q(role__role_name="FARMER", farmer_profile__isnull=True)
            )
        else:
            try:
                barangay_id = int(barangay_filter)
            except ValueError:
                return Response({"barangay_id": ["Use a barangay ID or unassigned."]}, status=400)
            # A staff jurisdiction and a farmer's address are different relationships.
            users = users.filter(
                Q(role__role_name__in=["SIBAT", "CBAT"], assigned_barangay_id=barangay_id)
                | Q(role__role_name="FARMER", farmer_profile__barangay_id=barangay_id)
            )

    search = request.query_params.get("search")
    if search:
        users = users.filter(
            Q(first_name__icontains=search)
            | Q(last_name__icontains=search)
            | Q(email__icontains=search)
            | Q(username__icontains=search)
            | Q(farmer_profile__barangay__barangay_name__icontains=search)
            | Q(assigned_barangay__barangay_name__icontains=search)
        )

    serializer = UserManagementSerializer(users, many=True, context={"request": request})
    return Response(serializer.data, status=status.HTTP_200_OK)


# PATCH /api/users/<id>/status/ -> Update account status (MAO only)
@api_view(["PATCH"])
@permission_classes([IsAuthenticated, IsMAO])
@transaction.atomic
def update_user_status(request, pk):
    user = get_object_or_404(User.objects.select_for_update(), pk=pk)

    serializer = UserStatusUpdateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    new_status = serializer.validated_data["status"]
    previous_status = user.account_status

    # Administrative safeguard:
    # If approving an account with submitted documents, ensure documents are not pending or under revision
    if new_status == User.AccountStatus.APPROVED:
        from .identity_service import evidence_fingerprint
        attempt = user.identity_attempts.select_for_update().first()
        if attempt and (not attempt.manual_review_at or attempt.manual_result_signature != evidence_fingerprint(attempt)):
            return Response({"detail": "Record an MAO assessment of the current identity evidence before approving this account. Incomplete checks require documented manual assessment."}, status=400)
        if user.documents.filter(verification_status=UserDocument.VerificationStatus.SUBJECT_TO_REVISION).exists():
            return Response(
                {"detail": "Cannot approve account while submitted documents are marked Subject to Revision. Please resolve or request updated documents first."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if user.documents.filter(verification_status=UserDocument.VerificationStatus.PENDING).exists():
            return Response(
                {"detail": "All submitted registration documents must be manually reviewed and approved by MAO before approving this account."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user.approved_at = timezone.now()

    user.account_status = new_status
    user.save()

    if previous_status != new_status:
        create_notification(
            user=user,
            title="Account status updated",
            message=f"Your account status is now {user.get_account_status_display()}.",
            link="/profile",
        )

    response_serializer = UserManagementSerializer(user, context={"request": request})

    return Response(response_serializer.data, status=status.HTTP_200_OK)


# PATCH /api/users/documents/<int:pk>/verification/ -> Review registration document (MAO only)
@api_view(["PATCH"])
@permission_classes([IsAuthenticated, IsMAO])
def verify_user_document(request, pk):
    doc = get_object_or_404(UserDocument, pk=pk)
    new_status = request.data.get("status")
    reason = str(request.data.get("reason") or "").strip()

    valid_statuses = [
        UserDocument.VerificationStatus.APPROVED,
        UserDocument.VerificationStatus.SUBJECT_TO_REVISION,
        UserDocument.VerificationStatus.PENDING,
    ]
    if new_status not in valid_statuses:
        return Response(
            {"status": [f"Invalid status. Must be one of: {', '.join(valid_statuses)}"]},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if new_status == UserDocument.VerificationStatus.SUBJECT_TO_REVISION and not reason:
        return Response(
            {"reason": ["A reason must be provided when returning a document for revision."]},
            status=status.HTTP_400_BAD_REQUEST,
        )

    doc.verification_status = new_status
    doc.approved_by = request.user
    doc.reviewed_at = timezone.now()
    doc.review_remarks = reason if new_status == UserDocument.VerificationStatus.SUBJECT_TO_REVISION else (reason or "")
    doc.save()

    if (
        new_status == UserDocument.VerificationStatus.SUBJECT_TO_REVISION
        and doc.user.account_status == User.AccountStatus.PENDING
    ):
        doc.user.account_status = User.AccountStatus.SUBJECT_TO_REVISION
        doc.user.save(update_fields=["account_status"])
    elif (
        new_status == UserDocument.VerificationStatus.APPROVED
        and doc.user.account_status == User.AccountStatus.SUBJECT_TO_REVISION
        and not doc.user.documents.filter(
            verification_status=UserDocument.VerificationStatus.SUBJECT_TO_REVISION
        ).exists()
    ):
        doc.user.account_status = User.AccountStatus.PENDING
        doc.user.save(update_fields=["account_status"])

    doc_type_label = doc.get_document_type_display()
    if new_status == UserDocument.VerificationStatus.SUBJECT_TO_REVISION:
        create_notification(
            user=doc.user,
            title="Document Requires Revision",
            message=f"Your submitted {doc_type_label} was returned for revision. Reason: {reason}",
            priority=Notification.Priority.HIGH,
            link="/profile",
        )
    elif new_status == UserDocument.VerificationStatus.APPROVED:
        create_notification(
            user=doc.user,
            title="Document Verified",
            message=f"Your submitted {doc_type_label} has been manually reviewed and verified by MAO.",
            priority=Notification.Priority.MEDIUM,
            link="/profile",
        )

    serializer = UserDocumentSerializer(doc, context={"request": request})
    return Response(serializer.data, status=status.HTTP_200_OK)


# GET /api/users/documents/<int:pk>/view/ -> Authenticated view/stream of sensitive registration document
@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def view_user_document(request, pk):
    auth_user = _authenticate_any_user_request(request, allow_registration_token=False)
    if auth_user is None:
        return Response(
            {"detail": "Authentication credentials were not provided."},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    doc = get_object_or_404(UserDocument, pk=pk)

    # Authorization: MAO/ADMIN or document owner
    is_staff_admin = bool(auth_user.is_superuser or auth_user.is_staff)
    is_mao = bool(getattr(auth_user, "role", None) and auth_user.role.role_name in {"MAO", "ADMIN"})
    is_owner = bool(auth_user.pk == doc.user_id)

    from .identity_service import can_read_evidence
    if not (is_staff_admin or is_mao or is_owner or can_read_evidence(auth_user, doc.user)):
        return Response(
            {"detail": "You do not have permission to access this registration document."},
            status=status.HTTP_403_FORBIDDEN,
        )

    if not doc.document_file:
        return Response({"detail": "Document file not found."}, status=status.HTTP_404_NOT_FOUND)

    try:
        file_handle = doc.document_file.open("rb")
    except Exception:
        return Response({"detail": "Document file could not be opened or is missing."}, status=status.HTTP_404_NOT_FOUND)

    content_type, _ = mimetypes.guess_type(doc.document_file.name)
    if not content_type:
        content_type = "application/octet-stream"

    filename = os.path.basename(doc.document_file.name)
    response = FileResponse(file_handle, content_type=content_type)
    # Inline disposition allows PDFs and images to render in browser modals / iframes
    response["Content-Disposition"] = f'inline; filename="{filename}"'
    response["Cache-Control"] = "no-store, private"
    response["X-Content-Type-Options"] = "nosniff"
    response["Content-Security-Policy"] = "sandbox"
    response["Referrer-Policy"] = "no-referrer"
    return response





@api_view(["PATCH"])
@permission_classes([IsAuthenticated, IsMAO])
@transaction.atomic
def update_sibat_assignment(request, pk):
    user = get_object_or_404(User.objects.select_for_update(of=("self",)).select_related("role"), pk=pk)
    if user.role.role_name not in {"SIBAT", "CBAT"}:
        return Response({"detail": "Barangay review assignment applies only to field reviewer accounts."}, status=400)
    serializer = SibatAssignmentSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    changed_fields = []
    for input_field, model_field in (("assigned_barangay_id", "assigned_barangay"), ("access_scope", "access_scope")):
        if input_field in serializer.validated_data:
            setattr(user, model_field, serializer.validated_data[input_field])
            changed_fields.append(model_field)
    user.save(update_fields=changed_fields)
    return Response(UserManagementSerializer(user, context={"request": request}).data)


def _authenticate_any_user_request(request, allow_registration_token=True):
    """
    Authenticate a request via:
    1. Already-authenticated request.user (e.g. force_authenticate in tests or session)
    2. RegistrationIdentityAuthentication ('Authorization: Identity <token>' for pending/revision farmers)
    3. ApprovedJWTAuthentication ('Authorization: Bearer <token>' for approved portal users)
    4. In DEBUG mode, fallback verification of a Render-issued Bearer token against Render's /api/users/me/
    """
    if getattr(request, "user", None) and request.user.is_authenticated:
        return request.user

    from .identity_service import RegistrationIdentityAuthentication
    from .authentication import ApprovedJWTAuthentication

    auth_classes = (RegistrationIdentityAuthentication, ApprovedJWTAuthentication) if allow_registration_token else (ApprovedJWTAuthentication,)
    for auth_cls in auth_classes:
        try:
            auth_result = auth_cls().authenticate(request)
            if auth_result is not None:
                user, _ = auth_result
                request.user = user
                return user
        except Exception:
            pass

    if settings.DEBUG:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            try:
                req = urllib.request.Request(
                    "https://smartlivestock-xkx4.onrender.com/api/users/me/",
                    headers={
                        "Authorization": auth_header,
                        "Accept": "application/json",
                        "User-Agent": "Mozilla/5.0 (SmartLivestock-LocalDev)",
                    },
                )
                with urllib.request.urlopen(req, timeout=10) as resp:
                    if resp.status == 200:
                        data = json.loads(resp.read().decode("utf-8"))
                        email = data.get("email")
                        if email:
                            user = User.objects.select_related("role").filter(email__iexact=email).first()
                            if user and user.is_active:
                                request.user = user
                                return user
            except Exception:
                pass
    return None


def _authenticate_mao_request(request):
    """Authenticate an MAO/Admin request locally, or in DEBUG mode verify a Render-issued JWT."""
    user = _authenticate_any_user_request(request)
    if user is None:
        return None
    request.user = user
    if IsMAO().has_permission(request, None):
        return user
    return False


# DELETE /api/users/<int:pk>/ -> Permanently delete a pending/unapproved registration (MAO only)
@api_view(["DELETE"])
@authentication_classes([])
@permission_classes([AllowAny])
@transaction.atomic
def delete_pending_user(request, pk):
    auth_user = _authenticate_mao_request(request)
    if auth_user is None:
        return Response(
            {"detail": "Authentication credentials were not provided or are invalid."},
            status=status.HTTP_401_UNAUTHORIZED,
        )
    if auth_user is False:
        return Response(
            {"detail": "You do not have permission to perform this action."},
            status=status.HTTP_403_FORBIDDEN,
        )

    user = get_object_or_404(User.objects.select_for_update(), pk=pk)

    if user.pk == auth_user.pk:
        return Response(
            {"detail": "You cannot delete your own account."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if user.account_status not in {
        User.AccountStatus.PENDING,
        User.AccountStatus.SUBJECT_TO_REVISION,
    }:
        return Response(
            {"detail": "Only pending or unapproved registrations can be deleted. Approved accounts must be suspended instead to preserve municipal audit history."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    farmer_profile = getattr(user, "farmer_profile", None)
    if farmer_profile and (
        farmer_profile.inventories.exists() or farmer_profile.batches.exists()
    ):
        return Response(
            {"detail": "Cannot delete an account that already has associated livestock records."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Remove protected relations before deleting the user record
    user.identity_attempts.all().delete()
    for doc in user.documents.all():
        if doc.document_file:
            try:
                doc.document_file.delete(save=False)
            except Exception:
                pass
        doc.delete()

    if farmer_profile:
        farmer_profile.delete()

    user.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


def _serialize_own_document_status(user: User, request, include_token: bool = False):
    full_name = f"{user.first_name} {user.last_name}".strip() or user.username
    docs = user.documents.all().order_by("id")
    payload = {
        "user_id": user.pk,
        "full_name": full_name,
        "email": user.email,
        "account_status": user.account_status,
        "account_status_display": user.get_account_status_display(),
        "documents": UserDocumentSerializer(docs, many=True, context={"request": request}).data,
    }
    if include_token:
        from .identity_service import registration_token
        payload["access_token"] = registration_token(user)
    return payload


# POST /api/users/documents/session/ -> Authenticate pending/revision farmer credentials to view & replace documents
@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def establish_document_revision_session(request):
    email = str(request.data.get("email") or "").strip().lower()
    password = str(request.data.get("password") or "")
    if not email or not password:
        return Response(
            {"detail": "Please enter both your registered email address and password."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user = User.objects.select_related("role").prefetch_related("documents").filter(email__iexact=email).first()
    if not user or not user.is_active or not user.check_password(password):
        return Response(
            {"detail": "Invalid email or password. Please check your credentials and try again."},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    if getattr(user, "role", None) and user.role.role_name != "FARMER":
        return Response(
            {"detail": "Registration document resubmission is only for farmer accounts."},
            status=status.HTTP_403_FORBIDDEN,
        )

    if user.account_status not in (User.AccountStatus.PENDING, User.AccountStatus.SUBJECT_TO_REVISION):
        return Response(
            {"detail": "This registration is no longer pending. Contact MAO if you need help accessing your account."},
            status=status.HTTP_409_CONFLICT,
        )

    return Response(
        _serialize_own_document_status(user, request, include_token=True),
        status=status.HTTP_200_OK,
    )


# GET /api/users/documents/ -> List current farmer's registration documents and MAO review remarks
@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def own_registration_documents(request):
    auth_user = _authenticate_any_user_request(request)
    if auth_user is None:
        return Response(
            {"detail": "Authentication credentials were not provided or have expired."},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    user = (
        User.objects.select_related("role")
        .prefetch_related("documents__approved_by")
        .get(pk=auth_user.pk)
    )
    return Response(
        _serialize_own_document_status(user, request, include_token=False),
        status=status.HTTP_200_OK,
    )


# PATCH/POST /api/users/documents/<int:pk>/resubmit/ -> Replace a document marked Subject to Revision
@api_view(["PATCH", "POST"])
@authentication_classes([])
@permission_classes([AllowAny])
@parser_classes([MultiPartParser, FormParser])
@transaction.atomic
def resubmit_user_document(request, pk):
    auth_user = _authenticate_any_user_request(request)
    if auth_user is None:
        return Response(
            {"detail": "Authentication credentials were not provided or have expired."},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    doc = get_object_or_404(
        UserDocument.objects.select_for_update().select_related("user"),
        pk=pk,
    )

    if doc.user_id != auth_user.pk:
        return Response(
            {"detail": "You do not have permission to replace this document."},
            status=status.HTTP_403_FORBIDDEN,
        )

    if doc.verification_status != UserDocument.VerificationStatus.SUBJECT_TO_REVISION:
        return Response(
            {"detail": "Only documents marked Subject to Revision by MAO can be replaced."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    uploaded_file = request.FILES.get("document_file")
    if not uploaded_file:
        return Response(
            {"document_file": ["Please select a replacement document file (PDF, JPG, PNG, or WEBP)."]},
            status=status.HTTP_400_BAD_REQUEST,
        )

    from .document_security import validate_document
    from rest_framework import serializers as drf_serializers

    doc_label = doc.get_document_type_display()
    try:
        validated_file = validate_document(uploaded_file, doc_label)
    except drf_serializers.ValidationError as exc:
        detail = exc.detail[0] if isinstance(exc.detail, list) and exc.detail else str(exc.detail)
        return Response(
            {"document_file": [str(detail)], "detail": str(detail)},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Optionally update government ID type if the farmer is submitting a different valid ID
    requested_type = str(request.data.get("document_type") or "").strip().upper()
    allowed_gov_id_types = {
        UserDocument.DocumentType.PHILID,
        UserDocument.DocumentType.DRIVERS_LICENSE,
        UserDocument.DocumentType.VOTERS_ID,
        UserDocument.DocumentType.PASSPORT,
        UserDocument.DocumentType.UMID,
        UserDocument.DocumentType.POSTAL_ID,
        UserDocument.DocumentType.PRC_ID,
        UserDocument.DocumentType.OTHER_GOV_ID,
    }
    if (
        requested_type
        and doc.document_type != UserDocument.DocumentType.RSBSA
        and requested_type in allowed_gov_id_types
    ):
        doc.document_type = requested_type

    # Preserve Front_/Back_ prefix if the original upload had one
    old_basename = os.path.basename(doc.document_file.name) if doc.document_file else ""
    side_prefix = next((p for p in ("Front_", "Back_") if old_basename.startswith(p)), "")
    if side_prefix and not validated_file.name.startswith(side_prefix):
        validated_file.name = f"{side_prefix}{validated_file.name}"

    if doc.document_file:
        try:
            doc.document_file.delete(save=False)
        except Exception:
            pass

    doc.document_file = validated_file
    doc.verification_status = UserDocument.VerificationStatus.PENDING
    doc.approved_by = None
    doc.reviewed_at = None
    doc.review_remarks = ""
    doc.uploaded_at = timezone.now()
    doc.save()

    user = User.objects.select_for_update().get(pk=doc.user_id)
    if user.account_status == User.AccountStatus.SUBJECT_TO_REVISION:
        user.account_status = User.AccountStatus.PENDING
        user.save(update_fields=["account_status"])

    # Mark unread revision notifications as read and notify MAO that the replacement is ready for review
    Notification.objects.filter(
        user=user,
        title="Document Requires Revision",
        is_read=False,
    ).update(is_read=True)

    from .notification_views import notify_role
    farmer_name = f"{user.first_name} {user.last_name}".strip() or user.username
    notify_role(
        "MAO",
        title="Revised Registration Document Submitted",
        message=f"{farmer_name} uploaded a replacement {doc.get_document_type_display()} for MAO verification.",
        link="/user-management",
    )

    serializer = UserDocumentSerializer(doc, context={"request": request})
    return Response(serializer.data, status=status.HTTP_200_OK)

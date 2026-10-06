import os
import mimetypes
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.http import HttpResponse, FileResponse
from django.views import View
from django.db import transaction
from django.db.models import Q
from rest_framework_simplejwt.views import TokenObtainPairView  # type: ignore
from rest_framework.generics import CreateAPIView
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

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
class RegisterView(CreateAPIView):
    # Registration is public; the serializer always creates a pending FARMER account.
    permission_classes = [AllowAny]
    serializer_class = RegisterSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]


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
                Q(role__role_name="SIBAT", assigned_barangay__isnull=True)
                | Q(role__role_name="FARMER", farmer_profile__isnull=True)
            )
        else:
            try:
                barangay_id = int(barangay_filter)
            except ValueError:
                return Response({"barangay_id": ["Use a barangay ID or unassigned."]}, status=400)
            # A staff jurisdiction and a farmer's address are different relationships.
            users = users.filter(
                Q(role__role_name="SIBAT", assigned_barangay_id=barangay_id)
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
def update_user_status(request, pk):
    user = get_object_or_404(User, pk=pk)

    serializer = UserStatusUpdateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    new_status = serializer.validated_data["status"]
    previous_status = user.account_status

    # Administrative safeguard:
    # If approving an account with submitted documents, ensure documents are not pending or under revision
    if new_status == User.AccountStatus.APPROVED:
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
            link="/login",
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
@permission_classes([IsAuthenticated])
def view_user_document(request, pk):
    doc = get_object_or_404(UserDocument, pk=pk)

    # Authorization: MAO/ADMIN or document owner
    is_staff_admin = bool(request.user.is_superuser or request.user.is_staff)
    is_mao = bool(getattr(request.user, "role", None) and request.user.role.role_name in {"MAO", "ADMIN"})
    is_owner = bool(request.user.pk == doc.user_id)

    if not (is_staff_admin or is_mao or is_owner):
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
    return response





@api_view(["PATCH"])
@permission_classes([IsAuthenticated, IsMAO])
@transaction.atomic
def update_sibat_assignment(request, pk):
    user = get_object_or_404(User.objects.select_for_update(of=("self",)).select_related("role"), pk=pk)
    if user.role.role_name != "SIBAT":
        return Response({"detail": "Barangay review assignment applies only to SIBAT accounts."}, status=400)
    serializer = SibatAssignmentSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    changed_fields = []
    for input_field, model_field in (("assigned_barangay_id", "assigned_barangay"), ("access_scope", "access_scope")):
        if input_field in serializer.validated_data:
            setattr(user, model_field, serializer.validated_data[input_field])
            changed_fields.append(model_field)
    user.save(update_fields=changed_fields)
    return Response(UserManagementSerializer(user, context={"request": request}).data)

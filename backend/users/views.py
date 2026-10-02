from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.http import HttpResponse
from django.views import View
from django.db import transaction
from django.db.models import Q
from rest_framework_simplejwt.views import TokenObtainPairView  # type: ignore
from rest_framework.generics import CreateAPIView
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from livestock.permission import IsMAO
from users.models import User
from .notification_views import create_notification
from .serializer import (
    CurrentUserSerializer,
    MyTokenSerializer,
    RegisterSerializer,
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
    user.account_status = new_status

    if new_status == User.AccountStatus.APPROVED:
        user.approved_at = timezone.now()

    user.save()

    if previous_status != new_status:
        create_notification(user=user, title="Account status updated",
            message=f"Your account status is now {user.get_account_status_display()}.", link="/login")

    response_serializer = UserManagementSerializer(user, context={"request": request})
    return Response(response_serializer.data, status=status.HTTP_200_OK)




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

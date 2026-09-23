from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.http import HttpResponse
from django.views import View
from django.db.models import Q
from rest_framework_simplejwt.views import TokenObtainPairView  # type: ignore
from rest_framework.generics import CreateAPIView
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from livestock.permission import IsMAO
from users.models import User
from .serializer import (
    CurrentUserSerializer,
    MyTokenSerializer,
    RegisterSerializer,
    UserManagementSerializer,
    UserStatusUpdateSerializer,
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
    serializer_class = RegisterSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]


# Get current logged-in user basic profile
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_user_information(request):
    serializer = CurrentUserSerializer(request.user)
    return Response(serializer.data)


# GET /api/users/pending/ -> List users with PENDING account status (MAO only)
@api_view(["GET"])
@permission_classes([IsAuthenticated, IsMAO])
def pending_users_list(request):
    users = (
        User.objects.filter(account_status=User.AccountStatus.PENDING)
        .select_related("role", "farmer_profile__barangay")
        .prefetch_related("farmer_profile__inventories")
        .order_by("-created_at")
    )
    serializer = UserManagementSerializer(users, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)


# GET /api/users/ -> List all users for user management directory (MAO only)
@api_view(["GET"])
@permission_classes([IsAuthenticated, IsMAO])
def all_users_list(request):
    users = (
        User.objects.all()
        .select_related("role", "farmer_profile__barangay")
        .prefetch_related("farmer_profile__inventories")
        .order_by("-created_at")
    )

    role_filter = request.query_params.get("role")
    if role_filter and role_filter.upper() != "ALL":
        users = users.filter(role__role_name__iexact=role_filter)

    status_filter = request.query_params.get("status")
    if status_filter and status_filter.upper() != "ALL":
        users = users.filter(account_status__iexact=status_filter)

    search = request.query_params.get("search")
    if search:
        users = users.filter(
            Q(first_name__icontains=search)
            | Q(last_name__icontains=search)
            | Q(email__icontains=search)
            | Q(username__icontains=search)
            | Q(farmer_profile__barangay__barangay_name__icontains=search)
        )

    serializer = UserManagementSerializer(users, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)


# PATCH /api/users/<id>/status/ -> Update account status (MAO only)
@api_view(["PATCH"])
@permission_classes([IsAuthenticated, IsMAO])
def update_user_status(request, pk):
    user = get_object_or_404(User, pk=pk)

    serializer = UserStatusUpdateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    new_status = serializer.validated_data["status"]
    user.account_status = new_status

    if new_status == User.AccountStatus.APPROVED:
        user.approved_at = timezone.now()

    user.save()

    response_serializer = UserManagementSerializer(user)
    return Response(response_serializer.data, status=status.HTTP_200_OK)



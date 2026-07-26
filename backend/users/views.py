from django.shortcuts import render
from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.http import HttpResponse
from django.views import View
from rest_framework_simplejwt.views import TokenObtainPairView  # type: ignore
from .serializer import CurrentUserSerializer, MyTokenSerialier, RegisterSerializer
from rest_framework.generics import CreateAPIView

from users import serializer  # type: ignore


# Simple health check views (can be removed later)
def hello(request):
    return HttpResponse("")


class HelloView(View):
    def get(self, request):
        return HttpResponse("Hello, World!")


# Custom JWT login view.
# Uses MyTokenSerialier which validates account_status=APPROVED before issuing tokens
# and includes user role + email in the JWT payload for frontend routing.
class MyTokenView(TokenObtainPairView):
    serializer_class = MyTokenSerialier


# Registration view for new farmers.
# POST with email, password, first_name, last_name, phone_number, barangay, farm_size, address.
# Atomically creates both a User (with status=PENDING) and a Farmer profile.
class RegisterView(CreateAPIView):
    serializer_class = RegisterSerializer


# Basically just get the user info
@api_view(["GET"])
def get_user_information(request):
    serializer = CurrentUserSerializer(request.user)
    return Response(serializer.data)

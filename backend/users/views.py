from django.shortcuts import render
from django.http import HttpResponse
from django.views import View
from rest_framework_simplejwt.views import TokenObtainPairView  # type: ignore
from .serializer import MyTokenSerialier, RegisterSerializer
from rest_framework.generics import CreateAPIView  # type: ignore
# Create your views here.


def hello(request):
    return HttpResponse("")


class HelloView(View):
    def get(self, request):
        return HttpResponse("Hello, World!")


class MyTokenView(TokenObtainPairView):
    serializer_class = MyTokenSerialier


class RegisterView(CreateAPIView):
    serializer_class = RegisterSerializer

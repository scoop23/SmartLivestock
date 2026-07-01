from django.shortcuts import render
from django.http import HttpResponse
from django.views import View
from rest_framework_simplejwt.views import TokenObtainPairView  # type: ignore
from .serializer import MyTokenSerialier  # type: ignore

# Create your views here.


def hello(request):
    return HttpResponse("")


class HelloView(View):
    def get(self, request):
        return HttpResponse("Hello, World!")


class MyTokenView(MyTokenSerialier):
    serializer_class = MyTokenSerialier

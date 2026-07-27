from django.urls import path
from . import views
from .views import RegisterView

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("me/", views.get_user_information, name="get_user_information"),
]

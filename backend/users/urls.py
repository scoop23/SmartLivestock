from django.urls import path
from . import views
from .views import RegisterView

urlpatterns = [
    path("hello/", views.hello, name="hello"),
    path("function", views.hello),
    path("class", views.HelloView.as_view()),
    path("register/", RegisterView.as_view(), name="register"),
    path("me/", views.get_user_information, name="get_user_information"),
]

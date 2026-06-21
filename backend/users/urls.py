from django.urls import path
from . import views

urlpatterns = [
    path("hello/", views.hello, name="hello"),
    path("function", views.hello),
    path("class", views.HelloView.as_view()),
]

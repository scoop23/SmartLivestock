from django.urls import path
from . import views

urlpatterns = [
    path("create/", views.create_inventory, name="create_inventory"),
    path("livestock_types/", views.list_livestock_types, name="get_livestock_types"),
    path("inventory/", views.get_user_inventory, name="get_user_inventory"),
]

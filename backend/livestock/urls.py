from django.urls import path
from . import views

urlpatterns = [
    path("create/", views.create_inventory, name="create_inventory"),
    path("livestock_types/", views.list_livestock_types, name="get_livestock_types"),
    path("inventory/", views.get_user_inventory, name="get_user_inventory"),
    path(
        "inventory_delete/<int:pk>/",
        views.delete_user_inventory,
        name="delete_user_inventory",
    ),
    path(
        "inventory_update/<int:pk>",
        views.update_user_inventory,
        name="update_user_inventory",
    ),
    path(
        "inventory/<int:pk>/",
        views.get_single_record,
        name="detail",
    ),
]

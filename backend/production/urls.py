from django.urls import include, path
from . import views


urlpatterns = [
    path(
        "create/",
        views.create_production_record,
        name="create",
    ),
    path(
        "view_records/",
        views.get_production_records,
        name="get_production_records",
    ),
    path(
        "<int:pk>/",
        views.get_single_production_record,
        name="detail",
    ),
    path(
        "update_record/<int:pk>",
        views.update_production_record,
        name="update",
    ),
]

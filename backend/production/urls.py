from django.urls import include, path
from . import views


urlpatterns = [
    path(
        "create/",
        views.create_production_record,
        name="create_production_record",
    )
]

from django.urls import path
from movements.views import (
    inspection_list_create,
    inspection_detail,
    inspection_verify,
    inspection_review,
)

urlpatterns = [
    path("", inspection_list_create, name="inspection_list_create"),
    path("<int:pk>/", inspection_detail, name="inspection_detail"),
    path("<int:pk>/verify/", inspection_verify, name="inspection_verify"),
    path("<int:pk>/review/", inspection_review, name="inspection_review"),
]

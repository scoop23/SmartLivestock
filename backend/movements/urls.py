from django.urls import path
from movements.views import (
    inspection_list_create,
    inspection_shipper_options,
    inspection_livestock_lookup,
    inspection_detail,
    inspection_verify,
    inspection_resubmit,
    inspection_review,
)

urlpatterns = [
    path("", inspection_list_create, name="inspection_list_create"),
    path("shippers/", inspection_shipper_options, name="inspection_shipper_options"),
    path("livestock-lookup/", inspection_livestock_lookup, name="inspection_livestock_lookup"),
    path("<int:pk>/", inspection_detail, name="inspection_detail"),
    path("<int:pk>/verify/", inspection_verify, name="inspection_verify"),
    path("<int:pk>/resubmit/", inspection_resubmit, name="inspection_resubmit"),
    path("<int:pk>/review/", inspection_review, name="inspection_review"),
]

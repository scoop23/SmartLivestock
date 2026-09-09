from django.urls import path
from . import views

urlpatterns = [
    # Collection: GET (list), POST (create)
    path("records/", views.production_record_list_create, name="record_list_create"),

    # Single Record: GET (detail), PUT/PATCH (update), DELETE (delete)
    path("records/<int:pk>/", views.production_record_detail, name="record_detail"),

    # Review Action: POST (approve / reject)
    path("records/<int:pk>/review/", views.review_production_record, name="review_record"),
]

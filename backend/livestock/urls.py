from django.urls import path
from . import views

urlpatterns = [
    # Livestock Inventory
    path("inventory/", views.inventory_list_create, name="inventory_list_create"),
    path("inventory/<int:pk>/", views.inventory_detail, name="inventory_detail"),
    path("inventory/<int:pk>/review/", views.review_inventory, name="review_inventory"),
    path("livestock_types/", views.list_livestock_types, name="list_livestock_types"),

    # Livestock Batches & Cohorts
    path("batches/", views.batch_list_create, name="batch_list_create"),
    path("batches/<int:pk>/", views.batch_detail, name="batch_detail"),
    path("batches/<int:pk>/animals/", views.batch_add_animals, name="batch_add_animals"),
    path("batches/<int:pk>/review/", views.batch_review, name="batch_review"),

    # Quarterly Census
    path("census/", views.census_list_create, name="census_list_create"),
    path("census/<int:pk>/", views.census_detail, name="census_detail"),
    path("census/<int:pk>/review/", views.review_census_submission, name="review_census_submission"),

    # References & Geography
    path("barangays/", views.get_barangays, name="get_barangays"),
    path("farmers/<int:barangay_id>/", views.get_farmer_by_barangays, name="get_farmers_by_barangay"),
]

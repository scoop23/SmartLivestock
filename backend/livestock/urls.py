from django.urls import path
from . import views

urlpatterns = [
    # Livestock Inventory
    path("inventory/", views.inventory_list_create, name="inventory_list_create"),
    path("inventory/<int:pk>/", views.inventory_detail, name="inventory_detail"),
    path("inventory/<int:pk>/review/", views.review_inventory, name="review_inventory"),
    path("livestock_types/", views.list_livestock_types, name="list_livestock_types"),
    path("gate-registrations/", views.gate_registration_list_create, name="gate_registration_list_create"),
    path("gate-verifications/", views.gate_verification_list_create, name="gate_verification_list_create"),

    # Livestock Herds
    path("batches/", views.batch_list_create, name="batch_list_create"),
    path("batches/lookup/", views.batch_lookup, name="batch_lookup"),
    path("batches/<int:pk>/", views.batch_detail, name="batch_detail"),
    path("batches/<int:pk>/animals/", views.batch_add_animals, name="batch_add_animals"),
    path("batches/<int:pk>/review/", views.batch_review, name="batch_review"),
    path("batches/<int:pk>/notes/", views.batch_add_notes, name="batch_add_notes"),

    # Quarterly Census
    path("census/", views.census_list_create, name="census_list_create"),
    path("census/<int:pk>/", views.census_detail, name="census_detail"),
    path("census/<int:pk>/review/", views.review_census_submission, name="review_census_submission"),

    # References & Geography
    path("barangays/", views.get_barangays, name="get_barangays"),
    path("farmers/<int:barangay_id>/", views.get_farmer_by_barangays, name="get_farmers_by_barangay"),
    path("ownership-transfers/", views.ownership_transfer_list_create, name="ownership_transfer_list_create"),
    path("ownership-transfer-farmers/", views.ownership_transfer_farmer_list, name="ownership_transfer_farmer_list"),
    path("ownership-transfer-farmers/<int:farmer_id>/", views.ownership_transfer_farmer_detail, name="ownership_transfer_farmer_detail"),
    path("ownership-transfer-farmers/<int:farmer_id>/livestock/", views.ownership_transfer_farmer_livestock, name="ownership_transfer_farmer_livestock"),
    path("ownership-transfers/<int:pk>/", views.ownership_transfer_detail, name="ownership_transfer_detail"),
    path("ownership-transfers/<int:pk>/review/", views.review_ownership_transfer, name="review_ownership_transfer"),
]

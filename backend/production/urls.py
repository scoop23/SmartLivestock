from django.urls import path
from . import views

urlpatterns = [
    # Daily Production Records (Milk, Meat, etc.)
    path("records/", views.production_record_list_create, name="record_list_create"),
    path("records/<int:pk>/", views.production_record_detail, name="record_detail"),
    path("records/<int:pk>/review/", views.review_production_record, name="review_record"),

    # Live Animal Sales
    path("sales/", views.live_animal_sales_list_create, name="sales_list_create"),
    path("sales/<int:pk>/", views.live_animal_sale_delete, name="sales_delete"),

    # Weight Logs & ADG
    path("weights/", views.weight_records_list_create, name="weights_list_create"),

    # Calving & Birth Registry
    path("calving/", views.calving_records_list_create, name="calving_list_create"),

    # Animal Disposition Intent (Sale, Slaughter, Movement)
    path("dispositions/", views.animal_disposition_list_create, name="dispositions_list_create"),
]

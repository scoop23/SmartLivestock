from django.urls import path
from . import views
from . import slaughterhouse_views

urlpatterns = [
    path("slaughterhouse/records/", slaughterhouse_views.slaughterhouse_records, name="slaughterhouse_records"),
    path("slaughterhouse/records/<int:pk>/", slaughterhouse_views.slaughterhouse_record_detail, name="slaughterhouse_record_detail"),
    path("slaughterhouse/records/<int:pk>/review/", slaughterhouse_views.review_slaughterhouse_record, name="review_slaughterhouse_record"),
    path("slaughterhouse/livestock-types/", slaughterhouse_views.slaughterhouse_livestock_types, name="slaughterhouse_livestock_types"),
    # Daily Production Records (Milk, Meat, etc.)
    path("records/", views.production_record_list_create, name="record_list_create"),
    path("records/<int:pk>/", views.production_record_detail, name="record_detail"),
    path("records/<int:pk>/review/", views.review_production_record, name="review_record"),

    # Live Animal Sales
    path("sales/", views.live_animal_sales_list_create, name="sales_list_create"),
    path("sales/<int:pk>/", views.live_animal_sale_delete, name="sales_delete"),
    path("sales/<int:pk>/review/", views.review_live_animal_sale, name="review_sale"),

    # Weight Logs & ADG
    path("weights/", views.weight_records_list_create, name="weights_list_create"),

    # Calving & Birth Registry
    path("calving/", views.calving_records_list_create, name="calving_list_create"),
    path("calving/<int:pk>/", views.calving_detail, name="calving_detail"),
    path("calving/<int:pk>/review/", views.review_calving_record, name="review_calving"),

    # Animal Disposition Intent (Sale, Slaughter, Movement)
    path("dispositions/", views.animal_disposition_list_create, name="dispositions_list_create"),

    # Breeding & Insemination (Mating, AI, Gestation Tracking)
    path("breeding/", views.breeding_records_list_create, name="breeding_list_create"),
    path("breeding/analytics/", views.breeding_analytics, name="breeding_analytics"),
    path("breeding/<int:pk>/", views.breeding_record_detail, name="breeding_detail"),

    # Feeding Logs & Rations
    path("feedings/", views.feeding_records_list_create, name="feeding_list_create"),
    path("feedings/analytics/", views.feeding_analytics, name="feeding_analytics"),
    path("feedings/<int:pk>/", views.feeding_record_detail, name="feeding_detail"),
]

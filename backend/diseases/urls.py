from django.urls import path
from . import views
from .clinical_views import disease_case_follow_ups

urlpatterns = [
    # Disease Cases
    path("cases/", views.disease_case_list_create, name="disease_case_list_create"),
    path("cases/<int:pk>/", views.disease_case_detail, name="disease_case_detail"),
    path("cases/<int:pk>/review/", views.review_disease_case, name="review_disease_case"),
    path("cases/<int:pk>/follow-ups/", disease_case_follow_ups, name="disease_case_follow_ups"),

    # Mortality Records
    path("mortality/", views.mortality_record_list_create, name="mortality_record_list_create"),
    path("mortality/<int:pk>/", views.mortality_record_detail, name="mortality_record_detail"),
    path("mortality/<int:pk>/review/", views.review_mortality_record, name="review_mortality_record"),
]

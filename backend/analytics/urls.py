from django.urls import path

from . import views

urlpatterns = [
    path("dashboard/", views.dashboard_summary, name="dashboard-summary"),
    path("overview/", views.data_overview_summary, name="data-overview-summary"),
    path("census/", views.census_summary, name="census-summary"),
]
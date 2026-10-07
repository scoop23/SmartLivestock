from django.urls import path

from . import views

urlpatterns = [
    path("reports/preview/", views.reports_preview, name="reports-preview"),
    path("reports/export/", views.reports_export, name="reports-export"),
    path("dashboard/", views.dashboard_summary, name="dashboard-summary"),
    path("overview/", views.data_overview_summary, name="data-overview-summary"),
    path("census/", views.census_summary, name="census-summary"),
    path("predictive/", views.predictive_model_comparison, name="predictive-model-comparison"),
    path("predictive/forecast/", views.predictive_forecast, name="predictive-forecast"),
    path("prescriptive/", views.prescriptive_recommendations, name="prescriptive-recommendations"),
    path("gis/", views.gis_summary, name="gis-summary"),
]

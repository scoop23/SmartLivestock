from django.urls import path

from . import views

urlpatterns = [
    path("reports/preview/", views.reports_preview, name="reports-preview"),
    path("reports/export/", views.reports_export, name="reports-export"),
    path("dashboard/", views.dashboard_summary, name="dashboard-summary"),
    path("mortality-weather/", views.mortality_weather_context, name="mortality-weather-context"),
    path("nlp-evaluation/", views.nlp_evaluation, name="nlp-evaluation"),
    path("nlp-query/", views.nlp_query, name="nlp-query"),
    path("review-workload/", views.review_workload, name="review-workload"),
    path("overview/", views.data_overview_summary, name="data-overview-summary"),
    path("barangays/<int:barangay_id>/current-farmers/", views.barangay_current_farmers, name="barangay-current-farmers"),
    path("census/", views.census_summary, name="census-summary"),
    path("predictive/", views.predictive_model_comparison, name="predictive-model-comparison"),
    path("predictive/forecast/", views.predictive_forecast, name="predictive-forecast"),
    path("predictive/individual-milk/", views.individual_milk_forecast, name="individual-milk-forecast"),
    path("livestock/<int:livestock_id>/milk-forecast/", views.livestock_milk_forecast, name="livestock-milk-forecast"),
    path("prescriptive/", views.prescriptive_recommendations, name="prescriptive-recommendations"),
    path("gis/", views.gis_summary, name="gis-summary"),
]

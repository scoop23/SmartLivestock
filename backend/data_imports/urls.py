from django.urls import path
from . import views

urlpatterns = [
    path("datasets/", views.list_datasets, name="list_datasets"),
    path("validate/", views.validate_import, name="validate_import"),
    path("import/", views.execute_import, name="execute_import"),
    path("batches/", views.list_batches, name="list_batches"),
    path("batches/<int:pk>/", views.batch_detail, name="batch_detail"),
    path("batches/<int:pk>/errors/", views.download_batch_errors, name="download_batch_errors"),
    path("templates/<str:dataset_type>/", views.download_template, name="download_template"),
    # Direct alias for listing batches at root
    path("", views.list_batches, name="root_batches"),
]

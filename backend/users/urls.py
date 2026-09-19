from django.urls import path
from . import views
from .views import RegisterView

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("me/", views.get_user_information, name="get_user_information"),
    path("pending/", views.pending_users_list, name="pending_users_list"),
    path("directory/", views.all_users_list, name="all_users_list"),
    path("", views.all_users_list, name="users_list"),
    path("<int:pk>/status/", views.update_user_status, name="update_user_status"),
]


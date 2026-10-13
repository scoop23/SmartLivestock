from django.urls import path
from . import views
from .views import RegisterView
from .password_reset_views import PasswordResetRequestView, PasswordResetConfirmView

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("password-reset/", PasswordResetRequestView.as_view(), name="password_reset_request"),
    path("password-reset/confirm/", PasswordResetConfirmView.as_view(), name="password_reset_confirm"),
    path("me/", views.get_user_information, name="get_user_information"),
    path("pending/", views.pending_users_list, name="pending_users_list"),
    path("directory/", views.all_users_list, name="all_users_list"),
    path("", views.all_users_list, name="users_list"),
    path("<int:pk>/assignment/", views.update_sibat_assignment, name="update_sibat_assignment"),
    path("<int:pk>/status/", views.update_user_status, name="update_user_status"),
    path("documents/<int:pk>/verification/", views.verify_user_document, name="verify_user_document"),
    path("documents/<int:pk>/view/", views.view_user_document, name="user_document_view"),
]




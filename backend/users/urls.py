from django.urls import path
from . import views
from . import identity_views
from .views import RegisterView
from .password_reset_views import PasswordResetRequestView, PasswordResetConfirmView

urlpatterns = [
    path("identity/config/", identity_views.configuration, name="identity_config"),
    path("identity/status/", identity_views.own_status, name="identity_status"),
    path("identity/start/", identity_views.start, name="identity_start"),
    path("identity/refresh/", identity_views.refresh, name="identity_refresh"),
    path("identity/assistance/", identity_views.request_assistance, name="identity_assistance"),
    path("identity/webhook/", identity_views.webhook, name="identity_webhook"),
    path("identity/reviews/", identity_views.reviews, name="identity_reviews"),
    path("identity/reviews/<int:user_id>/", identity_views.reviews, name="identity_review_detail"),
    path("identity/reviews/<int:user_id>/assessment/", identity_views.acknowledge, name="identity_assessment"),
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




from django.urls import path
from users.notification_views import (
    get_notifications,
    delete_notification,
    mark_notification_read,
    mark_all_notifications_read,
    push_public_key,
    push_subscription,
)

urlpatterns = [
    path("", get_notifications, name="notification-list"),
    path("<int:pk>/", delete_notification, name="notification-delete"),
    path("<int:pk>/read/", mark_notification_read, name="notification-mark-read"),
    path("mark-all-read/", mark_all_notifications_read, name="notification-mark-all-read"),
    path("push/public-key/", push_public_key, name="notification-push-public-key"),
    path("push/subscription/", push_subscription, name="notification-push-subscription"),
]

from django.urls import path
from users.notification_views import (
    get_notifications,
    mark_notification_read,
    mark_all_notifications_read,
)

urlpatterns = [
    path("", get_notifications, name="notification-list"),
    path("<int:pk>/read/", mark_notification_read, name="notification-mark-read"),
    path("mark-all-read/", mark_all_notifications_read, name="notification-mark-all-read"),
]

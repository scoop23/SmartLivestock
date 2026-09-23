from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404
from users.models import Notification
from users.serializer import NotificationSerializer


def create_notification(
    user,
    notification_type: str = Notification.NotificationType.GENERAL,
    title: str = "",
    message: str = "",
    priority: str = Notification.Priority.MEDIUM,
    link: str | None = None,
) -> Notification:
    """
    Utility helper to trigger an in-app notification for a given user.
    Can be imported across views (livestock, diseases, production, etc.).
    """
    return Notification.objects.create(
        user=user,
        notification_type=notification_type,
        priority=priority,
        title=title,
        message=message,
        link=link,
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_notifications(request):
    """
    GET /api/notifications/
    Returns list of notifications and unread count for the authenticated user.
    Optional query params:
      - unread_only=true
      - limit=30
    """
    user = request.user
    unread_only = request.query_params.get("unread_only", "").lower() in ("true", "1")
    try:
        limit = min(int(request.query_params.get("limit", 30)), 100)
    except (ValueError, TypeError):
        limit = 30

    queryset = Notification.objects.filter(user=user)
    unread_count = queryset.filter(is_read=False).count()

    if unread_only:
        queryset = queryset.filter(is_read=False)

    notifications = queryset[:limit]
    serializer = NotificationSerializer(notifications, many=True)

    return Response(
        {
            "unread_count": unread_count,
            "notifications": serializer.data,
        },
        status=status.HTTP_200_OK,
    )


@api_view(["PATCH", "POST"])
@permission_classes([IsAuthenticated])
def mark_notification_read(request, pk):
    """
    PATCH or POST /api/notifications/<pk>/read/
    Marks a specific notification as read.
    """
    notification = get_object_or_404(Notification, pk=pk, user=request.user)
    if not notification.is_read:
        notification.is_read = True
        notification.save(update_fields=["is_read"])

    serializer = NotificationSerializer(notification)
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def mark_all_notifications_read(request):
    """
    POST /api/notifications/mark-all-read/
    Batch marks all unread notifications as read for current user.
    """
    updated_count = Notification.objects.filter(
        user=request.user, is_read=False
    ).update(is_read=True)

    return Response(
        {
            "success": True,
            "marked_count": updated_count,
        },
        status=status.HTTP_200_OK,
    )

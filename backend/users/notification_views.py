from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404
from users.models import Notification, User
from users.serializer import NotificationSerializer
from django.db.models import Q


def reviewer_recipients_for_barangay(barangay_id):
    """Current authorized officers, each returned once even if scopes overlap."""
    scope = Q(access_scope=User.AccessScope.ALL_BARANGAYS)
    if barangay_id is not None:
        scope |= Q(assigned_barangay_id=barangay_id)
    return User.objects.filter(
        scope, role__role_name="SIBAT", is_active=True,
        account_status=User.AccountStatus.APPROVED,
    ).distinct()


def get_notification_recipients_for_farmer(farmer):
    return reviewer_recipients_for_barangay(farmer.barangay_id)


def health_notification_recipients(farmer):
    return User.objects.filter(
        Q(pk__in=get_notification_recipients_for_farmer(farmer).values("pk"))
        | Q(role__role_name__in=["MAO", "ADMIN"]),
        is_active=True, account_status=User.AccountStatus.APPROVED,
    ).select_related("role").distinct()


def notify_review_revision(farmer, reviewer, *, title, message, link):
    """Inform current field officers when municipal review returns a declaration."""
    if reviewer.role.role_name in {"MAO", "ADMIN"}:
        notify_role("SIBAT", title=title, message=message, link=link,
                    priority=Notification.Priority.HIGH, barangay_id=farmer.barangay_id)


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


def notify_role(
    role_name: str,
    notification_type: str = Notification.NotificationType.GENERAL,
    title: str = "",
    message: str = "",
    priority: str = Notification.Priority.MEDIUM,
    link: str | None = None,
    barangay_id: int | None = None,
    municipal_broadcast: bool = False,
) -> int:
    """Create the same in-app notification for every approved user in a role."""
    recipients = User.objects.filter(
        role__role_name__in=["MAO", "ADMIN"] if role_name == "MAO" else [role_name],
        account_status=User.AccountStatus.APPROVED, is_active=True,
    )
    if role_name == "SIBAT" and not municipal_broadcast:
        # Missing farmer location must never accidentally broadcast to all officers.
        recipients = reviewer_recipients_for_barangay(barangay_id)
    notifications = [
        Notification(
            user=user,
            notification_type=notification_type,
            priority=priority,
            title=title,
            message=message,
            link=link,
        )
        for user in recipients
    ]
    Notification.objects.bulk_create(notifications)
    return len(notifications)


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
        limit = max(0, min(int(request.query_params.get("limit", 30)), 100))
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


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_notification(request, pk):
    """Delete only a notification owned by the authenticated user."""
    notification = get_object_or_404(Notification, pk=pk, user=request.user)
    notification.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)

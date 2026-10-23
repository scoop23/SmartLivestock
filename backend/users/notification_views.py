from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.conf import settings as django_settings
from django.db import transaction
from django.shortcuts import get_object_or_404
from users.models import Notification, User
from users.serializer import NotificationSerializer
from django.db.models import Q
from rest_framework.exceptions import ValidationError
from .models import PushSubscription
from .push_notifications import create_user_push_notification, is_supported_push_endpoint, send_push_for_notification


def _field_officer_notification_queryset(user, queryset):
    """Hide record notifications outside a field officer's current jurisdiction.

    Notifications are addressed once, when created. A later barangay reassignment
    must not leave old record links visible in the officer's inbox.
    """
    role_name = getattr(getattr(user, "role", None), "role_name", "")
    if role_name not in {"SIBAT", "CBAT"}:
        return queryset

    from diseases.models import DiseaseCase, MortalityRecord
    from livestock.models import CensusSubmission, LivestockBatch, LivestockInventory, LivestockOwnershipTransfer
    from movements.models import LivestockInspection
    from production.models import CalvingRecord, LiveAnimalSale, ProductionRecord
    from smartlivestock.workflows import scope_reviewer_queryset

    scoped_record_ids = {
        "production_record": scope_reviewer_queryset(ProductionRecord.objects.all(), user).values("pk"),
        "livestock_inventory": scope_reviewer_queryset(LivestockInventory.objects.all(), user).values("pk"),
        "livestock_batch": scope_reviewer_queryset(LivestockBatch.objects.all(), user).values("pk"),
        "disease_case": scope_reviewer_queryset(DiseaseCase.objects.all(), user).values("pk"),
        "mortality_record": scope_reviewer_queryset(MortalityRecord.objects.all(), user).values("pk"),
        "livestock_sale": scope_reviewer_queryset(LiveAnimalSale.objects.all(), user).values("pk"),
        "calving_record": scope_reviewer_queryset(CalvingRecord.objects.all(), user).values("pk"),
        "census_submission": scope_reviewer_queryset(CensusSubmission.objects.all(), user).values("pk"),
        "ownership_transfer": scope_reviewer_queryset(LivestockOwnershipTransfer.objects.all(), user).values("pk"),
        "inspection": scope_reviewer_queryset(LivestockInspection.objects.all(), user).values("pk"),
    }
    allowed_records = Q()
    for entity_type in scoped_record_ids:
        allowed_records |= Q(related_entity_type=entity_type, related_entity_id__in=scoped_record_ids[entity_type])

    return queryset.filter(
        Q(related_entity_type__isnull=True)
        | ~Q(related_entity_type__in=scoped_record_ids)
        | allowed_records
    )


def reviewer_recipients_for_barangay(barangay_id, *, include_cbat=False):
    """Current authorized officers, each returned once even if scopes overlap."""
    scope = Q(access_scope=User.AccessScope.ALL_BARANGAYS)
    if barangay_id is not None:
        scope |= Q(assigned_barangay_id=barangay_id)
    return User.objects.filter(
        scope, role__role_name__in=["SIBAT", "CBAT"], is_active=True,
        account_status=User.AccountStatus.APPROVED,
    ).distinct()


def cbat_recipients_for_barangay(barangay_id):
    """Compatibility alias for the shared field reviewer recipient list."""
    return reviewer_recipients_for_barangay(barangay_id)


def get_notification_recipients_for_farmer(farmer):
    return reviewer_recipients_for_barangay(farmer.barangay_id)


def health_notification_recipients(farmer):
    return User.objects.filter(
        Q(pk__in=reviewer_recipients_for_barangay(farmer.barangay_id, include_cbat=True).values("pk"))
        | Q(role__role_name__in=["MAO", "ADMIN"]),
        is_active=True, account_status=User.AccountStatus.APPROVED,
    ).select_related("role").distinct()


def notify_review_revision(farmer, reviewer, *, title, message, link, include_cbat=False):
    """Inform current field officers when municipal review returns a declaration."""
    if reviewer.role.role_name in {"MAO", "ADMIN"}:
        notify_role("SIBAT", title=title, message=message, link=link,
                    priority=Notification.Priority.HIGH, barangay_id=farmer.barangay_id,
                    include_cbat=include_cbat)


def create_notification(
    user,
    notification_type: str = Notification.NotificationType.GENERAL,
    title: str = "",
    message: str = "",
    priority: str = Notification.Priority.MEDIUM,
    link: str | None = None,
    related_entity_type: str | None = None,
    related_entity_id: int | None = None,
) -> Notification:
    """
    Utility helper to trigger an in-app notification for a given user.
    Can be imported across views (livestock, movements, diseases, production, etc.).
    """
    return create_user_push_notification(
        user,
        notification_type=notification_type,
        priority=priority,
        title=title,
        message=message,
        link=link,
        related_entity_type=related_entity_type,
        related_entity_id=related_entity_id,
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
    include_cbat: bool = False,
    related_entity_type: str | None = None,
    related_entity_id: int | None = None,
) -> int:
    """Create the same in-app notification for every approved user in a role."""
    recipients = User.objects.filter(
        role__role_name__in=["MAO", "ADMIN"] if role_name == "MAO" else ["SIBAT", "CBAT"] if role_name in {"SIBAT", "CBAT"} else [role_name],
        account_status=User.AccountStatus.APPROVED, is_active=True,
    )
    if role_name in {"SIBAT", "CBAT"} and not municipal_broadcast:
        # Missing farmer location must never accidentally broadcast to all officers.
        recipients = reviewer_recipients_for_barangay(barangay_id, include_cbat=include_cbat)
    notifications = [
        Notification(
            user=user,
            notification_type=notification_type,
            priority=priority,
            title=title,
            message=message,
            link=link,
            related_entity_type=related_entity_type,
            related_entity_id=related_entity_id,
        )
        for user in recipients
    ]
    Notification.objects.bulk_create(notifications)
    for notification in notifications:
        transaction.on_commit(lambda item=notification: send_push_for_notification(item))
    return len(notifications)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def push_public_key(request):
    public_key = getattr(django_settings, "WEB_PUSH_VAPID_PUBLIC_KEY", "")
    if not public_key:
        return Response({"enabled": False, "public_key": None})
    return Response({"enabled": True, "public_key": public_key})


@api_view(["POST", "DELETE"])
@permission_classes([IsAuthenticated])
def push_subscription(request):
    endpoint = request.data.get("endpoint")
    if not isinstance(endpoint, str) or len(endpoint) > 2048 or not is_supported_push_endpoint(endpoint):
        raise ValidationError({"endpoint": "Use a supported HTTPS browser push endpoint."})

    if request.method == "DELETE":
        PushSubscription.objects.filter(user=request.user, endpoint=endpoint).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    keys = request.data.get("keys")
    if not isinstance(keys, dict):
        raise ValidationError({"keys": "Push subscription keys are required."})
    p256dh, auth = keys.get("p256dh"), keys.get("auth")
    if not isinstance(p256dh, str) or not p256dh or len(p256dh) > 256:
        raise ValidationError({"keys": {"p256dh": "A valid browser public key is required."}})
    if not isinstance(auth, str) or not auth or len(auth) > 128:
        raise ValidationError({"keys": {"auth": "A valid browser authentication key is required."}})

    subscription, created = PushSubscription.objects.get_or_create(
        endpoint=endpoint,
        defaults={"user": request.user, "p256dh": p256dh, "auth": auth},
    )
    if not created and subscription.user_id != request.user.pk:
        return Response({"detail": "This push endpoint is already registered to another account."},
                        status=status.HTTP_409_CONFLICT)
    if not created:
        subscription.p256dh = p256dh
        subscription.auth = auth
        subscription.save(update_fields=["p256dh", "auth", "updated_at"])
    return Response({"registered": True}, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


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

    queryset = _field_officer_notification_queryset(
        user,
        Notification.objects.filter(user=user),
    )
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
    Marks a specific notification as read or unread.
    """
    notification = get_object_or_404(Notification, pk=pk, user=request.user)
    unread = False
    if request.data and isinstance(request.data, dict):
        unread = bool(request.data.get("unread", False))
    elif request.query_params.get("unread") in ("true", "1", "True"):
        unread = True

    new_is_read = not unread
    if notification.is_read != new_is_read:
        notification.is_read = new_is_read
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

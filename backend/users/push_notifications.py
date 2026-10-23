"""Browser Web Push subscription and delivery helpers."""

import json
import logging
from functools import partial
from urllib.parse import urlparse

from django.conf import settings
from django.db import transaction

from .models import Notification, PushSubscription

logger = logging.getLogger(__name__)

_ALLOWED_PUSH_HOST_SUFFIXES = (
    "fcm.googleapis.com",
    "push.services.mozilla.com",
    "push.apple.com",
    "notify.windows.com",
)


def is_supported_push_endpoint(endpoint):
    try:
        parsed = urlparse(endpoint or "")
        port = parsed.port
    except ValueError:
        return False
    host = (parsed.hostname or "").lower().rstrip(".")
    return (
        parsed.scheme == "https"
        and port in (None, 443)
        and not parsed.username
        and not parsed.password
        and any(host == suffix or host.endswith("." + suffix) for suffix in _ALLOWED_PUSH_HOST_SUFFIXES)
    )


def send_push_for_notification(notification):
    """Best-effort Web Push delivery; in-app notification persistence is authoritative."""
    public_key = getattr(settings, "WEB_PUSH_VAPID_PUBLIC_KEY", "")
    private_key = getattr(settings, "WEB_PUSH_VAPID_PRIVATE_KEY", "")
    if not public_key or not private_key:
        return

    from pywebpush import WebPushException, webpush

    payload = json.dumps({
        # Avoid putting farmer, animal, or health details on a device lock screen.
        "title": "SmartLivestock notification",
        "body": "You have a new livestock-related update. Sign in to view details.",
        "url": notification.link or "/notifications",
        "tag": f"notification-{notification.pk}",
    })
    subscriptions = PushSubscription.objects.filter(user=notification.user)
    for subscription in subscriptions.iterator():
        try:
            webpush(
                subscription_info={
                    "endpoint": subscription.endpoint,
                    "keys": {"p256dh": subscription.p256dh, "auth": subscription.auth},
                },
                data=payload,
                vapid_private_key=private_key,
                vapid_claims={"sub": settings.WEB_PUSH_VAPID_SUBJECT},
                timeout=5,
                ttl=60,
            )
        except WebPushException as exc:
            response = getattr(exc, "response", None)
            if response is not None and response.status_code in (404, 410):
                subscription.delete()
            logger.warning("Web Push delivery failed for notification %s (status=%s)",
                           notification.pk, getattr(response, "status_code", "unknown"))
        except Exception:
            # A push provider outage must not roll back a saved livestock event.
            logger.exception("Web Push delivery failed for notification %s", notification.pk)


def create_user_push_notification(user, **notification_fields):
    notification = Notification.objects.create(user=user, **notification_fields)
    transaction.on_commit(partial(send_push_for_notification, notification))
    return notification

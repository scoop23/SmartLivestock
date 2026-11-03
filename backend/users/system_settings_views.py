from django.db import transaction
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from livestock.permission import IsMAO
from .models import SystemConfiguration, SystemConfigurationChange


def _configuration():
    return SystemConfiguration.objects.get_or_create(pk=1)[0]


@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated, IsMAO])
def system_settings(request):
    """Read or update the small set of municipality-wide settings."""
    if request.method == "GET":
        config = _configuration()
        history = config.change_history.select_related("changed_by").all()[:10]
        return Response({
            "browser_push_enabled": config.browser_push_enabled,
            "updated_at": config.updated_at,
            "updated_by": config.updated_by.get_full_name() or config.updated_by.email if config.updated_by else None,
            "recent_changes": [{
                "setting_name": row.setting_name,
                "old_value": row.old_value,
                "new_value": row.new_value,
                "changed_by": row.changed_by.get_full_name() or row.changed_by.email,
                "changed_at": row.changed_at,
            } for row in history],
        })

    enabled = request.data.get("browser_push_enabled")
    if not isinstance(enabled, bool):
        return Response(
            {"browser_push_enabled": "Provide true or false."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    with transaction.atomic():
        config = SystemConfiguration.objects.select_for_update().get_or_create(pk=1)[0]
        previous = config.browser_push_enabled
        if previous != enabled:
            config.browser_push_enabled = enabled
            config.updated_by = request.user
            config.save(update_fields=["browser_push_enabled", "updated_by", "updated_at"])
            SystemConfigurationChange.objects.create(
                configuration=config,
                setting_name="browser_push_enabled",
                old_value=str(previous).lower(),
                new_value=str(enabled).lower(),
                changed_by=request.user,
            )

    return Response({"browser_push_enabled": config.browser_push_enabled})

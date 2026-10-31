"""Access helpers for developer-only Ask SmartLivestock tooling."""

from rest_framework.permissions import BasePermission


NLP_DEVELOPER_GROUP = "NLP Developers"


class IsMAOOnly(BasePermission):
    """Allow the user-facing Ask SmartLivestock endpoint to MAO accounts only."""

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and getattr(getattr(user, "role", None), "role_name", None) == "MAO"
        )


def user_is_nlp_developer(user):
    """Require both the MAO role and explicit access to NLP developer tooling."""
    return bool(
        user
        and user.is_authenticated
        and getattr(getattr(user, "role", None), "role_name", None) == "MAO"
        and user.groups.filter(name=NLP_DEVELOPER_GROUP).exists()
    )


class IsNLPDeveloper(BasePermission):
    """Require an MAO role and explicit developer-group membership."""

    def has_permission(self, request, view):
        return user_is_nlp_developer(request.user)

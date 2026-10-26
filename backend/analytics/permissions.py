"""Access helpers for developer-only Ask SmartLivestock tooling."""

from rest_framework.permissions import BasePermission


NLP_DEVELOPER_GROUP = "NLP Developers"


def user_is_nlp_developer(user):
    """Return true only for users explicitly assigned to the NLP Developers group."""
    return bool(
        user
        and user.is_authenticated
        and user.groups.filter(name=NLP_DEVELOPER_GROUP).exists()
    )


class IsNLPDeveloper(BasePermission):
    """Require explicit developer-group membership, independent of an app role."""

    def has_permission(self, request, view):
        return user_is_nlp_developer(request.user)

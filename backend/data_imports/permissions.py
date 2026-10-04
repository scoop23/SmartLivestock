from rest_framework.permissions import BasePermission


class IsMAOOrAdmin(BasePermission):
    """
    Data ingestion and bulk batch imports are restricted exclusively to
    authorized Municipal Agriculture Office (MAO) officers and System Administrators.
    """

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        
        role = getattr(user, "role", None)
        role_name = getattr(role, "role_name", "")
        return role_name in {"MAO", "ADMIN"} or user.is_staff or user.is_superuser

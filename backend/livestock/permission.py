from rest_framework.permissions import BasePermission


class IsMAO(BasePermission):
    """Allow MAO officers and system administrators to use MAO-managed endpoints."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and getattr(request.user, "role", None)
            and request.user.role.role_name in {"MAO", "ADMIN"}
        )


class IsFarmer(BasePermission):
    """Allows access for Farmer role."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and getattr(request.user, "role", None)
            and request.user.role.role_name == "FARMER"
        )


class IsSibat(BasePermission):
    """Allows either barangay field reviewer role."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and getattr(request.user, "role", None)
            and request.user.role.role_name in {"SIBAT", "CBAT"}
        )


class IsAuction(BasePermission):
    """Allows access for Auction market role."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and getattr(request.user, "role", None)
            and request.user.role.role_name == "AUCTION"
        )


class IsSlaughterhouseStaff(BasePermission):
    """Allows access for Slaughterhouse staff role."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and getattr(request.user, "role", None)
            and request.user.role.role_name == "SLAUGHTERHOUSESTAFF"
        )


# Backward-compatible aliases for existing imports
isMAO = IsMAO
isFarmer = IsFarmer
isSibat = IsSibat
isAuction = IsAuction
isSlaughterhouseStaff = IsSlaughterhouseStaff


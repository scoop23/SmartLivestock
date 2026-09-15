from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response

class isMAO(BasePermission):
    # allows access for mao role
    def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and request.user.role
            and request.user.role.role_name == "MAO"
        )

class isFarmer(BasePermission):
    # allows access for farmer role
    def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and request.user.role
            and request.user.role.role_name == "FARMER"
        )

class isSibat(BasePermission):
    # allows access for sibat role
    def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and request.user.role
            and request.user.role.role_name == "SIBAT"
        )

class IsAuction(BasePermission):
    # allows access for auction role
    def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and request.user.role
            and request.user.role.role_name == "AUCTION"
        )

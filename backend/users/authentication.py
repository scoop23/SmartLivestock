from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication

from users.models import User


class ApprovedJWTAuthentication(JWTAuthentication):
    """Reject tokens when the account is no longer approved."""

    def get_user(self, validated_token):
        user = super().get_user(validated_token)
        if user.account_status != User.AccountStatus.APPROVED:
            raise AuthenticationFailed("Account is not approved.", code="account_not_approved")
        return user

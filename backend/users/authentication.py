import json
import os
import urllib.error
import urllib.request

from django.conf import settings
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError

from users.models import User


class ApprovedJWTAuthentication(JWTAuthentication):
    """Reject tokens when the account is no longer approved."""

    @staticmethod
    def _debug_remote_user(request):
        """Validate a Render-issued token remotely for local development only."""
        if not getattr(settings, "DEBUG", False):
            return None

        authorization = request.headers.get("Authorization", "")
        if not authorization.startswith("Bearer "):
            return None

        user_url = os.environ.get(
            "SMARTLIVESTOCK_REMOTE_AUTH_URL",
            "https://smartlivestock-xkx4.onrender.com/api/users/me/",
        )
        if not user_url.startswith("https://"):
            return None

        remote_request = urllib.request.Request(
            user_url,
            headers={
                "Authorization": authorization,
                "Accept": "application/json",
                "User-Agent": "SmartLivestock-LocalDev",
            },
        )
        try:
            with urllib.request.urlopen(remote_request, timeout=5) as response:
                if response.status != 200:
                    return None
                profile = json.loads(response.read().decode("utf-8"))
        except (urllib.error.URLError, TimeoutError, ValueError):
            return None

        email = profile.get("email") if isinstance(profile, dict) else None
        if not email:
            return None
        return User.objects.select_related("role").filter(
            email__iexact=email,
            is_active=True,
        ).first()

    def authenticate(self, request):
        try:
            return super().authenticate(request)
        except (InvalidToken, TokenError):
            user = self._debug_remote_user(request)
            if user is None:
                raise
            if user.account_status != User.AccountStatus.APPROVED:
                raise AuthenticationFailed("Account is not approved.", code="account_not_approved")
            return (user, None)

    def get_user(self, validated_token):
        user = super().get_user(validated_token)
        if user.account_status != User.AccountStatus.APPROVED:
            raise AuthenticationFailed("Account is not approved.", code="account_not_approved")
        return user

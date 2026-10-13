"""Public password-reset endpoints using Django's signed, expiring tokens."""

import logging

from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.mail import send_mail
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework import serializers, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .models import User

logger = logging.getLogger(__name__)
RESET_REQUEST_MESSAGE = (
    "If an active account uses that email address, password reset instructions have been sent."
)


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate(self, attrs):
        # The signed token proves access to the reset email; decoding the user ID
        # alone never grants access or changes a password.
        try:
            user_id = force_str(urlsafe_base64_decode(attrs["uid"]))
            user = User.objects.get(pk=user_id, is_active=True)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            raise serializers.ValidationError({"detail": "This reset link is invalid or expired."})

        if not default_token_generator.check_token(user, attrs["token"]):
            raise serializers.ValidationError({"detail": "This reset link is invalid or expired."})

        try:
            validate_password(attrs["new_password"], user=user)
        except DjangoValidationError as error:
            raise serializers.ValidationError({"new_password": list(error.messages)})

        attrs["user"] = user
        return attrs


class PasswordResetRequestView(APIView):
    """Email a reset link without revealing whether an account exists."""

    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "password_reset"

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"].strip()
        user = User.objects.filter(email__iexact=email, is_active=True).first()

        if user and user.has_usable_password():
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            reset_url = f"{settings.FRONTEND_URL}/reset-password?uid={uid}&token={token}"
            try:
                send_mail(
                    subject="Reset your SmartLivestock password",
                    message=(
                        "We received a request to reset your SmartLivestock password.\n\n"
                        f"Open this link to choose a new password:\n{reset_url}\n\n"
                        "If you did not request this, you can ignore this email. "
                        "The link expires after three days."
                    ),
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[user.email],
                    fail_silently=False,
                )
            except Exception:
                # Keep the public response identical for existing and unknown
                # emails; server logs still reveal mail-provider failures.
                logger.exception("Could not send a SmartLivestock password reset email.")

        # The same response avoids exposing which email addresses are registered.
        return Response({"detail": RESET_REQUEST_MESSAGE}, status=status.HTTP_200_OK)


class PasswordResetConfirmView(APIView):
    """Validate a one-time link and replace the account password."""

    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "password_reset"

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        user.set_password(serializer.validated_data["new_password"])
        user.save(update_fields=["password"])
        return Response(
            {"detail": "Your password has been reset. You can now sign in."},
            status=status.HTTP_200_OK,
        )

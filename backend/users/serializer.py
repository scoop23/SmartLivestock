from rest_framework import serializers  # type: ignore
from users.models import User
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer  # type: ignore


class MyTokenSerialier(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)

        token["role"] = user.role
        token["email"] = user.email

        return token

    def validate(self, attrs):
        data = super().validate(attrs)

        data["user"] = {
            "id": self.user.id,
            "email": self.user.email,
            "role": self.user.role,
        }

        return data

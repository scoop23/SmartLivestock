from rest_framework import serializers  # type: ignore
from users.models import User, Role
from livestock.models import Farmer
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer  # type: ignore
from django.db import transaction


class MyTokenSerialier(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)

        token["role"] = user.role
        token["email"] = user.email

        return token

    def validate(self, attrs):
        data = super().validate(attrs)

        if self.user.account_status != User.AccountStatus.APPROVED:
            raise serializers.ValidationError(
                {"account_status": "Your account is not approved yet."}
            )

        data["user"] = {
            "id": self.user.id,
            "email": self.user.email,
            "role": self.user.role,
        }

        return data


class RegisterSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = (
            "username",
            "email",
            "password",
            "first_name",
            "last_name",
            "phone_number",
        )

    password = serializers.CharField(write_only=True)

    @transaction.atomic
    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data["username"],
            email=validated_data["email"],
            password=validated_data["password"],
            first_name=validated_data.get("first_name", ""),
            last_name=validated_data.get("last_name", ""),
            phone_number=validated_data.get("phone_number", ""),
        )

        farmer = Farmer.objects.create(
            user=user,
            barangay=validated_data["barangay"],
            farm_size=validated_data["farm_size"],
            address=validated_data["address"],
        )

        user.account_status = User.AccountStatus.PENDING
        try:
            farmer_role = Role.objects.get(role_name=Role.UserRoles.FARMER)
            user.role = farmer_role
        except Role.DoesNotExist:
            raise serializers.ValidationError(
                {"role": "Default system role 'FARMER' does not exist in database."}
            )

        user.save()
        return user

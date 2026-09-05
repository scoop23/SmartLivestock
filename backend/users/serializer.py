from rest_framework import serializers  # type: ignore
from users.models import User, Role
from livestock.models import Farmer, Barangay
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer  # type: ignore
from django.db import transaction
from django.db.models import Max
from typing import cast


# Custom JWT serializer that:
# 1. Adds role and email to the JWT payload (so frontend can decode for routing)
# 2. Validates that the user's account_status is APPROVED before allowing login
class MyTokenSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)

        token["role"] = user.role.role_name
        token["email"] = user.email

        return token

    def validate(self, attrs):
        data = super().validate(attrs)

        user = cast(User, self.user)

        if user.account_status != User.AccountStatus.APPROVED:
            raise serializers.ValidationError(
                {"account_status": "Your account is not approved yet."}
            )

        data = cast(dict, data)

        data["user"] = {
            "id": user.id, #type: ignore[reportAttributeAccesssIssues]
            "email": user.email,
            "role": user.role.role_name,
        }

        return data


# Handles farmer registration.
# Accepts fields from both User (email, password, name, phone) and Farmer (barangay, farm_size, address).
# barangay, farm_size, address are write_only since they belong to the Farmer model, not User.
# Creates User + Farmer atomically inside a transaction.
class RegisterSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = (
            "email",
            "password",
            "first_name",
            "last_name",
            "phone_number",
            "barangay",
            "farm_size",
            "address",
        )

    password = serializers.CharField(write_only=True)
    barangay = serializers.PrimaryKeyRelatedField(
        queryset=Barangay.objects.all(),
        write_only=True,
    )
    farm_size = serializers.DecimalField(
        max_digits=10, decimal_places=2, write_only=True
    )
    address = serializers.CharField(
        max_length=255, required=True, allow_blank=False, write_only=True
    )

    @transaction.atomic
    def create(self, validated_data):
        farmer_role = Role.objects.get(role_name=Role.UserRoles.FARMER)

        username = self.generate_username()

        user = User.objects.create_user(
            username=username,
            email=validated_data["email"],
            password=validated_data["password"],
            first_name=validated_data.get("first_name", ""),
            last_name=validated_data.get("last_name", ""),
            phone_number=validated_data.get("phone_number", ""),
            role=farmer_role,
            account_status=User.AccountStatus.PENDING,
        )

        Farmer.objects.create(
            user=user,
            barangay=validated_data["barangay"],
            farm_size=validated_data["farm_size"],
            address=validated_data["address"],
        )

        return user

    # Auto-generates a username in format FMR-000001, FMR-000002, etc.
    # Since email is the login identifier, the username is just an internal identifier.
    def generate_username(self):
        last_user = User.objects.aggregate(Max("id"))["id__max"] or 0

        return f"FMR-{last_user + 1:06d}"


class CurrentUserSerializer(serializers.Serializer):
    first_name = serializers.CharField()
    last_name = serializers.CharField()
    email = serializers.EmailField()
    role = serializers.CharField(source="role.role_name")

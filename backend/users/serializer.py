from rest_framework import serializers  # type: ignore
from users.models import User, Role
from livestock.models import Farmer, Barangay
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer  # type: ignore
from django.db import transaction
from django.db.models import Max


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
        write_only=True,  # write_only true, because when drf serializes it returns the field. however, this field is on the FARMER table
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

    def generate_username(self):
        last_user = User.objects.aggregate(Max("id"))["id__max"] or 0

        return f"FMR-{last_user + 1:06d}"

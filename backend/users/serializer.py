from rest_framework import serializers  # type: ignore
from users.models import User, Role, UserDocument, Notification
from livestock.models import Farmer, Barangay
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer  # type: ignore
from django.db import transaction
from django.db.models import Max
from django.utils.timesince import timesince
from django.utils import timezone
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
            "id": user.id,  # type: ignore[reportAttributeAccessIssues]
            "email": user.email,
            "role": user.role.role_name,
        }

        return data


class UserDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserDocument
        fields = (
            "id",
            "document_type",
            "document_file",
            "verification_status",
            "uploaded_at",
        )


# Handles farmer registration.
# Accepts fields from both User (email, password, name, phone) and Farmer (barangay, farm_size, address)
# and optional document uploads (government_id, rsbsa_document).
# Creates User + Farmer + UserDocument records atomically inside a transaction.
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
            "government_id",
            "rsbsa_document",
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
    government_id = serializers.FileField(
        required=False, allow_null=True, write_only=True
    )
    rsbsa_document = serializers.FileField(
        required=False, allow_null=True, write_only=True
    )

    @transaction.atomic
    def create(self, validated_data):
        gov_id_file = validated_data.pop("government_id", None)
        rsbsa_file = validated_data.pop("rsbsa_document", None)

        farmer_role, _ = Role.objects.get_or_create(role_name=Role.UserRoles.FARMER)

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

        if gov_id_file:
            UserDocument.objects.create(
                user=user,
                document_type=UserDocument.DocumentType.GOVERNMENT_ID,
                document_file=gov_id_file,
                verification_status=UserDocument.VerificationStatus.PENDING,
            )

        if rsbsa_file:
            UserDocument.objects.create(
                user=user,
                document_type=UserDocument.DocumentType.RSBSA,
                document_file=rsbsa_file,
                verification_status=UserDocument.VerificationStatus.PENDING,
            )

        return user

    # Auto-generates a username in format FMR-000001, FMR-000002, etc.
    # Since email is the login identifier, the username is just an internal identifier.
    def generate_username(self):
        last_user = User.objects.aggregate(Max("id"))["id__max"] or 0

        return f"FMR-{last_user + 1:06d}"


class CurrentUserSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ("id", "first_name", "last_name", "email", "role")

    def get_role(self, obj):
        if hasattr(obj, "role") and obj.role:
            return obj.role.role_name
        if obj.is_superuser or obj.is_staff:
            return "MAO"
        return "FARMER"


class UserManagementSerializer(serializers.ModelSerializer):
    """
    Serializer for MAO user management & pending approvals.
    Exposes essential profile & farmer details without sensitive auth data.
    """
    role = serializers.CharField(source="role.role_name", read_only=True)
    full_name = serializers.SerializerMethodField()
    phone_number = serializers.SerializerMethodField()
    barangay = serializers.SerializerMethodField()
    barangay_id = serializers.SerializerMethodField()
    farm_size = serializers.SerializerMethodField()
    address = serializers.SerializerMethodField()
    cattle_count = serializers.SerializerMethodField()
    documents = UserDocumentSerializer(many=True, read_only=True)

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "full_name",
            "phone_number",
            "role",
            "account_status",
            "created_at",
            "approved_at",
            "barangay",
            "barangay_id",
            "farm_size",
            "address",
            "cattle_count",
            "documents",
        )
        read_only_fields = fields

    def get_full_name(self, obj):
        name = f"{obj.first_name} {obj.last_name}".strip()
        return name if name else obj.username

    def get_phone_number(self, obj):
        return str(obj.phone_number) if obj.phone_number else ""

    def get_barangay(self, obj):
        if hasattr(obj, "farmer_profile") and obj.farmer_profile.barangay:
            return obj.farmer_profile.barangay.barangay_name
        return ""

    def get_barangay_id(self, obj):
        if hasattr(obj, "farmer_profile") and obj.farmer_profile.barangay_id:
            return obj.farmer_profile.barangay_id
        return None

    def get_farm_size(self, obj):
        if hasattr(obj, "farmer_profile") and obj.farmer_profile.farm_size is not None:
            return float(obj.farmer_profile.farm_size)
        return None

    def get_address(self, obj):
        if hasattr(obj, "farmer_profile"):
            return obj.farmer_profile.address
        return ""

    def get_cattle_count(self, obj):
        if hasattr(obj, "farmer_profile"):
            inventories = getattr(obj.farmer_profile, "inventories", None)
            if inventories is not None:
                return sum(inv.quantity for inv in inventories.all())
        return 0


class UserStatusUpdateSerializer(serializers.Serializer):
    """
    Validates status updates submitted by MAO.
    """
    status = serializers.ChoiceField(choices=User.AccountStatus.choices)


class NotificationSerializer(serializers.ModelSerializer):
    type = serializers.CharField(source="notification_type")
    time_ago = serializers.SerializerMethodField()
    type_display = serializers.CharField(source="get_notification_type_display", read_only=True)
    priority_display = serializers.CharField(source="get_priority_display", read_only=True)

    class Meta:
        model = Notification
        fields = (
            "id",
            "type",
            "type_display",
            "priority",
            "priority_display",
            "title",
            "message",
            "is_read",
            "link",
            "created_at",
            "time_ago",
        )
        read_only_fields = ("id", "created_at", "time_ago", "type_display", "priority_display")

    def get_time_ago(self, obj):
        if not obj.created_at:
            return ""
        diff = timezone.now() - obj.created_at
        if diff.total_seconds() < 60:
            return "Just now"
        parts = timesince(obj.created_at).split(",")
        return f"{parts[0]} ago"



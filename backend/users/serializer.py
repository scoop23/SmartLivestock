from rest_framework import serializers  # type: ignore
from users.models import User, Role, UserDocument, Notification
from livestock.models import Farmer, Barangay
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer  # type: ignore
from django.db import transaction
from django.db.models import Max
from django.utils.timesince import timesince
from django.utils import timezone
from typing import cast


class MyTokenSerializer(TokenObtainPairSerializer):
    """
    Returns:
        JWT authentication token response with enriched claims and user payload:
        - access, refresh: Standard JWT tokens with embedded role and email claims
        - user: Dict containing { id, email, role } for immediate client hydration
    Enforces:
        Rejects login if the user's account_status is not APPROVED.
    Used in:
        POST /api/users/login/
    """
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
    """
    Returns:
        Farmer identity or RSBSA accreditation verification document:
        - id: Document primary key
        - document_type: GOVERNMENT_ID or RSBSA
        - document_file: Media upload URL / path
        - verification_status: PENDING, VERIFIED, or REJECTED
        - uploaded_at: Timestamp of submission
    Used in:
        Nested `documents` array inside UserManagementSerializer for MAO review.
    """
    class Meta:
        model = UserDocument
        fields = (
            "id",
            "document_type",
            "document_file",
            "verification_status",
            "uploaded_at",
        )


class RegisterSerializer(serializers.ModelSerializer):
    """
    Accepts & Returns:
        Farmer registration payload that atomically creates User + Farmer + Documents:
        - Accepts: email, password, first_name, last_name, phone_number,
          barangay (ID), farm_size, address, and optional government_id / rsbsa_document files.
        - Returns: Newly created User instance with auto-generated username (e.g. FMR-000042)
          and account_status set to PENDING.
    Used in:
        POST /api/users/register/
    """
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

        from .notification_views import notify_role
        notify_role("MAO", title="Farmer account awaiting approval",
                    message="A new farmer registration is awaiting account review.", link="/user-management")

        return user

    # Auto-generates a username in format FMR-000001, FMR-000002, etc.
    # Since email is the login identifier, the username is just an internal identifier.
    def generate_username(self):
        last_user = User.objects.aggregate(Max("id"))["id__max"] or 0

        return f"FMR-{last_user + 1:06d}"


class CurrentUserSerializer(serializers.ModelSerializer):
    """
    Returns:
        Minimal profile identity for the currently logged-in user:
        - id: User primary key
        - first_name, last_name, email, phone_number
        - role: Resolved role name string (e.g. 'FARMER', 'MAO', 'SIBAT')
        - profile_image: Full URL of uploaded profile photo
        - barangay: Owning barangay name for farmer accounts (read-only)
    Used in:
        GET/PATCH /api/users/me/ for frontend authentication status and route authorization.
    """
    role = serializers.SerializerMethodField()
    profile_image = serializers.SerializerMethodField()
    barangay = serializers.SerializerMethodField()
    assigned_barangay_id = serializers.IntegerField(read_only=True)
    assigned_barangay_name = serializers.CharField(source="assigned_barangay.barangay_name", read_only=True, allow_null=True)

    class Meta:
        model = User
        fields = (
            "id",
            "first_name",
            "last_name",
            "email",
            "role",
            "profile_image",
            "phone_number",
            "barangay",
            "assigned_barangay_id",
            "assigned_barangay_name",
            "access_scope",
        )
        read_only_fields = ("id", "role", "barangay", "access_scope")

    def get_role(self, obj):
        if hasattr(obj, "role") and obj.role:
            return obj.role.role_name
        if obj.is_superuser or obj.is_staff:
            return "MAO"
        return "FARMER"

    def get_profile_image(self, obj):
        if obj.profile_image:
            request = self.context.get("request")
            if request is not None:
                return request.build_absolute_uri(obj.profile_image.url)
            return obj.profile_image.url
        return None

    def get_barangay(self, obj):
        if hasattr(obj, "farmer_profile") and obj.farmer_profile.barangay:
            return obj.farmer_profile.barangay.barangay_name
        return ""


class UserManagementSerializer(serializers.ModelSerializer):
    """
    Returns:
        Comprehensive user & farmer account profile for administrative verification:
        - User Credentials & Status: id, username, email, first_name, last_name, full_name,
          phone_number, role, account_status (PENDING/APPROVED/REJECTED), created_at, approved_at
        - Farmer Demographics: barangay, barangay_id, farm_size (hectares), address
        - Agricultural Scale: cattle_count (sum of all registered animal head count)
        - Verification Evidence: documents (list of UserDocumentSerializer with gov ID & RSBSA files)
    Used in:
        MAO User Management command center (/admin/users).
    """
    role = serializers.CharField(source="role.role_name", read_only=True)
    full_name = serializers.SerializerMethodField()
    profile_image = serializers.SerializerMethodField()
    phone_number = serializers.SerializerMethodField()
    barangay = serializers.SerializerMethodField()
    barangay_id = serializers.SerializerMethodField()
    farm_size = serializers.SerializerMethodField()
    address = serializers.SerializerMethodField()
    cattle_count = serializers.SerializerMethodField()
    assigned_barangay_id = serializers.IntegerField(read_only=True, allow_null=True)
    assigned_barangay_name = serializers.CharField(source="assigned_barangay.barangay_name", read_only=True, allow_null=True)
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
            "profile_image",
            "phone_number",
            "role",
            "account_status",
            "created_at",
            "approved_at",
            "barangay",
            "barangay_id",
            "assigned_barangay_id",
            "assigned_barangay_name",
            "access_scope",
            "farm_size",
            "address",
            "cattle_count",
            "documents",
        )
        read_only_fields = fields

    def get_profile_image(self, obj):
        if obj.profile_image:
            request = self.context.get("request")
            if request is not None:
                return request.build_absolute_uri(obj.profile_image.url)
            return obj.profile_image.url
        return None

    def get_full_name(self, obj):
        name = f"{obj.first_name} {obj.last_name}".strip()
        return name if name else obj.username

    def get_phone_number(self, obj):
        return str(obj.phone_number) if obj.phone_number else ""

    def get_barangay(self, obj):
        if obj.role.role_name == "SIBAT":
            return obj.assigned_barangay.barangay_name if obj.assigned_barangay_id else ""
        if obj.role.role_name != "FARMER":
            return ""
        if hasattr(obj, "farmer_profile") and obj.farmer_profile.barangay:
            return obj.farmer_profile.barangay.barangay_name
        return ""

    def get_barangay_id(self, obj):
        if obj.role.role_name == "SIBAT":
            return obj.assigned_barangay_id
        if obj.role.role_name != "FARMER":
            return None
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
                # Inactive or unapproved animals are not the farmer's current active population.
                return sum(inv.quantity for inv in inventories.all()
                           if inv.status == "APPROVED" and inv.operational_status == "ACTIVE")
        return 0


class UserStatusUpdateSerializer(serializers.Serializer):
    """
    Validates & Accepts:
        Administrative approval or rejection action:
        - status: Target status choice (User.AccountStatus: APPROVED, REJECTED, or PENDING)
    Used in:
        PATCH /api/users/management/<id>/status/ by MAO officers.
    """
    status = serializers.ChoiceField(choices=User.AccountStatus.choices)


class SibatAssignmentSerializer(serializers.Serializer):
    assigned_barangay_id = serializers.PrimaryKeyRelatedField(
        queryset=Barangay.objects.all(), allow_null=True, required=False,
    )
    access_scope = serializers.ChoiceField(choices=User.AccessScope.choices, required=False)

    def validate(self, attrs):
        # Scope and primary barangay are independent; role cannot be edited here.
        if set(self.initial_data) - {"assigned_barangay_id", "access_scope"}:
            raise serializers.ValidationError("Only assigned_barangay_id and access_scope can be changed here.")
        if not attrs:
            raise serializers.ValidationError("Provide a barangay assignment or access scope.")
        return attrs


class NotificationSerializer(serializers.ModelSerializer):
    """
    Returns:
        User notification item with relative timestamp and deep-linking:
        - id: Notification ID
        - type: Category code (e.g. SIBAT, GENERAL, MORTALITY, DISEASE)
        - type_display: Human-readable category label
        - priority, priority_display: Urgency level (LOW, MEDIUM, HIGH)
        - title, message: Alert title and message text
        - is_read: Read status flag
        - link: Relative URL route for click-through navigation
        - created_at, time_ago: Relative time string (e.g. 'Just now', '15m ago')
    Used in:
        Header notification bell, dropdown list, and notification polling.
    """
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



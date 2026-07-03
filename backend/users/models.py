from django.db import models
from django.contrib.auth.models import AbstractUser


# Create your models here.
class User(AbstractUser):
    class AccountStatus(models.TextChoices):
        PENDING = "PENDING", "Pending"
        APPROVED = "APPROVED", "Approved"
        REJECTED = "REJECTED", "Rejected"
        SUSPENDED = "SUSPENDED", "Suspended"

    account_status = models.CharField(
        max_length=20, choices=AccountStatus.choices, default=AccountStatus.PENDING
    )
    email = models.EmailField(unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    role = models.ForeignKey("Role", on_delete=models.PROTECT)

    def __str__(self):
        user_pk = self.pk if self.pk else "New"

        role_info = self.role if hasattr(self, "role") and self.role else "No Role"
        return f"Account {user_pk}. with role: {role_info}!. Account Status: {self.account_status}"


class Role(models.Model):
    class UserRoles(models.TextChoices):
        FARMER = "FARMER", "Farmer"
        MAO = "MAO", "Municipal Agriculturist Office"
        SIBAT = "SIBAT", "Sibat"
        ADMIN = "ADMIN", "Admin"
        # Possible Future Roles
        #

    role_name = models.CharField(max_length=20, choices=UserRoles.choices, unique=True)

    def __str__(self):
        return self.role_name

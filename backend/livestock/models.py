from django.db import models
from phonenumber_field.modelfields import PhoneNumberField  # type: ignore
from django.conf import settings

# Create your models here.


class Barangay(models.Model):
    barangay_name = models.CharField(max_length=255)
    latitude = models.DecimalField(null=False, max_digits=9, decimal_places=6)
    longitude = models.DecimalField(null=False, max_digits=9, decimal_places=6)
    description = models.TextField(null=True, blank=True)

    def __str__(self):
        return f"{self.barangay_name}"


class Farmer(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="farmer_profile",
    )
    barangay = models.ForeignKey(
        "Barangay", on_delete=models.PROTECT, related_name="farmers"
    )
    # removed last name and first name because for each farmer links to a User
    address = models.TextField()
    contact_no = PhoneNumberField(blank=True)
    registered_at = models.DateTimeField(auto_now_add=True, blank=False)

    def __str__(self):
        return f"with User {self.user.username}"

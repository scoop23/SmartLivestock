from django.db import models

# Create your models here.


class Barangay(models.Model):
    barangay_name = models.CharField(max_length=255)
    latitude = models.DecimalField(null=False, max_digits=9, decimal_places=6)
    longitude = models.DecimalField(null=False, max_digits=9, decimal_places=6)
    description = models.TextField(null=True, blank=True)

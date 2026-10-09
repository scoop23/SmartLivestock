from django.db import models


class IndividualMilkDemoCow(models.Model):
    """A synthetic cow used only by the individual-forecast demonstration."""

    demo_id = models.CharField(max_length=40, primary_key=True)
    tag_number = models.CharField(max_length=50, unique=True)
    breed = models.CharField(max_length=80, blank=True, default="")
    sex = models.CharField(max_length=10, default="FEMALE")
    birth_date = models.DateField(null=True, blank=True)
    weight_kg = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    calving_date = models.DateField(null=True, blank=True)
    seed_marker = models.CharField(max_length=80, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["tag_number"]
        verbose_name = "Individual Milk Forecast Demo Cow"


class IndividualMilkDemoObservation(models.Model):
    """Synthetic daily yield and time-aware health flag, isolated from real production."""

    cow = models.ForeignKey(
        IndividualMilkDemoCow,
        on_delete=models.CASCADE,
        related_name="observations",
    )
    record_date = models.DateField()
    milk_quantity_liters = models.DecimalField(max_digits=6, decimal_places=2)
    disease_active = models.BooleanField(default=False)
    seed_marker = models.CharField(max_length=80, db_index=True)

    class Meta:
        ordering = ["record_date", "cow_id"]
        constraints = [
            models.UniqueConstraint(
                fields=["cow", "record_date"],
                name="uniq_demo_cow_milk_observation_day",
            )
        ]

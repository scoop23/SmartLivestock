# Create a dedicated storage boundary for synthetic individual-cow forecasting.
# These records are not production records and cannot enter official aggregates.
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="IndividualMilkDemoCow",
            fields=[
                ("demo_id", models.CharField(max_length=40, primary_key=True, serialize=False)),
                ("tag_number", models.CharField(max_length=50, unique=True)),
                ("breed", models.CharField(blank=True, default="", max_length=80)),
                ("sex", models.CharField(default="FEMALE", max_length=10)),
                ("birth_date", models.DateField(blank=True, null=True)),
                ("weight_kg", models.DecimalField(blank=True, decimal_places=2, max_digits=6, null=True)),
                ("calving_date", models.DateField(blank=True, null=True)),
                ("seed_marker", models.CharField(db_index=True, max_length=80)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={
                "verbose_name": "Individual Milk Forecast Demo Cow",
                "ordering": ["tag_number"],
            },
        ),
        migrations.CreateModel(
            name="IndividualMilkDemoObservation",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("record_date", models.DateField()),
                ("milk_quantity_liters", models.DecimalField(decimal_places=2, max_digits=6)),
                ("disease_active", models.BooleanField(default=False)),
                ("seed_marker", models.CharField(db_index=True, max_length=80)),
                ("cow", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="observations", to="analytics.individualmilkdemocow")),
            ],
            options={"ordering": ["record_date", "cow_id"]},
        ),
        migrations.AddConstraint(
            model_name="individualmilkdemoobservation",
            constraint=models.UniqueConstraint(fields=("cow", "record_date"), name="uniq_demo_cow_milk_observation_day"),
        ),
    ]

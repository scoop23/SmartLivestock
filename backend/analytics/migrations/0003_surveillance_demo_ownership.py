from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("analytics", "0002_monthlyreportdelivery"),
    ]

    operations = [
        migrations.CreateModel(
            name="SurveillanceDemoOwnership",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("identifier", models.CharField(max_length=180, unique=True)),
                ("object_type", models.CharField(max_length=24)),
                ("object_id", models.PositiveBigIntegerField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={"ordering": ["identifier"]},
        ),
        migrations.AddConstraint(
            model_name="surveillancedemoownership",
            constraint=models.UniqueConstraint(
                fields=("object_type", "object_id"),
                name="unique_surveillance_demo_owned_object",
            ),
        ),
    ]

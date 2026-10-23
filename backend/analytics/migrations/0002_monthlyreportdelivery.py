from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [("analytics", "0001_individual_milk_forecast_demo")]

    operations = [
        migrations.CreateModel(
            name="MonthlyReportDelivery",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("period_start", models.DateField(unique=True)),
                ("period_end", models.DateField()),
                ("status", models.CharField(choices=[("GENERATING", "Generating"), ("SENT", "Sent"), ("FAILED", "Failed")], default="GENERATING", max_length=12)),
                ("recipients", models.JSONField(blank=True, default=list)),
                ("started_at", models.DateTimeField(auto_now_add=True)),
                ("sent_at", models.DateTimeField(blank=True, null=True)),
                ("error_summary", models.CharField(blank=True, default="", max_length=500)),
            ],
            options={"ordering": ["-period_start"]},
        ),
    ]

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("diseases", "0009_mortalityrecord_affected_livestock"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="diseasecase", name="clinical_status",
            field=models.CharField(max_length=16, default="NOT_RECORDED", choices=[
                ("NOT_RECORDED", "Resolution not recorded"), ("OPEN", "Awaiting resolution"),
                ("RECOVERED", "Recovered"), ("CLOSED", "Closed"),
            ]),
        ),
        migrations.CreateModel(
            name="DiseaseCaseFollowUp",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("event_type", models.CharField(max_length=16, choices=[("FARMER_UPDATE", "Farmer follow-up"), ("RECOVERED", "Recovered"), ("CLOSED", "Closed")])),
                ("observed_on", models.DateField()),
                ("notes", models.TextField(max_length=2000)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("case", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="follow_ups", to="diseases.diseasecase")),
                ("created_by", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="disease_case_follow_ups", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["created_at", "id"]},
        ),
    ]

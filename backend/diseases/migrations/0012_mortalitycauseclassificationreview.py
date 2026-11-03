from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("diseases", "0011_persist_inspection_details"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="MortalityCauseClassificationReview",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("category", models.CharField(choices=[("SUSPECTED_INFECTIOUS", "Suspected infectious"), ("INJURY_ACCIDENT", "Injury or accident"), ("REPRODUCTIVE_PERINATAL", "Reproductive or perinatal"), ("OTHER_REPORTED_CAUSE", "Other reported cause"), ("UNDETERMINED", "Undetermined")], max_length=32)),
                ("note", models.CharField(blank=True, default="", max_length=1000)),
                ("reviewed_at", models.DateTimeField(auto_now_add=True)),
                ("mortality_record", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="cause_classification_reviews", to="diseases.mortalityrecord")),
                ("reviewer", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="mortality_cause_classification_reviews", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ["-reviewed_at", "-id"],
                "indexes": [models.Index(fields=["mortality_record", "-reviewed_at"], name="mortality_cause_review_idx")],
            },
        ),
    ]

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("analytics", "0003_surveillance_demo_ownership"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="NLPExampleReviewEvent",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("corpus_version", models.CharField(max_length=80)),
                ("example_id", models.CharField(db_index=True, max_length=180)),
                ("decision", models.CharField(choices=[("accepted", "Accepted"), ("rejected", "Rejected")], max_length=12)),
                ("utterance_override", models.CharField(blank=True, default="", max_length=500)),
                ("intent_override", models.CharField(blank=True, default="", max_length=40)),
                ("notes", models.TextField(blank=True, default="")),
                ("reviewed_at", models.DateTimeField(auto_now_add=True)),
                ("reviewer", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="nlp_example_reviews", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["-reviewed_at", "-pk"]},
        ),
        migrations.AddIndex(
            model_name="nlpexamplereviewevent",
            index=models.Index(fields=["corpus_version", "example_id", "-reviewed_at"], name="nlpex_review_latest_idx"),
        ),
    ]

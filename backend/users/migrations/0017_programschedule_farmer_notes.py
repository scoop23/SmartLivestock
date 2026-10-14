from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0016_programschedule_deleted_at"),
    ]

    operations = [
        migrations.AddField(
            model_name="programschedule",
            name="farmer_notes",
            field=models.TextField(blank=True, default="", max_length=1000),
        ),
    ]

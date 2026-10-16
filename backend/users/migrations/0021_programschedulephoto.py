from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0020_programschedule_registration_opens"),
    ]

    operations = [
        migrations.CreateModel(
            name="ProgramSchedulePhoto",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("image", models.ImageField(upload_to="program_images/%Y/%m/gallery/")),
                ("position", models.PositiveIntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("schedule", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="photos", to="users.programschedule")),
            ],
            options={
                "ordering": ["position", "id"],
            },
        ),
    ]

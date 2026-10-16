from django.db import migrations, models


def preserve_existing_program_visibility(apps, schema_editor):
    ProgramSchedule = apps.get_model("users", "ProgramSchedule")
    ProgramSchedule.objects.filter(barangay__isnull=True).update(farmer_audience="ALL_FARMERS")
    ProgramSchedule.objects.filter(barangay__isnull=False).update(farmer_audience="BARANGAY_ONLY")


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0021_programschedulephoto"),
    ]

    operations = [
        migrations.AddField(
            model_name="programschedule",
            name="farmer_audience",
            field=models.CharField(
                choices=[
                    ("BARANGAY_ONLY", "Farmers in this barangay"),
                    ("ALL_FARMERS", "All farmers across barangays"),
                ],
                default="",
                max_length=20,
            ),
        ),
        migrations.RunPython(preserve_existing_program_visibility, migrations.RunPython.noop),
    ]

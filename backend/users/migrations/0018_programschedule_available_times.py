from django.db import migrations, models


DEFAULT_PROGRAM_TIMES = ["08:00", "09:30", "11:00", "13:30"]


def add_default_times_to_existing_schedules(apps, schema_editor):
    ProgramSchedule = apps.get_model("users", "ProgramSchedule")
    ProgramSchedule.objects.filter(available_times=[]).update(available_times=DEFAULT_PROGRAM_TIMES)


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0017_programschedule_farmer_notes"),
    ]

    operations = [
        migrations.AddField(
            model_name="programschedule",
            name="available_times",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.RunPython(add_default_times_to_existing_schedules, migrations.RunPython.noop),
    ]

from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0022_programschedule_farmer_audience"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="announcement",
            name="schedule",
        ),
    ]

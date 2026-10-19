from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0023_remove_announcement_program_schedule"),
    ]

    operations = [
        migrations.RemoveConstraint(
            model_name="programschedule",
            name="program_capacity_at_least_one",
        ),
        migrations.AddConstraint(
            model_name="programschedule",
            constraint=models.CheckConstraint(
                condition=models.Q(capacity__gte=0),
                name="program_capacity_nonnegative",
            ),
        ),
    ]

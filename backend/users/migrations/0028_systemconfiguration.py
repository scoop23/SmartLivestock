from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("users", "0027_pushsubscription"),
    ]

    operations = [
        migrations.CreateModel(
            name="SystemConfiguration",
            fields=[
                ("id", models.PositiveSmallIntegerField(default=1, editable=False, primary_key=True, serialize=False)),
                ("browser_push_enabled", models.BooleanField(default=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("updated_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="system_configuration_updates", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "verbose_name": "system configuration",
                "verbose_name_plural": "system configuration",
            },
        ),
        migrations.CreateModel(
            name="SystemConfigurationChange",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("setting_name", models.CharField(max_length=80)),
                ("old_value", models.CharField(max_length=255)),
                ("new_value", models.CharField(max_length=255)),
                ("changed_at", models.DateTimeField(auto_now_add=True)),
                ("changed_by", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="system_configuration_changes", to=settings.AUTH_USER_MODEL)),
                ("configuration", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="change_history", to="users.systemconfiguration")),
            ],
            options={"ordering": ["-changed_at", "-pk"]},
        ),
    ]

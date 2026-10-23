from django.db import migrations


def add_carabao_type(apps, schema_editor):
    LivestockType = apps.get_model("livestock", "LivestockType")
    LivestockType.objects.get_or_create(
        name="Carabao",
        defaults={"description": "Carabao (Kalabaw)"},
    )


class Migration(migrations.Migration):

    dependencies = [
        ("livestock", "0026_livestockbatchphoto"),
    ]

    operations = [
        migrations.RunPython(add_carabao_type, migrations.RunPython.noop),
    ]

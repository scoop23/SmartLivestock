from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("livestock", "0035_inventory_scope")]
    operations = [
        migrations.AlterField(
            model_name="livestockgateverification", name="verified_at",
            field=models.DateTimeField(auto_now_add=True, db_index=True),
        ),
    ]

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("livestock", "0020_ownership_transfer_external_party"),
    ]

    operations = [
        migrations.AddField(
            model_name="livestockinventory",
            name="birth_date",
            field=models.DateField(
                blank=True,
                help_text="Date of birth. Optional for legacy records where the birth date is unknown.",
                null=True,
            ),
        ),
    ]

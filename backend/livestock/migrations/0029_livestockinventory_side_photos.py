from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("livestock", "0028_livestockinventoryreviewhistory"),
    ]

    operations = [
        migrations.AddField(
            model_name="livestockinventory",
            name="left_side_photo",
            field=models.ImageField(
                blank=True,
                help_text="Left-side identification photo of the animal.",
                null=True,
                upload_to="livestock_photos/%Y/%m/",
            ),
        ),
        migrations.AddField(
            model_name="livestockinventory",
            name="right_side_photo",
            field=models.ImageField(
                blank=True,
                help_text="Right-side identification photo of the animal.",
                null=True,
                upload_to="livestock_photos/%Y/%m/",
            ),
        ),
    ]

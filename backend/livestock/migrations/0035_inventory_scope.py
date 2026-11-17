from django.db import migrations, models


def classify_outside_inventory(apps, schema_editor):
    Farmer = apps.get_model("livestock", "Farmer")
    Inventory = apps.get_model("livestock", "LivestockInventory")
    alias = schema_editor.connection.alias
    # Identify only the system placeholder created by the outside gate workflow.
    external_farmers = Farmer.objects.using(alias).filter(
        user__email="outside-farmer@smartlivestock.local",
        rsbsa_number="EXTERNAL-NON-RESIDENT",
    )
    external_farmers.update(is_external=True)
    # The placeholder also identifies old rows whose certificate metadata was
    # cleared when their certificate number or photo changed.
    Inventory.objects.using(alias).filter(
        models.Q(certificate_verification__is_outside_farmer=True)
        | models.Q(farmer_id__in=external_farmers.values("pk"))
    ).update(inventory_scope="EXTERNAL")


class Migration(migrations.Migration):
    dependencies = [("livestock", "0034_inventory_review_inspection_photo")]

    operations = [
        migrations.AddField(
            model_name="farmer",
            name="is_external",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="livestockinventory",
            name="inventory_scope",
            field=models.CharField(
                choices=[("LOCAL", "Local livestock"), ("EXTERNAL", "Outside auction livestock")],
                default="LOCAL", max_length=10,
            ),
        ),
        migrations.RunPython(classify_outside_inventory, migrations.RunPython.noop),
    ]

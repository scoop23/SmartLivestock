import re

from django.db import migrations, models
from django.conf import settings
from django.db.models import Count, Q
import django.db.models.deletion


def backfill_milk_session_and_approval(apps, schema_editor):
    ProductionRecord = apps.get_model("production", "ProductionRecord")
    database = schema_editor.connection.alias
    rows = list(
        ProductionRecord.objects.using(database)
        .only("id", "notes", "production_type", "milking_session", "session_conflict", "status", "reviewed_at", "approved_at")
    )
    changed = []
    for row in rows:
        if row.production_type == "MILK" and row.milking_session is None:
            match = re.match(r"^\s*\[(Morning|Afternoon|Evening)\]\s*", row.notes or "", re.IGNORECASE)
            if match:
                row.milking_session = match.group(1).upper()
                row.notes = (row.notes or "")[match.end():]
        # Existing reviewed_at is a valid approval time only for a currently
        # approved row, because that workflow wrote it at the approval action.
        if row.status == "APPROVED" and row.reviewed_at and row.approved_at is None:
            row.approved_at = row.reviewed_at
        changed.append(row)
    ProductionRecord.objects.using(database).bulk_update(
        changed, ["milking_session", "notes", "approved_at"]
    )

    # Legacy same-session duplicates cannot be safely resolved by choosing a
    # winner. Preserve both rows, mark them ambiguous, and keep them out of
    # duplicate-sensitive analytics and the new uniqueness constraints.
    keys = (
        ProductionRecord.objects.using(database)
        .filter(production_type="MILK", milking_session__isnull=False)
        .values("livestock_id", "batch_id", "record_date", "milking_session")
        .annotate(row_count=Count("pk"))
        .filter(row_count__gt=1)
    )
    for key in keys.iterator():
        ProductionRecord.objects.using(database).filter(
            production_type="MILK",
            livestock_id=key["livestock_id"],
            batch_id=key["batch_id"],
            record_date=key["record_date"],
            milking_session=key["milking_session"],
        ).update(session_conflict=True)


class Migration(migrations.Migration):
    # The data backfill updates rows before creating partial unique indexes.
    # Keep those operations in separate transactions so PostgreSQL can flush
    # deferred FK trigger events before the indexes are created.
    atomic = False

    dependencies = [
        ("production", "0016_milkanomalydemoownership"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="productionrecord",
            name="milking_session",
            field=models.CharField(
                blank=True,
                choices=[("MORNING", "Morning Session (6:00 AM)"),
                         ("AFTERNOON", "Afternoon Session (2:00 PM)"),
                         ("EVENING", "Evening Session (6:00 PM)")],
                max_length=12,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="productionrecord",
            name="session_conflict",
            field=models.BooleanField(db_index=True, default=False),
        ),
        migrations.AddField(
            model_name="productionrecord",
            name="approved_at",
            field=models.DateTimeField(blank=True, db_index=True, null=True),
        ),
        migrations.CreateModel(
            name="ProductionRecordWorkflowEvent",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("event_type", models.CharField(choices=[("SUBMITTED", "Submitted"), ("RESUBMITTED", "Resubmitted"), ("VERIFIED", "Verified"), ("APPROVED", "Approved"), ("RETURNED", "Returned for revision")], max_length=16)),
                ("from_status", models.CharField(blank=True, max_length=25)),
                ("to_status", models.CharField(max_length=25)),
                ("remarks", models.TextField(blank=True)),
                ("snapshot", models.JSONField(blank=True, default=dict)),
                ("occurred_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("actor", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to=settings.AUTH_USER_MODEL)),
                ("production_record", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="workflow_events", to="production.productionrecord")),
            ],
            options={"ordering": ("occurred_at", "pk")},
        ),
        # Commit the backfill before adding partial unique indexes. PostgreSQL
        # cannot create those indexes in a transaction that still has pending
        # trigger events from the row updates above.
        migrations.RunPython(
            backfill_milk_session_and_approval,
            migrations.RunPython.noop,
            atomic=False,
        ),
        migrations.AddConstraint(
            model_name="productionrecord",
            constraint=models.UniqueConstraint(
                condition=Q(production_type="MILK", milking_session__isnull=False,
                            session_conflict=False, livestock__isnull=False),
                fields=("livestock", "record_date", "milking_session"),
                name="unique_milk_animal_date_session",
            ),
        ),
        migrations.AddConstraint(
            model_name="productionrecord",
            constraint=models.UniqueConstraint(
                condition=Q(production_type="MILK", milking_session__isnull=False,
                            session_conflict=False, batch__isnull=False),
                fields=("batch", "record_date", "milking_session"),
                name="unique_milk_batch_date_session",
            ),
        ),
    ]

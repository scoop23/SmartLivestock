from django.db import transaction
from urllib.parse import quote

from users.models import Notification
from users.notification_views import create_notification


def notify_breeding_owner(record, *, title, message, priority=Notification.Priority.MEDIUM, reminder_key=None):
    """Send a breeding notice to the livestock owner, never to a review queue."""
    with transaction.atomic():
        # Serialize reminder creation for this breeding record. This prevents
        # two overlapping daily scheduler runs from both passing the existence check.
        record = type(record).objects.select_for_update(of=("self",)).select_related(
            "dam__farmer__user", "dam__livestock_type"
        ).get(pk=record.pk)
        if reminder_key and record.status != "PREGNANT":
            return None
        owner = record.dam.farmer.user
        entity_type = "breeding_record"
        if reminder_key:
            # Include the expected date so a corrected breeding date can get a new reminder.
            due_key = record.expected_due_date.strftime("%Y%m%d") if record.expected_due_date else "unknown"
            entity_type = f"breeding_due_{reminder_key}_{due_key}"[:50]
        if reminder_key and Notification.objects.filter(
            user=owner,
            related_entity_type=entity_type,
            related_entity_id=record.pk,
        ).exists():
            return None
        species = quote(record.dam.livestock_type.name or "ALL", safe="")
        return create_notification(
            user=owner,
            notification_type=Notification.NotificationType.PRODUCTION,
            priority=priority,
            title=title,
            message=message,
            link=f"/production-dashboard/{species}?activity=breeding&breedingRecordId={record.pk}",
            related_entity_type=entity_type,
            related_entity_id=record.pk,
        )


def send_breeding_due_reminders(*, today):
    """Create one farmer reminder at each due-date window; safe to run daily."""
    from datetime import timedelta

    from production.models import BreedingRecord

    sent = 0
    record_ids = list(BreedingRecord.objects.filter(
        status=BreedingRecord.BreedingStatus.PREGNANT,
        expected_due_date__isnull=False,
        expected_due_date__lte=today + timedelta(days=30),
        expected_due_date__gte=today - timedelta(days=30),
    ).values_list("pk", flat=True))

    for record_id in record_ids:
        with transaction.atomic():
            record = (
                BreedingRecord.objects.select_for_update(of=("self",))
                .select_related("dam__farmer__user", "dam__livestock_type")
                .filter(
                    pk=record_id,
                    status=BreedingRecord.BreedingStatus.PREGNANT,
                    expected_due_date__lte=today + timedelta(days=30),
                    expected_due_date__gte=today - timedelta(days=30),
                )
                .first()
            )
            if not record:
                continue
            days = (record.expected_due_date - today).days
            if 8 <= days <= 30:
                key = "30"
                title = "Dam expected to calve within 30 days"
                message = f"{record.dam.tag_number or 'Your dam'} is expected to calve on {record.expected_due_date:%b %d, %Y} (about {days} days from now)."
                priority = Notification.Priority.LOW
            elif 1 <= days <= 7:
                key = "7"
                title = "Dam expected to calve within 7 days"
                message = f"{record.dam.tag_number or 'Your dam'} is expected to calve on {record.expected_due_date:%b %d, %Y} (about {days} days from now)."
                priority = Notification.Priority.MEDIUM
            elif days == 0:
                key = "today"
                title = "Dam expected to calve today"
                message = f"{record.dam.tag_number or 'Your dam'} has an estimated due date of today, {record.expected_due_date:%b %d, %Y}. Contact your veterinarian or livestock technician if needed."
                priority = Notification.Priority.HIGH
            else:
                key = "overdue"
                title = "Dam is past the estimated due date"
                message = f"{record.dam.tag_number or 'Your dam'} passed the estimated due date of {record.expected_due_date:%b %d, %Y}. Update the breeding record when the outcome is known."
                priority = Notification.Priority.MEDIUM

            notification = notify_breeding_owner(
                record,
                title=title,
                message=message,
                priority=priority,
                reminder_key=key,
            )
            sent += notification is not None

    return sent

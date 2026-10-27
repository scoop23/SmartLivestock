from django.core.management.base import BaseCommand
from django.utils import timezone

from production.services.breeding_notifications import send_breeding_due_reminders


class Command(BaseCommand):
    help = "Send once-per-window in-app reminders to farmers with confirmed pregnancies nearing the estimated due date."

    def handle(self, *args, **options):
        sent = send_breeding_due_reminders(today=timezone.localdate())
        self.stdout.write(self.style.SUCCESS(f"Created {sent} breeding due reminder(s)."))

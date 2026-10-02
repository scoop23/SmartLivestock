"""Explicit setup for existing reviewers; never infer staff jurisdiction from logs."""
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from livestock.models import Barangay
from users.models import User


class Command(BaseCommand):
    help = "Assign an existing SIBAT account to an explicitly named barangay."

    def add_arguments(self, parser):
        parser.add_argument("--username", required=True)
        parser.add_argument("--barangay", required=True)

    @transaction.atomic
    def handle(self, *args, **options):
        try:
            user = User.objects.select_for_update().get(username=options["username"], role__role_name="SIBAT")
            barangay = Barangay.objects.get(barangay_name__iexact=options["barangay"])
        except User.DoesNotExist:
            raise CommandError("No SIBAT account matches that username.")
        except Barangay.DoesNotExist:
            raise CommandError("No barangay matches that name.")
        except Barangay.MultipleObjectsReturned:
            raise CommandError("Barangay name is ambiguous; correct the duplicate names first.")
        # Only the explicit staff assignment changes; farmer ownership and logs stay intact.
        user.assigned_barangay = barangay
        user.save(update_fields=["assigned_barangay"])
        self.stdout.write(self.style.SUCCESS(f"Assigned {user.username} to {barangay.barangay_name}. Refresh the SIBAT portal."))

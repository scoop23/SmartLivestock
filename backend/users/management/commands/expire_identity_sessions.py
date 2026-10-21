"""Explicit, policy-controlled cleanup. Dry run unless --execute is supplied."""
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone
from users.models import IdentityVerificationAttempt as Attempt, IdentityVerificationEvent as Event
from users.identity_service import provider_request, ProviderUnavailable


class Command(BaseCommand):
    help = "Expire provider sessions past configured retention; retains minimal audit records and existing ID documents."

    def add_arguments(self, parser):
        parser.add_argument("--execute", action="store_true")

    def handle(self, *args, **options):
        attempts = Attempt.objects.filter(retention_due_at__lte=timezone.now(), retention_hold=False,
                                          provider_deleted_at__isnull=True)
        self.stdout.write(f"{attempts.count()} verification attempts due for cleanup.")
        if not options["execute"]:
            self.stdout.write("Dry run; nothing deleted. Establish the retention policy before using --execute.")
            return
        if not settings.DIDIT_API_KEY or not settings.IDENTITY_PROVIDER_PRIVACY_CONFIRMED:
            raise CommandError("Provider credentials and reviewed retention configuration are required.")
        for attempt in attempts:
            if not attempt.provider_session_id and attempt.consent_at:
                raise CommandError("A provider creation outcome is unknown. Reconcile the opaque attempt reference in the provider console before cleanup; audit retained.")
            if attempt.provider_session_id:
                try:
                    result = provider_request("DELETE", f"session/{attempt.provider_session_id}/delete/", {
                        "retain_face_embeddings": False, "instruction_id": f"registration-expiry-{attempt.pk}",
                    })
                    if str(result.get("session_id")) != str(attempt.provider_session_id) or result.get("face_retention_outcome") not in ("deleted", "none", "ineligible_no_vendor_user"):
                        raise ProviderUnavailable()
                except ProviderUnavailable:
                    raise CommandError("Provider deletion was not confirmed; audit references were retained. Retry later.") from None
            # Never delete the original ID or the human approval history here.
            attempt.provider_deleted_at = timezone.now()
            attempt.provider_session_id = None
            attempt.document_result = attempt.face_result = attempt.liveness_result = "NOT_RETAINED"
            attempt.state = Attempt.State.REVIEW_REQUIRED
            attempt.save()
            Event.objects.create(attempt=attempt, state="PROVIDER_DATA_EXPIRED")
        self.stdout.write("Cleanup requests completed. Confirm provider erasure outcomes under the agreed policy.")

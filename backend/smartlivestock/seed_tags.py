"""Allocate normal owner-name ear tags and COLC numbers for registered seed animals."""
import re

from django.utils import timezone

from livestock.models import LivestockInventory, LivestockOwnershipTransfer
from livestock.serializer import livestock_tag_prefix_for_user


def next_seed_livestock_tag(command, user):
    """Include unsaved bulk rows in the sequence as well as existing records."""
    prefix = livestock_tag_prefix_for_user(user)
    if not prefix:
        raise ValueError("An owner name is required to generate a livestock tag.")
    if not hasattr(command, "_seed_tag_sequences"):
        command._seed_tag_sequences = {}
    sequences = command._seed_tag_sequences
    if prefix not in sequences:
        pattern = re.compile(rf"^{re.escape(prefix)}-(\d{{3,}})$", re.IGNORECASE)
        tags = LivestockInventory.objects.filter(
            tag_number__istartswith=f"{prefix}-",
        ).values_list("tag_number", flat=True)
        sequences[prefix] = max(
            (int(match.group(1)) for tag in tags if (match := pattern.fullmatch(tag.strip()))),
            default=0,
        )
    sequences[prefix] += 1
    return f"{prefix}-{sequences[prefix]:03d}"


def generate_unique_colc_number(inventory=None, reference_date=None) -> str:
    """Generate a unique COLC number (COLC-YYYY-XXXXXX) for an approved animal."""
    year = reference_date.year if reference_date is not None else timezone.localdate().year
    prefix = f"COLC-{year}"
    if inventory is not None and getattr(inventory, "pk", None):
        candidate = f"{prefix}-{inventory.pk:06d}"
        if not LivestockInventory.objects.filter(
            ownership_certificate_number__iexact=candidate
        ).exclude(pk=inventory.pk).exists():
            return candidate

    pattern = re.compile(rf"^{re.escape(prefix)}-(\d+)$", re.IGNORECASE)
    existing = LivestockInventory.objects.filter(
        ownership_certificate_number__istartswith=f"{prefix}-",
    ).values_list("ownership_certificate_number", flat=True)
    max_seq = max(
        (int(m.group(1)) for cert in existing if (m := pattern.fullmatch(cert.strip()))),
        default=0,
    )
    seq = max_seq + 1
    while True:
        candidate = f"{prefix}-{seq:06d}"
        if not LivestockInventory.objects.filter(ownership_certificate_number__iexact=candidate).exists():
            return candidate
        seq += 1


def next_seed_colc_number(command, reference_date=None) -> str:
    """Allocate unique sequential COLC numbers across unsaved bulk seed rows and existing DB rows."""
    year = reference_date.year if reference_date is not None else timezone.localdate().year
    prefix = f"COLC-{year}"
    if not hasattr(command, "_seed_colc_sequences"):
        command._seed_colc_sequences = {}
    if not hasattr(command, "_seed_colc_existing"):
        command._seed_colc_existing = {}
    sequences = command._seed_colc_sequences
    existing_map = command._seed_colc_existing
    if prefix not in sequences:
        pattern = re.compile(rf"^{re.escape(prefix)}-(\d+)$", re.IGNORECASE)
        certs = list(
            LivestockInventory.objects.filter(
                ownership_certificate_number__istartswith=f"{prefix}-",
            ).values_list("ownership_certificate_number", flat=True)
        )
        existing_map[prefix] = {c.strip().upper() for c in certs if c}
        sequences[prefix] = max(
            (int(match.group(1)) for cert in certs if (match := pattern.fullmatch(cert.strip()))),
            default=0,
        )
    while True:
        sequences[prefix] += 1
        candidate = f"{prefix}-{sequences[prefix]:06d}"
        if candidate.upper() not in existing_map[prefix]:
            existing_map[prefix].add(candidate.upper())
            return candidate


def generate_unique_transfer_certificate_number(reference_date=None) -> str:
    """Generate a unique transfer certificate number (BTG-YYYY-XXXXXX) for an ownership transfer (Accountable Form No. 52)."""
    year = reference_date.year if reference_date is not None else timezone.localdate().year
    prefix = f"BTG-{year}"
    pattern = re.compile(rf"^{re.escape(prefix)}-(\d+)$", re.IGNORECASE)
    existing = LivestockOwnershipTransfer.objects.filter(
        transfer_certificate_number__istartswith=f"{prefix}-",
    ).values_list("transfer_certificate_number", flat=True)
    max_seq = max(
        (int(m.group(1)) for cert in existing if (m := pattern.fullmatch(cert.strip()))),
        default=0,
    )
    seq = max_seq + 1
    while True:
        candidate = f"{prefix}-{seq:06d}"
        if not LivestockOwnershipTransfer.objects.filter(transfer_certificate_number__iexact=candidate).exists():
            return candidate
        seq += 1


def next_seed_transfer_certificate_number(command, reference_date=None) -> str:
    """Allocate unique sequential transfer certificate numbers across unsaved bulk seed rows and existing DB rows."""
    year = reference_date.year if reference_date is not None else timezone.localdate().year
    prefix = f"BTG-{year}"
    if not hasattr(command, "_seed_transfer_sequences"):
        command._seed_transfer_sequences = {}
    if not hasattr(command, "_seed_transfer_existing"):
        command._seed_transfer_existing = {}
    sequences = command._seed_transfer_sequences
    existing_map = command._seed_transfer_existing
    if prefix not in sequences:
        pattern = re.compile(rf"^{re.escape(prefix)}-(\d+)$", re.IGNORECASE)
        certs = list(
            LivestockOwnershipTransfer.objects.filter(
                transfer_certificate_number__istartswith=f"{prefix}-",
            ).values_list("transfer_certificate_number", flat=True)
        )
        existing_map[prefix] = {c.strip().upper() for c in certs if c}
        sequences[prefix] = max(
            (int(match.group(1)) for cert in certs if (match := pattern.fullmatch(cert.strip()))),
            default=0,
        )
    while True:
        sequences[prefix] += 1
        candidate = f"{prefix}-{sequences[prefix]:06d}"
        if candidate.upper() not in existing_map[prefix]:
            existing_map[prefix].add(candidate.upper())
            return candidate


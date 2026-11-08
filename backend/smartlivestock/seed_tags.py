"""Allocate normal owner-name ear tags for registered seed animals."""
import re

from livestock.models import LivestockInventory
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

"""Shared municipality-level movement direction labels for GIS and reports."""

import re


def _is_local_place(value, local_barangays):
    value = (value or "").strip().lower()
    if "padre garcia" in value:
        return True
    return any(
        re.search(rf"(?<!\w){re.escape(name.lower())}(?!\w)", value)
        for name in local_barangays
    )


def classify_movement_direction(origin, destination, local_barangays):
    """Classify a movement relative to Padre Garcia; unknown text stays unknown."""
    origin_local = _is_local_place(origin, local_barangays)
    destination_local = _is_local_place(destination, local_barangays)
    if origin_local and destination_local:
        return "INTERNAL"
    if destination_local:
        return "INBOUND"
    if origin_local:
        return "OUTBOUND"
    return "UNKNOWN"

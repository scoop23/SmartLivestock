"""Shared authorization and state-transition rules for core livestock records."""

from dataclasses import dataclass

from rest_framework.exceptions import PermissionDenied, ValidationError


FARMER = "FARMER"
SIBAT = "SIBAT"
MAO = "MAO"
AUCTION = "AUCTION"
ADMIN = "ADMIN"


ROLE_MATRIX = {
    "disease": {"create": {FARMER}, "read_all": {SIBAT, MAO, ADMIN}, "edit_own": {FARMER}, "review": {SIBAT, MAO, ADMIN}},
    "mortality": {"create": {FARMER}, "read_all": {SIBAT, MAO, ADMIN}, "edit_own": {FARMER}, "review": {SIBAT, MAO, ADMIN}},
    "production": {"create": {FARMER}, "read_all": {SIBAT, MAO, ADMIN}, "review": {SIBAT, MAO, ADMIN}},
    "inventory": {"create": {FARMER}, "read_all": {SIBAT, MAO, ADMIN}, "review": {SIBAT, MAO, ADMIN}, "edit_own": {FARMER}},
    "sales": {"create": {FARMER}, "read_all": {SIBAT, MAO, ADMIN, AUCTION}, "review": {SIBAT, MAO, ADMIN}, "delete_own": {FARMER}},
    "calving": {"create": {FARMER}, "read_all": {SIBAT, MAO, ADMIN}, "review": {SIBAT, MAO, ADMIN}},
    "batches": {"create": {FARMER}, "read_all": {SIBAT, MAO, ADMIN}, "review": {SIBAT, MAO, ADMIN}, "edit_own": {FARMER}},
    "census": {"create": {SIBAT}, "read_all": {SIBAT, MAO, ADMIN}, "review": {MAO, ADMIN}, "edit_own": {SIBAT}},
    "inspections": {"create": {FARMER, AUCTION, MAO, ADMIN}, "read_all": {AUCTION, MAO, ADMIN, SIBAT}, "edit_own": {FARMER, AUCTION}, "review": {MAO, ADMIN}, "delete_own": {AUCTION, MAO, ADMIN}},
    "ownership_transfers": {"create": {FARMER}, "read_all": {SIBAT, MAO, ADMIN}, "review": {SIBAT, MAO, ADMIN}},
}


@dataclass(frozen=True)
class TransitionRule:
    role: str
    current: str
    targets: frozenset[str]


REVIEW_TRANSITIONS: dict[str, tuple[TransitionRule, ...]] = {
    domain: (
        TransitionRule(SIBAT, "PENDING", frozenset({"VERIFIED", "SUBJECT_TO_REVISION"})),
        TransitionRule(MAO, "VERIFIED", frozenset({"APPROVED", "SUBJECT_TO_REVISION"})),
        TransitionRule(ADMIN, "VERIFIED", frozenset({"APPROVED", "SUBJECT_TO_REVISION"})),
    )
    for domain in ("inventory", "sales", "calving", "batches", "disease", "mortality", "ownership_transfers")
}

# Production declarations use the same field-verification and municipal-approval steps.
REVIEW_TRANSITIONS["production"] = REVIEW_TRANSITIONS["inventory"]

# Census has a single transition rule (SIBAT is the source, so a census is born
# VERIFIED when submitted and only awaits MAO certification).
REVIEW_TRANSITIONS["census"] = (
    TransitionRule(MAO, "VERIFIED", frozenset({"APPROVED", "SUBJECT_TO_REVISION"})),
    TransitionRule(ADMIN, "VERIFIED", frozenset({"APPROVED", "SUBJECT_TO_REVISION"})),
)

# Auction submissions go straight to MAO. VERIFIED remains reviewable for legacy records.
REVIEW_TRANSITIONS["inspections"] = (
    # Auction can record/forward intake; only MAO/Admin make the official decision.
    TransitionRule(AUCTION, "PENDING", frozenset({"VERIFIED"})),
    TransitionRule(MAO, "PENDING", frozenset({"APPROVED", "SUBJECT_TO_REVISION"})),
    TransitionRule(ADMIN, "PENDING", frozenset({"APPROVED", "SUBJECT_TO_REVISION"})),
    TransitionRule(MAO, "VERIFIED", frozenset({"APPROVED", "SUBJECT_TO_REVISION"})),
    TransitionRule(ADMIN, "VERIFIED", frozenset({"APPROVED", "SUBJECT_TO_REVISION"})),
)


BATCH_LIFECYCLE_TRANSITIONS = {
    "ACTIVE": frozenset({"ACTIVE", "HARVESTED", "SOLD"}),
    "HARVESTED": frozenset({"HARVESTED", "ARCHIVED"}),
    "SOLD": frozenset({"SOLD", "ARCHIVED"}),
    "ARCHIVED": frozenset({"ARCHIVED"}),
}


def role_name(user) -> str:
    return getattr(getattr(user, "role", None), "role_name", "").upper()


def require_action(user, domain: str, action: str) -> str:
    role = role_name(user)
    if role not in ROLE_MATRIX.get(domain, {}).get(action, set()):
        raise PermissionDenied(
            f"The {role or 'unassigned'} role cannot {action.replace('_', ' ')} {domain} records."
        )
    return role


def valid_review_targets(domain: str, role: str, current: str) -> set[str]:
    for rule in REVIEW_TRANSITIONS.get(domain, ()):
        if rule.role == role and rule.current == current:
            return set(rule.targets)
    return set()


def validate_review_transition(*, domain: str, role: str, current: str, target: str, remarks: str = "") -> None:
    valid_targets = valid_review_targets(domain, role, current)
    if target not in valid_targets:
        allowed = ", ".join(sorted(valid_targets)) or "none"
        raise ValidationError(
            {"status": f"The {role} role cannot move this {domain} record from {current} to {target}. Allowed next statuses: {allowed}."}
        )
    if target == "SUBJECT_TO_REVISION" and not remarks.strip():
        raise ValidationError({"remarks": "Remarks are required when returning a record for revision."})


def validate_batch_lifecycle(current: str, target: str) -> None:
    allowed_targets = BATCH_LIFECYCLE_TRANSITIONS.get(current, frozenset())
    if target not in allowed_targets:
        allowed = ", ".join(sorted(allowed_targets)) or "none"
        raise ValidationError(
            {"status": f"Batch status cannot move from {current} to {target}. Allowed next statuses: {allowed}."}
        )


def has_all_barangay_access(user):
    """Scope expands operational access without changing role or approval authority."""
    return role_name(user) in (SIBAT, "CBAT") and getattr(user, "access_scope", None) == "ALL_BARANGAYS"


def reviewer_barangay_condition(user, *paths):
    from django.db.models import Q
    condition = Q(pk__in=[])
    if getattr(user, "assigned_barangay_id", None) is not None:
        for path in paths:
            condition |= Q(**{path: user.assigned_barangay_id})
    return condition


def scope_reviewer_queryset(queryset, user):
    """Apply the same SIBAT/CBAT jurisdiction to lists, details, reviews and aggregates."""
    if role_name(user) not in (SIBAT, "CBAT") or has_all_barangay_access(user):
        return queryset
    paths = {
        "LivestockInventory": ("farmer__barangay_id",),
        "LivestockBatch": ("farmer__barangay_id",),
        "Farmer": ("barangay_id",),
        "CensusSubmission": ("barangay_id",),
        "CensusSubmissionItem": ("census_submission__barangay_id",),
        "Barangay": ("id",),
        "ProgramBooking": ("farmer__farmer_profile__barangay_id",),
        "SlaughterRecord": ("livestock__farmer__barangay_id", "batch__farmer__barangay_id"),
        "ProductionRecord": ("farmer_at_record__barangay_id",),
        "LiveAnimalSale": ("livestock__farmer__barangay_id", "batch__farmer__barangay_id"),
        "DiseaseCase": ("livestock__farmer__barangay_id", "batch__farmer__barangay_id"),
        "MortalityRecord": ("livestock__farmer__barangay_id", "batch__farmer__barangay_id"),
        "CalvingRecord": ("dam__farmer__barangay_id",),
        "WeightRecord": ("livestock__farmer__barangay_id",),
        "AnimalDisposition": ("livestock__farmer__barangay_id",),
        "LivestockOwnershipTransfer": ("previous_owner__barangay_id", "new_owner__barangay_id"),
        "LivestockInspection": ("shipper__barangay_id",),
        "LivestockInspectionClearance": ("inspection__shipper__barangay_id",),
    }
    if queryset.model.__name__ not in paths:
        return queryset.none()
    return queryset.filter(reviewer_barangay_condition(user, *paths[queryset.model.__name__]))

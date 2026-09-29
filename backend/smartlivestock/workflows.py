"""Shared authorization and state-transition rules for core livestock records."""

from dataclasses import dataclass

from rest_framework.exceptions import PermissionDenied, ValidationError


FARMER = "FARMER"
SIBAT = "SIBAT"
MAO = "MAO"
AUCTION = "AUCTION"


ROLE_MATRIX = {
    "inventory": {"create": {FARMER}, "read_all": {SIBAT, MAO}, "review": {SIBAT, MAO}, "edit_own": {FARMER}},
    "sales": {"create": {FARMER}, "read_all": {SIBAT, MAO, AUCTION}, "review": {SIBAT, MAO}, "delete_own": {FARMER}},
    "calving": {"create": {FARMER}, "read_all": {SIBAT, MAO}, "review": {SIBAT, MAO}},
    "batches": {"create": {FARMER}, "read_all": {SIBAT, MAO}, "review": {SIBAT, MAO}, "edit_own": {FARMER}},
    "census": {"create": {SIBAT}, "read_all": {SIBAT, MAO}, "review": {MAO}, "edit_own": {SIBAT}},
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
    )
    for domain in ("inventory", "sales", "calving", "batches")
}
# Census only has a single transition rule; tuple of length 1 is allowed by the ellipsis type.
REVIEW_TRANSITIONS["census"] = (
    TransitionRule(MAO, "PENDING", frozenset({"APPROVED", "SUBJECT_TO_REVISION"})),
)


BATCH_LIFECYCLE_TRANSITIONS = {
    "ACTIVE": frozenset({"ACTIVE", "HARVESTED", "SOLD"}),
    "HARVESTED": frozenset({"HARVESTED", "ARCHIVED"}),
    "SOLD": frozenset({"SOLD", "ARCHIVED"}),
    "ARCHIVED": frozenset({"ARCHIVED"}),
}


def role_name(user) -> str:
    return getattr(getattr(user, "role", None), "role_name", "")


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

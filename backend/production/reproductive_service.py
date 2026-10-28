"""
SmartLivestock-Batangas — Reproductive Management & Conception Analytics Service

Authoritative backend service that resolves:
1. Reproductive status of individual livestock (cycle-aware precedence rules).
2. Herd-level bull exposure and recorded breeding events.
3. Descriptive conception-rate analytics with rigorously defined denominators.
4. Individual conception-likelihood prediction evaluation (data readiness, baseline, and leakage prevention).
5. Estimated calving dates and biological gestation windows.
"""

from datetime import date, timedelta
from typing import Any, Dict, List, Optional
from django.db.models import Q, QuerySet
from django.utils import timezone

from livestock.models import LivestockInventory, LivestockBatch
from production.models import BreedingRecord, CalvingRecord, LivestockTreatmentRecord, get_species_gestation_days


# ---------------------------------------------------------------------------
# Conceptual Reproductive Status Definitions
# ---------------------------------------------------------------------------

class ReproductiveStatus:
    EXPOSED = "EXPOSED"                     # Valid breeding or active bull herd-exposure; pregnancy unconfirmed
    PREGNANT = "PREGNANT"                   # Explicitly confirmed pregnancy; active current cycle
    COMPLETE = "COMPLETE"                   # Calving completed for cycle; post-partum / resting
    UNKNOWN = "UNKNOWN"                     # Insufficient evidence to assign status
    NOT_APPLICABLE = "NOT_APPLICABLE"       # Male or outside reproductive tracking

    LABELS = {
        EXPOSED: "Exposed",
        PREGNANT: "Pregnant — Confirmed",
        COMPLETE: "Complete",
        UNKNOWN: "Unknown / Not Recorded",
        NOT_APPLICABLE: "Not Applicable",
    }

    BADGE_VARIANTS = {
        EXPOSED: "amber",
        PREGNANT: "emerald",
        COMPLETE: "blue",
        UNKNOWN: "slate",
        NOT_APPLICABLE: "muted",
    }


# Maximum grace period beyond biological gestation before an unconfirmed or uncalved
# pregnancy is marked overdue for clinical check rather than remaining indefinitely pregnant.
MAX_GESTATION_GRACE_DAYS = 45


# ---------------------------------------------------------------------------
# 1. Authoritative Reproductive Status Resolver
# ---------------------------------------------------------------------------

def _resolve_reproductive_status_internal(
    animal: LivestockInventory,
    as_of_date: Optional[date] = None,
) -> Dict[str, Any]:
    """
    Authoritatively resolve the reproductive status of an individual animal
    following cycle-aware precedence rules.
    """
    as_of_date = as_of_date or timezone.localdate()

    # Rule 1: Male animals and invalid entries are Not Applicable
    sex_str = (animal.sex or "").strip().upper()
    if sex_str.startswith("M") or sex_str == "MALE":
        return {
            "status": ReproductiveStatus.NOT_APPLICABLE,
            "label": ReproductiveStatus.LABELS[ReproductiveStatus.NOT_APPLICABLE],
            "badge_variant": ReproductiveStatus.BADGE_VARIANTS[ReproductiveStatus.NOT_APPLICABLE],
            "explanation": "Animal is male and outside female reproductive cycle tracking.",
            "is_female": False,
            "can_breed": False,
            "cycle_number": 0,
            "supporting_event_type": None,
            "supporting_event_date": None,
            "days_in_status": None,
            "expected_calving_date": None,
            "gestation_window": None,
            "active_breeding_record_id": None,
        }

    # If sex is unrecorded or not female
    if not (sex_str.startswith("F") or sex_str == "FEMALE"):
        return {
            "status": ReproductiveStatus.NOT_APPLICABLE,
            "label": ReproductiveStatus.LABELS[ReproductiveStatus.NOT_APPLICABLE],
            "badge_variant": ReproductiveStatus.BADGE_VARIANTS[ReproductiveStatus.NOT_APPLICABLE],
            "explanation": "Animal sex is unrecorded or unrecognized as breeding stock.",
            "is_female": False,
            "can_breed": False,
            "cycle_number": 0,
            "supporting_event_type": None,
            "supporting_event_date": None,
            "days_in_status": None,
            "expected_calving_date": None,
            "gestation_window": None,
            "active_breeding_record_id": None,
        }

    # Species biological gestation
    species_name = getattr(getattr(animal, "livestock_type", None), "name", "Cattle")
    std_gestation_days = get_species_gestation_days(species_name)

    # Historical calving records for this dam (ordered latest first)
    calving_records = list(
        CalvingRecord.objects.filter(dam=animal, calving_date__lte=as_of_date)
        .order_by("-calving_date", "-id")
    )
    latest_calving = calving_records[0] if calving_records else None
    latest_calving_date = latest_calving.calving_date if latest_calving else None
    total_calvings = len(calving_records)

    # Historical breeding records for this dam (ordered latest first)
    breeding_records = list(
        BreedingRecord.objects.filter(dam=animal, breeding_date__lte=as_of_date)
        .order_by("-breeding_date", "-id")
    )
    latest_breeding = breeding_records[0] if breeding_records else None

    # Check for active bull in the same herd (current herd overlap)
    active_bull_exposure = check_active_bull_herd_exposure(animal)

    # -------------------------------------------------------------------------
    # Cycle Determination:
    # A cycle boundary begins when breeding/exposure occurs after the previous calving.
    # -------------------------------------------------------------------------
    cycle_number = total_calvings + 1

    # Check if there is a breeding record that occurred AFTER the latest calving
    current_cycle_breeding: Optional[BreedingRecord] = None
    if latest_calving_date and latest_breeding:
        if latest_breeding.breeding_date >= latest_calving_date:
            current_cycle_breeding = latest_breeding
    elif not latest_calving_date and latest_breeding:
        current_cycle_breeding = latest_breeding

    # -------------------------------------------------------------------------
    # Precedence Rules for Active Cycle
    # -------------------------------------------------------------------------

    # 1. We have a breeding record in the current cycle
    if current_cycle_breeding:
        b_date = current_cycle_breeding.breeding_date
        gest_days = current_cycle_breeding.gestation_days or std_gestation_days
        days_elapsed = (as_of_date - b_date).days
        exp_due_date = current_cycle_breeding.expected_due_date or (b_date + timedelta(days=gest_days))

        # Pregnancy check: confirmed pregnant
        is_confirmed = (
            current_cycle_breeding.status == BreedingRecord.BreedingStatus.PREGNANT
            or current_cycle_breeding.pregnancy_confirmed_date is not None
        )

        if is_confirmed:
            # Prevent indefinite pregnancy: Check if gestation has elapsed beyond biological limit
            max_limit_days = gest_days + MAX_GESTATION_GRACE_DAYS
            if days_elapsed > max_limit_days:
                return {
                    "status": ReproductiveStatus.UNKNOWN,
                    "label": "Overdue / Re-check Required",
                    "badge_variant": "slate",
                    "explanation": (
                        f"Pregnancy was confirmed on {current_cycle_breeding.pregnancy_confirmed_date or b_date}, "
                        f"but has exceeded maximum biological gestation ({days_elapsed} days elapsed vs {gest_days} standard) "
                        "without a recorded calving event. Veterinary or ultrasound re-check is required."
                    ),
                    "is_female": True,
                    "can_breed": True,
                    "cycle_number": cycle_number,
                    "supporting_event_type": "BREEDING_OVERDUE",
                    "supporting_event_date": str(b_date),
                    "days_in_status": days_elapsed,
                    "expected_calving_date": str(exp_due_date),
                    "gestation_window": {
                        "start": str(exp_due_date - timedelta(days=10)),
                        "end": str(exp_due_date + timedelta(days=10)),
                    },
                    "active_breeding_record_id": current_cycle_breeding.id,
                }

            return {
                "status": ReproductiveStatus.PREGNANT,
                "label": ReproductiveStatus.LABELS[ReproductiveStatus.PREGNANT],
                "badge_variant": ReproductiveStatus.BADGE_VARIANTS[ReproductiveStatus.PREGNANT],
                "explanation": (
                    f"Pregnancy confirmed"
                    f"{f' via {current_cycle_breeding.confirmation_method}' if current_cycle_breeding.confirmation_method else ''} "
                    f"from {current_cycle_breeding.get_breeding_type_display()} on {b_date:%b %d, %Y}. "
                    f"Gestation day {days_elapsed} of {gest_days}."
                ),
                "is_female": True,
                "can_breed": False,
                "cycle_number": cycle_number,
                "supporting_event_type": "PREGNANCY_CONFIRMATION",
                "supporting_event_date": str(current_cycle_breeding.pregnancy_confirmed_date or b_date),
                "days_in_status": days_elapsed,
                "expected_calving_date": str(exp_due_date),
                "gestation_window": {
                    "start": str(exp_due_date - timedelta(days=10)),
                    "end": str(exp_due_date + timedelta(days=10)),
                },
                "active_breeding_record_id": current_cycle_breeding.id,
            }

        # Breeding recorded as OPEN (confirmed not pregnant / unsuccessful)
        if current_cycle_breeding.status == BreedingRecord.BreedingStatus.OPEN:
            return {
                "status": ReproductiveStatus.UNKNOWN,
                "label": "Open / Non-Pregnant",
                "badge_variant": "slate",
                "explanation": (
                    f"Breeding attempt on {b_date:%b %d, %Y} was checked and recorded as open (non-pregnant). "
                    "Awaiting subsequent estrus cycle and re-insemination."
                ),
                "is_female": True,
                "can_breed": True,
                "cycle_number": cycle_number,
                "supporting_event_type": "BREEDING_CHECK_OPEN",
                "supporting_event_date": str(b_date),
                "days_in_status": days_elapsed,
                "expected_calving_date": None,
                "gestation_window": None,
                "active_breeding_record_id": current_cycle_breeding.id,
            }

        # Breeding recorded as CALVED
        if current_cycle_breeding.status == BreedingRecord.BreedingStatus.CALVED:
            return {
                "status": ReproductiveStatus.COMPLETE,
                "label": ReproductiveStatus.LABELS[ReproductiveStatus.COMPLETE],
                "badge_variant": ReproductiveStatus.BADGE_VARIANTS[ReproductiveStatus.COMPLETE],
                "explanation": f"Calving recorded for breeding cycle of {b_date:%b %d, %Y}.",
                "is_female": True,
                "can_breed": True,
                "cycle_number": cycle_number,
                "supporting_event_type": "CALVED_CYCLE",
                "supporting_event_date": str(b_date),
                "days_in_status": days_elapsed,
                "expected_calving_date": None,
                "gestation_window": None,
                "active_breeding_record_id": current_cycle_breeding.id,
            }

        # Plain breeding or insemination without pregnancy confirmation (PENDING_CHECK)
        # Exposure is recorded, but PREGNANCY IS NEVER INFERRED!
        return {
            "status": ReproductiveStatus.EXPOSED,
            "label": ReproductiveStatus.LABELS[ReproductiveStatus.EXPOSED],
            "badge_variant": ReproductiveStatus.BADGE_VARIANTS[ReproductiveStatus.EXPOSED],
            "explanation": (
                f"{current_cycle_breeding.get_breeding_type_display()} recorded on {b_date:%b %d, %Y}. "
                "Pregnancy check is pending; exposure does not confirm conception."
            ),
            "is_female": True,
            "can_breed": False,
            "cycle_number": cycle_number,
            "supporting_event_type": "BREEDING_EVENT",
            "supporting_event_date": str(b_date),
            "days_in_status": days_elapsed,
            # Provide calculated date as conditional estimate ONLY, clearly labeled!
            "expected_calving_date": str(exp_due_date),
            "gestation_window": {
                "start": str(exp_due_date - timedelta(days=10)),
                "end": str(exp_due_date + timedelta(days=10)),
            },
            "active_breeding_record_id": current_cycle_breeding.id,
        }

    # 2. No breeding record in current cycle, but current active herd exposure exists with a bull
    if active_bull_exposure["has_exposure"]:
        return {
            "status": ReproductiveStatus.EXPOSED,
            "label": ReproductiveStatus.LABELS[ReproductiveStatus.EXPOSED],
            "badge_variant": ReproductiveStatus.BADGE_VARIANTS[ReproductiveStatus.EXPOSED],
            "explanation": (
                f"Female is currently housed in herd '{active_bull_exposure['batch_name']}' "
                f"with active registered sire bull(s): {', '.join(active_bull_exposure['bull_tags'])}. "
                "Exposure is noted for surveillance; exposure alone does not confirm pregnancy."
            ),
            "is_female": True,
            "can_breed": True,
            "cycle_number": cycle_number,
            "supporting_event_type": "HERD_BULL_EXPOSURE",
            "supporting_event_date": str(as_of_date),
            "days_in_status": 0,
            "expected_calving_date": None,
            "gestation_window": None,
            "active_breeding_record_id": None,
        }

    # 3. No current breeding or herd exposure, but previous calving completed cycle
    if latest_calving:
        days_since_calving = (as_of_date - latest_calving.calving_date).days
        return {
            "status": ReproductiveStatus.COMPLETE,
            "label": ReproductiveStatus.LABELS[ReproductiveStatus.COMPLETE],
            "badge_variant": ReproductiveStatus.BADGE_VARIANTS[ReproductiveStatus.COMPLETE],
            "explanation": (
                f"Calving completed on {latest_calving.calving_date:%b %d, %Y} "
                f"(Calf: {latest_calving.calf_tag or 'Registered'}). "
                f"Currently open / post-calving rest ({days_since_calving} days elapsed)."
            ),
            "is_female": True,
            "can_breed": True,
            "cycle_number": total_calvings,
            "supporting_event_type": "CALVING_EVENT",
            "supporting_event_date": str(latest_calving.calving_date),
            "days_in_status": days_since_calving,
            "expected_calving_date": None,
            "gestation_window": None,
            "active_breeding_record_id": None,
        }

    # 4. No reproductive events or herd exposure found
    return {
        "status": ReproductiveStatus.UNKNOWN,
        "label": ReproductiveStatus.LABELS[ReproductiveStatus.UNKNOWN],
        "badge_variant": ReproductiveStatus.BADGE_VARIANTS[ReproductiveStatus.UNKNOWN],
        "explanation": "No breeding, insemination, herd bull exposure, or calving records logged in SmartLivestock.",
        "is_female": True,
        "can_breed": True,
        "cycle_number": 0,
        "supporting_event_type": None,
        "supporting_event_date": None,
        "days_in_status": None,
        "expected_calving_date": None,
        "gestation_window": None,
        "active_breeding_record_id": None,
    }


def resolve_reproductive_status(
    animal: LivestockInventory,
    as_of_date: Optional[date] = None,
) -> Dict[str, Any]:
    """
    Authoritatively resolve the reproductive status of an individual animal
    following cycle-aware precedence rules.
    """
    res = _resolve_reproductive_status_internal(animal, as_of_date)
    res["badge_label"] = res.get("label", "")
    res["is_confirmed_pregnant"] = (res.get("status") == ReproductiveStatus.PREGNANT)
    return res


# ---------------------------------------------------------------------------
# 2. Bull Exposure & Herd Membership Checker (Phase 4)
# ---------------------------------------------------------------------------

def check_active_bull_herd_exposure(animal: LivestockInventory) -> Dict[str, Any]:
    """
    Evaluate whether a female animal currently shares the exact same herd (batch)
    with an active, approved male bull of compatible species.

    Strict guardrails:
    - Does NOT infer exposure merely because animals belong to the same farm or barangay.
    - Only evaluates verified current herd membership (`batch` link).
    """
    if not animal.batch_id:
        return {"has_exposure": False, "exposed": False, "batch_name": None, "bull_tags": [], "bulls": []}

    batch = animal.batch
    if batch.status != LivestockBatch.StatusType.ACTIVE:
        return {"has_exposure": False, "exposed": False, "batch_name": batch.batch_name, "bull_tags": [], "bulls": []}

    # Find active, approved males in the EXACT SAME batch and compatible species
    bulls = list(LivestockInventory.objects.filter(
        batch=batch,
        sex__iexact="MALE",
        livestock_type=animal.livestock_type,
        operational_status=LivestockInventory.OperationalStatus.ACTIVE,
    ).exclude(id=animal.id))

    bull_tags = [b.tag_number or f"Bull #{b.id}" for b in bulls]
    bull_items = [{"tag_number": b.tag_number or f"Bull #{b.id}"} for b in bulls]

    return {
        "has_exposure": len(bull_tags) > 0,
        "exposed": len(bull_tags) > 0,
        "batch_id": batch.id,
        "batch_name": batch.batch_name,
        "batch_code": batch.batch_code,
        "bull_count": len(bull_tags),
        "bull_tags": bull_tags,
        "bulls": bull_items,
    }


# ---------------------------------------------------------------------------
# 3. Descriptive Conception-Rate Analytics (Phase 6)
# ---------------------------------------------------------------------------

def calculate_conception_analytics(
    breeding_qs: QuerySet[BreedingRecord],
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    species_filter: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Calculate descriptive conception-rate analytics with an explicitly defined denominator.

    Mathematical definition:
      Observed Conception Rate =
        (Eligible breeding events with confirmed conception outcomes)
        ÷ (Eligible breeding events with known outcomes)
        × 100

    Strict Rules:
    - Events with unknown / pending outcome (PENDING_CHECK) are excluded from the denominator.
    - Missing confirmation is NOT treated as proof of failure.
    - Empty or insufficient datasets return explicit empty states, not misleading 0% or 100%.
    """
    qs = breeding_qs

    if date_from:
        qs = qs.filter(breeding_date__gte=date_from)
    if date_to:
        qs = qs.filter(breeding_date__lte=date_to)
    if species_filter:
        qs = qs.filter(dam__livestock_type__name__iexact=species_filter)

    total_events = qs.count()

    # Confirmed conception outcomes:
    # Status is PREGNANT, or pregnancy_confirmed_date is set, or status is CALVED, or calving_record is attached
    confirmed_conceptions_qs = qs.filter(
        Q(status=BreedingRecord.BreedingStatus.PREGNANT)
        | Q(pregnancy_confirmed_date__isnull=False)
        | Q(status=BreedingRecord.BreedingStatus.CALVED)
        | Q(calving_record__isnull=False)
    ).distinct()
    confirmed_conceptions = confirmed_conceptions_qs.count()

    # Known unsuccessful outcomes:
    # Explicitly recorded as OPEN (checked non-pregnant)
    known_unsuccessful_qs = qs.filter(status=BreedingRecord.BreedingStatus.OPEN)
    known_unsuccessful = known_unsuccessful_qs.count()

    # Total events with KNOWN outcomes (denominator)
    events_with_known_outcomes = confirmed_conceptions + known_unsuccessful

    # Events with UNKNOWN / pending outcomes (excluded from denominator)
    pending_check_events = qs.filter(
        status=BreedingRecord.BreedingStatus.PENDING_CHECK,
        pregnancy_confirmed_date__isnull=True,
        calving_record__isnull=True,
    ).count()

    # Observed rate computation
    if events_with_known_outcomes > 0:
        observed_conception_rate = round((confirmed_conceptions / events_with_known_outcomes) * 100, 1)
        if events_with_known_outcomes < 10:
            rate_status = "LOW_SAMPLE_SIZE"
            status_message = (
                f"Observed conception rate is {observed_conception_rate}% based on {events_with_known_outcomes} "
                "recorded outcomes. Caution: sample size is under 10 observations."
            )
        else:
            rate_status = "SUFFICIENT"
            status_message = (
                f"Calculated from {events_with_known_outcomes} breeding events with verified clinical outcomes "
                f"({confirmed_conceptions} confirmed conceptions, {known_unsuccessful} open)."
            )
    else:
        observed_conception_rate = None
        rate_status = "INSUFFICIENT_DATA"
        status_message = "Insufficient recorded breeding outcomes to calculate a reliable conception rate."

    # Breakdown by breeding method
    by_type = {}
    for b_type in BreedingRecord.BreedingType.values:
        type_qs = qs.filter(breeding_type=b_type)
        type_total = type_qs.count()
        type_confirmed = type_qs.filter(
            Q(status=BreedingRecord.BreedingStatus.PREGNANT)
            | Q(pregnancy_confirmed_date__isnull=False)
            | Q(status=BreedingRecord.BreedingStatus.CALVED)
            | Q(calving_record__isnull=False)
        ).distinct().count()
        type_open = type_qs.filter(status=BreedingRecord.BreedingStatus.OPEN).count()
        type_known = type_confirmed + type_open
        type_rate = round((type_confirmed / type_known) * 100, 1) if type_known > 0 else None

        by_type[b_type] = {
            "total_events": type_total,
            "known_outcomes": type_known,
            "confirmed_conceptions": type_confirmed,
            "known_unsuccessful": type_open,
            "pending_check": type_total - type_known,
            "conception_rate_pct": type_rate,
        }

    return {
        "total_eligible_events": total_events,
        "total_eligible_breeding_events": total_events,
        "events_with_known_outcomes": events_with_known_outcomes,
        "confirmed_conceptions": confirmed_conceptions,
        "known_unsuccessful_outcomes": known_unsuccessful,
        "pending_outcomes_excluded": pending_check_events,
        "pending_outcome_checks": pending_check_events,
        "observed_conception_rate_pct": observed_conception_rate,
        "rate_status": rate_status,
        "status_message": status_message,
        "formula_explanation": (
            "Observed conception rate = Confirmed conceptions ÷ Events with known outcomes × 100. "
            "Awaiting-check events are excluded from the denominator to avoid treating unconfirmed events as failures."
        ),
        "by_breeding_type": by_type,
    }


# ---------------------------------------------------------------------------
# 4. Conception Likelihood Prediction & Data Readiness (Phase 7)
# ---------------------------------------------------------------------------

MINIMUM_OUTCOMES_FOR_PREDICTION = 30  # Defensible minimum verified events to fit binary model

def evaluate_conception_prediction_readiness(scope_user=None) -> Dict[str, Any]:
    """
    Audits whether the dataset is sufficient to train or evaluate an individual
    conception-likelihood prediction model without fabricating data or assumptions.
    """
    all_breeding = BreedingRecord.objects.all()
    total_events = all_breeding.count()
    known_outcomes = all_breeding.filter(
        Q(status__in=[BreedingRecord.BreedingStatus.PREGNANT, BreedingRecord.BreedingStatus.CALVED, BreedingRecord.BreedingStatus.OPEN])
        | Q(pregnancy_confirmed_date__isnull=False)
        | Q(calving_record__isnull=False)
    ).distinct().count()

    is_sufficient = known_outcomes >= MINIMUM_OUTCOMES_FOR_PREDICTION
    state_str = "ACTIVE" if is_sufficient else "BLOCKED_PENDING_DATA"

    return {
        "status": state_str,
        "is_ready": is_sufficient,
        "prediction_state": state_str,
        "verdict": "Active" if is_sufficient else "Deferred (Data Collection Phase)",
        "total_recorded_breeding_events": total_events,
        "events_with_known_outcomes": known_outcomes,
        "known_outcomes_available": known_outcomes,
        "minimum_required_for_model": MINIMUM_OUTCOMES_FOR_PREDICTION,
        "minimum_required_samples": MINIMUM_OUTCOMES_FOR_PREDICTION,
        "is_data_sufficient": is_sufficient,
        "rationale": (
            f"The repository currently contains {known_outcomes} verified breeding outcome records. "
            f"A minimum of {MINIMUM_OUTCOMES_FOR_PREDICTION} independent events with verified outcomes "
            "is required for statistically defensible binary classification and temporal cross-validation. "
            "Model training is deferred to prevent unvalidated or fabricated AI estimates."
            if not is_sufficient else
            f"Dataset meets minimum sample threshold ({known_outcomes} outcomes) for baseline estimation."
        ),
        "guidance": (
            "Farmers and municipal officers should continue logging breeding attempts and clinical pregnancy "
            "check confirmations to build an empirical, field-verified training baseline."
        ),
    }


def predict_conception_likelihood(
    animal: LivestockInventory,
    breeding_event: Optional[BreedingRecord] = None,
) -> Dict[str, Any]:
    """
    Evaluate individual conception-likelihood prediction for a female animal.
    Adheres strictly to Phase 7:
    - If dataset is insufficient, returns honest deferred status.
    - Never modifies animal's official reproductive status.
    - Never uses future outcomes as input features (prevents data leakage).
    """
    readiness = evaluate_conception_prediction_readiness()

    if not readiness["is_data_sufficient"]:
        return {
            "prediction_available": False,
            "prediction_status": "BLOCKED_PENDING_DATA",
            "conception_likelihood_pct": None,
            "confidence_interval": None,
            "model_version": "Deferred (Data Collection Phase)",
            "prediction_date": str(timezone.localdate()),
            "message": readiness["rationale"],
            "data_readiness": readiness,
            "disclaimer": (
                "Individual prediction is deferred until sufficient field breeding outcomes accumulate. "
                "SmartLivestock policy prohibits AI predictions based on synthetic, fabricated, or unverified labels."
            ),
            "is_confirmed_pregnancy": False,
        }

    # Baseline empirical rate calculation when data becomes sufficient in future:
    # Uses historical observed conception rate strictly preceding this animal's breeding event
    baseline_qs = BreedingRecord.objects.filter(
        status__in=[BreedingRecord.BreedingStatus.PREGNANT, BreedingRecord.BreedingStatus.CALVED, BreedingRecord.BreedingStatus.OPEN]
    )
    if breeding_event:
        # Prevent temporal data leakage: only use events prior to this breeding event
        baseline_qs = baseline_qs.filter(breeding_date__lt=breeding_event.breeding_date)

    analytics = calculate_conception_analytics(baseline_qs)
    baseline_rate = analytics.get("observed_conception_rate_pct")

    return {
        "prediction_available": True,
        "prediction_status": "BASELINE_EMPIRICAL",
        "conception_likelihood_pct": baseline_rate,
        "confidence_interval": [max(0, baseline_rate - 8), min(100, baseline_rate + 8)] if baseline_rate else None,
        "model_version": "Empirical Historical Baseline v1.0",
        "prediction_date": str(timezone.localdate()),
        "message": f"Historical empirical baseline for herd is {baseline_rate}%.",
        "data_readiness": readiness,
        "disclaimer": "This statistical estimate does NOT confirm pregnancy. Pregnancy requires veterinary palpation or ultrasound.",
        "is_confirmed_pregnancy": False,
    }


# ---------------------------------------------------------------------------
# 5. Full Animal Reproductive & Health Profile Assembled
# ---------------------------------------------------------------------------

def get_animal_reproductive_profile(animal: LivestockInventory) -> Dict[str, Any]:
    """
    Assembles a comprehensive, auditable reproductive and medical timeline
    for an individual animal profile.
    """
    status_data = resolve_reproductive_status(animal)
    bull_exposure = check_active_bull_herd_exposure(animal)

    # Breeding events
    breeding_qs = BreedingRecord.objects.filter(dam=animal).order_by("-breeding_date", "-id")
    breeding_history = []
    for b in breeding_qs:
        breeding_history.append({
            "id": b.id,
            "breeding_date": str(b.breeding_date),
            "breeding_type": b.breeding_type,
            "breeding_type_label": b.get_breeding_type_display(),
            "sire_tag_or_code": b.sire_tag_or_code or (b.sire_livestock.tag_number if b.sire_livestock else ""),
            "sire_breed": b.sire_breed or (b.sire_livestock.breed if b.sire_livestock else ""),
            "technician_or_inseminator": b.technician_or_inseminator,
            "gestation_days": b.gestation_days,
            "expected_due_date": str(b.expected_due_date) if b.expected_due_date else None,
            "status": b.status,
            "status_label": b.get_status_display(),
            "pregnancy_confirmed_date": str(b.pregnancy_confirmed_date) if b.pregnancy_confirmed_date else None,
            "confirmation_method": b.confirmation_method,
            "notes": b.notes,
        })

    # Calving events
    calving_qs = CalvingRecord.objects.filter(dam=animal).order_by("-calving_date", "-id")
    calving_history = []
    for c in calving_qs:
        calving_history.append({
            "id": c.id,
            "calving_date": str(c.calving_date),
            "calf_tag": c.calf_tag,
            "calf_sex": c.calf_sex,
            "birth_weight": float(c.birth_weight) if c.birth_weight is not None else None,
            "sire_tag": c.sire_tag,
            "calving_ease": c.calving_ease,
            "status": c.status,
            "notes": c.notes,
        })

    # Treatment events
    treatment_qs = LivestockTreatmentRecord.objects.filter(livestock=animal).order_by("-treatment_date", "-id")
    treatment_history = []
    for t in treatment_qs:
        treatment_history.append({
            "id": t.id,
            "treatment_date": str(t.treatment_date),
            "treatment_type": t.treatment_type,
            "treatment_type_label": t.get_treatment_type_display(),
            "medication_name": t.medication_name,
            "reason": t.reason,
            "dosage": t.dosage,
            "route_of_administration": t.route_of_administration,
            "administered_by": t.administered_by,
            "notes": t.notes,
            "follow_up_date": str(t.follow_up_date) if t.follow_up_date else None,
            "related_disease_case_id": t.related_disease_case_id,
            "related_breeding_record_id": t.related_breeding_record_id,
        })

    # Unified chronological timeline (Phase 2 & 5)
    timeline_items = []
    for b in breeding_history:
        timeline_items.append({
            "type": "BREEDING",
            "date": b["breeding_date"],
            "title": f"Breeding ({b['breeding_type_label']})",
            "details": f"Sire: {b['sire_tag_or_code'] or 'Unrecorded'} · Tech: {b['technician_or_inseminator'] or 'N/A'}",
            "status": b["status_label"],
            "badge_color": "amber",
        })
        if b["pregnancy_confirmed_date"]:
            timeline_items.append({
                "type": "PREGNANCY_CHECK",
                "date": b["pregnancy_confirmed_date"],
                "title": "Pregnancy Confirmed",
                "details": f"Method: {b['confirmation_method'] or 'Clinical diagnosis'} · Expected Due: {b['expected_due_date']}",
                "status": "CONFIRMED",
                "badge_color": "emerald",
            })

    for c in calving_history:
        timeline_items.append({
            "type": "CALVING",
            "date": c["calving_date"],
            "title": f"Calving ({c['calf_tag'] or 'Newborn'})",
            "details": f"Sex: {c['calf_sex']} · Weight: {c['birth_weight'] or 'N/A'} kg · Ease: {c['calving_ease']}",
            "status": c["status"],
            "badge_color": "blue",
        })

    for t in treatment_history:
        timeline_items.append({
            "type": "TREATMENT",
            "date": t["treatment_date"],
            "title": f"Treatment: {t['medication_name']}",
            "details": f"Type: {t['treatment_type_label']} · Dose: {t['dosage'] or 'N/A'} · By: {t['administered_by'] or 'N/A'}",
            "status": "RECORDED",
            "badge_color": "purple",
        })

    # Sort unified timeline descending by date
    timeline_items.sort(key=lambda x: x["date"], reverse=True)

    # Individual conception prediction assessment
    prediction_info = predict_conception_likelihood(animal)

    return {
        "animal_id": animal.id,
        "tag_number": animal.tag_number or f"TAG-{animal.id}",
        "species": getattr(getattr(animal, "livestock_type", None), "name", "Cattle"),
        "breed": animal.breed or "Unrecorded",
        "sex": animal.sex or "Unknown",
        "batch_id": animal.batch_id,
        "batch_code": animal.batch.batch_code if animal.batch else None,
        "reproductive_status": status_data,
        "bull_herd_exposure": bull_exposure,
        "breeding_history": breeding_history,
        "calving_history": calving_history,
        "treatment_history": treatment_history,
        "unified_timeline": timeline_items,
        "timeline": timeline_items,
        "conception_prediction": prediction_info,
        "prediction_readiness": prediction_info.get("data_readiness") if prediction_info else None,
        "gestation_summary": status_data.get("gestation_window"),
    }

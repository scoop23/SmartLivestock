"""
Data Extraction, Cleaning, and Feature Engineering for Time-Series Forecasting.

=============================================================================
EDUCATIONAL OVERVIEW: MULTI-DOMAIN TIME-SERIES EXTRACTION & DATA INTEGRITY
=============================================================================
In municipal livestock analytics, we process five core time-series domains:
  1. Production: Milk (Liters), Farmer-reported Meat (kg), Eggs (pcs), Wool (kg)
  2. Disease Surveillance: Outbreak frequency (Cases) and Affected Animals (Heads)
  3. Mortality: Livestock Deaths (Heads) across disease-linked and independent causes
  4. Slaughter: Abattoir Throughput (Heads) vs Meat Biomass (Carcass Weight kg)
  5. Auction / Live Animal Sales: Market throughput (Heads) and trading volume (PHP)

KEY DATA SCIENCE & CAPSTONE PRINCIPLES:
1. Source-appropriate Records:
   Routine farmer production is available as RECORDED only. Historical rows
   in approval states remain stored but are excluded. Official slaughter, disease, mortality, and transfer
   sources retain their separate approval requirements.

2. Unit Purity Rule:
   Different production yields have incompatible physical units:
     - Milk: LITERS
     - Meat: KILOGRAMS
     - Eggs: PIECES
   Mixing liters, kilograms, and pieces into a single time series corrupts the data.
   Every model strictly targets a single (domain, target, unit) tuple.

3. Farmer-Reported Meat vs. Slaughterhouse Meat (Preventing Double Counting):
   Farmer meat (ProductionRecord with production_type='MEAT' and slaughter=None)
   is kept strictly separate from municipal slaughterhouse records (SlaughterRecord).
   Counting both in the same meat metric would double-count the same livestock.

4. Data Sufficiency vs. Fake Forecasts:
   Each requested target has a documented monthly minimum. We NEVER fabricate forecast
   curves or random numbers when that minimum or data-coverage rules are not met.

5. Chronological Train/Test Split (Preventing Data Leakage):
   Standard ML often splits data randomly (e.g. train_test_split(..., shuffle=True)).
   In TIME SERIES, random splitting is a fatal error called DATA LEAKAGE:
   if the model sees May 2026 during training, it can "cheat" when predicting April 2026.
   We always split chronologically:
     - Oldest observations -> Training set (past)
     - Newest observations -> Test set (unseen future)
"""

from typing import Dict, Any, Tuple, Optional
from datetime import date
import pandas as pd
import numpy as np
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from livestock.models import LivestockOwnershipTransfer

from django.db.models import Case, Count, DateTimeField, F, Max, Sum, When
from django.db.models.functions import TruncMonth

from production.models import ProductionRecord, SlaughterRecord
from diseases.models import DiseaseCase, MortalityRecord
from smartlivestock.workflows import scope_reviewer_queryset
from analytics.seed_markers import (
    SEED_MARKER_PRODUCTION_V2,
    SEED_MARKER_PRODUCTION_LEGACY,
    SEED_MARKER_DISEASE,
    SEED_MARKER_MORTALITY,
    SEED_MARKER_SLAUGHTER,
    SEED_MARKER_AUCTION,
    SEED_MARKER_FORECAST_QUALITY_IDEAL,
    SEED_MARKER_FORECAST_QUALITY_POOR,
)

SEED_MARKER_V2 = SEED_MARKER_PRODUCTION_V2
SEED_MARKER_LEGACY = SEED_MARKER_PRODUCTION_LEGACY
SEED_MARKER = SEED_MARKER_V2

# -----------------------------------------------------------------------------
# MODEL & DATA READINESS THRESHOLDS (Capstone Defense Concept)
# -----------------------------------------------------------------------------
# 1. NOT_READY: The target-specific minimum is not met. Cannot establish the
#    target's required chronological training and holdout periods.
# 2. READY (12 - 23 observations):
#    Minimal data available (at least 1 full annual cycle). Allows chronological
#    holdout evaluation and baseline comparison, but sample size is still limited.
# 3. QUALITY_READY (>= 24 observations):
#    Two or more full annual cycles. Supports full seasonal decomposition
#    (e.g., Holt-Winters 12-month periodicity) and higher confidence in evaluation metrics.
# -----------------------------------------------------------------------------
READINESS_NOT_READY = "NOT_READY"
READINESS_READY = "READY"
READINESS_QUALITY_READY = "QUALITY_READY"

MIN_OBSERVATIONS_REQUIRED = 12
QUALITY_OBSERVATIONS_THRESHOLD = 24

# These are the only four operational forecasts requested by the municipal
# dashboard. Event dates and statuses are tied to the actual source models.
FORECAST_TARGETS = {
    ("production", "MILK", "LITERS"): {
        "label": "Milk production",
        "unit": "LITERS",
        "event_date_field": "ProductionRecord.record_date",
        "eligible_status": "RECORDED",
        "source": "Farmer-recorded ProductionRecord (MILK; liters)",
        "expected_reporting": "Daily entries are possible, but no daily reporting-completeness ledger exists.",
        "minimum_monthly_observations": 24,
        "minimum_rule": "Two annual cycles before evaluating annual seasonality and a holdout forecast.",
    },
    ("production", "MEAT", "KILOGRAMS"): {
        "label": "Farmer-reported meat yield",
        "unit": "KILOGRAMS",
        "event_date_field": "ProductionRecord.record_date",
        "eligible_status": "RECORDED",
        "source": "Farmer-recorded ProductionRecord (MEAT; slaughter is null; kilograms)",
        "expected_reporting": "Event-based; no reporting-completeness ledger exists.",
        "minimum_monthly_observations": 18,
        "minimum_rule": "12 training months plus a 6-month out-of-sample window for this monthly event series.",
    },
    ("slaughter", "ALL", "KILOGRAMS"): {
        "label": "Slaughterhouse meat yield",
        "unit": "KILOGRAMS",
        "event_date_field": "SlaughterRecord.record_date",
        "eligible_status": "APPROVED",
        "source": "SlaughterRecord.carcass_weight (kilograms)",
        "expected_reporting": "Event-based; missing carcass weights are not treated as zero.",
        "minimum_monthly_observations": 18,
        "minimum_rule": "12 training months plus a 6-month out-of-sample window for this monthly event series.",
    },
    ("auction", "ALL", "HEADS"): {
        "label": "Livestock sold",
        "unit": "HEADS",
        "event_date_field": "LivestockOwnershipTransfer.transfer_date",
        "eligible_status": "APPROVED",
        "source": "LivestockOwnershipTransfer (one animal per approved transfer)",
        "expected_reporting": "Transfer-event based; a missing month does not prove zero sales or no transfers.",
        "minimum_monthly_observations": 18,
        "minimum_rule": "12 training months plus a 6-month out-of-sample window for this monthly event series.",
    },
    ("auction", "ALL", "TRANSACTIONS"): {
        "label": "Completed livestock transfer events",
        "unit": "TRANSACTIONS",
        "event_date_field": "LivestockOwnershipTransfer.transfer_date",
        "eligible_status": "APPROVED",
        "source": "LivestockOwnershipTransfer approved events",
        "expected_reporting": "Weekly transfer-event based; missing weeks are unknown because no reporting coverage log exists.",
        "minimum_monthly_observations": 12,
        "minimum_rule": "The weekly transfer service requires 12 contiguous complete weeks of approved transfer events; missing weeks are never zero-filled.",
    },
}


def get_forecast_target_definition(domain: str, target: str, unit: str) -> Dict[str, str]:
    """Return source semantics for the four forecast metrics, when applicable."""
    key = ((domain or "").lower(), (target or "").upper(), (unit or "").upper())
    if key in FORECAST_TARGETS:
        return dict(FORECAST_TARGETS[key])
    # Slaughter may be filtered to a species rather than ALL.
    if key[0] == "slaughter" and key[2] == "KILOGRAMS":
        return dict(FORECAST_TARGETS[("slaughter", "ALL", "KILOGRAMS")])
    return {
        "label": f"{domain.title()} {target}",
        "unit": unit,
        "event_date_field": "source-model event date",
        "eligible_status": "APPROVED",
        "source": f"Approved {domain} records",
        "expected_reporting": "Reporting completeness is not recorded; absent months are unknown.",
        "minimum_monthly_observations": MIN_OBSERVATIONS_REQUIRED,
        "minimum_rule": "Existing generic minimum for monthly forecasts.",
    }


def get_readiness_status(
    observation_count: int,
    missing_month_count: int = 0,
    min_observations_required: int = MIN_OBSERVATIONS_REQUIRED,
) -> Tuple[str, str]:
    """
    Computes deterministic model/data readiness state:
    - NOT_READY (< target-specific minimum): Insufficient data for the intended train/test periods.
    - READY: Minimal data available for baseline and model training, but sample is limited.
    - QUALITY_READY (>= 24 observations): Two or more annual cycles available, supporting full 12-month seasonality
      and robust out-of-sample evaluation.
    """
    if observation_count < min_observations_required:
        return (
            READINESS_NOT_READY,
            f"Found {observation_count} monthly observation(s). At least {min_observations_required} are required for this target.",
        )
    elif missing_month_count > 0:
        return (
            READINESS_READY,
            f"Found {observation_count} observed months and {missing_month_count} months with no eligible records. "
            "Missing months are not assumed to be zero; annual seasonality confidence is limited.",
        )
    elif observation_count < QUALITY_OBSERVATIONS_THRESHOLD:
        return (
            READINESS_READY,
            f"Found {observation_count} monthly observations. Adequate for chronological split and initial model evaluation.",
        )
    else:
        return (
            READINESS_QUALITY_READY,
            f"Found {observation_count} monthly observations (>= 2 full annual cycles). Supports seasonal decomposition and robust evaluation.",
        )


def extract_monthly_series(
    domain: str = "production",
    target: str = "MILK",
    unit: str = "LITERS",
    user=None,
) -> Tuple[Optional[pd.DataFrame], Dict[str, Any]]:
    """
    Extracts approved municipal records grouped by calendar month for any supported domain.

    Supported domains:
      - 'production': Target is commodity (MILK, MEAT, EGGS, WOOL). Unit is LITERS, KILOGRAMS, PIECES.
                      Farmer meat enforces slaughter=None to prevent double counting.
      - 'disease': Target is disease name or 'ALL'. Unit is 'CASES' or 'HEADS'.
      - 'mortality': Target is cause or 'ALL'. Unit is 'HEADS'.
      - 'slaughter': Target is species or 'ALL'. Unit is 'HEADS' (throughput) or 'KILOGRAMS' (carcass weight).
      - 'auction': Target is livestock type or 'ALL'. Unit is 'HEADS', 'TRANSACTIONS', or 'PHP'.

    Returns:
        (df, metadata)
        - df: A pandas DataFrame with columns ['month', 'quantity'], indexed by DatetimeIndex,
              or None if the target-specific observation minimum or coverage rules are unmet.
        - metadata: Dictionary containing observation counts, seed status, historical points,
                    and sufficiency explanation.
    """
    domain = (domain or "production").lower()
    if domain == "production":
        raise ValidationError({"domain": "Farmer production forecasting has been retired."})
    target_clean = (target or "MILK").upper()
    unit_clean = (unit or "LITERS").upper()

    active_marker = None
    has_seed = False
    base_qs = None
    records = []
    event_date_field = "record_date"
    unmeasured_target_records = 0
    excluded_milk_session_conflicts = 0

    if domain == "production":
        # ---------------------------------------------------------------------
        # DOMAIN: PRODUCTION (Milk, Meat, Eggs, Wool)
        # ---------------------------------------------------------------------
        base_qs = scope_reviewer_queryset(ProductionRecord.objects.all(), user).filter(
            status=ProductionRecord.ProductionStatus.RECORDED,
            production_type=target_clean,
            unit=unit_clean,
        )
        # Crucial: Farmer-reported meat must NOT double-count slaughter records!
        if target_clean == "MEAT":
            base_qs = base_qs.filter(slaughter__isnull=True)
        elif target_clean == "MILK":
            excluded_milk_session_conflicts = base_qs.filter(session_conflict=True).count()
            base_qs = base_qs.filter(session_conflict=False)

        # A farmer log becomes available at submission. Approval-state history
        # is excluded from training and backtesting.
        production_availability = {
            "latest_eligible_at": Max(Case(
                When(status=ProductionRecord.ProductionStatus.RECORDED, then=F("created_at")),
                output_field=DateTimeField(),
            )),
            "eligible_timestamp_count": Count(Case(
                When(status=ProductionRecord.ProductionStatus.RECORDED, created_at__isnull=False, then=F("created_at")),
                output_field=DateTimeField(),
            )),
        }

        seeded_record = base_qs.filter(notes__contains="AI_SEED").first()
        if seeded_record:
            has_seed = True
            active_marker = (
                SEED_MARKER_PRODUCTION_V2
                if SEED_MARKER_PRODUCTION_V2 in seeded_record.notes
                else SEED_MARKER_PRODUCTION_LEGACY
            )

        if target_clean == "MILK":
            monthly_data = (
                base_qs.annotate(month=TruncMonth("record_date"))
                .values("month")
                .annotate(total_quantity=Sum("quantity"), latest_event_date=Max("record_date"),
                          latest_approval=Max("approved_at"), latest_creation=Max("created_at"),
                          total_records=Count("pk"), reviewed_records=Count("approved_at"),
                          created_records=Count("created_at"), **production_availability)
                .order_by("month")
            )
        else:
            monthly_data = (
            base_qs.annotate(month=TruncMonth("record_date"))
            .values("month")
            .annotate(total_quantity=Sum("quantity"), latest_event_date=Max("record_date"), latest_approval=Max("approved_at"),
                      latest_creation=Max("created_at"), total_records=Count("pk"),
                      reviewed_records=Count("approved_at"), created_records=Count("created_at"),
                      **production_availability)
            .order_by("month")
            )
        records = list(monthly_data)

    elif domain == "disease":
        # ---------------------------------------------------------------------
        # DOMAIN: DISEASE SURVEILLANCE
        # ---------------------------------------------------------------------
        base_qs = scope_reviewer_queryset(DiseaseCase.objects.all(), user).filter(
            status=DiseaseCase.DiseaseStatus.APPROVED
        )
        if target_clean not in ("ALL", "CASES", "HEADS", ""):
            base_qs = base_qs.filter(name__icontains=target_clean)

        seeded_record = base_qs.filter(review_remarks__contains="AI_SEED").first()
        if seeded_record:
            has_seed = True
            active_marker = SEED_MARKER_DISEASE

        if unit_clean == "HEADS":
            # Track affected animals count
            monthly_data = (
                base_qs.annotate(month=TruncMonth("record_date"))
                .values("month")
                .annotate(total_quantity=Sum("affected_count"), latest_event_date=Max("record_date"), latest_approval=Max("reviewed_at"),
                          latest_creation=Max("created_at"), total_records=Count("pk"),
                          reviewed_records=Count("reviewed_at"), created_records=Count("created_at"))
                .order_by("month")
            )
        else:
            # Track distinct clinical case events (default: CASES)
            unit_clean = "CASES"
            monthly_data = (
                base_qs.annotate(month=TruncMonth("record_date"))
                .values("month")
                .annotate(total_quantity=Count("id"), latest_event_date=Max("record_date"), latest_approval=Max("reviewed_at"),
                          latest_creation=Max("created_at"), total_records=Count("pk"),
                          reviewed_records=Count("reviewed_at"), created_records=Count("created_at"))
                .order_by("month")
            )
        records = list(monthly_data)

    elif domain == "mortality":
        # ---------------------------------------------------------------------
        # DOMAIN: LIVESTOCK MORTALITY
        # ---------------------------------------------------------------------
        base_qs = scope_reviewer_queryset(MortalityRecord.objects.all(), user).filter(
            status=MortalityRecord.MortalityRecordStatus.APPROVED
        )
        if target_clean not in ("ALL", "DEATHS", "HEADS", ""):
            base_qs = base_qs.filter(cause__icontains=target_clean)

        seeded_record = base_qs.filter(review_remarks__contains="AI_SEED").first()
        if seeded_record:
            has_seed = True
            active_marker = SEED_MARKER_MORTALITY

        unit_clean = "HEADS"
        monthly_data = (
            base_qs.annotate(month=TruncMonth("record_date"))
            .values("month")
            .annotate(total_quantity=Sum("death_count"), latest_event_date=Max("record_date"), latest_approval=Max("reviewed_at"),
                      latest_creation=Max("created_at"), total_records=Count("pk"),
                      reviewed_records=Count("reviewed_at"), created_records=Count("created_at"))
            .order_by("month")
        )
        records = list(monthly_data)

    elif domain == "slaughter":
        # ---------------------------------------------------------------------
        # DOMAIN: MUNICIPAL SLAUGHTERHOUSE
        # ---------------------------------------------------------------------
        base_qs = scope_reviewer_queryset(SlaughterRecord.objects.all(), user).filter(
            status=SlaughterRecord.StatusType.APPROVED
        )
        if target_clean not in ("ALL", "HEADS", "WEIGHT", "KILOGRAMS", ""):
            base_qs = base_qs.filter(livestock_type__name__icontains=target_clean)

        seeded_record = base_qs.filter(review_remarks__contains="AI_SEED").first()
        if seeded_record:
            has_seed = True
            active_marker = SEED_MARKER_SLAUGHTER

        if unit_clean in ("KILOGRAMS", "KG", "WEIGHT"):
            unit_clean = "KILOGRAMS"
            unmeasured_target_records = base_qs.filter(carcass_weight__isnull=True).count()
            monthly_data = (
                base_qs.annotate(month=TruncMonth("record_date"))
                .values("month")
                .annotate(total_quantity=Sum("carcass_weight"), latest_event_date=Max("record_date"), latest_approval=Max("reviewed_at"),
                          latest_creation=Max("created_at"), total_records=Count("pk"),
                          reviewed_records=Count("reviewed_at"), created_records=Count("created_at"))
                .order_by("month")
            )
        else:
            unit_clean = "HEADS"
            monthly_data = (
                base_qs.annotate(month=TruncMonth("record_date"))
                .values("month")
                .annotate(total_quantity=Sum("quantity"), latest_event_date=Max("record_date"), latest_approval=Max("reviewed_at"),
                          latest_creation=Max("created_at"), total_records=Count("pk"),
                          reviewed_records=Count("reviewed_at"), created_records=Count("created_at"))
                .order_by("month")
            )
        records = list(monthly_data)

    elif domain == "auction":
        # ---------------------------------------------------------------------
        # DOMAIN: COMPLETED LIVE ANIMAL OWNERSHIP TRANSFERS
        # ---------------------------------------------------------------------
        base_qs = scope_reviewer_queryset(LivestockOwnershipTransfer.objects.all(), user).filter(
            status=LivestockOwnershipTransfer.Status.APPROVED
        )
        event_date_field = "transfer_date"
        if target_clean not in ("ALL", "HEADS", "SALES", "TRANSACTIONS", "PHP", ""):
            base_qs = base_qs.filter(livestock__livestock_type__name__icontains=target_clean)

        # Check for synthetic test seed markers so test datasets are clearly flagged
        # (This allows safe cleaning via python manage.py seed_auction --clean without touching real records)
        seeded_record = base_qs.filter(review_remarks__contains="AI_SEED").first()
        if seeded_record:
            has_seed = True
            active_marker = next((marker for marker in (
                SEED_MARKER_FORECAST_QUALITY_IDEAL,
                SEED_MARKER_FORECAST_QUALITY_POOR,
                SEED_MARKER_AUCTION,
            ) if marker in (seeded_record.review_remarks or "")), "AI_SEED")

        if unit_clean in ("PHP", "VALUE", "TOTAL_PRICE"):
            unit_clean = "PHP"
            unmeasured_target_records = base_qs.filter(purchase_price__isnull=True).count()
            monthly_data = (
                base_qs.annotate(month=TruncMonth("transfer_date"))
                .values("month")
                .annotate(total_quantity=Sum("purchase_price"), latest_event_date=Max("transfer_date"), latest_approval=Max("reviewed_at"),
                          latest_creation=Max("created_at"), total_records=Count("pk"),
                          reviewed_records=Count("reviewed_at"), created_records=Count("created_at"))
                .order_by("month")
            )
        else:
            unit_clean = "HEADS"
            monthly_data = (
                base_qs.annotate(month=TruncMonth("transfer_date"))
                .values("month")
                .annotate(total_quantity=Count("livestock_id", distinct=True), latest_event_date=Max("transfer_date"), latest_approval=Max("reviewed_at"),
                          latest_creation=Max("created_at"), total_records=Count("pk"),
                          reviewed_records=Count("reviewed_at"), created_records=Count("created_at"))
                .order_by("month")
            )
        records = list(monthly_data)

    else:
        # Fallback to empty series for unknown domain
        records = []
        base_qs = ProductionRecord.objects.none()

    # A current calendar month is still in progress, so its total may be partial.
    # Keep it out of the model history instead of treating a month-to-date value
    # as a complete monthly observation.
    current_month_start = date(timezone.localdate().year, timezone.localdate().month, 1)
    # TruncMonth can yield either datetime or date objects depending on the
    # database backend. Convert both to a pandas Timestamp before comparing.
    current_month_has_records = any(
        r.get("month") is not None and pd.Timestamp(r["month"]).date() >= current_month_start
        for r in records
    )

    # Filter out any None months if legacy records had null dates, plus the
    # incomplete current month. We do not fill missing months with fabricated zeros.
    records = [r for r in records if r.get("month") is not None and r.get("total_quantity") is not None]
    records = [
        r for r in records
        if pd.Timestamp(r["month"]).date() < current_month_start
    ]

    # Count absent calendar months so model results can disclose incomplete
    # coverage. An absent row could mean no activity or no submitted records.
    missing_months = []
    if records:
        observed_months = {pd.Timestamp(r["month"]).to_period("M") for r in records}
        first_month = min(observed_months)
        # Also disclose trailing months without eligible records through the last
        # fully completed calendar month; otherwise stale data can look current.
        last_month = (pd.Timestamp(current_month_start) - pd.offsets.MonthBegin(1)).to_period("M")
        missing_months = [
            str(month)
            for month in pd.period_range(first_month, last_month, freq="M")
            if month not in observed_months
        ]

    # A monthly observation becomes usable only when every included row has an
    # availability timestamp. Farmer production uses submission time.
    for row in records:
        if domain == "production":
            row["available_at"] = (
                timezone.localtime(row["latest_eligible_at"]).date()
                if row.get("latest_eligible_at") is not None
                and row.get("total_records") == row.get("eligible_timestamp_count")
                else None
            )
        else:
            row["available_at"] = (
                timezone.localtime(max(row.get("latest_approval"), row.get("latest_creation"))).date()
                if row.get("latest_approval") is not None
                and row.get("latest_creation") is not None
                and row.get("total_records") == row.get("reviewed_records")
                and row.get("total_records") == row.get("created_records")
                else None
            )

    def date_only(value):
        if value is None:
            return None
        return timezone.localtime(value).date().isoformat() if hasattr(value, "date") else value.isoformat()

    # Give reviewers an aggregate-only trace of when each month's value became
    # eligible. These are current-record timestamps, not immutable history.
    availability_timeline = [
        {
            "event_month": pd.Timestamp(row["month"]).strftime("%Y-%m"),
            "latest_event_date": date_only(row.get("latest_event_date")),
            "record_count": int(row.get("total_records") or 0),
            "latest_submitted_on": date_only(row.get("latest_creation")),
            "latest_approved_on": date_only(row.get("latest_approval")),
            "latest_eligible_on": date_only(row.get("latest_eligible_at")) if domain == "production" else None,
            "available_to_model_on": date_only(row.get("available_at")),
        }
        for row in records
    ]

    # Convert the raw database query results into a list of chronological data points
    historical_trend_points = [
        {
            "date": r["month"].strftime("%Y-%m-%d"),
            "month_label": r["month"].strftime("%b %Y"),
            "actual": float(r["total_quantity"]),
        }
        for r in records
    ]

    # Explicit Domain Scopes:
    # We explicitly define the geographic and administrative scope of the forecast here.
    # For example, disease and mortality are municipal-level aggregates (overall totals),
    # NOT spatial GIS barangay risk predictions.
    domain_scopes = {
        "production": "Municipal-level production output",
        "disease": "Municipal-level disease forecast",
        "mortality": "Municipality-wide mortality totals",
        "slaughter": "Municipal slaughterhouse (abattoir) throughput",
        "auction": "Approved municipal live-animal ownership transfers",
    }
    domain_scope = domain_scopes.get(domain, f"Municipal {domain} aggregate")

    # Compute deterministic readiness status & explanatory message
    target_definition = get_forecast_target_definition(domain, target_clean, unit_clean)
    min_observations_required = target_definition.get(
        "minimum_monthly_observations", MIN_OBSERVATIONS_REQUIRED
    )
    readiness_status, readiness_message = get_readiness_status(
        len(records), len(missing_months), min_observations_required
    )
    coverage_warning_parts = []
    if current_month_has_records:
        coverage_warning_parts.append(
            f"Records from the incomplete current month ({current_month_start:%Y-%m}) were excluded from model history."
        )
    if missing_months:
        coverage_warning_parts.append(
            f"There are {len(missing_months)} calendar month(s) with no eligible records. They were left missing, not treated as zero."
        )
    coverage_warning = " ".join(coverage_warning_parts) or None

    # Build standardized metadata dictionary passed downstream to evaluation and forecasting
    metadata = {
        "domain": domain,
        "scope": domain_scope,
        "target": target_clean,
        "unit": unit_clean,
        "frequency": "MONTHLY",
        "is_seeded": has_seed,
        "seed_marker": active_marker,
        "total_records": base_qs.count() if base_qs is not None else 0,
        "total_monthly_observations": len(records),
        # Observation counters consumed by frontend to display available vs required points:
        "available_observations": len(records),
        "required_observations": min_observations_required,
        "min_observations_required": min_observations_required,
        "quality_observations_threshold": QUALITY_OBSERVATIONS_THRESHOLD,
        "readiness_status": readiness_status,
        "readiness_details": readiness_message,
        "missing_months": missing_months,
        "missing_month_count": len(missing_months),
        "is_monthly_series_contiguous": not missing_months,
        "excluded_incomplete_current_month": current_month_has_records,
        "coverage_warning": coverage_warning,
        "historical_trend": historical_trend_points,
        "approval_timeline": availability_timeline,
        "approval_timeline_note": (
            "Production months become available after the latest recorded log was submitted. Historical approval-state rows are excluded. "
            "Official slaughter, disease, mortality, and transfer sources use their review timestamps. This is not "
            "a reconstruction of historical edits beyond stored timestamps."
            if domain == "production" else
            "Dates summarize currently approved records by event month. Each month is treated as available only "
            "after its latest submission and approval timestamps. This is not a reconstruction of historical edits."
        ),
        "target_definition": target_definition,
        "data_through_date": (
            base_qs.filter(**{f"{event_date_field}__lt": current_month_start}).aggregate(latest=Max(event_date_field))["latest"]
            if base_qs is not None else None
        ),
        "approval_cutoff_reconstructable": all(r.get("available_at") is not None for r in records),
        "unmeasured_target_records": unmeasured_target_records,
        "excluded_milk_session_conflict_records": excluded_milk_session_conflicts,
    }

    # Data sufficiency verification: NEVER force a model on sparse target-specific data.
    # If the user does not have 12 months yet, we return status="insufficient_data"
    # along with the historical points so the frontend can display honest ground truth without guessing.
    if len(records) < min_observations_required:
        metadata["status"] = "insufficient_data"
        metadata["forecast_available"] = False
        metadata["readiness_status"] = READINESS_NOT_READY
        metadata["message"] = (
            f"Insufficient historical data for {domain.title()} ({target_clean}): Found {len(records)} "
            f"monthly observation(s). At least {min_observations_required} monthly observations are required "
            f"to train, chronologically evaluate, and benchmark predictive forecasting models reliably "
            f"without fabricating synthetic scores."
        )
        return None, metadata

    if unmeasured_target_records:
        metadata["status"] = "incomplete_target_measurements"
        metadata["forecast_available"] = False
        metadata["readiness_status"] = READINESS_NOT_READY
        if domain == "slaughter":
            metadata["readiness_details"] = (
                f"{unmeasured_target_records} approved slaughter event(s) have no carcass weight. "
                "The monthly meat-yield totals may be partial, so the forecast is withheld."
            )
        elif domain == "auction" and unit_clean == "PHP":
            metadata["readiness_details"] = (
                f"{unmeasured_target_records} approved ownership transfer(s) have no recorded purchase price. "
                "Monthly transfer values may be partial, so the forecast is withheld."
            )
        else:
            metadata["readiness_details"] = "Some approved events are missing a required measurement, so the forecast is withheld."
        metadata["message"] = metadata["readiness_details"]
        return None, metadata

    # Monthly models and monthly horizons require one observation per calendar
    # month. Filling absent event/report months with zero would invent reporting
    # completeness, while dropping them would make adjacent rows look adjacent in
    # time. Keep actual history visible and withhold the forecast instead.
    if missing_months:
        metadata["status"] = "incomplete_coverage"
        metadata["forecast_available"] = False
        metadata["readiness_status"] = READINESS_NOT_READY
        metadata["readiness_details"] = (
            f"There are {len(missing_months)} months without eligible records. "
            "The system has no coverage log to distinguish zero activity from unreported data, "
            "so a monthly forecast is withheld."
        )
        metadata["message"] = metadata["readiness_details"]
        return None, metadata

    if not metadata["approval_cutoff_reconstructable"]:
        metadata["approval_history_note"] = (
            "One or more production periods lack reconstructable submission or historical approval timestamps. "
            "They remain usable in the present-time projection but are excluded from historical training cutoffs. "
            "Forecast generation and historical validation are reported separately."
            if domain == "production" else
            "One or more current approved periods lack reconstructable submission or approval timestamps. "
            "They remain usable in the present-time projection but are excluded from historical training cutoffs. "
            "Forecast generation and historical validation are reported separately."
        )

    rows = [
        {
            "month": pd.to_datetime(r["month"]),
            "quantity": float(r["total_quantity"]),
            "available_at": pd.Timestamp(r["available_at"]),
        }
        for r in records
    ]

    df = pd.DataFrame(rows)
    df.sort_values("month", inplace=True)
    df.reset_index(drop=True, inplace=True)

    metadata["status"] = "ready"
    metadata["forecast_available"] = True
    metadata["start_date"] = df["month"].min().strftime("%Y-%m-%d")
    metadata["end_date"] = df["month"].max().strftime("%Y-%m-%d")

    return df, metadata


def extract_monthly_production_series(
    production_type: str = "MILK",
    unit: str = "LITERS",
    user=None,
) -> Tuple[Optional[pd.DataFrame], Dict[str, Any]]:
    """
    Backward-compatible convenience wrapper for production series extraction.
    """
    return extract_monthly_series(
        domain="production",
        target=production_type,
        unit=unit,
        user=user,
    )


def prepare_tabular_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Transforms a 1D univariate time series into a supervised tabular dataset (X, y).

    Feature Engineering Explanation:
    Machine learning algorithms like Linear Regression and Random Forest do not inherently
    understand sequences or dates. They require row-by-row feature vectors.
    We create:
    1. Lag 1 (lag_1): Production from 1 month ago (t - 1).
    2. Lag 2 (lag_2): Production from 2 months ago (t - 2).
    3. Lag 3 (lag_3): Production from 3 months ago (t - 3).
    4. Rolling Mean (rolling_mean_3): The average production of the last 3 months,
       which smooths short-term noise and reveals local momentum.
    5. Calendar Time Index (time_step) captures elapsed months, including gaps.
    6. Month sine/cosine features represent annual seasonality as a continuous cycle.
    """
    df_feat = df.copy()

    # Use elapsed calendar months so a gap does not masquerade as one time step.
    first_month = df_feat["month"].iloc[0]
    df_feat["time_step"] = (
        (df_feat["month"].dt.year - first_month.year) * 12
        + (df_feat["month"].dt.month - first_month.month)
    )

    # Sine/cosine encode month as a cycle: December is close to January.
    month_angle = 2 * np.pi * (df_feat["month"].dt.month - 1) / 12
    df_feat["month_sin"] = np.sin(month_angle)
    df_feat["month_cos"] = np.cos(month_angle)

    # Lag features (previous values)
    df_feat["lag_1"] = df_feat["quantity"].shift(1)
    df_feat["lag_2"] = df_feat["quantity"].shift(2)
    df_feat["lag_3"] = df_feat["quantity"].shift(3)

    # Rolling window statistics (past 3 months mean)
    # Important: shift(1) ensures the rolling window only uses PAST data,
    # preventing current target 'quantity' from leaking into the feature!
    df_feat["rolling_mean_3"] = df_feat["quantity"].shift(1).rolling(window=3).mean()

    # Drop only rows without model features created by the lag window. In
    # particular, an unknown historical approval time must stay unknown rather
    # than deleting an otherwise usable observation from a forward forecast.
    df_feat.dropna(subset=["lag_1", "lag_2", "lag_3", "rolling_mean_3"], inplace=True)
    df_feat.reset_index(drop=True, inplace=True)

    return df_feat


def chronological_split(
    df: pd.DataFrame,
    test_ratio: float = 0.2,
    min_test_size: int = 4,
    max_test_size: int = 8,
) -> Tuple[pd.DataFrame, pd.DataFrame]:
    """
    Splits the time-series DataFrame chronologically into training and testing subsets.

    Why Chronological?
    In time series, we must simulate the real world:
      - We train on historical data up to time T.
      - We test our predictions on unseen future data after time T.
    Using shuffle=True would leak future observations into the training phase,
    falsely inflating metrics (a classic machine learning mistake).
    """
    n = len(df)
    test_size = int(np.round(n * test_ratio))
    test_size = max(min_test_size, min(test_size, max_test_size))

    split_idx = n - test_size

    train_df = df.iloc[:split_idx].copy()
    test_df = df.iloc[split_idx:].copy()

    return train_df, test_df

"""
Forecast Readiness & Validation Diagnostics Service.

Provides authoritative, evidence-based diagnostics for municipal livestock forecasts:
1. Data Readiness: Evaluates historical observation counts, event dates, continuity, and completeness.
2. Backtesting Process: Evaluates historical forecast cutoffs, training windows, and test outcomes.
3. Separation of Dimensions:
   - Forecast Availability: Can a forward projection be generated from the available history?
   - Validation Status: Has the model been chronologically evaluated against past actuals?
   - Data Readiness: Does the data meet minimum target-specific observation requirements?
4. Target Reporting Semantics:
   - Milk: Recurring monthly production.
   - Farmer Meat: Event-based farmer production (slaughter=None).
   - Slaughter Meat: Facility carcass weight events (missing weights not assumed zero).
   - Livestock Sales: Approved ownership transfer events and transferred heads (all weekdays included).
"""

from typing import Dict, Any, List, Optional
from datetime import date, timedelta
from django.utils import timezone
import pandas as pd
import numpy as np
from django.db.models import Count, Q, Sum
from django.utils.timezone import localdate

from livestock.models import LivestockOwnershipTransfer
from production.models import ProductionRecord, SlaughterRecord
from diseases.models import DiseaseCase, MortalityRecord
from smartlivestock.workflows import require_farmer_production_access, scope_reviewer_queryset
from .data import (
    extract_monthly_series,
    get_forecast_target_definition,
    get_readiness_status,
    MIN_OBSERVATIONS_REQUIRED,
    QUALITY_OBSERVATIONS_THRESHOLD,
    READINESS_NOT_READY,
    READINESS_READY,
    READINESS_QUALITY_READY,
)


def _farmer_production_records(user):
    require_farmer_production_access(user)
    return ProductionRecord.objects.filter(
        Q(farmer_at_record__user=user)
        | Q(farmer_at_record__isnull=True, livestock__farmer__user=user)
        | Q(farmer_at_record__isnull=True, batch__farmer__user=user)
    )
from .evaluation import evaluate_rolling_origins, MIN_VALID_BACKTEST_WINDOWS
from .forecasting import generate_future_forecast
from .auction_weekly import evaluate_weekly_auction, generate_weekly_auction_forecast


# Authoritative dashboard forecast targets
CORE_DIAGNOSTIC_TARGETS = [
    {
        "id": "milk",
        "domain": "production",
        "target": "MILK",
        "unit": "LITERS",
        "label": "Milk Production",
        "commodity_type": "MILK",
        "reporting_type": "RECURRING_MONTHLY",
        "description": "Farmer-recorded dairy output in liters across Padre Garcia farms.",
    },
    {
        "id": "farmer_meat",
        "domain": "production",
        "target": "MEAT",
        "unit": "KILOGRAMS",
        "label": "Farmer Meat Yield",
        "commodity_type": "MEAT",
        "reporting_type": "EVENT_BASED",
        "description": "Farmer-recorded meat yield not linked to an official slaughter record.",
    },
    {
        "id": "disease_reports", "domain": "disease", "target": "ALL", "unit": "CASES",
        "label": "Disease Reports", "commodity_type": "DISEASE_REPORTS", "reporting_type": "EVENT_BASED",
        "description": "Approved disease report counts by event month; reporting activity does not establish disease prevalence.",
    },
    {
        "id": "disease_heads", "domain": "disease", "target": "ALL", "unit": "HEADS",
        "label": "Disease Affected Heads", "commodity_type": "AFFECTED_HEADS", "reporting_type": "EVENT_BASED",
        "description": "Affected-head counts recorded in approved disease reports; repeated episodes may involve the same animal.",
    },
    {
        "id": "mortality_deaths", "domain": "mortality", "target": "ALL", "unit": "HEADS",
        "label": "Mortality Deaths", "commodity_type": "DEATHS", "reporting_type": "EVENT_BASED",
        "description": "Recorded death counts in approved mortality reports; missing periods are unknown and no historical population rate is implied.",
    },
    {
        "id": "slaughter_meat",
        "domain": "slaughter",
        "target": "ALL",
        "unit": "KILOGRAMS",
        "label": "Slaughter Meat Yield",
        "commodity_type": "CARCASS_WEIGHT",
        "reporting_type": "EVENT_BASED",
        "description": "Abattoir carcass weight yield (kg) from approved slaughter inspections.",
    },
    {
        "id": "livestock_sales",
        "domain": "auction",
        "target": "ALL",
        "unit": "HEADS",
        "label": "Livestock Sales",
        "commodity_type": "LIVE_ANIMALS",
        "reporting_type": "TRANSACTION_BASED",
        "description": "Approved ownership transfers (one animal per transfer event), including transfers on all weekdays.",
    },
    {
        "id": "registered_cattle_price",
        "domain": "auction",
        "target": "CATTLE",
        "unit": "PHP_PER_HEAD",
        "transfer_source": "REGISTERED",
        "label": "Registered Cattle Price per Head",
        "commodity_type": "LIVE_ANIMAL_PRICE",
        "reporting_type": "SALE_PRICE_BASED",
        "description": "Weekly average recorded price per head for approved cattle transfers linked to registered inventory.",
    },
    {
        "id": "external_cattle_price",
        "domain": "auction",
        "target": "CATTLE",
        "unit": "PHP_PER_HEAD",
        "transfer_source": "EXTERNAL",
        "label": "External Cattle Price per Head",
        "commodity_type": "LIVE_ANIMAL_PRICE",
        "reporting_type": "SALE_PRICE_BASED",
        "description": "Weekly average recorded price per head for approved external-market cattle transfers.",
    },
]


def _approval_status_breakdown(
    domain: str, target: str, unit: str, user=None, transfer_source: Optional[str] = None
) -> Dict[str, Any]:
    """Count target-source rows by their actual workflow status, within reviewer scope."""
    current_month = localdate().replace(day=1)
    domain = (domain or "").lower()
    target = (target or "").upper()
    unit = (unit or "").upper()

    if domain == "production":
        queryset = _farmer_production_records(user).filter(
            production_type=target,
            unit=unit,
            status=ProductionRecord.ProductionStatus.RECORDED,
            record_date__lt=current_month,
        )
        if target == ProductionRecord.ProductionType.MEAT:
            queryset = queryset.filter(slaughter__isnull=True)
        model = ProductionRecord
        scope_note = (
            "Status context for production records dated before the current month; routine RECORDED farmer logs do not require review. "
            "Farmer meat excludes records linked to slaughter. Counts are source rows, not forecast months."
        )
    elif domain in ("disease", "mortality"):
        model = DiseaseCase if domain == "disease" else MortalityRecord
        queryset = scope_reviewer_queryset(model.objects.all(), user).filter(record_date__lt=current_month)
        scope_note = "Workflow totals count source reports before the current month. Forecasting uses approved records; reports, affected heads, and deaths remain separate targets."
    elif domain == "slaughter":
        queryset = scope_reviewer_queryset(SlaughterRecord.objects.all(), user).filter(
            record_date__lt=current_month,
        )
        model = SlaughterRecord
        scope_note = "Current workflow status for slaughter events dated before the current month; status totals count events, not measured yield."
    elif domain == "auction":
        today = localdate()
        current_week = today - timedelta(days=today.weekday())
        queryset = scope_reviewer_queryset(LivestockOwnershipTransfer.objects.all(), user).filter(
            transfer_date__lt=current_week,
        )
        if target not in {"ALL", "HEADS", "TRANSACTIONS", "SALES", "PHP", "PHP_PER_HEAD", "AVG_PHP_PER_HEAD", "PRICE_PER_HEAD"}:
            queryset = queryset.filter(
                Q(livestock__livestock_type__name__icontains=target)
                | Q(external_livestock_type__icontains=target)
            )
        source = (transfer_source or "").strip().upper()
        if source == "REGISTERED":
            queryset = queryset.filter(livestock__isnull=False)
            scope_note = "Status of transfers linked to registered livestock records and dated before the current Monday; counts are transfer events."
        elif source == "EXTERNAL":
            queryset = queryset.filter(livestock__isnull=True)
            scope_note = "Status of external-market transfer records dated before the current Monday; counts are transfer events."
        else:
            scope_note = "Current workflow status for ownership transfers dated before the current Monday; status totals count transfer events, not distinct animals or market coverage."
        model = LivestockOwnershipTransfer
    else:
        return {
            "available": False,
            "source_model": None,
            "total_records": None,
            "statuses": [],
            "scope_note": "This forecast source does not expose approval-status diagnostics.",
        }

    grouped = list(queryset.values("status").annotate(count=Count("pk", distinct=True)))
    counts = {row["status"]: row["count"] for row in grouped}
    choices = dict(model._meta.get_field("status").choices)
    statuses = [
        {"status": code, "label": label, "count": counts.pop(code, 0)}
        for code, label in choices.items()
    ]
    statuses.extend(
        {"status": code or "UNKNOWN", "label": code or "Unknown status", "count": count}
        for code, count in counts.items()
    )
    return {
        "available": True,
        "source_model": model.__name__,
        "total_records": sum(row["count"] for row in grouped),
        "statuses": statuses,
        "scope_note": scope_note,
    }


def _build_readiness_checklist(
    domain: str,
    target: str,
    unit: str,
    meta: Dict[str, Any],
    usable_observations: int,
    min_required: int,
    valid_cutoffs: int,
    total_cutoffs: int,
    forecast_available: bool,
    validation_status: str,
    minimum_valid_windows: int = MIN_VALID_BACKTEST_WINDOWS,
) -> List[Dict[str, Any]]:
    """Builds a structured 12-item checklist explaining what was checked, actual vs expected, and next steps."""
    total_records = meta.get("total_records", 0)
    missing_months = meta.get("missing_months", [])
    missing_month_count = len(missing_months)
    unmeasured = meta.get("unmeasured_target_records", 0)
    approval_reconstructable = meta.get("approval_cutoff_reconstructable", False)
    data_through_date = meta.get("data_through_date")
    target_def = meta.get("target_definition", {})

    checklist: List[Dict[str, Any]] = []

    # 1. Historical Records Found
    checklist.append({
        "id": "records_found",
        "title": "Historical Records in System",
        "category": "DATA_COLLECTION",
        "status": "PASSED" if total_records > 0 else "BLOCKED",
        "actual_value": f"{total_records} record(s)",
        "expected_requirement": "At least 1 record",
        "explanation": (
            f"Municipal analytics contain eligible farmer-recorded {target} production ({unit})."
            if domain == "production" else
            f"Official municipal database contains recorded {domain} entries for {target} ({unit})."
        ),
        "action_needed": (
            "Farmers can submit production through their production log."
            if domain == "production" and total_records == 0 else
            "Submit records through the standard municipal encoder workflow."
            if total_records == 0 else None
        ),
        "resolution_type": "DATA_COLLECTION",
    })

    # Production forecasting uses RECORDED farmer logs only. Other forecast
    # domains continue to require their own approved source records.
    production_source = domain == "production"
    checklist.append({
        "id": "approved_records",
        "title": "Production Records Used" if production_source else "Approved Records Used",
        "category": "DATA_COLLECTION",
        "status": "PASSED" if total_records > 0 else "BLOCKED",
        "actual_value": f"{total_records} eligible record(s)" if production_source else f"{total_records} approved record(s)",
        "expected_requirement": (
            "Only farmer-submitted production records are used"
            if production_source else "Only approved records are used"
        ),
        "explanation": (
            "Farmers submit production records directly. Older records marked pending, checked, or returned are left out."
            if production_source else
            "Drafts, records awaiting review, and returned records are left out so estimates use approved information."
        ),
        "action_needed": (
            "Record production logs through the farmer production workflow."
            if production_source and total_records == 0 else
            "Finish reviewing and approving these records before they can be used."
            if not production_source and total_records == 0 else None
        ),
        "resolution_type": "DATA_COLLECTION",
    })

    # 3. Valid Event Dates
    if data_through_date:
        try:
            formatted_date = pd.to_datetime(data_through_date).strftime("%B %d, %Y")
        except Exception:
            formatted_date = str(data_through_date)
        date_actual_val = f"Through {formatted_date}"
    else:
        date_actual_val = "No valid dates"

    checklist.append({
        "id": "valid_event_dates",
        "title": "Valid record dates",
        "category": "DATA_COLLECTION",
        "status": "PASSED" if data_through_date is not None else ("WARNING" if total_records > 0 else "BLOCKED"),
        "actual_value": date_actual_val,
        "expected_requirement": "Records dated before the current month",
        "explanation": "Records need a valid date. The current, incomplete month is not included in past-record checks.",
        "action_needed": "Verify record event dates if submissions fail validation." if not data_through_date else None,
        "resolution_type": "DATA_COLLECTION",
    })

    # 4. Sufficient Historical Time Span
    has_sufficient_span = usable_observations >= min_required
    checklist.append({
        "id": "time_span",
        "title": "Enough months of records",
        "category": "DATA_COLLECTION",
        "status": "PASSED" if has_sufficient_span else ("WARNING" if usable_observations >= 12 else "BLOCKED"),
        "actual_value": f"Records cover {usable_observations} month(s)",
        "expected_requirement": f"At least {min_required} months required ({target_def.get('minimum_rule', 'Standard threshold')})",
        "explanation": target_def.get("minimum_rule", f"At least {min_required} months of records are needed to make an estimate."),
        "action_needed": f"Continue collecting monthly records as new calendar months elapse ({max(0, min_required - usable_observations)} more months needed)." if not has_sufficient_span else None,
        "resolution_type": "DATA_COLLECTION",
    })

    # 5. Required Monthly Observations
    checklist.append({
        "id": "monthly_observations",
        "title": "Months with records",
        "category": "DATA_COLLECTION",
        "status": "PASSED" if usable_observations >= min_required else "BLOCKED",
        "actual_value": f"{usable_observations} of {min_required} months needed",
        "expected_requirement": f"Records for {min_required} complete months",
        "explanation": "Each month is counted from approved records. Missing months are not treated as zero activity.",
        "action_needed": f"Add complete records for {max(0, min_required - usable_observations)} more month(s)." if usable_observations < min_required else None,
        "resolution_type": "DATA_COLLECTION",
    })

    # 6. Missing or Incomplete Periods
    is_continuous = missing_month_count == 0 and usable_observations > 0
    checklist.append({
        "id": "timeline_continuity",
        "title": "No missing months",
        "category": "DATA_QUALITY",
        "status": "PASSED" if is_continuous else ("WARNING" if missing_month_count > 0 else "BLOCKED"),
        "actual_value": "Records found for every month" if is_continuous else f"{missing_month_count} month(s) without records",
        "expected_requirement": "Records for each month in the period",
        "explanation": "A month without records may mean no activity or no report. It is not counted as zero activity.",
        "action_needed": "Ensure routine monthly submissions so future months remain continuous." if missing_month_count > 0 else None,
        "resolution_type": "DATA_COLLECTION",
    })

    # 7. Target Measurement Completeness
    has_unmeasured = unmeasured > 0
    checklist.append({
        "id": "measurement_completeness",
        "title": "Required values recorded",
        "category": "DATA_QUALITY",
        "status": "WARNING" if has_unmeasured else "PASSED",
        "actual_value": f"{unmeasured} record(s) missing a required value" if has_unmeasured else "All required values are recorded",
        "expected_requirement": "Record the required amounts, such as slaughter weight",
        "explanation": "Records missing a required amount cannot be included in totals that use that amount.",
        "action_needed": "Ensure inspectors enter measured weights on all future records." if has_unmeasured else None,
        "resolution_type": "DATA_COLLECTION",
    })

    # 8. Historical availability timestamp reliability
    production_source = domain == "production"
    checklist.append({
        "id": "timestamp_reliability",
        "title": "Record dates for past checks",
        "category": "VALIDATION_INTEGRITY",
        "status": "PASSED" if approval_reconstructable else "WARNING",
        "actual_value": "Dates are available" if approval_reconstructable else "Some records are missing dates",
        "expected_requirement": (
            "Production records include their submission dates"
            if production_source else "Approved records include their creation and review dates"
        ),
        "explanation": "Past checks use only records that were available at the time. Dates help keep later records out of earlier checks.",
        "action_needed": "New records get dates automatically. Missing past dates cannot be safely added later." if not approval_reconstructable else None,
        "resolution_type": "DATA_COLLECTION",
    })

    # 9. Valid Historical Forecast Cutoffs
    has_cutoffs = valid_cutoffs >= minimum_valid_windows
    checklist.append({
        "id": "qualifying_cutoffs",
        "title": "Past forecasts checked",
        "category": "VALIDATION_INTEGRITY",
        "status": "PASSED" if has_cutoffs else ("WARNING" if total_cutoffs > 0 else "BLOCKED"),
        "actual_value": f"{valid_cutoffs} of {total_cutoffs} past checks completed",
        "expected_requirement": f"Complete at least {minimum_valid_windows} past checks",
        "explanation": (
            "A past check can be completed only if enough production records were available by that date."
            if production_source else
            "A past check can be completed only if enough records had been approved by that date."
        ),
        "action_needed": (
            "As dated production records are added, more past checks may become possible."
            if production_source else
            "As municipal records are approved and dated, more past checks may become possible."
        ) if not has_cutoffs else None,
        "resolution_type": "DATA_COLLECTION",
    })

    # 10. Model Training Execution
    checklist.append({
        "id": "model_training",
        "title": "Prediction methods ready",
        "category": "MODEL_EXECUTION",
        "status": "PASSED" if usable_observations >= 12 else "BLOCKED",
        "actual_value": "Methods can be compared" if usable_observations >= 12 else "More records are needed",
        "expected_requirement": "Enough past records to compare prediction methods",
        "explanation": "Several prediction methods are compared using past records.",
        "action_needed": "Add more monthly records before comparing methods." if usable_observations < 12 else None,
        "resolution_type": "DATA_COLLECTION",
    })

    # 11. Baseline Comparison
    checklist.append({
        "id": "baseline_comparison",
        "title": "Compare with a simple forecast",
        "category": "MODEL_EXECUTION",
        "status": "PASSED" if validation_status == "VALIDATED" else "WARNING",
        "actual_value": "Comparison completed" if validation_status == "VALIDATED" else "More past checks are needed",
        "expected_requirement": "Check whether a more advanced method beats a simple forecast",
        "explanation": "The method with the smallest average difference from recorded values is selected.",
        "action_needed": "More completed past checks are needed for this comparison." if validation_status != "VALIDATED" else None,
        "resolution_type": "DATA_COLLECTION",
    })

    # 12. Forecast Generation Availability
    checklist.append({
        "id": "forecast_generation",
        "title": "Estimate availability",
        "category": "FORECAST_DELIVERY",
        "status": "PASSED" if forecast_available else "BLOCKED",
        "actual_value": "Estimate available" if forecast_available else "More records are needed",
        "expected_requirement": "Enough past records to estimate upcoming months",
        "explanation": "Uses past records to estimate upcoming months.",
        "action_needed": "Satisfy data requirements above to generate projections." if not forecast_available else None,
        "resolution_type": "DATA_COLLECTION",
    })

    return checklist


def _get_auction_weekly_diagnostics(
    target: str, unit: str, user, horizon_weeks: int, transfer_source: Optional[str] = None
) -> Dict[str, Any]:
    """Build auction readiness data using weekly, not monthly, observations."""
    evaluation = evaluate_weekly_auction(target, unit, horizon_weeks, user, transfer_source)
    forecast_result = (
        generate_weekly_auction_forecast(
            target, unit, horizon_weeks, user=user, transfer_source=transfer_source
        )
        if evaluation.get("forecast_available") else evaluation
    )
    data = evaluation.get("data", {})
    progress_count = evaluation.get("available_observations", 0)
    required_count = evaluation.get("required_observations", 12)
    valid_cutoffs = evaluation.get("backtesting", {}).get("valid_windows", 0)
    attempted_cutoffs = evaluation.get("backtesting", {}).get("requested_windows", 0)
    # One or two folds are useful preliminary evidence; call validation established
    # only after at least three distinct full horizons have been tested.
    validation_status = "VALIDATED" if valid_cutoffs >= 3 else (
        "NOT_YET_VALIDATED" if progress_count >= required_count else "INSUFFICIENT_DATA"
    )
    forecast_status = (
        "READY" if evaluation.get("forecast_available") and validation_status == "VALIDATED"
        else "AVAILABLE_UNVALIDATED" if evaluation.get("forecast_available")
        else "INSUFFICIENT_DATA"
    )
    scoped_sales = scope_reviewer_queryset(LivestockOwnershipTransfer.objects.all(), user)
    target_clean = (target or "ALL").upper()
    if target_clean not in {"ALL", "HEADS", "TRANSACTIONS", "SALES", "PHP", "PHP_PER_HEAD", "AVG_PHP_PER_HEAD", "PRICE_PER_HEAD"}:
        scoped_sales = scoped_sales.filter(
            Q(livestock__livestock_type__name__icontains=target_clean)
            | Q(external_livestock_type__icontains=target_clean)
        )
    source = (transfer_source or "").strip().upper()
    if source == "REGISTERED":
        scoped_sales = scoped_sales.filter(livestock__isnull=False)
    elif source == "EXTERNAL":
        scoped_sales = scoped_sales.filter(livestock__isnull=True)
    price_source_label = (
        "registered cattle" if source == "REGISTERED" else
        "external cattle" if source == "EXTERNAL" else
        "cattle"
    )
    approved_qs = scoped_sales.filter(status=LivestockOwnershipTransfer.Status.APPROVED)
    missing_review_count = approved_qs.filter(reviewed_at__isnull=True).count()
    synthetic_count = approved_qs.filter(review_remarks__contains="AI_SEED").count()
    source_diagnostics = {
        "approved_transfers": approved_qs.count(),
        "pending_transfers": scoped_sales.filter(status=LivestockOwnershipTransfer.Status.PENDING).count(),
        "verified_transfers": scoped_sales.filter(status=LivestockOwnershipTransfer.Status.VERIFIED).count(),
        "returned_transfers": scoped_sales.filter(status=LivestockOwnershipTransfer.Status.SUBJECT_TO_REVISION).count(),
        "approved_without_review_timestamp": missing_review_count,
        "synthetic_transfers": synthetic_count,
        "weekday_activity": evaluation.get("weekday_activity", []),
        "weekday_pattern_estimable": False,
        "weekday_pattern_note": evaluation.get("weekday_pattern_note"),
        "coverage_status": "UNKNOWN",
        "coverage_note": data.get("coverage_note"),
        "duplicate_detection_note": "Each approved transfer is counted once. If the same animal is transferred again later, that is a separate sale.",
    }
    missing_weeks = data.get("missing_weeks", [])
    message = evaluation.get("message", "Past checks are not available for livestock transfers.")
    if missing_review_count:
        message += f" {missing_review_count} approved transfer(s) have no review date, so we cannot tell whether they were approved by the date being checked."
    if synthetic_count:
        message += " The current records include synthetic demo entries; any estimate that uses them is for demonstration, not a report of real market prices or activity."
    checklist = [
        {"id": "approved_transfers", "title": "Approved ownership transfers", "category": "DATA_COLLECTION",
         "status": "PASSED" if approved_qs.exists() else "BLOCKED", "actual_value": f"{approved_qs.count()} approved transfer event(s)",
         "expected_requirement": "Only approved livestock transfers count as completed sales",
         "explanation": "An approved transfer counts as one sale. Listings, inventory changes, and animal movements are not counted as extra sales.",
         "action_needed": None if approved_qs.exists() else "Record completed ownership transfers through the existing transfer workflow.", "resolution_type": "DATA_COLLECTION"},
        {"id": "weekly_history", "title": "Complete weeks of records", "category": "DATA_QUALITY",
         "status": "PASSED" if evaluation.get("forecast_available") else "WARNING",
         "actual_value": f"{progress_count} observed week(s); {len(missing_weeks)} week(s) without complete values",
         "expected_requirement": (
             f"At least {required_count} consecutive weekly cattle price averages, with every transfer priced"
             if unit == "PHP_PER_HEAD" else
             f"At least {required_count} complete weeks in a row"
         ),
         "explanation": (
             "A weekly average is unknown when a cattle transfer has no price or the week has no priced transfer."
             if unit == "PHP_PER_HEAD" else
             "When no transfer is recorded, we cannot tell whether there were no sales or no records."
         ),
         "action_needed": evaluation.get("message") if not evaluation.get("forecast_available") else None, "resolution_type": "DATA_QUALITY"},
        {"id": "weekday_pattern", "title": "Thursday and Friday activity pattern", "category": "DATA_QUALITY",
         "status": "WARNING", "actual_value": "Only approved transfers recorded in SmartLivestock",
         "expected_requirement": "A record of market activity for each day",
         "explanation": evaluation.get("weekday_pattern_note", "No weekday coverage is recorded."),
         "action_needed": "A daily record of market activity is needed to compare sales by weekday.",
         "resolution_type": "DATA_COLLECTION"},
        {"id": "historical_cutoffs", "title": "Past forecast checks", "category": "VALIDATION_INTEGRITY",
         "status": "PASSED" if valid_cutoffs >= 3 else "WARNING",
         "actual_value": f"{valid_cutoffs} of {attempted_cutoffs} past checks completed",
         "expected_requirement": "Enough approved records must be available for each past check",
         "explanation": data.get("approval_timeline_note", "Saved dates show when approved records became available."),
         "action_needed": "Some review dates are missing, so fewer past periods can be checked." if valid_cutoffs < 3 else None,
         "resolution_type": "VALIDATION_INTEGRITY"},
    ]
    forecast_points = forecast_result.get("forecast", [])
    chart_data = forecast_result.get("chart_data", [
        {**row, "forecast": None, "is_future": False} for row in evaluation.get("historical_trend", [])
    ])
    return {
        "metric_id": f"auction_{target_clean.lower()}_{unit.lower()}" + (f"_{source.lower()}" if source else ""),
        "domain": "auction", "target": target_clean,
        "unit": evaluation.get("target", {}).get("unit", unit),
        "transfer_source": source or None,
        "label": (
            f"{price_source_label.title()} price per head" if unit == "PHP_PER_HEAD" else
            "Completed transfer events" if unit == "TRANSACTIONS" else
            "Animals transferred" if unit == "HEADS" else
            "Recorded transfer value"
        ),
        "source": (
            f"Approved {price_source_label} transfers" if source else
            "Approved livestock transfers"
        ), "frequency": "WEEKLY",
        "reporting_type": "SALE_PRICE_BASED" if unit == "PHP_PER_HEAD" else "TRANSFER_EVENT_BASED",
        "expected_reporting": (
            f"Each approved {price_source_label} transfer should have a recorded purchase price. A week without priced transfers has no known average."
            if unit == "PHP_PER_HEAD" else
            "SmartLivestock does not record all market activity. A week without transfers may mean no sale or missing records."
        ),
        "minimum_rule": (
            f"At least {required_count} complete weekly {price_source_label} price averages in a row, with a price on every included approved transfer."
            if unit == "PHP_PER_HEAD" else
            f"At least {required_count} complete weeks of records in a row. Missing weeks are not counted as zero."
        ),
        "forecast_status": forecast_status, "forecast_available": evaluation.get("forecast_available", False),
        "validation_status": validation_status,
        "validation_details": (
            f"{valid_cutoffs} weekly past check(s) were completed. "
            "At least three are needed before we can say the estimates have been checked enough."
        ),
        "readiness_status": evaluation.get("readiness_status", "NOT_READY"),
        "readiness_details": evaluation.get("readiness_details", message),
        "blocker_summary": message,
        "next_step": (
            f"Keep approved {price_source_label} transfer dates and prices complete. This average does not adjust for weight, breed, age, or sex."
            if unit == "PHP_PER_HEAD" and evaluation.get("forecast_available") else
            f"Continue recording and approving {price_source_label} transfers with prices. A week without priced transfers has no known average."
            if unit == "PHP_PER_HEAD" else
            "Keep weekly transfer records complete and dated. Record daily market activity to compare sales by weekday."
            if evaluation.get("forecast_available") else
            "Continue recording and approving transfers. Without daily market records, we cannot tell whether weeks without transfers had no sales."
        ),
        "progress": {
            "usable_observations": progress_count, "required_observations": required_count,
            "observations_progress_pct": min(100, int(round(progress_count / max(1, required_count) * 100))),
            "quality_threshold": 52, "total_records": data.get("total_records", 0),
            "missing_month_count": len(missing_weeks), "missing_months": missing_weeks,
            "missing_week_count": len(missing_weeks), "missing_weeks": missing_weeks,
            "unmeasured_records": data.get("unmeasured_value_records", 0),
            "approval_reconstructable": data.get("approval_cutoff_reconstructable", False),
            "valid_cutoffs_count": valid_cutoffs, "total_cutoffs_count": attempted_cutoffs,
            "milestone_label": f"{progress_count} of {required_count} weeks recorded",
            "data_through_date": data.get("last_complete_week"),
            "auction_diagnostics": source_diagnostics,
        },
        "checklist": checklist,
        "backtesting": {
            "valid_cutoffs_count": valid_cutoffs, "total_attempted_cutoffs": attempted_cutoffs,
            "minimum_required_windows": 3, "evaluation_horizon_months": 0,
            "evaluation_horizon_weeks": evaluation.get("backtesting", {}).get("horizon_weeks", horizon_weeks),
            "cutoffs": evaluation.get("backtesting", {}).get("diagnostics", []),
            "winning_model": evaluation.get("selection", {}).get("selected_model"),
            "baseline_mae": evaluation.get("baseline_mae"),
            "selected_mae": evaluation.get("selected_model_mae"),
            "models": {item["name"]: item for item in evaluation.get("models", [])},
        },
        "forecast": {
            "model_name": forecast_result.get("model") or evaluation.get("selection", {}).get("selected_model"),
            "horizon_months": 0, "horizon_weeks": evaluation.get("backtesting", {}).get("horizon_weeks", horizon_weeks),
            "forecast_points": forecast_points, "chart_data": chart_data,
            "metadata": forecast_result.get("metadata", {}),
        },
        "last_evaluated_at": timezone.now().isoformat(),
    }


def get_forecast_readiness_diagnostics(
    domain: str = "production",
    target: str = "MILK",
    unit: str = "LITERS",
    user=None,
    horizon_months: int = 6,
    transfer_source: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Generates a complete, evidence-based diagnostic assessment for a specific municipal forecast target.
    Separates:
      - Forecast availability (can a projection be produced?)
      - Validation status (was it evaluated on historical cutoffs?)
      - Data readiness (does the dataset meet observation standards?)
    """
    domain = (domain or "production").lower()
    if domain == "production":
        require_farmer_production_access(user)
    target_clean = (target or "MILK").upper()
    unit_clean = (unit or "LITERS").upper()

    required_validation_windows = (
        3 if domain == "slaughter" or (domain == "production" and target_clean == "MEAT")
        else MIN_VALID_BACKTEST_WINDOWS
    )

    if domain == "auction":
        diagnostic = _get_auction_weekly_diagnostics(
            target=target_clean,
            unit=unit_clean,
            user=user,
            horizon_weeks=horizon_months,
            transfer_source=transfer_source,
        )
        diagnostic["progress"]["approval_status_breakdown"] = _approval_status_breakdown(
            domain, target_clean, unit_clean, user, transfer_source
        )
        return diagnostic

    target_def = get_forecast_target_definition(domain, target_clean, unit_clean)
    min_required = target_def.get("minimum_monthly_observations", MIN_OBSERVATIONS_REQUIRED)

    # Step 1: Extract monthly data series and source metadata
    df, meta = extract_monthly_series(
        domain=domain,
        target=target_clean,
        unit=unit_clean,
        user=user,
    )

    usable_observations = meta.get("available_observations", 0)
    missing_months = meta.get("missing_months", [])
    missing_month_count = len(missing_months)
    unmeasured_records = meta.get("unmeasured_target_records", 0)
    approval_reconstructable = meta.get("approval_cutoff_reconstructable", False)
    total_records = meta.get("total_records", 0)
    milk_diagnostics = None
    source_diagnostics = None
    if domain == "production" and target_clean == "MILK":
        cutoff_month = localdate().replace(day=1)
        scoped = _farmer_production_records(user).filter(
            production_type=ProductionRecord.ProductionType.MILK,
            unit=ProductionRecord.UnitType.LITERS,
            record_date__lt=cutoff_month,
        )
        eligible_records = scoped.filter(
            status=ProductionRecord.ProductionStatus.RECORDED,
            session_conflict=False,
        )
        session_days = list(
            eligible_records.values("record_date")
            .annotate(session_count=Count("milking_session", distinct=True), record_count=Count("pk"))
        )
        milk_diagnostics = {
            "usable_records": eligible_records.count(),
            "usable_production_days": eligible_records.values("record_date").distinct().count(),
            "records_with_approval_timestamp": eligible_records.filter(
                Q(status=ProductionRecord.ProductionStatus.RECORDED, created_at__isnull=False)
            ).count(),
            "records_with_availability_timestamp": eligible_records.filter(
                Q(status=ProductionRecord.ProductionStatus.RECORDED, created_at__isnull=False)
            ).count(),
            "monthly_observations": usable_observations,
            "months_with_records": usable_observations,
            "months_without_records": missing_month_count,
            "missing_months": missing_months,
            "days_with_one_session": sum(1 for row in session_days if row["session_count"] == 1 and row["record_count"] == 1),
            "days_with_two_sessions": sum(1 for row in session_days if row["session_count"] == 2 and row["record_count"] == 2),
            "days_with_three_sessions": sum(1 for row in session_days if row["session_count"] == 3 and row["record_count"] == 3),
            "days_with_unknown_or_conflicting_sessions": sum(1 for row in session_days if row["session_count"] != row["record_count"]),
            "pending_records": scoped.filter(status__in=["PENDING", "VERIFIED"]).count(),
            "returned_records": scoped.filter(status=ProductionRecord.ProductionStatus.SUBJECT_TO_REVISION).count(),
            "missing_approval_timestamp_records": scoped.filter(
                Q(status=ProductionRecord.ProductionStatus.RECORDED, created_at__isnull=True)
            ).count(),
            "excluded_duplicate_conflict_records": scoped.filter(
                status=ProductionRecord.ProductionStatus.RECORDED,
                session_conflict=True,
            ).count(),
            "session_completeness_note": (
                "These counts show recorded sessions only. A missing session is not treated as zero, "
                "and the system does not record whether a session was skipped or not applicable."
            ),
            "monthly_completeness_note": (
                "A month with eligible records is an observed total, not proof that every milking session was reported. "
                "A month without records does not prove zero production; no coverage log exists."
            ),
        }
    elif domain == "production" and target_clean == "MEAT":
        scoped = _farmer_production_records(user).filter(
            production_type=ProductionRecord.ProductionType.MEAT,
            unit=ProductionRecord.UnitType.KILOGRAMS,
            record_date__lt=localdate().replace(day=1),
        )
        eligible = scoped.filter(
            status=ProductionRecord.ProductionStatus.RECORDED
        )
        usable = eligible.filter(slaughter__isnull=True)
        source_diagnostics = {
            "source_record_type": "Farmer-submitted production records",
            "eligible_source_records": eligible.count(),
            "eligible_records_used": usable.count(),
            "recorded_source_records": eligible.filter(status=ProductionRecord.ProductionStatus.RECORDED).count(),
            "linked_to_slaughter_excluded": eligible.filter(slaughter__isnull=False).count(),
            "pending_or_verified_records": scoped.filter(status__in=["PENDING", "VERIFIED"]).count(),
            "returned_records": scoped.filter(status=ProductionRecord.ProductionStatus.SUBJECT_TO_REVISION).count(),
            "missing_approval_timestamp_records": usable.filter(
                Q(status=ProductionRecord.ProductionStatus.RECORDED, created_at__isnull=True)
            ).count(),
            "synthetic_records": usable.filter(notes__contains="AI_SEED").count(),
            "period_coverage_note": "Meat entries are event-based. Months without entries are unknown, not confirmed zero production.",
            "availability_note": "Farmer-submitted production records are counted from their submission date. Older records with review labels are left out.",
        }
    elif domain == "slaughter":
        scoped = scope_reviewer_queryset(SlaughterRecord.objects.all(), user).filter(
            record_date__lt=localdate().replace(day=1),
        )
        approved = scoped.filter(status=SlaughterRecord.StatusType.APPROVED)
        source_diagnostics = {
            "source_record_type": "Slaughter records",
            "approved_slaughter_events": approved.count(),
            "approved_heads_recorded": approved.aggregate(total=Sum("quantity"))["total"] or 0,
            "events_with_carcass_weight": approved.filter(carcass_weight__isnull=False).count(),
            "events_missing_carcass_weight": approved.filter(carcass_weight__isnull=True).count(),
            "pending_or_verified_records": scoped.filter(status__in=["PENDING", "VERIFIED"]).count(),
            "returned_records": scoped.filter(status=SlaughterRecord.StatusType.SUBJECT_TO_REVISION).count(),
            "missing_review_timestamp_records": approved.filter(reviewed_at__isnull=True).count(),
            "synthetic_records": approved.filter(review_remarks__contains="AI_SEED").count(),
            "period_coverage_note": "Slaughter entries are event-based; no event in a period is not proof of zero activity.",
            "availability_note": "The current review date is available, but older changes to a record may not be shown.",
        }

    # Step 2: Determine Data Readiness State
    readiness_status, readiness_details = get_readiness_status(
        usable_observations, missing_month_count, min_required
    )

    # Step 3: Run Rolling-Origin Cutoff Evaluation if series is extracted
    backtest_diagnostics: List[Dict[str, Any]] = []
    valid_cutoffs_count = 0
    total_attempted_cutoffs = 0
    model_metrics: Dict[str, Any] = {}
    validation_status = "INSUFFICIENT_DATA"
    validation_details = "There are not enough past records to check earlier estimates."
    winning_model_name: Optional[str] = None
    baseline_mae: Optional[float] = None
    selected_mae: Optional[float] = None

    if df is not None and len(df) >= 8:
        candidate_names = ["Naive Baseline", "Seasonal Naive", "Linear Regression", "Random Forest", "ARIMA", "Holt-Winters"]
        if domain == "disease":
            candidate_names.append("Negative Binomial")
        rolling = evaluate_rolling_origins(
            df,
            candidate_names,
            requested_horizon=horizon_months,
            exact_horizon=(domain == "slaughter" or (domain == "production" and target_clean == "MEAT")),
            history_label="eligible production" if domain == "production" else "approved",
        )
        valid_cutoffs_count = rolling.get("windows", 0)
        total_attempted_cutoffs = rolling.get("requested_windows", 0)
        backtest_diagnostics = rolling.get("diagnostics", [])
        model_metrics = rolling.get("models", {})

        if valid_cutoffs_count >= required_validation_windows and model_metrics:
            validation_status = "VALIDATED"
            validation_details = (
                f"The estimate was checked against {valid_cutoffs_count} past period(s). "
                f"Each check covered {rolling.get('horizon', horizon_months)} month(s)."
            )
            # Find best model
            valid_models = [
                (name, m["mae"])
                for name, m in model_metrics.items()
                if m.get("mae") is not None
            ]
            if valid_models:
                valid_models.sort(key=lambda x: x[1])
                winning_model_name = valid_models[0][0]
                selected_mae = valid_models[0][1]
            if "Naive Baseline" in model_metrics and model_metrics["Naive Baseline"].get("mae") is not None:
                baseline_mae = model_metrics["Naive Baseline"]["mae"]
        else:
            validation_status = "NOT_YET_VALIDATED"
            if total_attempted_cutoffs == 0:
                validation_details = "There are not enough past periods to compare an estimate with recorded results."
            else:
                primary_reason = ""
                if backtest_diagnostics:
                    reasons = [d.get("reason") for d in backtest_diagnostics if d.get("reason")]
                    if reasons:
                        primary_reason = f" {reasons[0]}"

                source_word = "submitted" if domain == "production" else "approved"
                fallback_explanation = f"Some records were {source_word} only after the date being checked, so they could not be used in that past check."
                validation_details = (
                    f"{valid_cutoffs_count} of {total_attempted_cutoffs} past checks could be completed."
                    f"{primary_reason or f' {fallback_explanation}'}"
                )
    elif usable_observations >= 12:
        validation_status = "NOT_YET_VALIDATED"
        validation_details = "Records are available, but there are not enough dates to check earlier estimates."

    # Step 4: Separate Forecast Availability from Validation
    # A forecast is available if we have at least 12 complete monthly observations
    # and no missing calendar gaps, even if historical backtesting was unvalidated.
    forecast_available = False
    forecast_status = "UNAVAILABLE"
    forecast_blocker = ""
    forecast_next_step = ""

    reporting_coverage = meta.get("reporting_coverage") or {}
    if domain in {"disease", "mortality"} and meta.get("status") in {"incomplete_coverage", "coverage_unconfirmed"}:
        forecast_status = "INSUFFICIENT_DATA"
        forecast_blocker = meta.get("message") or "Monthly reporting coverage is incomplete."
        forecast_next_step = "Open Disease & Mortality > Monthly Reporting Coverage and review the missing or stale confirmations across your barangay scope."
    elif usable_observations < 12:
        forecast_available = False
        forecast_status = "INSUFFICIENT_DATA"
        forecast_blocker = f"There are records for {usable_observations} months. At least 12 months are needed."
        forecast_next_step = f"Continue recording monthly data for {max(0, 12 - usable_observations)} more month(s)."
    elif missing_month_count > 0:
        forecast_available = False
        forecast_status = "UNAVAILABLE"
        source_word = "eligible" if domain == "production" else "approved"
        forecast_blocker = f"There are {missing_month_count} month(s) without {source_word} records."
        forecast_next_step = "Keep monthly records complete so no months are missing."
    elif unmeasured_records > 0:
        forecast_available = False
        forecast_status = "UNAVAILABLE"
        forecast_blocker = f"{unmeasured_records} approved record(s) are missing a required amount."
        forecast_next_step = "Check that required amounts, such as slaughter weight, are recorded."
    elif usable_observations < min_required:
        # Reached generic 12 months, but below target-specific minimum (e.g. 18 or 24)
        forecast_available = True
        forecast_status = "AVAILABLE_UNVALIDATED" if validation_status != "VALIDATED" else "READY"
        forecast_blocker = f"Records are available for {usable_observations} months. {min_required} months are needed for a full check of year-to-year patterns."
        forecast_next_step = f"An estimate is available. Collect records for {min_required} months to check year-to-year patterns."
    elif validation_status == "VALIDATED":
        forecast_available = True
        forecast_status = "READY"
        forecast_blocker = "The estimate is available and has been checked against past records."
        forecast_next_step = "Keep adding monthly records so future checks can continue."
    else:
        # Has sufficient observations (>= min_required) but validation_status is NOT_YET_VALIDATED
        forecast_available = True
        forecast_status = "AVAILABLE_UNVALIDATED"
        if domain == "production":
            forecast_blocker = "Some production records are missing dates needed for earlier past-record checks."
            forecast_next_step = "The current estimate can use eligible records. Keep dates on new records so future checks can improve."
        else:
            forecast_blocker = "Some records were approved after the dates used for past checks."
            forecast_next_step = "The estimate is available. New approved records can be included in later checks."

    # Step 5: Generate Forecast & Chart Data if available
    forecast_points: List[Dict[str, Any]] = []
    chart_timeline: List[Dict[str, Any]] = []
    forecast_metadata: Dict[str, Any] = {}

    if forecast_available:
        try:
            fc_res = generate_future_forecast(
                domain=domain,
                target=target_clean,
                unit=unit_clean,
                horizon_months=horizon_months,
                preferred_model=winning_model_name,
                user=user,
            )
            if fc_res.get("forecast"):
                forecast_points = fc_res.get("forecast", [])
                chart_timeline = fc_res.get("chart_data", [])
                forecast_metadata = fc_res.get("metadata", {})
                if not winning_model_name:
                    winning_model_name = fc_res.get("model", "Naive Baseline")
        except Exception:
            # If generation encountered an issue, retain availability as false with clear note
            forecast_available = False
            forecast_status = "ERROR"
            forecast_blocker = "The estimate could not be created."
            forecast_next_step = "Review the recorded values or try again."

    # If chart_timeline was not generated by forecast, use historical trend points
    if not chart_timeline and meta.get("historical_trend"):
        chart_timeline = [
            {
                "date": p["date"],
                "month_label": p["month_label"],
                "actual": p["actual"],
                "forecast": None,
                "is_future": False,
            }
            for p in meta["historical_trend"]
        ]

    # Step 6: Assemble Comprehensive Readiness Checklist
    checklist = _build_readiness_checklist(
        domain=domain,
        target=target_clean,
        unit=unit_clean,
        meta=meta,
        usable_observations=usable_observations,
        min_required=min_required,
        valid_cutoffs=valid_cutoffs_count,
        total_cutoffs=total_attempted_cutoffs,
        forecast_available=forecast_available,
        validation_status=validation_status,
        minimum_valid_windows=required_validation_windows,
    )

    # Step 7: Progress Metrics
    observations_progress_pct = min(100, int(round((usable_observations / max(1, min_required)) * 100)))
    milestone_label = (
        f"Need {max(0, min_required - usable_observations)} more months of records ({usable_observations}/{min_required})"
        if usable_observations < min_required
        else (
            "Enough past records; waiting for more past checks"
            if validation_status != "VALIDATED"
            else f"Checked against {valid_cutoffs_count} past period(s)"
        )
    )

    return {
        "metric_id": f"{domain}_{target_clean.lower()}_{unit_clean.lower()}",
        "domain": domain,
        "target": target_clean,
        "unit": unit_clean,
        "label": target_def.get("label", f"{domain.title()} {target_clean}"),
        "source": target_def.get("source", f"{domain} records"),
        "expected_reporting": target_def.get("expected_reporting", "Standard reporting"),
        "frequency": "MONTHLY",
        "minimum_rule": target_def.get("minimum_rule", ""),

        # Three primary decoupled dimensions
        "forecast_status": forecast_status,
        "forecast_available": forecast_available,
        "validation_status": validation_status,
        "validation_details": validation_details,
        "readiness_status": readiness_status,
        "readiness_details": readiness_details,

        # Human-readable diagnostic summary
        "blocker_summary": forecast_blocker,
        "next_step": forecast_next_step,

        # Data collection & progress metrics
        "progress": {
            "usable_observations": usable_observations,
            "older_covered_observations": reporting_coverage.get("older_covered_month_count", 0),
            "required_observations": min_required,
            "observations_progress_pct": observations_progress_pct,
            "quality_threshold": QUALITY_OBSERVATIONS_THRESHOLD,
            "total_records": total_records,
            "missing_month_count": missing_month_count,
            "missing_months": missing_months,
            "unmeasured_records": unmeasured_records,
            "approval_reconstructable": approval_reconstructable,
            "valid_cutoffs_count": valid_cutoffs_count,
            "total_cutoffs_count": total_attempted_cutoffs,
            "milestone_label": milestone_label,
            "data_through_date": meta.get("data_through_date"),
            "milk_diagnostics": milk_diagnostics,
            "source_diagnostics": source_diagnostics,
            "approval_status_breakdown": _approval_status_breakdown(
                domain, target_clean, unit_clean, user
            ),
        },

        # Detailed 12-item checklist
        "checklist": checklist,

        # Historical backtesting cutoffs timeline
        "backtesting": {
            "valid_cutoffs_count": valid_cutoffs_count,
            "total_attempted_cutoffs": total_attempted_cutoffs,
            "minimum_required_windows": required_validation_windows,
            "evaluation_horizon_months": horizon_months,
            "cutoffs": backtest_diagnostics,
            "winning_model": winning_model_name,
            "baseline_mae": baseline_mae,
            "selected_mae": selected_mae,
            "models": model_metrics,
        },

        # Forecast output & chart data
        "forecast": {
            "model_name": winning_model_name,
            "horizon_months": horizon_months,
            "forecast_points": forecast_points,
            "chart_data": chart_timeline,
            "metadata": forecast_metadata,
        },

        # Last evaluation timestamp
        "last_evaluated_at": timezone.now().isoformat(),
    }


def get_all_forecast_readiness_diagnostics(
    user=None,
    horizon_months: int = 6,
) -> Dict[str, Any]:
    """
    Evaluates accessible core forecasting targets and returns summary cards plus
    detailed diagnostics. Staff roles omit private Farmer milk and meat targets.
    """
    diagnostics_by_id: Dict[str, Any] = {}
    summary_cards: List[Dict[str, Any]] = []
    # Municipal dashboards may still show permitted livestock, disease,
    # mortality, slaughter, and auction diagnostics. Farmer milk/meat records
    # are private, so do not even evaluate their readiness for staff roles.
    from smartlivestock.workflows import role_name
    private_to_farmer = role_name(user) in {"MAO", "ADMIN", "SIBAT", "CBAT"}

    for target_config in CORE_DIAGNOSTIC_TARGETS:
        if private_to_farmer and target_config["domain"] == "production":
            continue
        diag = get_forecast_readiness_diagnostics(
            domain=target_config["domain"],
            target=target_config["target"],
            unit=target_config["unit"],
            user=user,
            horizon_months=horizon_months,
            transfer_source=target_config.get("transfer_source"),
        )
        diag["config"] = target_config
        diagnostics_by_id[target_config["id"]] = diag

        # Extract summary card data for Phase 2 overview
        summary_cards.append({
            "id": target_config["id"],
            "label": target_config["label"],
            "domain": target_config["domain"],
            "target": target_config["target"],
            "unit": target_config["unit"],
            "transfer_source": target_config.get("transfer_source"),
            "reporting_type": target_config["reporting_type"],
            "frequency": diag.get("frequency", "MONTHLY"),
            "observation_label": "wk" if diag.get("frequency") == "WEEKLY" else "mo",
            "description": target_config["description"],
            "forecast_status": diag["forecast_status"],
            "forecast_available": diag["forecast_available"],
            "validation_status": diag["validation_status"],
            "readiness_status": diag["readiness_status"],
            "usable_observations": diag["progress"]["usable_observations"],
            "older_covered_observations": diag["progress"].get("older_covered_observations", 0),
            "required_observations": diag["progress"]["required_observations"],
            "observations_progress_pct": diag["progress"]["observations_progress_pct"],
            "valid_cutoffs_count": diag["progress"]["valid_cutoffs_count"],
            "total_cutoffs_count": diag["progress"]["total_cutoffs_count"],
            "blocker_summary": diag["blocker_summary"],
            "next_step": diag["next_step"],
            "milestone_label": diag["progress"]["milestone_label"],
            "model_name": diag["forecast"]["model_name"],
            "last_evaluated_at": diag["last_evaluated_at"],
        })

    return {
        "status": "success",
        "last_checked_at": timezone.now().isoformat(),
        "summary_cards": summary_cards,
        "diagnostics": diagnostics_by_id,
    }

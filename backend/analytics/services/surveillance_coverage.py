"""Monthly reporting coverage for disease and mortality surveillance."""

from collections import defaultdict
from datetime import date, timedelta

from django.db.models import Count, F, Max, Q
from django.db.models.functions import Coalesce, TruncMonth
from django.utils import timezone

from analytics.models import SurveillanceCoverageReport
from diseases.models import DiseaseCase, MortalityRecord
from livestock.models import Barangay
from smartlivestock.workflows import SIBAT, role_name, scope_reviewer_queryset


def domain_model(domain):
    normalized = (domain or "").upper()
    if normalized == SurveillanceCoverageReport.Domain.DISEASE:
        return DiseaseCase, "record_date", DiseaseCase.DiseaseStatus.APPROVED
    if normalized == SurveillanceCoverageReport.Domain.MORTALITY:
        return MortalityRecord, "record_date", MortalityRecord.MortalityRecordStatus.APPROVED
    raise ValueError("Choose DISEASE or MORTALITY.")


def month_bounds(report_month):
    """Return the inclusive start and exclusive start of the following month."""
    if report_month.month == 12:
        next_month = date(report_month.year + 1, 1, 1)
    else:
        next_month = date(report_month.year, report_month.month + 1, 1)
    return report_month, next_month


def previous_month_start(today):
    if today.month == 1:
        return date(today.year - 1, 12, 1)
    return date(today.year, today.month - 1, 1)


def _event_queryset(domain, user, start, end, *, assigned_only=False):
    model, date_field, _ = domain_model(domain)
    effective_assigned_only = assigned_only or (
        role_name(user) in (SIBAT, "CBAT") and getattr(user, "assigned_barangay_id", None) is not None
    )
    return scope_reviewer_queryset(model.objects.all(), user, assigned_only=effective_assigned_only).filter(
        **{f"{date_field}__gte": start, f"{date_field}__lt": end}
    )


def _barangay_event_summary(domain, user, start, end, *, assigned_only=False):
    _, _, approved_status = domain_model(domain)
    records = _event_queryset(domain, user, start, end, assigned_only=assigned_only)
    return list(
        records.annotate(
            coverage_barangay_id=Coalesce(
                F("livestock__farmer__barangay_id"), F("batch__farmer__barangay_id")
            )
        )
        .values("coverage_barangay_id")
        .annotate(
            record_count=Count("pk"),
            approved_record_count=Count("pk", filter=Q(status=approved_status)),
            latest_created_at=Max("created_at"),
        )
        .order_by("coverage_barangay_id")
    )


def month_snapshot(domain, user, report_month, *, assigned_only=False):
    """Return aggregate-only status for a month within the caller's barangay scope."""
    start, end = month_bounds(report_month)
    effective_assigned_only = assigned_only or (
        role_name(user) in (SIBAT, "CBAT") and getattr(user, "assigned_barangay_id", None) is not None
    )
    barangays = list(
        scope_reviewer_queryset(Barangay.objects.all(), user, assigned_only=effective_assigned_only)
        .order_by("barangay_name", "pk")
        .values("id", "barangay_name")
    )
    event_summary = {
        row["coverage_barangay_id"]: row
        for row in _barangay_event_summary(domain, user, start, end, assigned_only=effective_assigned_only)
    }
    confirmations = SurveillanceCoverageReport.objects.filter(
        domain=domain.upper(), report_month=report_month,
        barangay_id__in=[row["id"] for row in barangays],
    ).select_related("confirmed_by").order_by("barangay_id", "-confirmed_at", "-pk")
    latest_confirmation = {}
    for confirmation in confirmations:
        latest_confirmation.setdefault(confirmation.barangay_id, confirmation)

    rows = []
    for barangay in barangays:
        barangay_id = barangay["id"]
        events = event_summary.get(barangay_id, {})
        record_count = events.get("record_count", 0)
        approved_count = events.get("approved_record_count", 0)
        confirmation = latest_confirmation.get(barangay_id)
        state = "UNCONFIRMED"
        if confirmation:
            state = "CONFIRMED"
            if events.get("latest_created_at") and events["latest_created_at"] > confirmation.confirmed_at:
                state = "STALE"
            elif (
                confirmation.status == SurveillanceCoverageReport.Status.NO_REPORTS_RECEIVED
                and record_count
            ) or (
                confirmation.status == SurveillanceCoverageReport.Status.REPORTS_COMPLETE
                and not record_count
            ):
                state = "INCONSISTENT"

        rows.append({
            "barangay_id": barangay_id,
            "barangay_name": barangay["barangay_name"],
            "record_count": record_count,
            "approved_record_count": approved_count,
            "needs_approval_count": record_count - approved_count,
            "state": state,
            "confirmation": ({
                "status": confirmation.status,
                "confirmed_at": confirmation.confirmed_at,
                "confirmed_by": confirmation.confirmed_by.username,
            } if confirmation else None),
            "can_confirm_no_reports": record_count == 0,
            "can_confirm_reports_complete": record_count > 0 and approved_count == record_count,
        })

    unassigned_count = event_summary.get(None, {}).get("record_count", 0)
    return {
        "domain": domain.upper(),
        "report_month": report_month.strftime("%Y-%m"),
        "barangays": rows,
        "unassigned_record_count": unassigned_count,
    }


def report_period_coverage(domain, user, start_date, end_date, barangay_name=""):
    """Summarize monthly attestations for completed months in an official report period."""
    domain = domain.upper()
    _, date_field, approved_status = domain_model(domain)
    current_month_start = date(timezone.localdate().year, timezone.localdate().month, 1)

    months = []
    not_assessed_months = []
    cursor = date(start_date.year, start_date.month, 1)
    final_month = date(end_date.year, end_date.month, 1)
    while cursor <= final_month:
        next_month = month_bounds(cursor)[1]
        month_end = next_month - timedelta(days=1)
        selected_full_month = start_date <= cursor and end_date >= month_end
        month_completed = next_month <= current_month_start
        if selected_full_month and month_completed:
            months.append(cursor)
        else:
            reason = "MONTH_IN_PROGRESS" if cursor >= current_month_start else "PARTIAL_PERIOD"
            not_assessed_months.append({
                "domain": domain,
                "domain_label": "Disease" if domain == SurveillanceCoverageReport.Domain.DISEASE else "Mortality",
                "report_month": cursor.strftime("%Y-%m"),
                "barangay": "All selected barangays",
                "status": reason,
                "status_label": "Month not completed" if reason == "MONTH_IN_PROGRESS" else "Partial month not assessed",
                "record_count": None,
                "approved_record_count": None,
                "detail": (
                    "Coverage is confirmed only after the reporting month has ended."
                    if reason == "MONTH_IN_PROGRESS"
                    else "This date range does not include the full calendar month."
                ),
            })
        cursor = next_month

    selected_barangay_name = barangay_name.strip()
    barangays = list(
        scope_reviewer_queryset(Barangay.objects.all(), user)
        .order_by("barangay_name", "pk")
        .values("id", "barangay_name")
    )
    if selected_barangay_name:
        selected_name = selected_barangay_name.casefold()
        barangays = [row for row in barangays if row["barangay_name"].casefold() == selected_name]
    barangay_ids = [row["id"] for row in barangays]
    rows = []
    counts = defaultdict(int)
    unassigned_record_count = 0

    if months and barangay_ids:
        first_month = months[0]
        _, after_last_month = month_bounds(months[-1])
        events = _event_queryset(domain, user, first_month, after_last_month)
        if selected_barangay_name:
            events = events.filter(
                Q(livestock__farmer__barangay_id__in=barangay_ids)
                | Q(batch__farmer__barangay_id__in=barangay_ids)
            )
        event_rows = events.annotate(
            month=TruncMonth(date_field),
            coverage_barangay_id=Coalesce(
                F("livestock__farmer__barangay_id"), F("batch__farmer__barangay_id")
            ),
        ).values("month", "coverage_barangay_id").annotate(
            record_count=Count("pk"),
            approved_record_count=Count("pk", filter=Q(status=approved_status)),
            latest_created_at=Max("created_at"),
        )
        event_map = {}
        for row in event_rows:
            month_value = row["month"]
            month = month_value.date() if hasattr(month_value, "date") else month_value
            event_map[(month, row["coverage_barangay_id"])] = row

        confirmations = SurveillanceCoverageReport.objects.filter(
            domain=domain,
            report_month__in=months,
            barangay_id__in=barangay_ids,
        ).order_by("report_month", "barangay_id", "-confirmed_at", "-pk")
        latest_confirmation = {}
        for confirmation in confirmations:
            latest_confirmation.setdefault((confirmation.report_month, confirmation.barangay_id), confirmation)

        domain_label = "Disease" if domain == SurveillanceCoverageReport.Domain.DISEASE else "Mortality"
        for month in months:
            for barangay in barangays:
                events = event_map.get((month, barangay["id"]), {})
                record_count = events.get("record_count", 0)
                approved_count = events.get("approved_record_count", 0)
                confirmation = latest_confirmation.get((month, barangay["id"]))
                if confirmation is None:
                    state = "UNCONFIRMED"
                    detail = f"{record_count} report(s) recorded; no monthly attestation is on file."
                elif events.get("latest_created_at") and events["latest_created_at"] > confirmation.confirmed_at:
                    state = "STALE"
                    detail = "A report was entered after the last confirmation; coverage needs reconfirmation."
                elif (
                    confirmation.status == SurveillanceCoverageReport.Status.NO_REPORTS_RECEIVED
                    and record_count > 0
                ) or (
                    confirmation.status == SurveillanceCoverageReport.Status.REPORTS_COMPLETE
                    and record_count == 0
                ):
                    state = "INCONSISTENT"
                    detail = "The attestation does not match the reports currently recorded."
                elif confirmation.status == SurveillanceCoverageReport.Status.NO_REPORTS_RECEIVED:
                    state = "CONFIRMED_ZERO"
                    detail = "An officer confirmed that no reports were received for this month."
                elif approved_count != record_count:
                    state = "AWAITING_APPROVAL"
                    detail = f"{record_count - approved_count} of {record_count} recorded report(s) are not approved."
                else:
                    state = "CONFIRMED_COMPLETE"
                    detail = "An officer confirmed all recorded reports were entered and approved."

                status_labels = {
                    "CONFIRMED_ZERO": "Confirmed zero reports",
                    "CONFIRMED_COMPLETE": "Confirmed reports complete",
                    "UNCONFIRMED": "Unconfirmed",
                    "STALE": "Reconfirmation needed",
                    "INCONSISTENT": "Inconsistent",
                    "AWAITING_APPROVAL": "Awaiting approval",
                }
                counts[state] += 1
                rows.append({
                    "domain": domain,
                    "domain_label": domain_label,
                    "report_month": month.strftime("%Y-%m"),
                    "barangay": barangay["barangay_name"],
                    "status": state,
                    "status_label": status_labels[state],
                    "record_count": record_count,
                    "approved_record_count": approved_count,
                    "detail": detail,
                })

        if not barangay_name:
            for month in months:
                unassigned = event_map.get((month, None), {})
                unassigned_count = unassigned.get("record_count", 0)
                if not unassigned_count:
                    continue
                counts["UNASSIGNED_RECORDS"] += 1
                unassigned_record_count += unassigned_count
                rows.append({
                    "domain": domain,
                    "domain_label": domain_label,
                    "report_month": month.strftime("%Y-%m"),
                    "barangay": "Unassigned records",
                    "status": "UNASSIGNED_RECORDS",
                    "status_label": "Barangay assignment needed",
                    "record_count": unassigned_count,
                    "approved_record_count": unassigned.get("approved_record_count", 0),
                    "detail": "Assign these reports to a barangay before confirming monthly coverage.",
                })

    expected_count = len(months) * len(barangays)
    confirmed_count = counts["CONFIRMED_ZERO"] + counts["CONFIRMED_COMPLETE"]
    unresolved_count = expected_count - confirmed_count
    rows.extend(not_assessed_months)
    rows.sort(key=lambda row: (row["report_month"], row["domain"], row["barangay"]))
    return {
        "domain": domain,
        "scope_barangay_count": len(barangays),
        "assessed_months": [month.strftime("%Y-%m") for month in months],
        "not_assessed_months": [row["report_month"] for row in not_assessed_months],
        "expected_confirmation_count": expected_count,
        "confirmed_confirmation_count": confirmed_count,
        "unresolved_confirmation_count": unresolved_count,
        "unassigned_month_count": counts["UNASSIGNED_RECORDS"],
        "unassigned_record_count": unassigned_record_count,
        "status_counts": dict(counts),
        "rows": rows,
    }


def build_confirmed_monthly_series(domain, user, target_monthly_records, current_month_start):
    """Build only fully covered monthly observations; confirmed quiet months become zero."""
    domain = domain.upper()
    _, date_field, approved_status = domain_model(domain)
    last_month = previous_month_start(current_month_start)
    barangays = list(
        scope_reviewer_queryset(Barangay.objects.all(), user).values_list("pk", flat=True)
    )
    if not barangays:
        return {
            "records": [], "missing_months": [],
            "coverage": {"status": "no_scope", "scope_barangay_count": 0,
                         "eligible_month_count": 0, "missing_month_count": 0,
                         "first_month": None, "last_completed_month": last_month.strftime("%Y-%m")},
        }

    confirmations = list(
        SurveillanceCoverageReport.objects.filter(
            domain=domain, barangay_id__in=barangays, report_month__lte=last_month,
        ).order_by("report_month", "barangay_id", "-confirmed_at", "-pk")
    )
    if not confirmations:
        return {
            "records": [], "missing_months": [],
            "coverage": {"status": "not_started", "scope_barangay_count": len(barangays),
                         "eligible_month_count": 0, "missing_month_count": 0,
                         "first_month": None, "last_completed_month": last_month.strftime("%Y-%m")},
        }

    first_month = min(row.report_month for row in confirmations)
    _, end = month_bounds(last_month)
    event_rows = (
        _event_queryset(domain, user, first_month, end)
        .annotate(
            month=TruncMonth(date_field),
            coverage_barangay_id=Coalesce(
                F("livestock__farmer__barangay_id"), F("batch__farmer__barangay_id")
            ),
        )
        .values("month", "coverage_barangay_id")
        .annotate(
            record_count=Count("pk"),
            approved_record_count=Count("pk", filter=Q(status=approved_status)),
            timestamped_approval_count=Count("pk", filter=Q(reviewed_at__isnull=False)),
            latest_created_at=Max("created_at"),
            latest_reviewed_at=Max("reviewed_at"),
        )
    )
    event_map = {}
    for row in event_rows:
        month_value = row["month"]
        month = month_value.date() if hasattr(month_value, "date") else month_value
        event_map[(month, row["coverage_barangay_id"])] = row

    latest_confirmation = {}
    for confirmation in confirmations:
        latest_confirmation.setdefault((confirmation.report_month, confirmation.barangay_id), confirmation)

    target_by_month = {}
    for row in target_monthly_records:
        month_value = row.get("month")
        if month_value is None:
            continue
        month = month_value.date() if hasattr(month_value, "date") else month_value
        target_by_month[month] = row

    periods = []
    cursor = first_month
    while cursor <= last_month:
        periods.append(cursor)
        _, cursor = month_bounds(cursor)

    reasons_by_month = defaultdict(list)
    eligible_by_month = {}
    for month in periods:
        month_confirmations = [latest_confirmation.get((month, barangay_id)) for barangay_id in barangays]
        if any(confirmation is None for confirmation in month_confirmations):
            reasons_by_month["unconfirmed"].append(month.strftime("%Y-%m"))
            continue

        month_events = [event_map.get((month, barangay_id), {}) for barangay_id in barangays]
        unassigned_events = event_map.get((month, None), {})
        if unassigned_events.get("record_count", 0):
            reasons_by_month["unassigned_records"].append(month.strftime("%Y-%m"))
            continue

        status_problem = False
        stale = False
        pending = False
        missing_approval_time = False
        for confirmation, events in zip(month_confirmations, month_events):
            count = events.get("record_count", 0)
            approved_count = events.get("approved_record_count", 0)
            if (
                confirmation.status == SurveillanceCoverageReport.Status.NO_REPORTS_RECEIVED
                and count > 0
            ) or (
                confirmation.status == SurveillanceCoverageReport.Status.REPORTS_COMPLETE
                and count == 0
            ):
                status_problem = True
            if events.get("latest_created_at") and events["latest_created_at"] > confirmation.confirmed_at:
                stale = True
            if count != approved_count:
                pending = True
            if count != events.get("timestamped_approval_count", 0):
                missing_approval_time = True

        month_label = month.strftime("%Y-%m")
        if stale:
            reasons_by_month["stale"].append(month_label)
        if status_problem:
            reasons_by_month["inconsistent"].append(month_label)
        if pending:
            reasons_by_month["pending_approval"].append(month_label)
        if missing_approval_time:
            reasons_by_month["missing_approval_time"].append(month_label)
        if stale or status_problem or pending or missing_approval_time:
            continue

        target_row = target_by_month.get(month, {})
        latest_reviewed = max(
            (events["latest_reviewed_at"] for events in month_events if events.get("latest_reviewed_at")),
            default=None,
        )
        latest_created = max(
            (events["latest_created_at"] for events in month_events if events.get("latest_created_at")),
            default=None,
        )
        latest_confirmation_at = max(confirmation.confirmed_at for confirmation in month_confirmations)
        available_at = max(
            (value for value in (latest_reviewed, latest_confirmation_at) if value is not None),
        )
        eligible_by_month[month] = {
            **target_row,
            "month": month,
            "total_quantity": float(target_row.get("total_quantity") or 0),
            "total_records": int(target_row.get("total_records") or 0),
            "latest_creation": latest_created,
            "latest_approval": latest_reviewed,
            "latest_event_date": target_row.get("latest_event_date"),
            "available_at": timezone.localtime(available_at).date(),
            "coverage_record_count": sum(events.get("record_count", 0) for events in month_events),
            "coverage_confirmed_at": latest_confirmation_at,
        }

    # Train only on the latest continuous run ending with the most recently
    # completed month. Old unconfirmed history before that run cannot fill gaps.
    contiguous_records = []
    cursor = last_month
    while cursor in eligible_by_month:
        contiguous_records.append(eligible_by_month[cursor])
        cursor = date(cursor.year - 1, 12, 1) if cursor.month == 1 else date(cursor.year, cursor.month - 1, 1)
    contiguous_records.reverse()

    trailing_missing_months = []
    cursor = last_month
    while cursor >= first_month and cursor not in eligible_by_month:
        trailing_missing_months.append(cursor.strftime("%Y-%m"))
        cursor = date(cursor.year - 1, 12, 1) if cursor.month == 1 else date(cursor.year, cursor.month - 1, 1)
    all_gap_months = {month for months in reasons_by_month.values() for month in months}

    coverage = {
        "status": "complete" if last_month in eligible_by_month else "incomplete",
        "scope_barangay_count": len(barangays),
        "eligible_month_count": len(contiguous_records),
        "missing_month_count": len(trailing_missing_months),
        "coverage_history_start_month": first_month.strftime("%Y-%m"),
        "first_month": contiguous_records[0]["month"].strftime("%Y-%m") if contiguous_records else None,
        "last_completed_month": last_month.strftime("%Y-%m"),
        "older_covered_month_count": max(0, len(eligible_by_month) - len(contiguous_records)),
        "historical_gap_month_count": max(0, len(all_gap_months) - len(trailing_missing_months)),
        "trailing_missing_months": list(reversed(trailing_missing_months)),
        "unconfirmed_months": reasons_by_month["unconfirmed"],
        "stale_months": reasons_by_month["stale"],
        "inconsistent_months": reasons_by_month["inconsistent"],
        "pending_approval_months": reasons_by_month["pending_approval"],
        "missing_approval_time_months": reasons_by_month["missing_approval_time"],
        "unassigned_record_months": reasons_by_month["unassigned_records"],
    }
    return {
        "records": contiguous_records,
        # Display may include older complete months; model training still uses
        # only the continuous run ending at the latest completed month.
        "history_records": [eligible_by_month[month] for month in sorted(eligible_by_month)],
        "missing_months": list(reversed(trailing_missing_months)),
        "coverage": coverage,
    }

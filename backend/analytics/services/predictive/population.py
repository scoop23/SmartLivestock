"""Quarterly census forecasts; missing coverage is unknown, never zero heads."""

from calendar import monthrange
from datetime import date
from math import ceil, sqrt

from django.db.models import Prefetch
from django.utils import timezone

from livestock.models import Barangay, CensusSubmission, CensusSubmissionItem, LivestockType
from smartlivestock.workflows import scope_reviewer_queryset

MIN_QUARTERS = 8
LOOKBACK_QUARTERS = 16


def quarter_end(index):
    year, quarter = divmod(index, 4)
    month = (quarter + 1) * 3
    return date(year, month, monthrange(year, month)[1])


def quarter_label(index):
    year, quarter = divmod(index, 4)
    return f"Q{quarter + 1} {year}"


def project(values, lead, model):
    drift = (values[-1] - values[0]) / (len(values) - 1) if model == "Quarterly drift" else 0
    return max(0, values[-1] + lead * drift)


def population_forecast(*, user, barangay_id=None, species_id=None, horizon=4):
    today = timezone.localdate()
    last_quarter = today.year * 4 + (today.month - 1) // 3 - 1
    first_quarter = last_quarter - LOOKBACK_QUARTERS + 1
    barangays = list(scope_reviewer_queryset(Barangay.objects.all(), user).order_by("barangay_name"))
    species = list(LivestockType.objects.order_by("name"))
    selected = [b for b in barangays if barangay_id is None or b.pk == barangay_id]
    expected = {b.pk for b in selected}
    names = {b.pk: b.barangay_name for b in selected}
    items = CensusSubmissionItem.objects.all()
    if species_id is not None:
        items = items.filter(livestock_type_id=species_id)
    submissions = scope_reviewer_queryset(CensusSubmission.objects.all(), user).filter(
        barangay_id__in=expected, status="APPROVED", reviewed_at__isnull=False,
        reviewed_at__lte=timezone.now(), submission_date__lte=today, created_at__lte=timezone.now(),
        report_year__gte=first_quarter // 4,
        report_year__lte=last_quarter // 4,
    ).prefetch_related(Prefetch("items", queryset=items, to_attr="forecast_items"))
    snapshots = {}
    for row in submissions:
        index = row.report_year * 4 + row.report_quarter - 1
        if not first_quarter <= index <= last_quarter or not row.forecast_items:
            continue
        # Require explicit item observations. An absent species is not an observed zero.
        available_on = max(row.submission_date, timezone.localdate(row.reviewed_at), timezone.localdate(row.created_at))
        snapshots.setdefault(index, {})[row.barangay_id] = {
            "heads": sum(item.number_of_heads for item in row.forecast_items),
            "available_on": available_on,
        }

    def observation(index, cutoff=today):
        rows = snapshots.get(index, {})
        if not expected or any(b not in rows or rows[b]["available_on"] > cutoff for b in expected):
            return None
        return sum(rows[b]["heads"] for b in expected)

    history = []
    gaps = []
    for index in range(first_quarter, last_quarter + 1):
        value = observation(index)
        history.append({"quarter": quarter_label(index), "heads": value})
        if value is None:
            gaps.append({"quarter": quarter_label(index), "missing_barangays": [
                names[b] for b in sorted(expected) if b not in snapshots.get(index, {})
            ]})
    # Use only a contiguous suffix ending at the most recently completed quarter.
    start = last_quarter
    while start >= first_quarter and observation(start) is not None:
        start -= 1
    start += 1
    values = [observation(i) for i in range(start, last_quarter + 1)]
    result = {
        "forecast_available": False, "status": "INSUFFICIENT_DATA",
        "frequency": "QUARTERLY", "unit": "HEADS", "horizon": horizon,
        "required_quarters": MIN_QUARTERS, "usable_quarters": len(values),
        "as_of": today.isoformat(), "latest_required_quarter": quarter_label(last_quarter),
        "options": {"barangays": [{"id": b.pk, "name": b.barangay_name} for b in barangays],
                    "species": [{"id": s.pk, "name": s.name} for s in species]},
        "scope": {"barangay_id": barangay_id, "species_id": species_id, "barangay_count": len(expected)},
        "history": history, "coverage_gaps": gaps, "forecast": [],
        "evaluation": {"status": "NOT_YET_EVALUATED", "valid_origins": 0, "models": []},
        "method_note": "Forecasts quarterly census heads, not the current individual-animal inventory. "
                       "Census totals are not added to inventory, herds or transfer counts. "
                       "All barangays in the selected scope must have approved observations; missing species items remain unknown.",
        "range_note": "Planning ranges reflect historical variability; they are not calibrated confidence intervals.",
        "limitations": "Census snapshots are currently stored records, not an immutable historical archive. "
                      "Historical evaluation checks recorded submission and approval availability. "
                      "Changing census coverage or later edits can affect comparability. "
                      "This forecast does not simulate births, deaths or boundary movements separately.",
    }
    if len(values) < MIN_QUARTERS:
        result["message"] = (
            f"Need {MIN_QUARTERS} consecutive completed quarters of approved census observations through "
            f"{quarter_label(last_quarter)}. Currently {len(values)} consecutive quarters are usable. "
            "Review missing census coverage and approvals; record genuine zero counts explicitly."
        )
        return result

    errors = {"Last census baseline": [], "Quarterly drift": []}
    by_lead = {name: {lead: [] for lead in range(1, horizon + 1)} for name in errors}
    valid_origins = 0
    # Use identical full-horizon windows for both candidates. No post-cutoff approvals enter training.
    for origin in range(start + 3, last_quarter - horizon + 1):
        cutoff = quarter_end(origin)
        training = []
        for index in range(start, origin + 1):
            value = observation(index, cutoff)
            training = [] if value is None else training + [value]
        if len(training) < 4:
            continue
        valid_origins += 1
        for name in errors:
            for lead in range(1, horizon + 1):
                error = observation(origin + lead) - project(training, lead, name)
                errors[name].append(abs(error))
                by_lead[name][lead].append(error)
    mae = {name: sum(rows) / len(rows) for name, rows in errors.items() if rows}
    model = "Last census baseline"
    if valid_origins >= 3 and mae["Quarterly drift"] < mae[model]:
        model = "Quarterly drift"
    result["evaluation"] = {
        "status": "BACKTESTED" if valid_origins >= 3 else "NOT_YET_VALIDATED",
        "valid_origins": valid_origins, "required_origins": 3,
        "horizon_quarters": horizon,
        "models": [{"name": name, "mae_heads": round(value, 2)} for name, value in mae.items()],
    }
    variation = sqrt(sum((b - a) ** 2 for a, b in zip(values, values[1:])) / (len(values) - 1))
    for lead in range(1, horizon + 1):
        estimate = project(values, lead, model)
        residuals = by_lead[model][lead]
        spread = (sqrt(sum(e * e for e in residuals) / len(residuals))
                  if len(residuals) >= 3 else variation * sqrt(lead))
        radius = 1.96 * spread
        result["forecast"].append({"quarter": quarter_label(last_quarter + lead),
            "heads": round(estimate), "lower": max(0, int(estimate - radius)), "upper": ceil(estimate + radius)})
    result.update(forecast_available=True, status="AVAILABLE", model=model,
                  message="Quarterly population estimates are available from approved census history.")
    return result

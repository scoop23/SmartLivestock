"""Explainable, record-based disease and mortality surveillance indicators.

These are operational review signals, not diagnoses or validated outbreak
predictions. Silence in the records is not evidence that no cases occurred.
"""

from collections import defaultdict
from datetime import date, timedelta

from django.db.models import Q, Sum
from django.utils import timezone

from analytics.seed_markers import SEED_MARKER_DISEASE, SEED_MARKER_MORTALITY
from diseases.models import DiseaseCase, MortalityRecord
from .population import official_inventory
from smartlivestock.workflows import scope_reviewer_queryset


ASSOCIATION_DAYS = 30
WEEKLY_HISTORY_WEEKS = 12
ELEVATED_MULTIPLIER = 2
ELEVATED_MIN_INCREASE = 2


def complete_week_windows(today):
    """Return the latest and preceding complete Monday-Sunday weeks."""
    latest_end = today - timedelta(days=today.weekday() + 1)
    latest_start = latest_end - timedelta(days=6)
    previous_end = latest_start - timedelta(days=1)
    previous_start = previous_end - timedelta(days=6)
    return {
        "previous_start": previous_start,
        "previous_end": previous_end,
        "latest_start": latest_start,
        "latest_end": latest_end,
    }


def _real_approved(queryset, marker):
    return queryset.filter(status="APPROVED").filter(
        Q(review_remarks__isnull=True) | ~Q(review_remarks__contains=marker)
    )


def _days(start, end):
    while start <= end:
        yield start
        start += timedelta(days=1)


def _weekly_points(rows, value_key, end):
    """Return complete Monday-Sunday weeks ending with the latest full week."""
    latest_week_end = complete_week_windows(end)["latest_end"]
    first_week_start = latest_week_end - timedelta(days=(WEEKLY_HISTORY_WEEKS - 1) * 7 + 6)
    counts = defaultdict(lambda: {"reports": 0, "value": 0})
    for row in rows:
        event_date = row["record_date"]
        if first_week_start <= event_date <= latest_week_end:
            week_start = event_date - timedelta(days=event_date.weekday())
            counts[week_start]["reports"] += 1
            counts[week_start]["value"] += int(row[value_key] or 0)
    return [
        {
            "start": (first_week_start + timedelta(days=7 * index)).isoformat(),
            "end": (first_week_start + timedelta(days=7 * index + 6)).isoformat(),
            "reports": counts[first_week_start + timedelta(days=7 * index)]["reports"],
            "value": counts[first_week_start + timedelta(days=7 * index)]["value"],
        }
        for index in range(WEEKLY_HISTORY_WEEKS)
    ]


def _daily_points(rows, value_key, start, end):
    counts = defaultdict(lambda: {"reports": 0, "value": 0})
    for row in rows:
        if start <= row["record_date"] <= end:
            counts[row["record_date"]]["reports"] += 1
            counts[row["record_date"]]["value"] += int(row[value_key] or 0)
    return [{"date": day.isoformat(), **counts[day]} for day in _days(start, end)]


def _deduplicate_identified_deaths(rows):
    """Count identified animals once across repeated approved mortality reports."""
    seen_animals = set()
    unique_rows = []
    for row in rows:
        identified = row["animal_ids"]
        new_animals = identified - seen_animals
        seen_animals.update(identified)
        # Preserve any legacy count not represented by an animal ID, while
        # removing repeated reports for already counted individually identified animals.
        unlinked_count = max(int(row["death_count"] or 0) - len(identified), 0)
        unique_rows.append({
            **row,
            "animal_ids": new_animals,
            "death_count": len(new_animals) + unlinked_count,
        })
    return unique_rows


def _period_totals(rows, start, end, value_key):
    selected = [row for row in rows if start <= row["record_date"] <= end]
    animals = set()
    herds = set()
    farms = set()
    barangays = set()
    total = 0
    for row in selected:
        total += int(row[value_key] or 0)
        animals.update(row.get("animal_ids", ()))
        if row.get("batch_id") or row.get("livestock_batch_id"):
            herds.add(row.get("batch_id") or row.get("livestock_batch_id"))
        if row.get("farmer_id"):
            farms.add(row["farmer_id"])
        if row.get("barangay_id"):
            barangays.add(row["barangay_id"])
    return {
        "reports": len(selected),
        "affected_heads" if value_key == "affected_count" else "deaths": total,
        "distinct_identified_livestock": len(animals),
        "distinct_herds": len(herds),
        "farms": len(farms),
        "barangays": len(barangays),
    }


def _trend_signal(current, previous):
    """A deliberately simple change flag for reported counts, not incidence."""
    if current == 0 and previous == 0:
        return {
            "level": "INSUFFICIENT_DATA",
            "explanation": "No approved events were recorded in either comparison week; reporting completeness is not measured.",
        }
    if current == 0:
        return {
            "level": "NORMAL",
            "explanation": "No approved events were recorded in the latest complete week, down from the preceding week; this does not establish zero cases.",
        }
    if previous == 0:
        return {
            "level": "WATCH",
            "explanation": f"{current} approved event(s) were recorded after a week with no approved events; compare recorded activity only because reporting completeness is unknown.",
        }
    if current <= previous:
        return {
            "level": "NORMAL",
            "explanation": f"Recorded activity was {current} versus {previous} in the preceding complete week; no increase was detected.",
        }
    if current >= previous * ELEVATED_MULTIPLIER and current - previous >= ELEVATED_MIN_INCREASE:
        return {
            "level": "ELEVATED",
            "explanation": f"Recorded activity reached {current}, at least {ELEVATED_MULTIPLIER} times the preceding week's {previous}, with an increase of at least {ELEVATED_MIN_INCREASE} events.",
        }
    return {
        "level": "WATCH",
        "explanation": f"Recorded activity increased from {previous} to {current} versus the preceding complete week.",
    }


def _load_events(user, today):
    start = today - timedelta(weeks=WEEKLY_HISTORY_WEEKS + 1)
    disease_qs = _real_approved(
        scope_reviewer_queryset(DiseaseCase.objects.all(), user), SEED_MARKER_DISEASE
    )
    disease_undated = disease_qs.filter(record_date__isnull=True).count()
    disease_objects = list(
        disease_qs.filter(record_date__range=(start, today))
        .select_related("livestock__farmer__user", "livestock__farmer__barangay", "livestock__batch", "batch__farmer__user", "batch__farmer__barangay")
        .order_by("record_date", "pk")
    )
    disease_rows = []
    for case in disease_objects:
        animal_ids = {case.livestock_id} if case.livestock_id else set()
        farmer = (case.livestock.farmer if case.livestock_id else case.batch.farmer if case.batch_id else None)
        farmer_name = " ".join(part for part in (farmer.user.first_name, farmer.user.last_name) if part).strip() if farmer else ""
        row = {
            "id": case.pk,
            "name": case.name,
            "affected_count": case.affected_count,
            "record_date": case.record_date,
            "livestock_id": case.livestock_id,
            "batch_id": case.batch_id,
            "livestock_batch_id": case.livestock.batch_id if case.livestock_id else None,
            "batch_code": case.batch.batch_code if case.batch_id else case.livestock.batch.batch_code if case.livestock_id and case.livestock.batch_id else None,
            "farmer_id": farmer.pk if farmer else None,
            "farmer_name": farmer_name or farmer.user.username if farmer else None,
            "barangay_id": farmer.barangay_id if farmer else None,
            "barangay_name": farmer.barangay.barangay_name if farmer and farmer.barangay_id else None,
            "clinical_status": case.clinical_status,
            "animal_ids": animal_ids,
        }
        disease_rows.append(row)

    mortality_qs = _real_approved(
        scope_reviewer_queryset(MortalityRecord.objects.all(), user), SEED_MARKER_MORTALITY
    )
    mortality_undated = mortality_qs.filter(record_date__isnull=True).count()
    mortality_objects = list(
        mortality_qs.filter(record_date__range=(start, today))
        .select_related("livestock__farmer__user", "livestock__farmer__barangay", "livestock__batch", "batch__farmer__user", "batch__farmer__barangay", "source_disease_case")
        .prefetch_related("affected_livestock")
        .order_by("record_date", "pk")
    )
    mortality_rows = []
    for record in mortality_objects:
        animal_ids = {animal.pk for animal in record.affected_livestock.all()}
        if record.livestock_id:
            animal_ids.add(record.livestock_id)
        farmer = (record.livestock.farmer if record.livestock_id else record.batch.farmer if record.batch_id else None)
        farmer_name = " ".join(part for part in (farmer.user.first_name, farmer.user.last_name) if part).strip() if farmer else ""
        mortality_rows.append({
            "id": record.pk,
            "death_count": record.death_count,
            "cause": record.cause,
            "record_date": record.record_date,
            "livestock_id": record.livestock_id,
            "batch_id": record.batch_id,
            "livestock_batch_id": record.livestock.batch_id if record.livestock_id else None,
            "batch_code": record.batch.batch_code if record.batch_id else record.livestock.batch.batch_code if record.livestock_id and record.livestock.batch_id else None,
            "source_disease_case_id": record.source_disease_case_id,
            "source_disease_case": record.source_disease_case,
            "farmer_id": farmer.pk if farmer else None,
            "farmer_name": farmer_name or farmer.user.username if farmer else None,
            "barangay_id": farmer.barangay_id if farmer else None,
            "barangay_name": farmer.barangay.barangay_name if farmer and farmer.barangay_id else None,
            "animal_ids": animal_ids,
        })
    return disease_rows, mortality_rows, disease_undated, mortality_undated


def _associations(disease_rows, mortality_rows):
    rows = []
    lower_bound = min((row["record_date"] for row in mortality_rows), default=date.max) - timedelta(days=ASSOCIATION_DAYS)
    for death in mortality_rows:
        candidates = []
        for case in disease_rows:
            if not (lower_bound <= case["record_date"] < death["record_date"]):
                continue
            days = (death["record_date"] - case["record_date"]).days
            if days > ASSOCIATION_DAYS:
                continue
            relationship = None
            if death["source_disease_case_id"] == case["id"]:
                relationship = "explicit_source_disease_case"
            elif death["livestock_id"] and case["livestock_id"] == death["livestock_id"]:
                relationship = "same_livestock"
            elif (
                (death["batch_id"] and death["batch_id"] == case["batch_id"])
                or (death["livestock_batch_id"] and death["livestock_batch_id"] == case["batch_id"])
                or (death["batch_id"] and death["batch_id"] == case["livestock_batch_id"])
                or (death["livestock_batch_id"] and death["livestock_batch_id"] == case["livestock_batch_id"])
            ):
                relationship = "same_herd"
            elif death["barangay_id"] and death["barangay_id"] == case["barangay_id"]:
                relationship = "same_barangay"
            if relationship:
                candidates.append((days, case, relationship))
        for days, case, relationship in candidates:
            rows.append({
                "mortality_record": f"MOR-{death['id']}",
                "mortality_date": death["record_date"].isoformat(),
                "recorded_cause": death["cause"],
                "disease_record": f"DIS-{case['id']}",
                "disease_date": case["record_date"].isoformat(),
                "recorded_classification": case["name"],
                "days_between": days,
                "relationship": relationship,
                "disease_farmer": case["farmer_name"],
                "mortality_farmer": death["farmer_name"],
                "disease_barangay": case["barangay_name"],
                "mortality_barangay": death["barangay_name"],
                "interpretation": "Temporal association for review only; this does not establish that disease caused the death.",
            })
    return rows


def surveillance_summary(*, user=None, today=None):
    """Build scoped weekly/daily surveillance summaries from approved real rows."""
    today = today or timezone.localdate()
    disease, mortality, disease_undated, mortality_undated = _load_events(user, today)
    mortality = _deduplicate_identified_deaths(mortality)

    weeks = complete_week_windows(today)
    latest_week_start = weeks["latest_start"]
    latest_week_end = weeks["latest_end"]
    previous_week_start = weeks["previous_start"]
    previous_week_end = weeks["previous_end"]
    last_14_start = today - timedelta(days=13)
    last_30_start = today - timedelta(days=29)

    disease_7 = _period_totals(disease, latest_week_start, latest_week_end, "affected_count")
    disease_prev = _period_totals(disease, previous_week_start, previous_week_end, "affected_count")
    mortality_7 = _period_totals(mortality, latest_week_start, latest_week_end, "death_count")
    mortality_prev = _period_totals(mortality, previous_week_start, previous_week_end, "death_count")
    disease_14 = _period_totals(disease, last_14_start, today, "affected_count")
    disease_30 = _period_totals(disease, last_30_start, today, "affected_count")
    mortality_14 = _period_totals(mortality, last_14_start, today, "death_count")
    mortality_30 = _period_totals(mortality, last_30_start, today, "death_count")

    identified_deaths = len(set().union(*(row["animal_ids"] for row in mortality if last_30_start <= row["record_date"] <= today))) if mortality else 0
    population = official_inventory(user).aggregate(heads=Sum("quantity"))["heads"] or 0
    mortality_rate = round(mortality_30["deaths"] / population * 100, 4) if population else None

    disease_weeks = _weekly_points(disease, "affected_count", today)
    mortality_weeks = _weekly_points(mortality, "death_count", today)
    daily_start = today - timedelta(days=13)
    disease_alert = _trend_signal(disease_7["reports"], disease_prev["reports"])
    mortality_alert = _trend_signal(mortality_7["deaths"], mortality_prev["deaths"])

    disease_types = defaultdict(lambda: {"reports": 0, "affected_heads": 0})
    clinical_statuses = defaultdict(int)
    for row in disease:
        if last_30_start <= row["record_date"] <= today:
            item = disease_types[row["name"]]
            item["reports"] += 1
            item["affected_heads"] += int(row["affected_count"] or 0)
            clinical_statuses[row["clinical_status"]] += 1

    mortality_causes = defaultdict(lambda: {"reports": 0, "deaths": 0})
    for row in mortality:
        if last_30_start <= row["record_date"] <= today:
            item = mortality_causes[row["cause"]]
            item["reports"] += 1
            item["deaths"] += int(row["death_count"] or 0)

    barangay_summary = defaultdict(lambda: {"disease_reports": 0, "affected_heads": 0, "mortality_reports": 0, "deaths": 0})
    herd_summary = defaultdict(lambda: {"batch_code": "", "disease_reports": 0, "affected_heads": 0, "mortality_reports": 0, "deaths": 0})
    for row in disease:
        if last_30_start <= row["record_date"] <= today and row["barangay_id"]:
            item = barangay_summary[row["barangay_id"]]
            item["disease_reports"] += 1
            item["affected_heads"] += int(row["affected_count"] or 0)
        herd_id = row["batch_id"] or row["livestock_batch_id"]
        if last_30_start <= row["record_date"] <= today and herd_id:
            herd_summary[herd_id]["batch_code"] = row["batch_code"] or f"Herd #{herd_id}"
            herd_summary[herd_id]["disease_reports"] += 1
            herd_summary[herd_id]["affected_heads"] += int(row["affected_count"] or 0)
    for row in mortality:
        if last_30_start <= row["record_date"] <= today and row["barangay_id"]:
            item = barangay_summary[row["barangay_id"]]
            item["mortality_reports"] += 1
            item["deaths"] += int(row["death_count"] or 0)
        herd_id = row["batch_id"] or row["livestock_batch_id"]
        if last_30_start <= row["record_date"] <= today and herd_id:
            herd_summary[herd_id]["batch_code"] = row["batch_code"] or f"Herd #{herd_id}"
            herd_summary[herd_id]["mortality_reports"] += 1
            herd_summary[herd_id]["deaths"] += int(row["death_count"] or 0)

    barangay_names = {
        row["barangay_id"]: row["barangay_name"]
        for row in [*disease, *mortality]
        if row["barangay_id"] and row["barangay_name"]
    }
    associations = _associations(
        disease,
        [row for row in mortality if row["death_count"] > 0 and last_30_start <= row["record_date"] <= today],
    )
    association_counts = defaultdict(int)
    for row in associations:
        association_counts[row["relationship"]] += 1

    return {
        "as_of": today.isoformat(),
        "periods": {
            "latest_complete_week": {"start": latest_week_start.isoformat(), "end": latest_week_end.isoformat()},
            "preceding_complete_week": {"start": previous_week_start.isoformat(), "end": previous_week_end.isoformat()},
            "last_14_days": {"start": last_14_start.isoformat(), "end": today.isoformat(), "is_partial": True},
            "last_30_days": {"start": last_30_start.isoformat(), "end": today.isoformat(), "is_partial": True},
        },
        "disease": {
            "latest_complete_week": disease_7,
            "preceding_complete_week": disease_prev,
            "last_14_days": disease_14,
            "last_30_days": disease_30,
            "clinical_status_counts_30_days": dict(clinical_statuses),
            "daily_last_14_days": _daily_points(disease, "affected_count", daily_start, today),
            "weekly_reported_affected_heads": disease_weeks,
            "by_recorded_classification_30_days": [
                {"classification": name, **counts} for name, counts in sorted(disease_types.items())
            ],
            "alert": disease_alert,
            "undated_approved_reports_excluded": disease_undated,
        },
        "mortality": {
            "latest_complete_week": mortality_7,
            "preceding_complete_week": mortality_prev,
            "last_30_days": mortality_30,
            "last_14_days": mortality_14,
            "by_recorded_cause_30_days": [
                {"cause": cause, **counts} for cause, counts in sorted(mortality_causes.items())
            ],
            "daily_last_14_days": _daily_points(mortality, "death_count", daily_start, today),
            "identified_animals_last_30_days": identified_deaths,
            "weekly_reported_deaths": mortality_weeks,
            "population_denominator": population,
            "rate_percent": mortality_rate,
            "rate_method": "Estimated from deaths recorded in the last 30 days divided by current approved active individual inventory; this is not a historical population-at-risk rate.",
            "alert": mortality_alert,
            "undated_approved_reports_excluded": mortality_undated,
        },
        "associations": {
            "window_days": ASSOCIATION_DAYS,
            "count_by_relationship": dict(association_counts),
            "events": associations[:100],
            "truncated": len(associations) > 100,
        },
        "barangays_last_30_days": [
            {"barangay_id": barangay_id, "barangay": barangay_names.get(barangay_id, "Unmapped"), **counts}
            for barangay_id, counts in sorted(barangay_summary.items())
        ],
        "herds_last_30_days": [
            {"batch_id": batch_id, **counts}
            for batch_id, counts in sorted(
                herd_summary.items(),
                key=lambda item: (-item[1]["disease_reports"] - item[1]["mortality_reports"], item[0]),
            )
        ],
        "data_quality": {
            "reporting_completeness": "not measured; zero recorded reports must not be interpreted as zero incidence",
            "case_certainty": "The workflow has approval and clinical-resolution statuses, but no structured confirmed/suspected classification. Disease names are shown as recorded.",
            "synthetic_records": "Legacy analytics-test disease and mortality rows are excluded. Clearly labeled surveillance-demo records are intentionally included for dashboard demonstration and are not real-world evidence.",
            "historical_population": "Cannot be reconstructed reliably from the available current inventory and event history; mortality rate uses a current-inventory estimate.",
            "alert_validation": "Operational week-over-week flags only; no validated epidemiological threshold or predictive accuracy is claimed.",
            "backtesting": "Not established: the database does not preserve immutable approval/revision history or reporting-completeness periods needed for representative leakage-safe alert evaluation.",
            "forecast_feature_comparison": "Not established: no representative, immutable real-record history is available here to compare surveillance features with the unchanged monthly baseline without leakage.",
        },
        "historical_backtest": {
            "status": "unvalidated",
            "usable_evaluation_periods": 0,
            "reason": "No defensible real-world outbreak outcome label or immutable historical availability/reporting-coverage record is stored.",
        },
        "monthly_forecast_comparison": {
            "status": "not_established",
            "baseline": "Existing monthly model-comparison pipeline remains unchanged.",
            "enhanced_model_adopted": False,
            "evaluation_periods": 0,
            "mae": None,
            "rmse": None,
            "prediction_coverage": None,
            "reason": "Surveillance-derived features are not adopted without a fair chronological backtest on representative real approved records; synthetic seed data is excluded.",
        },
    }

"""Cutoff-safe surveillance and target-history feature engineering.

Empty event windows are unknown (NaN), not zero. The paired ``*_observed``
fields indicate at least one approved report was available; they do not claim
complete reporting coverage.
"""

from datetime import date, datetime, time, timedelta

from django.utils import timezone


WINDOW_DAYS = (7, 14, 30)


def _cutoff_datetime(cutoff):
    if isinstance(cutoff, date) and not isinstance(cutoff, datetime):
        cutoff = datetime.combine(cutoff, time.min)
    return timezone.make_aware(cutoff) if timezone.is_naive(cutoff) else cutoff


def _cutoff_day(cutoff):
    stamp = _cutoff_datetime(cutoff)
    return timezone.localtime(stamp).date()


def _available_rows(rows, cutoff):
    cutoff_stamp = _cutoff_datetime(cutoff)
    cutoff_day = _cutoff_day(cutoff_stamp)
    return [
        row for row in rows
        if row.get("record_date")
        and row["record_date"] < cutoff_day
        and row.get("reviewed_at") is not None
        and row["reviewed_at"] <= cutoff_stamp
    ]


def _deduplicated_death_count(rows):
    """Count linked animals once per window; retain unmatched recorded head counts."""
    seen_animals = set()
    total = 0
    for row in sorted(rows, key=lambda item: (item["record_date"], item.get("id", 0))):
        animal_ids = set(row.get("animal_ids") or ())
        new_animals = animal_ids - seen_animals
        seen_animals.update(animal_ids)
        unlinked = max(int(row.get("death_count") or 0) - len(animal_ids), 0)
        total += len(new_animals) + unlinked
    return total


def build_surveillance_features(cutoff, disease_rows, mortality_rows, target_domain):
    """Return observed counts plus explicit availability flags for 7/14/30 days.

    Windows use ``[cutoff - N days, cutoff)`` on event dates. Because the source
    schema has no reporting-coverage ledger, an empty window is represented by
    ``None`` and an observed flag of 0. Overlapping windows remain separate
    predictors; they are never added together.
    """
    cutoff_stamp = _cutoff_datetime(cutoff)
    cutoff_day = _cutoff_day(cutoff_stamp)
    disease = _available_rows(disease_rows, cutoff_stamp)
    mortality = _available_rows(mortality_rows, cutoff_stamp) if target_domain == "mortality" else []
    result = {}

    for days in WINDOW_DAYS:
        start = cutoff_day - timedelta(days=days)
        disease_window = [row for row in disease if start <= row["record_date"] < cutoff_day]
        has_disease = bool(disease_window)
        result[f"disease_reports_{days}d"] = len(disease_window) if has_disease else None
        result[f"disease_reports_{days}d_observed"] = int(has_disease)
        result[f"disease_affected_heads_{days}d"] = (
            sum(int(row.get("affected_count") or 0) for row in disease_window) if has_disease else None
        )
        result[f"disease_affected_heads_{days}d_observed"] = int(has_disease)

        if target_domain == "mortality":
            mortality_window = [row for row in mortality if start <= row["record_date"] < cutoff_day]
            has_mortality = bool(mortality_window)
            result[f"mortality_deaths_{days}d"] = (
                _deduplicated_death_count(mortality_window) if has_mortality else None
            )
            result[f"mortality_deaths_{days}d_observed"] = int(has_mortality)
    return result


def build_target_history_features(cutoff, monthly_history):
    """Add last three observed monthly target values without filling missing months."""
    cutoff_day = _cutoff_day(cutoff)
    history = []
    for row in monthly_history:
        month_value = row["month"]
        month_day = month_value.date() if isinstance(month_value, datetime) else month_value
        if month_day and month_day < cutoff_day:
            history.append((month_day, float(row["quantity"])))
    history.sort(key=lambda item: item[0])

    result = {}
    cutoff_month = date(cutoff_day.year, cutoff_day.month, 1)
    for lag in range(1, 4):
        if len(history) >= lag:
            month, value = history[-lag]
            result[f"target_lag_{lag}"] = value
            result[f"target_lag_{lag}_observed"] = 1
            result[f"target_lag_{lag}_months_ago"] = (cutoff_month.year - month.year) * 12 + cutoff_month.month - month.month
        else:
            result[f"target_lag_{lag}"] = None
            result[f"target_lag_{lag}_observed"] = 0
            result[f"target_lag_{lag}_months_ago"] = None
    return result


def surveillance_value_features(target_domain):
    names = []
    for days in WINDOW_DAYS:
        names.extend((f"disease_reports_{days}d", f"disease_affected_heads_{days}d"))
        if target_domain == "mortality":
            names.append(f"mortality_deaths_{days}d")
    return names

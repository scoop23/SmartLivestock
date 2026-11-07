"""Active registered population = opening heads + additions - removals."""
import numpy as np
from datetime import timedelta
from dateutil.relativedelta import relativedelta
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from analytics.services.population import official_inventory
from livestock.models import Barangay, LivestockType, PopulationTracking, RegisteredPopulationChange
from smartlivestock.workflows import scope_reviewer_queryset

KINDS = ("registrations", "births", "sales", "deaths", "removals")


def predict_components(history, lead, model):
    if model == "Seasonal Naive":
        return np.asarray(history[-12 + ((lead - 1) % 12)], dtype=float)
    return np.mean(history[-3:], axis=0)


@transaction.atomic
def population_forecast(*, user, barangay_id=None, species_id=None, horizon=6, **assumptions):
    today = timezone.localdate()
    barangays = list(scope_reviewer_queryset(Barangay.objects.all(), user).order_by("barangay_name"))
    ids = [b.pk for b in barangays if barangay_id is None or b.pk == barangay_id]
    inventory = official_inventory(user).filter(farmer__barangay_id__in=ids)
    events = RegisteredPopulationChange.objects.filter(barangay_id__in=ids, recorded_at__lte=timezone.now())
    if species_id is not None:
        inventory = inventory.filter(livestock_type_id=species_id)
        events = events.filter(livestock_type_id=species_id)
    current = inventory.aggregate(n=Sum("quantity"))["n"] or 0
    tracking, _ = PopulationTracking.objects.get_or_create(pk=1)
    started = timezone.localdate(tracking.started_at)
    first = started.replace(day=1) + relativedelta(months=1)
    this_month = today.replace(day=1)
    months = []
    month = max(first, this_month - relativedelta(months=36))
    while month < this_month:
        months.append(month)
        month += relativedelta(months=1)
    buckets = {m: {kind: 0 for kind in KINDS} for m in months}
    observed_events = list(events.filter(recorded_at__date__gte=months[0] if months else first).values("recorded_at", "kind", "delta"))
    for event in observed_events:
        month = timezone.localdate(event["recorded_at"]).replace(day=1)
        if month in buckets and event["kind"] in KINDS:
            buckets[month][event["kind"]] += abs(event["delta"])
    # Reconstruct recorded month-end heads from today's count and subsequent
    # recorded deltas. These are not independent census snapshots.
    historical_heads = current - sum(event["delta"] for event in observed_events)
    history = []
    for month in months:
        bucket = buckets[month]
        historical_heads += bucket["registrations"] + bucket["births"] - bucket["sales"] - bucket["deaths"] - bucket["removals"]
        month_end = month + relativedelta(months=1) - timedelta(days=1)
        history.append({"date": month_end.isoformat(), "month": month.strftime("%b %Y"),
                        "heads": historical_heads if historical_heads >= 0 else None, **bucket})
    scenario = bool(assumptions)
    result = {
        "forecast_available": False, "status": "INSUFFICIENT_HISTORY", "frequency": "MONTHLY",
        "as_of": today.isoformat(), "tracking_started_at": started.isoformat(), "horizon": horizon,
        "mode": "SCENARIO" if scenario else "AUTOMATIC",
        "training_through": (this_month - timedelta(days=1)).isoformat() if months else None,
        "history_note": "Past month-end counts are reconstructed from today's active registered count and recorded population changes; they are not census observations.",
        "current_heads": current, "usable_months": len(months), "required_months": 3,
        "options": {"barangays": [{"id": b.pk, "name": b.barangay_name} for b in barangays],
                    "species": list(LivestockType.objects.order_by("name").values("id", "name"))},
        "scope": {"barangay_id": barangay_id, "species_id": species_id},
        "history": history, "forecast": [], "evaluation": {"status": "NOT_YET_VALIDATED", "valid_origins": 0, "models": []},
        "formula": "Opening registered heads + registrations + births - sales - deaths - other removals",
        "method_note": "Counts approved, active individual animal records. Buyer registration adds a head only after approval. Calving-created calves are births, not a second registration. Herd changes and census totals add no heads.",
        "limitations": "This forecasts system records, not every animal physically in the municipality. Registration delays affect results. Tracking starts at deployment; earlier activity is not invented. Direct database/bulk changes outside recorded application operations are not covered. No municipal boundary movement is inferred.",
    }
    values = [[row[kind] for kind in KINDS] for row in history]
    model = "Recent 3-month average"
    if scenario:
        model = "MAO monthly scenario"
        expected = [assumptions[f"expected_{kind}"] for kind in KINDS]
        result["evaluation"]["status"] = "USER_ASSUMPTIONS"
    elif len(values) < 3:
        result["message"] = f"Automatic forecasting needs 3 complete months of tracked registrations, births, sales, deaths and removals; {len(values)} are available. Continue recording these operations so the system can estimate future monthly changes."
        return result
    else:
        errors = {name: [] for name in (model, "Seasonal Naive")}
        for origin in range(12, len(values) - horizon + 1):
            for name in errors:
                for lead in range(1, horizon + 1):
                    errors[name].append(float(np.mean(np.abs(np.asarray(values[origin + lead - 1]) - predict_components(values[:origin], lead, name)))))
        origins = max(0, len(values) - horizon - 11)
        scores = {name: float(np.mean(rows)) for name, rows in errors.items() if rows}
        if origins >= 3 and scores["Seasonal Naive"] < scores[model]:
            model = "Seasonal Naive"
        result["evaluation"] = {"status": "BACKTESTED" if origins >= 3 else "NOT_YET_VALIDATED", "valid_origins": origins,
                                "models": [{"name": name, "component_mae_heads": round(score, 2)} for name, score in scores.items()]}
    opening = current
    for lead in range(1, horizon + 1):
        components = expected if scenario else [max(0, int(round(v))) for v in predict_components(values, lead, model)]
        components = dict(zip(KINDS, components))
        closing = opening + components["registrations"] + components["births"] - components["sales"] - components["deaths"] - components["removals"]
        if closing < 0:
            result.update(status="INCONSISTENT_BALANCE", model=model, forecast=[],
                          message="Expected removals exceed available heads. Shorten the horizon or revise the assumptions; negative populations are not displayed.")
            return result
        end = today + relativedelta(months=lead)
        result["forecast"].append({"date": end.isoformat(), "period_start": (today + relativedelta(months=lead - 1)).isoformat(),
                                   "lead_months": lead, "month": end.strftime("%b %Y"), "opening": opening,
                                   **components, "heads": closing})
        opening = closing
    result.update(forecast_available=True, status="SCENARIO" if scenario else "AVAILABLE", model=model,
                  message="Monthly balance scenario using your entered counts, repeated each future month." if scenario else "Population balance estimates from recorded monthly additions and removals.")
    return result

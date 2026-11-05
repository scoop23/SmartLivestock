"""Permission-scoped comparison evidence calculated before optional AI prose."""
from datetime import date, timedelta


def change(metric, current, previous):
    return {
        "metric": metric, "current": current, "previous": previous,
        "difference": round(current - previous, 4),
        "percent_change": round((current - previous) / previous * 100, 2) if previous else None,
        "direction": "higher" if current > previous else "lower" if current < previous else "unchanged",
    }


def prior_period(period):
    start, end = date.fromisoformat(period["start"]), date.fromisoformat(period["end"])
    duration = (end - start).days
    label = period.get("label", "").lower()
    shift = 3 if "quarter" in label else 12 if "year" in label else 1 if "month" in label else None
    if shift and start.day == 1:
        index = start.year * 12 + start.month - 1 - shift
        previous_start = date(index // 12, index % 12 + 1, 1)
        previous_end = min(previous_start + timedelta(days=duration), start - timedelta(days=1))
    else:
        previous_end = start - timedelta(days=1)
        previous_start = previous_end - timedelta(days=duration)
    return {"start": previous_start.isoformat(), "end": previous_end.isoformat(), "label": "Previous comparable recorded period"}, (previous_end - previous_start).days == duration


def comparison_context(intent, parameters, rows, user, today, forecast=None):
    # Reuse the same scoped handlers and filters as the main answer. No raw
    # question, farmer identity, animal ID, or document enters this evidence.
    from . import nlp_query as queries
    if intent == "population_summary":
        by_species, *_ = queries._population_results({**parameters, "group_by": "species"}, user, today)
        total = sum(row["current_heads"] for row in by_species)
        return {
            "kind": "current_snapshot", "historical_comparison_available": False,
            "composition": [{"livestock_type": row["livestock_type"], "current_heads": row["current_heads"], "share_percent": round(row["current_heads"] / total * 100, 2) if total else None} for row in by_species],
            "limitation": "Current approved active inventory only. Category shares describe this snapshot, not population growth or reporting completeness.",
        }
    if intent == "forecast":
        values = [row["projected_value"] for row in rows if row.get("projected_value") is not None]
        return {
            "kind": "model_projection", "available": bool(values),
            "projected_periods": len(values),
            "projected_path": change("projected_value", values[-1], values[0]) if len(values) > 1 else None,
            "validated": bool(forecast and forecast.get("is_validated", forecast.get("validation_status") == "VALIDATED") and forecast.get("status") != "unvalidated"),
            "limitation": "Comparison is between supplied future estimates, not observed outcomes. An isolated estimate establishes no direction; no guaranteed result or new projection is implied.",
        }
    if not parameters.get("period"):
        return {"kind": "unavailable", "limitation": "No comparable reporting period was supplied."}
    period, equal_duration = prior_period(parameters["period"])
    previous_parameters = {**parameters, "period": period}
    context = {
        "kind": "recorded_period_comparison", "previous_period": period,
        "equal_elapsed_days": equal_duration, "metrics": [],
        "limitation": "Compares event dates using currently eligible records and identical permission scope and filters. Approval history and completeness of real-world reporting are not established. Absent observations are not evidence of no activity.",
    }
    if not equal_duration:
        context["limitation"] = "The previous calendar period is shorter than the selected elapsed period. A direct change comparison is withheld to avoid comparing unequal durations."
        return context
    if intent == "sales_summary":
        previous = queries._sales_summary(previous_parameters, user)
        if not rows or not previous:
            context["limitation"] = "Comparable priced sales observations are not available in both periods. Do not infer a change from absent records."
            return context
        current, before = rows[0], previous[0]
        context["metrics"].append(change("approved_sale_events", current["approved_sale_events"], before["approved_sale_events"]))
        context["current_all_priced"] = current["missing_price_events"] == 0
        context["previous_all_priced"] = before["missing_price_events"] == 0
        if current["priced_events"] and before["priced_events"]:
            context["metrics"].extend([
                change("known_sale_value_php", current["known_sale_value_php"], before["known_sale_value_php"]),
                change("mean_price_per_priced_event_php", current["known_sale_value_php"] / current["priced_events"], before["known_sale_value_php"] / before["priced_events"]),
            ])
        context["interpretation"] = "Describe value, volume, and average-price differences separately. Composition can change; these comparisons do not prove causes. Price completeness refers separately to each period."
        return context
    if intent in {"disease_by_barangay", "mortality_comparison"}:
        previous = (queries._disease_results if intent == "disease_by_barangay" else queries._mortality_results)(previous_parameters, user)
        keys = ["disease_cases", "affected_heads"] if intent == "disease_by_barangay" else ["deaths", "records"]
        if rows and previous:
            context["metrics"] = [change(key, sum(row.get(key, 0) for row in rows), sum(row.get(key, 0) for row in previous)) for key in keys]
        context["interpretation"] = "Compare recorded reports and animal counts separately. A change does not establish disease spread, disease risk, a mortality rate, or its cause."
        return context
    if intent in {"production_trend", "production_breakdown"}:
        current_rows, *_ = queries._production_results({**parameters, "intent": "production_breakdown", "group_by": "species"}, user)
        previous, *_ = queries._production_results({**previous_parameters, "intent": "production_breakdown", "group_by": "species"}, user)
        def grouped(items):
            totals = {}
            for item in items:
                key = (item.get("livestock_type", parameters.get("species") or "Selected species"), item.get("production_type", parameters.get("production_type") or "Selected product"), item["unit"])
                totals[key] = totals.get(key, 0) + item["quantity"]
            return totals
        current, before = grouped(current_rows), grouped(previous)
        context["metrics"] = [{**change("recorded_quantity", current[key], before[key]), "livestock_type": key[0], "production_type": key[1], "unit": key[2]} for key in current.keys() & before.keys()]
        context["interpretation"] = "Compare only matching product, species, and unit groups. Never combine incompatible units or describe recorded quantity as productivity without denominators."
        return context
    return {"kind": "unavailable", "limitation": "This intent has no supported comparison."}

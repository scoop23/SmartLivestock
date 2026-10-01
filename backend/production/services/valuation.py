"""Offline PSA valuation: compatible references with an explicit previous-period fallback."""
from decimal import Decimal, ROUND_HALF_UP
from production.models import PSACommodityMapping, PSAReferencePrice

BASIS = {"MILK": "MILK", "EGGS": "EGGS", "MEAT": "CARCASS", "WOOL": "WOOL"}


def snapshot_for(record, previous=None):
    source = record.livestock or record.batch
    if not source:
        return None
    identity = {"livestock_type_id": source.livestock_type_id, "production_type": record.production_type,
                "unit": record.unit, "quantity": str(record.quantity), "record_date": record.record_date.isoformat()}
    # A notes edit preserves its exact reference; changing a measurement intentionally revalues it.
    if previous and previous.get("input") == identity:
        return previous
    mapping = PSACommodityMapping.objects.filter(livestock_type_id=source.livestock_type_id,
        production_type=record.production_type, unit=record.unit, active=True).first()
    if not mapping:
        return None
    compatible = PSAReferencePrice.objects.filter(commodity_id=mapping.commodity_id,
        product_basis=BASIS.get(record.production_type), unit=record.unit, active=True,
        geographic_level="NATIONAL", geography="Philippines")
    matches = list(compatible.filter(period_start__lte=record.record_date,
        period_end__gte=record.record_date)[:2])
    price_match = "EXACT_PERIOD"
    if not matches:
        # Use the newest completed reference period, never a period after the event date.
        earlier = compatible.filter(period_end__lt=record.record_date).order_by("-period_end", "-period_start")
        latest = earlier.first()
        if latest:
            matches = list(earlier.filter(period_start=latest.period_start, period_end=latest.period_end)[:2])
            price_match = "PREVIOUS_PERIOD"
    # Conflicting active revisions remain unavailable instead of silently choosing a price.
    if len(matches) != 1:
        return None
    reference = matches[0]
    value = (record.quantity * reference.price).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return {"price_match": price_match, "pricing_policy": "EXACT_THEN_PREVIOUS_V1", "input": identity, "estimated_value": str(value), "currency": "PHP",
            "reference_id": reference.pk, "commodity_id": reference.commodity_id,
            "commodity": reference.commodity, "price": str(reference.price), "unit": reference.unit,
            "reference_period": reference.reference_period, "period_start": reference.period_start.isoformat(),
            "period_end": reference.period_end.isoformat(), "geographic_level": reference.geographic_level,
            "geography": reference.geography, "source": "Philippine Statistics Authority",
            "source_url": reference.source_url, "source_title": reference.source_title,
            "source_table": reference.source_table, "publication_status": reference.publication_status,
            "revision": reference.revision}

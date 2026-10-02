"""Small overview response, separate from detailed/historical record lists."""
from datetime import date
from django.db.models import Count, Sum
from django.db.models.functions import Coalesce
from django.utils import timezone
from diseases.models import DiseaseCase
from production.models import ProductionRecord, SlaughterRecord, LiveAnimalSale
from smartlivestock.workflows import scope_reviewer_queryset
from .population import population_summary


def overview_summary(*, user=None, today=None):
    today = today or timezone.localdate()
    start = date(today.year, today.month, 1)
    population = population_summary(user=user, today=today)
    def grouped(queryset, value, *, fallback=None):
        location_paths = ["livestock__farmer__barangay_id", "batch__farmer__barangay_id"]
        if fallback: location_paths.append(fallback)
        return dict(queryset.annotate(location=Coalesce(*location_paths)).values("location").annotate(value=value).values_list("location", "value"))
    milk = grouped(scope_reviewer_queryset(ProductionRecord.objects.all(), user).filter(
        status="APPROVED", production_type="MILK", unit="LITERS", record_date__range=(start, today)), Sum("quantity"))
    meat = grouped(scope_reviewer_queryset(SlaughterRecord.objects.all(), user).filter(
        status="APPROVED", record_date__range=(start, today)), Sum("carcass_weight"), fallback="barangay_id")
    pending = grouped(scope_reviewer_queryset(DiseaseCase.objects.all(), user).filter(
        status__in=("PENDING", "VERIFIED")), Count("pk"))
    for barangay in population["by_barangay"]:
        pk = barangay["barangay_id"]
        barangay.update(monthly_milk_l=float(milk.get(pk) or 0),
            monthly_meat_kg=float(meat.get(pk) or 0), pending_disease_reports=pending.get(pk, 0))
    # Historical approved sales preserve their event value even after animals exit.
    value = scope_reviewer_queryset(LiveAnimalSale.objects.all(), user).filter(
        status="APPROVED").aggregate(value=Sum("total_price"))["value"]
    return {"population": population, "period": today.strftime("%Y-%m"),
            "approved_sales_value": float(value) if value is not None else None}

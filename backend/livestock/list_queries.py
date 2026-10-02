"""Opt-in list pagination; existing array responses remain compatible."""
from django.db.models import Avg, Case, Count, F, IntegerField, Q, Sum, Value, When, CharField
from rest_framework.pagination import PageNumberPagination


class LivestockListPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100


def batch_list_annotations(queryset):
    # Count all children for review status, but only ACTIVE children for current heads.
    queryset = queryset.annotate(
        child_count=Count("animals"),
        active_animal_count=Count("animals", filter=Q(animals__operational_status="ACTIVE")),
        active_average_weight=Avg("animals__weight", filter=Q(animals__operational_status="ACTIVE")),
        approved_children=Count("animals", filter=Q(animals__status="APPROVED")),
        verified_children=Count("animals", filter=Q(animals__status="VERIFIED")),
        returned_children=Count("animals", filter=Q(animals__status="SUBJECT_TO_REVISION")),
    )
    return queryset.annotate(list_review_status=Case(
        When(child_count=0, then=Value("PENDING")),
        When(approved_children=F("child_count"), then=Value("APPROVED")),
        When(returned_children__gt=0, then=Value("SUBJECT_TO_REVISION")),
        When(verified_children=F("child_count"), then=Value("VERIFIED")),
        default=Value("PENDING"), output_field=CharField(),
    ))


def filter_livestock_list(queryset, params, *, batch=False):
    for parameter, field in (
        ("barangay_id", "farmer__barangay_id"), ("barangay", "farmer__barangay__barangay_name"),
        ("livestock_type", "livestock_type_id"), ("species", "livestock_type__name"), ("farmer", "farmer_id"),
    ):
        value = params.get(parameter)
        if value and value.upper() != "ALL":
            queryset = queryset.filter(**{field: value})
    if not batch:
        for parameter in ("status", "entry_type", "batch"):
            value = params.get(parameter)
            if value and value.upper() != "ALL":
                queryset = queryset.filter(**{parameter: value})
    else:
        value = params.get("review_status")
        if value and value.upper() != "ALL":
            queryset = queryset.filter(list_review_status=value)
    search = params.get("search", "").strip()
    if search:
        common = Q(farmer__user__first_name__icontains=search) | Q(farmer__user__last_name__icontains=search) | Q(farmer__user__username__icontains=search) | Q(farmer__barangay__barangay_name__icontains=search)
        if batch:
            # EXISTS avoids duplicating the herd or inflating counts when several tags match.
            from django.db.models import Exists, OuterRef
            from livestock.models import LivestockInventory
            matches = LivestockInventory.objects.filter(batch_id=OuterRef("pk"), tag_number__icontains=search)
            queryset = queryset.alias(tag_match=Exists(matches)).filter(common | Q(batch_code__icontains=search) | Q(batch_name__icontains=search) | Q(tag_match=True))
        else:
            queryset = queryset.filter(common | Q(tag_number__icontains=search) | Q(breed__icontains=search))
    return queryset


def inventory_management_page(inventories, batches, request):
    """Page the existing inventory-plus-herd management view without loading rosters."""
    from livestock.serializer import LivestockInventorySerializer, LivestockBatchListSerializer
    pager = LivestockListPagination()
    params = request.query_params.copy()
    params["review_status"] = params.get("status", "ALL")
    batches = filter_livestock_list(batch_list_annotations(batches), params, batch=True)
    animals = inventories.annotate(record_kind=Value("inventory"), admin_state=F("status")).values("created_at", "id", "record_kind", "admin_state").order_by()
    herds = batches.annotate(record_kind=Value("batch"), admin_state=F("list_review_status")).values("created_at", "id", "record_kind", "admin_state").order_by()
    # UNION keeps identifiers from both models distinct; paginate before serializing either model.
    rows = pager.paginate_queryset(animals.union(herds).order_by("-created_at", "record_kind", "-id"), request)
    animal_ids = [row["id"] for row in rows if row["record_kind"] == "inventory"]
    herd_ids = [row["id"] for row in rows if row["record_kind"] == "batch"]
    animal_data = LivestockInventorySerializer(inventories.filter(pk__in=animal_ids), many=True, context={"request": request}).data
    herd_data = LivestockBatchListSerializer(batches.filter(pk__in=herd_ids).select_related("livestock_type", "farmer__user", "farmer__barangay"), many=True, context={"request": request}).data
    lookup = {( "inventory", row["id"]): {**row, "record_kind": "inventory"} for row in animal_data}
    lookup.update({("batch", row["id"]): {**row, "record_kind": "batch"} for row in herd_data})
    response = pager.get_paginated_response([lookup[(row["record_kind"], row["id"])] for row in rows])
    stats = {state: Count("id", filter=Q(status=state)) for state in ("PENDING", "VERIFIED", "APPROVED", "SUBJECT_TO_REVISION")}
    animal_counts = inventories.aggregate(**stats)
    herd_counts = batches.aggregate(**{state: Count("id", filter=Q(list_review_status=state)) for state in stats})
    response.data["status_counts"] = {state: animal_counts[state] + herd_counts[state] for state in stats}
    return response

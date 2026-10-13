"""Opt-in list pagination; existing array responses remain compatible."""
from django.db.models import Avg, Case, CharField, Count, Exists, F, OuterRef, Q, Sum, Value, When
from rest_framework.pagination import PageNumberPagination


class LivestockListPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100


def batch_list_annotations(queryset):
    # A herd is only a container. These counts are summaries of its animals;
    # they never authorize a herd-wide review action.
    queryset = queryset.annotate(
        child_count=Count("animals", filter=Q(animals__entry_type="INDIVIDUAL")),
        active_animal_count=Count("animals", filter=Q(animals__entry_type="INDIVIDUAL", animals__operational_status="ACTIVE")),
        active_average_weight=Avg("animals__weight", filter=Q(animals__entry_type="INDIVIDUAL", animals__operational_status="ACTIVE")),
        pending_animal_count=Count("animals", filter=Q(animals__entry_type="INDIVIDUAL", animals__status="PENDING")),
        verified_animal_count=Count("animals", filter=Q(animals__entry_type="INDIVIDUAL", animals__status="VERIFIED")),
        approved_animal_count=Count("animals", filter=Q(animals__entry_type="INDIVIDUAL", animals__status="APPROVED")),
        revision_animal_count=Count("animals", filter=Q(animals__entry_type="INDIVIDUAL", animals__status__in=("SUBJECT_TO_REVISION", "SUBJECT_FOR_REVISION"))),
        rejected_animal_count=Count("animals", filter=Q(animals__entry_type="INDIVIDUAL", animals__status="REJECTED")),
    )
    return queryset.annotate(
        list_review_status=Case(
            When(child_count=0, then=Value("NO_ANIMALS")),
            When(approved_animal_count=F("child_count"), then=Value("APPROVED")),
            When(verified_animal_count=F("child_count"), then=Value("VERIFIED")),
            When(pending_animal_count=F("child_count"), then=Value("PENDING")),
            When(revision_animal_count=F("child_count"), then=Value("SUBJECT_TO_REVISION")),
            When(rejected_animal_count=F("child_count"), then=Value("REJECTED")),
            When(revision_animal_count__gt=0, then=Value("MIXED")),
            default=Value("MIXED"),
            output_field=CharField(),
        )
    )


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
            # Status filters find herds containing animals at that stage; the
            # herd itself is not a reviewable record. EXISTS avoids joining the
            # roster into the aggregate query and accidentally multiplying counts.
            from livestock.models import LivestockInventory
            matching_animals = LivestockInventory.objects.filter(
                batch_id=OuterRef("pk"),
                entry_type=LivestockInventory.EntryType.INDIVIDUAL,
                status=value,
            )
            queryset = queryset.alias(has_status_match=Exists(matching_animals)).filter(has_status_match=True)
    search = params.get("search", "").strip()
    if search:
        common = Q(farmer__user__first_name__icontains=search) | Q(farmer__user__last_name__icontains=search) | Q(farmer__user__username__icontains=search) | Q(farmer__barangay__barangay_name__icontains=search)
        if batch:
            # EXISTS avoids duplicating the herd or inflating counts when several tags match.
            from livestock.models import LivestockInventory
            matches = LivestockInventory.objects.filter(batch_id=OuterRef("pk"), entry_type="INDIVIDUAL", tag_number__icontains=search)
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
    individual_inventories = inventories.filter(entry_type="INDIVIDUAL")
    stats = {state: Count("id", filter=Q(status=state)) for state in ("PENDING", "VERIFIED", "APPROVED", "SUBJECT_TO_REVISION")}
    animal_counts = individual_inventories.aggregate(**stats)
    # KPI totals count livestock records only. Adding herd rows here would
    # count the same animals once as animals and again as their container.
    response.data["status_counts"] = animal_counts
    return response

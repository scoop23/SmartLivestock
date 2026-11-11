"""Map stored domain records to their canonical upload columns."""


def dataset_rows(dataset_type, config, headers):
    queryset = config.model_class.objects.order_by("pk")
    if dataset_type == "auction":
        queryset = queryset.select_related("livestock__farmer__user", "previous_owner__user", "new_owner__user", "livestock__livestock_type")
    elif dataset_type == "livestock_inventory":
        queryset = queryset.select_related("farmer__user", "farmer__barangay", "livestock_type")
    else:
        queryset = queryset.select_related("livestock__farmer__user", "livestock__farmer__barangay", "batch__farmer__user", "batch__farmer__barangay")
        if dataset_type == "slaughter":
            queryset = queryset.select_related("barangay", "livestock_type")

    for record in queryset.iterator(chunk_size=1000):
        animal = record if dataset_type == "livestock_inventory" else record.livestock
        batch = getattr(record, "batch", None)
        farmer = getattr(animal, "farmer", None) or getattr(batch, "farmer", None)
        barangay = getattr(record, "barangay", None) or getattr(farmer, "barangay", None)
        values = {field: getattr(record, field, "") for field in headers}
        # A username resolves unambiguously through the importer's farmer lookup.
        values["farmer"] = farmer.user.username if farmer else ""
        values["barangay"] = barangay.barangay_name if barangay else ""
        livestock_type = getattr(record, "livestock_type", None)
        if livestock_type:
            values["livestock_type"] = livestock_type.name
        values["tag_number"] = getattr(animal, "tag_number", "")
        if dataset_type == "livestock_inventory":
            values["sex"] = (record.sex or "").upper()
        elif dataset_type == "auction":
            values["external_seller_name"] = record.previous_owner.user.get_full_name() if record.previous_owner else record.external_seller_name
            values["external_owner_name"] = record.new_owner.user.get_full_name() if record.new_owner else record.external_owner_name
            values["external_livestock_type"] = animal.livestock_type.name if animal else record.external_livestock_type
        elif dataset_type == "disease":
            values["disease_name"] = record.name
        yield [values.get(field, "") for field in headers]

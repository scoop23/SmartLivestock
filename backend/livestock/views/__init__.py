from .inventory_views import (
    inventory_list_create,
    inventory_detail,
    review_inventory,
    list_livestock_types,
    get_barangays,
    get_farmer_by_barangays,
)
from .census_views import (
    census_list_create,
    census_detail,
    review_census_submission,
)
from .batch_views import (
    batch_list_create,
    batch_detail,
    batch_add_animals,
    batch_review,
    batch_add_notes,
)
from .ownership_views import (
    ownership_transfer_list_create,
    ownership_transfer_detail,
    review_ownership_transfer,
)

__all__ = [
    "inventory_list_create",
    "inventory_detail",
    "review_inventory",
    "list_livestock_types",
    "get_barangays",
    "get_farmer_by_barangays",
    "census_list_create",
    "census_detail",
    "review_census_submission",
    "batch_list_create",
    "batch_detail",
    "batch_add_animals",
    "batch_review",
    "batch_add_notes",
    "ownership_transfer_list_create",
    "ownership_transfer_detail",
    "review_ownership_transfer",
]

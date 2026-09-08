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
]

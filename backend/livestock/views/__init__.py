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
    batch_lookup,
    batch_detail,
    batch_add_animals,
    batch_review,
    batch_add_notes,
)
from .ownership_views import (
    ownership_transfer_list_create,
    ownership_transfer_detail,
    ownership_transfer_farmer_list,
    ownership_transfer_farmer_detail,
    ownership_transfer_farmer_livestock,
    review_ownership_transfer,
)
from .gate_views import gate_registration_list_create, gate_verification_list_create

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
    "batch_lookup",
    "batch_detail",
    "batch_add_animals",
    "batch_review",
    "batch_add_notes",
    "ownership_transfer_list_create",
    "ownership_transfer_detail",
    "ownership_transfer_farmer_list",
    "ownership_transfer_farmer_detail",
    "ownership_transfer_farmer_livestock",
    "review_ownership_transfer",
    "gate_registration_list_create",
    "gate_verification_list_create",
]
